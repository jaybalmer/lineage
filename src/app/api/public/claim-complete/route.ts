import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// POST /api/public/claim-complete — PB-010 Phase 4b. The authenticated tail of
// the public tag-to-claim growth loop.
//
// A visitor tapped "I was there" on someone's public timeline (Phase 4a). That
// minted an invite-shaped ghost (`people.node_status='unclaimed'`,
// `invite_email`), wrote their implied claim (`subject = ghost`) plus a paired
// `tag_event` (subject = the timeline owner, status `pending`,
// `anonymous_aggregate`), and emailed a magic link. When they click it they
// sign in and `/auth/complete` calls this route to finish the claim.
//
// Promotion mirrors the proven invite-claim path (see /auth/complete): repoint
// the ghost's claims onto the real account, restore the visitor's typed identity
// onto the profile (name first, other fields only when empty), leave a
// `merged_from_id` breadcrumb for old-URL redirects, and delete the ghost. We
// also flip the paired tag_events from anonymous + pending to attributed +
// approved now that a real account stands behind them.
//
// Why not merge_person? That RPC keys its canonical lookup on a `people` row
// with `claimed_by` = the caller, but a brand-new signup has only a `profiles`
// row, so merge_person would claim-in-place and strand the claim on a leftover
// ghost node that never surfaces on the member's (subject = auth id) timeline.
// The invite-style repoint keeps the profile canonical and is the proven path.
//
// Security: the binding is the authenticated email. The magic link verified it,
// and we only ever promote a ghost whose `invite_email` matches the session
// email. No client-supplied id is trusted, so there is no tampering surface.
//
// Idempotent + graceful: a second click (ghost already gone), an expired hold,
// or a normal signup with no pending tag all resolve to `{ claimed: false }`
// with a 200, never a 500.

interface GhostIdentity {
  display_name: string | null
  birth_year: number | null
  riding_since: number | null
  bio: string | null
  avatar_url: string | null
}

