import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { nameToSlug } from "@/lib/utils"
import {
  claimApprovedHtml,
  claimDeniedHtml,
  sendClaimEmail,
} from "@/lib/emails/claim-emails"
import type { ClaimRequest } from "@/types"

function trackEvent(origin: string, event: string, props: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

type Action =
  | { action: "approve" }
  | { action: "deny" }
  | { action: "update_notes"; editor_notes: string | null }

function parseAction(body: unknown): Action | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  if (b.action === "approve") return { action: "approve" }
  if (b.action === "deny") return { action: "deny" }
  if (b.action === "update_notes") {
    const n = b.editor_notes
    if (n === null || typeof n === "string") {
      return { action: "update_notes", editor_notes: n }
    }
  }
  return null
}

// ── PATCH /api/claim-requests/[id] ────────────────────────────────────────────
// Admin-only. Body is one of:
//   { action: "approve" }
//   { action: "deny" }
//   { action: "update_notes", editor_notes: string | null }
//
// Approve / deny stub:
//   - Flips status, writes resolved_at, resolved_by, status_reason.
//   - Does NOT touch people.node_status / claimed_by — that lives in
//     Session 3's merge handler so all people-level state changes go through
//     a single auditable path (merge_log).
//   - On approve: writes any required person_slug_aliases rows mirroring
//     Session 1 conventions, then revalidateTag("person-redirects", { expire: 0 })
//     so middleware sees the new aliases on the very next request. Next 16
//     deprecated the single-arg form; { expire: 0 } is the immediate-expiry
//     pattern the docs recommend for "external trigger, refresh now" cases.
//     updateTag would be the Server-Action-only equivalent.
//   - Emails the claimant on approve / deny.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response: authResponse } = await requireEditor()
  if (authResponse) return authResponse

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const action = parseAction(raw)
  if (!action) {
    return NextResponse.json(
      { error: "action must be one of: approve, deny, update_notes" },
      { status: 400 },
    )
  }

  const db = getServiceClient()

  const { data: existing, error: fetchError } = await db
    .from("claim_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) {
    console.error("[admin claim PATCH] fetch failed:", fetchError)
    return NextResponse.json({ error: "Failed to load claim request" }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 })
  }

  const current = existing as ClaimRequest
  const origin = req.headers.get("origin") ?? req.nextUrl.origin
  const nowIso = new Date().toISOString()

  // ── update_notes is a simple field write; no transition ──
  if (action.action === "update_notes") {
    const { data: updated, error } = await db
      .from("claim_requests")
      .update({
        editor_notes: action.editor_notes,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .single()
    if (error || !updated) {
      console.error("[admin claim PATCH update_notes]", error)
      return NextResponse.json({ error: "Failed to update notes" }, { status: 500 })
    }
    return NextResponse.json(updated)
  }

  // ── approve / deny: status transition ──
  if (current.status !== "pending" && current.status !== "vouched") {
    return NextResponse.json(
      { error: `Claim is already ${current.status}; cannot ${action.action}` },
      { status: 409 },
    )
  }

  const newStatus = action.action === "approve" ? "approved" : "denied"
  const statusReason = action.action === "approve" ? "editor_approved" : "editor_denied"

  const { data: updated, error: updateError } = await db
    .from("claim_requests")
    .update({
      status: newStatus,
      status_reason: statusReason,
      resolved_at: nowIso,
      resolved_by: user.id,
      updated_at: nowIso,
    })
    .eq("id", id)
    .eq("status", current.status) // race guard against another editor
    .select("*")
    .single()

  if (updateError || !updated) {
    console.error("[admin claim PATCH transition]", updateError)
    return NextResponse.json(
      { error: "Status changed in another session; please refresh" },
      { status: 409 },
    )
  }

  // ── Emit alias rows + cache bust on approve ──
  if (action.action === "approve") {
    try {
      const [{ data: person }, { data: claimant }] = await Promise.all([
        db.from("people").select("display_name").eq("id", current.node_id).maybeSingle(),
        db.from("profiles").select("display_name").eq("id", current.claimant_id).maybeSingle(),
      ])
      const personName = person?.display_name ?? ""
      const claimantName = claimant?.display_name ?? ""
      const oldSlug = personName ? nameToSlug(personName) : ""
      const newSlug = claimantName ? nameToSlug(claimantName) : oldSlug

      // Session 2 only flips claim status; Session 3 will perform the
      // people-row updates that produce a real slug change. Until then
      // oldSlug === newSlug for almost every row, so the upsert is a
      // no-op write. We still call revalidateTag to keep the cache in sync.
      if (oldSlug && oldSlug !== newSlug) {
        await db.from("person_slug_aliases").upsert({
          alias: oldSlug,
          person_id: current.node_id,
          reason: "reslugged",
        })
      }
    } catch (err) {
      console.error("[admin claim PATCH] alias write failed:", err)
    }
    revalidateTag("person-redirects", { expire: 0 })
  }

  // ── Email claimant + track ──
  trackEvent(origin, "claim_status_changed", {
    claim_request_id: id,
    from: current.status,
    to: newStatus,
    reason: statusReason,
  })

  try {
    const [{ data: claimantUser }, { data: person }] = await Promise.all([
      db.auth.admin.getUserById(current.claimant_id),
      db.from("people").select("display_name").eq("id", current.node_id).maybeSingle(),
    ])
    const email = claimantUser.user?.email
    const personName = person?.display_name ?? "your profile"

    if (email && action.action === "approve") {
      const profileLink = `${origin}/people/${nameToSlug(personName) || current.node_id}`
      void sendClaimEmail({
        to: email,
        subject: `Your claim was approved`,
        html: claimApprovedHtml(personName, profileLink),
      })
    } else if (email && action.action === "deny") {
      void sendClaimEmail({
        to: email,
        subject: `About your claim on ${personName}`,
        html: claimDeniedHtml(personName, updated.editor_notes ?? null),
      })
    }
  } catch (err) {
    console.error("[admin claim PATCH] email/lookup failed:", err)
  }

  return NextResponse.json(updated)
}
