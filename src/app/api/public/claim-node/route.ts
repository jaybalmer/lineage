import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"
import { verificationTierFor, vouchesRequiredForTier } from "@/lib/claim-request-helpers"
import { claimRequestAdminHtml, claimRequestAdminText, sendClaimEmail } from "@/lib/emails/claim-emails"
import {
  hashVisitorValue,
  getClientIp,
  isVisitorBlocked,
  checkTagThrottle,
  recordTagThrottle,
} from "@/lib/public-tag"
import type { Person } from "@/types"

// POST /api/public/claim-node — node-claim-by-admin-invite.
//
// The email-first, admin-confirmed claim path. A NOT-logged-in visitor on a
// person node (in-app /people/[id] or a node reference on /t/[slug]) says
// "that's me": we capture their email, drop a claim_kind='public_invite' row
// into the existing /admin/claims queue, and email the admin. The admin confirms
// identity and approves; approval sends the claimant an invite magic link that
// creates their account and folds the node in at signup (see the approve branch
// in /api/claim-requests/[id] + promoteGhostToAccount).
//
// Unauthenticated by design. There is no merge_person here and no vouch surface
// (an anonymous email has no claimant profile); the admin is the identity gate.
// Reuses the PB-010 Phase 4a abuse guards (public-tag), scoped to the node id.

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "jay@lineage.community"

function trackEvent(origin: string, event: string, props: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const nodeId = typeof body.node_id === "string" ? body.node_id.trim() : ""
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null
  const source = body.source === "public_timeline" ? "public_timeline" : "person_page"

  if (!nodeId) {
    return NextResponse.json({ error: "node_id is required" }, { status: 400 })
  }
  if (!emailRaw || !emailRaw.includes("@") || emailRaw.length < 3) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }

  const db = getServiceClient()

  // Resolve the node + its claim count (for the tier) in parallel.
  const [personRes, claimCountRes] = await Promise.all([
    db
      .from("people")
      .select("id, display_name, node_status, is_notable, is_deceased")
      .eq("id", nodeId)
      .maybeSingle(),
    // Read through claims_public so declined tags don't inflate the tier count
    // (PB-009 parity with the member claim path).
    db.from("claims_public").select("*", { count: "exact", head: true }).eq("subject_id", nodeId),
  ])

  const person = personRes.data as Pick<
    Person,
    "id" | "display_name" | "node_status" | "is_notable" | "is_deceased"
  > | null
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }
  // Same guard as the member path (VF2): only catalog/unclaimed nodes are claimable.
  if (person.node_status !== "catalog" && person.node_status !== "unclaimed") {
    return NextResponse.json(
      { error: "This profile is no longer accepting claim requests" },
      { status: 409 },
    )
  }

  // Abuse gate, scoped to the node id (the throttle's owner/scope key).
  const emailHash = hashVisitorValue(emailRaw)
  const ipHash = hashVisitorValue(getClientIp(req))
  if (await isVisitorBlocked(db, { emailHash, ipHash, ownerId: nodeId })) {
    return NextResponse.json(
      { error: "We could not process that right now.", reason: "blocked" },
      { status: 429 },
    )
  }
  const throttled = await checkTagThrottle(db, { emailHash, ipHash, ownerId: nodeId })
  if (throttled) {
    return NextResponse.json(
      { error: "You have submitted a lot of claims today. Try again tomorrow.", reason: "rate_limited" },
      { status: 429 },
    )
  }

  // D6: one open email claim per (node, email).
  const { data: existing } = await db
    .from("claim_requests")
    .select("id")
    .eq("node_id", nodeId)
    .eq("claim_kind", "public_invite")
    .eq("claimant_email", emailRaw)
    .in("status", ["pending", "vouched"])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: "You already have an open claim on this profile with that email" },
      { status: 409 },
    )
  }

  const claimCount = claimCountRes.count ?? 0
  const tier = verificationTierFor(person, claimCount)
  const vouchesRequired = vouchesRequiredForTier(tier)
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString()

  const { data: inserted, error: insertError } = await db
    .from("claim_requests")
    .insert({
      claim_kind: "public_invite",
      claimant_id: null,
      claimant_email: emailRaw,
      node_id: nodeId,
      verification_tier: tier,
      status: "pending",
      // Stored for consistency; vouches do not apply to public_invite claims (D5).
      vouches_required: vouchesRequired,
      vouches_received: [],
      evidence_notes: note,
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    console.error("[claim-node POST] insert failed:", insertError)
    return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 })
  }

  // Count this submission against the daily limits now that it has landed.
  await recordTagThrottle(db, { emailHash, ipHash, ownerId: nodeId })

  const origin = req.headers.get("origin") ?? req.nextUrl.origin

  // D7: notify the admin per-claim, on submit (every tier is approve-first), so
  // an approval never sits silently. Fire-and-forget; never fail the request.
  void sendClaimEmail({
    to: ADMIN_NOTIFY_EMAIL,
    subject: `New claim on ${person.display_name} to review`,
    html: claimRequestAdminHtml({
      personName: person.display_name,
      claimantEmail: emailRaw,
      tier,
      note,
      reviewLink: `${origin}/admin/claims`,
    }),
    text: claimRequestAdminText({
      personName: person.display_name,
      claimantEmail: emailRaw,
      tier,
      note,
      reviewLink: `${origin}/admin/claims`,
    }),
  })

  trackEvent(origin, "claim_node_requested", {
    claim_request_id: inserted.id,
    node_id: nodeId,
    verification_tier: tier,
    source,
  })

  return NextResponse.json({ ok: true })
}