export async function POST() {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  const email = user.email?.toLowerCase().trim()
  if (!email) {
    // No verified email on the session — nothing to bind a claim to.
    return NextResponse.json({ ok: true, claimed: false, reason: "no_email" })
  }

  const db = getServiceClient()

  // ── Find this visitor's unclaimed ghost(s) by verified email ────────────────
  // 4a upserts ONE unclaimed ghost per visitor email (invite_email stored
  // lowercase); the loop below defensively covers an unexpected multi-row case.
  const { data: ghosts, error: ghostErr } = await db
    .from("people")
    .select("id")
    .eq("invite_email", email)
    .eq("node_status", "unclaimed")
  if (ghostErr) {
    console.error("[claim-complete] ghost lookup failed:", ghostErr.message)
    return NextResponse.json({ error: "Could not complete your claim." }, { status: 500 })
  }
  if (!ghosts || ghosts.length === 0) {
    // Normal signup with no pending tag, or already promoted. No-op.
    return NextResponse.json({ ok: true, claimed: false })
  }

  const nowIso = new Date().toISOString()
  // The email-derived name onboarding falls back to when the typed name is lost
  // (user.email.split("@")[0]). Only that exact placeholder, or a blank, is safe
  // to overwrite on the profile; a real onboarding name is never clobbered.
  const placeholder = email.split("@")[0]
  let claimedAny = false
  let sawLiveGhost = false

  for (const ghost of ghosts as { id: string }[]) {
    const ghostId = ghost.id

    // The ghost's claims (subject = ghost) and the tag_event FK'd to each.
    const { data: ghostClaims } = await db
      .from("claims")
      .select("id, tag_event_id")
      .eq("subject_id", ghostId)
    const tagEventIds = (ghostClaims ?? [])
      .map((c) => (c as { tag_event_id: string | null }).tag_event_id)
      .filter((v): v is string => !!v)

    // Enforce the 7-day hold. A tag with no paired event is grandfathered-live
    // (claims_public treats tag_event_id IS NULL as visible). Otherwise the
    // ghost is live only while at least one paired tag is still pending and
    // unexpired. Flip those live tags to attributed/approved.
    let live = tagEventIds.length === 0
    if (tagEventIds.length > 0) {
      const { data: tagEvents } = await db
        .from("tag_events")
        .select("id, expires_at, status")
        .in("id", tagEventIds)
      const liveTagIds = ((tagEvents ?? []) as { id: string; expires_at: string | null; status: string }[])
        .filter((t) => t.status === "pending" && (!t.expires_at || t.expires_at > nowIso))
        .map((t) => t.id)
      live = liveTagIds.length > 0
      if (liveTagIds.length > 0) {
        await db
          .from("tag_events")
          .update({
            status: "approved",
            display_state: "attributed",
            asserter_id: user.id,
            decision_at: nowIso,
          })
          .in("id", liveTagIds)
      }
    }

    if (!live) continue // expired hold for this ghost — leave it owner-moderatable
    sawLiveGhost = true

    // Read the visitor's identity off the ghost before we delete it. The public
    // "I was there" form stored the name they typed as people.display_name (POST
    // /api/public/tag); a cross-device signup loses onboarding.display_name, so
    // this ghost is the only place that typed name still survives.
    const { data: ghostRow } = await db
      .from("people")
      .select("display_name, birth_year, riding_since, bio, avatar_url")
      .eq("id", ghostId)
      .maybeSingle()
    const ghostIdentity = (ghostRow as GhostIdentity | null) ?? null

    // ── Repoint the ghost's data onto the real account (invite-claim parity) ──
    await db
      .from("claims")
      .update({ subject_id: user.id })
      .eq("subject_id", ghostId)
      .eq("subject_type", "person")
    await db
      .from("claims")
      .update({ object_id: user.id })
      .eq("object_id", ghostId)
      .eq("object_type", "person")
    await db.from("claims").update({ asserted_by: user.id }).eq("asserted_by", ghostId)
    await db.from("story_riders").update({ rider_id: user.id }).eq("rider_id", ghostId)

    // ── Restore the visitor's identity onto the profile (invite-claim parity) ──
    // Name: overwrite only a blank or email-placeholder name, never a real name
    // the user typed during onboarding. Other fields: fill only when the
    // profile's is empty, so we never clobber values the member set themselves.
    // Redirect breadcrumb: profiles.merged_from_id feeds the proxy's alias map
    // (person-redirects.ts). Only set it if the account hasn't already absorbed
    // another record, so we never clobber an existing alias.
    const { data: profRow } = await db
      .from("profiles")
      .select("display_name, birth_year, riding_since, bio, avatar_url, merged_from_id")
      .eq("id", user.id)
      .maybeSingle()
    const profile = profRow as (GhostIdentity & { merged_from_id: string | null }) | null

    const profUpdate: Record<string, unknown> = {
      node_status: "claimed",
      claimed_at: nowIso,
    }
    if (!profile?.merged_from_id) profUpdate.merged_from_id = ghostId

    const nameIsPlaceholder =
      !profile?.display_name || profile.display_name === placeholder
    if (nameIsPlaceholder && ghostIdentity?.display_name) profUpdate.display_name = ghostIdentity.display_name
    if (!profile?.birth_year && ghostIdentity?.birth_year) profUpdate.birth_year = ghostIdentity.birth_year
    if (!profile?.riding_since && ghostIdentity?.riding_since) profUpdate.riding_since = ghostIdentity.riding_since
    if (!profile?.bio && ghostIdentity?.bio) profUpdate.bio = ghostIdentity.bio
    if (!profile?.avatar_url && ghostIdentity?.avatar_url) profUpdate.avatar_url = ghostIdentity.avatar_url

    await db.from("profiles").update(profUpdate).eq("id", user.id)

    // The ghost has served its purpose — remove it so it no longer shows as a
    // separate unclaimed node.
    await db.from("people").delete().eq("id", ghostId)
    claimedAny = true
  }

  return NextResponse.json({
    ok: true,
    claimed: claimedAny,
    ...(!claimedAny && !sawLiveGhost ? { reason: "expired" } : {}),
  })
}
