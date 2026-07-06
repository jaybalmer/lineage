import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { claimVouchedHtml, claimVouchedText, sendClaimEmail } from "@/lib/emails/claim-emails"
import type { ClaimRequest, Vouch } from "@/types"

const RELATIONSHIPS = ["rode_with", "worked_with", "family", "other"] as const
type Relationship = (typeof RELATIONSHIPS)[number]

function isRelationship(v: unknown): v is Relationship {
  return typeof v === "string" && (RELATIONSHIPS as readonly string[]).includes(v)
}

function trackEvent(origin: string, event: string, props: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

function trackError(origin: string, tag: string, payload: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-error`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag, payload }),
  }).catch(() => {})
}

// ── POST /api/claim-requests/[id]/vouch ───────────────────────────────────────
// Body: { relationship: Relationship, note?: string }
//
// Atomicity:
//   1. Pre-check (SELECT) catches the common conflict cases with friendly
//      400/409 codes for UX. It is NOT a correctness check.
//   2. The UPDATE uses compare-and-swap on `updated_at`: we write only if
//      the row's updated_at still matches the value we read. Postgres
//      serialises UPDATEs on the same row via row locks under READ COMMITTED,
//      so a concurrent vouch cannot interleave — the loser sees the new
//      updated_at, matches 0 rows, and we return 409 to the client.
//   3. The append + threshold flip + status_reason write happen in the same
//      UPDATE statement, so they are inseparable.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  const origin = req.headers.get("origin") ?? req.nextUrl.origin

  let body: { relationship?: unknown; note?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isRelationship(body.relationship)) {
    return NextResponse.json(
      { error: "relationship must be one of: rode_with, worked_with, family, other" },
      { status: 400 },
    )
  }

  const note = typeof body.note === "string" && body.note.trim().length > 0
    ? body.note.trim()
    : null

  const db = getServiceClient()

  // ── Pre-check ──
  const { data: existing, error: fetchError } = await db
    .from("claim_requests")
    .select("id, claimant_id, status, vouches_received, vouches_required, expires_at, node_id, updated_at")
    .eq("id", id)
    .maybeSingle()

  if (fetchError) {
    console.error("[vouch] fetch failed:", fetchError)
    return NextResponse.json({ error: "Failed to load claim request" }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 })
  }

  const current = existing as Pick<
    ClaimRequest,
    "id" | "claimant_id" | "status" | "vouches_received" | "vouches_required" | "expires_at" | "node_id" | "updated_at"
  >

  if (current.status !== "pending" && current.status !== "vouched") {
    return NextResponse.json(
      { error: "This claim is no longer accepting vouches" },
      { status: 409 },
    )
  }
  if (new Date(current.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This claim has expired" }, { status: 409 })
  }
  if (current.claimant_id === user.id) {
    trackError(origin, "vouch_self_target", { claim_request_id: id, voucher_id: user.id })
    return NextResponse.json(
      { error: "You cannot vouch for your own claim" },
      { status: 400 },
    )
  }
  const already = (current.vouches_received ?? []).some((v) => v.voucher_id === user.id)
  if (already) {
    trackError(origin, "vouch_duplicate", { claim_request_id: id, voucher_id: user.id })
    return NextResponse.json(
      { error: "You have already vouched for this claim" },
      { status: 409 },
    )
  }

  // ── Atomic compare-and-swap UPDATE ──
  const newVouch: Vouch = {
    voucher_id: user.id,
    relationship: body.relationship,
    note,
    created_at: new Date().toISOString(),
  }
  const nextVouches = [...(current.vouches_received ?? []), newVouch]
  const willFlip =
    current.status === "pending" && nextVouches.length >= current.vouches_required

  const { data: updated, error: updateError } = await db
    .from("claim_requests")
    .update({
      vouches_received: nextVouches,
      status: willFlip ? "vouched" : current.status,
      status_reason: willFlip ? "vouch_threshold_met" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("updated_at", current.updated_at) // CAS guard
    .select("*")
    .single()

  if (updateError || !updated) {
    trackError(origin, "vouch_append_race_condition", {
      claim_request_id: id,
      voucher_id: user.id,
      reason: updateError?.message ?? "no row matched compare-and-swap",
    })
    return NextResponse.json(
      { error: "A simultaneous vouch was recorded; please retry" },
      { status: 409 },
    )
  }

  const vouchCount = Array.isArray(updated.vouches_received) ? updated.vouches_received.length : 0

  trackEvent(origin, "vouch_added", {
    claim_request_id: id,
    voucher_id: user.id,
    relationship: newVouch.relationship,
    vouch_count: vouchCount,
    threshold_met: willFlip,
  })

  if (willFlip) {
    trackEvent(origin, "claim_status_changed", {
      claim_request_id: id,
      from: "pending",
      to: "vouched",
      reason: "vouch_threshold_met",
    })

    // Vouches only apply to member claims (public_invite never reaches the vouch
    // surface, D5), so claimant_id is set here; ?? "" keeps TS happy on the now
    // nullable column.
    const [{ data: claimantUser }, { data: person }] = await Promise.all([
      db.auth.admin.getUserById(current.claimant_id ?? ""),
      db.from("people").select("display_name").eq("id", current.node_id).maybeSingle(),
    ])
    const email = claimantUser.user?.email
    const personName = person?.display_name ?? "your profile"
    if (email) {
      void sendClaimEmail({
        to: email,
        subject: `Your claim on ${personName} is ready for review`,
        html: claimVouchedHtml(personName, current.vouches_required),
        text: claimVouchedText(personName, current.vouches_required),
      })
    }
  }

  return NextResponse.json({
    status: updated.status,
    vouch_count: vouchCount,
  })
}
