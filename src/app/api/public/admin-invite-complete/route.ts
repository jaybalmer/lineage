import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { promoteGhostToAccount } from "@/lib/promote-ghost"

// POST /api/public/admin-invite-complete — node-claim-by-admin-invite.
//
// The authenticated tail of the admin-invite claim path, called by
// /auth/complete after a claimant clicks the invite magic link and signs up.
//
// On approval the PATCH /api/claim-requests/[id] branch stamped the node's
// invite_email with the claimant's email and flipped catalog -> unclaimed. Here
// we find the approved public_invite claim(s) for the verified session email,
// confirm the node still carries the matching invite_email, and fold it into the
// new account via promoteGhostToAccount.
//
// Why a dedicated route and not claim-complete? claim-complete enforces the
// 7-day hold via the node's paired tag_events, and a seeded legend node's tags
// are 'approved' (never 'pending'), so claim-complete would treat the node as
// not-live and skip it. An admin already approved this claim, so there is no
// abuse window to gate: we promote unconditionally. Run this BEFORE
// claim-complete in /auth/complete so the node is gone before that path looks.
//
// Security: the binding is the verified session email (the magic link proved
// inbox control) matched against the approved claim's claimant_email AND the
// node's invite_email. No client-supplied id is trusted.
//
// Idempotent: a second click finds the node already promoted (deleted) and
// resolves to { claimed: false } with a 200, never a 500.

export async function POST() {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  const email = user.email?.toLowerCase().trim()
  if (!email) {
    return NextResponse.json({ ok: true, claimed: false, reason: "no_email" })
  }

  const db = getServiceClient()

  const { data: claims, error: claimsErr } = await db
    .from("claim_requests")
    .select("id, node_id, claimant_email")
    .eq("claim_kind", "public_invite")
    .eq("status", "approved")
    .eq("claimant_email", email)
  if (claimsErr) {
    console.error("[admin-invite-complete] claim lookup failed:", claimsErr.message)
    return NextResponse.json({ error: "Could not complete your claim." }, { status: 500 })
  }
  if (!claims || claims.length === 0) {
    return NextResponse.json({ ok: true, claimed: false })
  }

  const placeholder = email.split("@")[0]
  let claimedAny = false

  for (const claim of claims as { id: string; node_id: string }[]) {
    const ghostId = claim.node_id

    // The node must still exist and carry the matching invite_email set on
    // approval. A missing node = already promoted (idempotent no-op). A
    // mismatched invite_email = a safety stop, never bind to the wrong node.
    const { data: node } = await db
      .from("people")
      .select("id, invite_email")
      .eq("id", ghostId)
      .maybeSingle()
    if (!node) continue
    if (((node as { invite_email: string | null }).invite_email ?? "").toLowerCase() !== email) {
      continue
    }

    // A seeded/tagged legend node can carry tag_events whose subject is this
    // node (a thin public-tag ghost never does, which is why claim-complete
    // needs none of this). subject_id is a text node ref (no FK, so the delete
    // is never blocked), but repoint it so any tags made AGAINST this node land
    // in the new owner's /me/tags inbox after the fold-in.
    await db.from("tag_events").update({ subject_id: user.id }).eq("subject_id", ghostId)

    const { claimed } = await promoteGhostToAccount(db, {
      ghostId,
      userId: user.id,
      placeholderName: placeholder,
    })
    if (claimed) claimedAny = true
  }

  return NextResponse.json({ ok: true, claimed: claimedAny })
}
