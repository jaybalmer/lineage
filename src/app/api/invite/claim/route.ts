import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// POST /api/invite/claim — the authenticated tail of the email-invite flow.
//
// Someone invited this person by email (see POST /api/invite): that minted a
// `people` ghost (node_status='unclaimed', invite_email set) plus an `invites`
// row holding the token, person_id, and email, and the inviter's claims point at
// the ghost. When the invitee clicks the magic link they sign in and
// /auth/complete calls this route to finish the claim.
//
// Why server-side + email-keyed? The old merge lived inline in /auth/complete
// and read the invite token out of localStorage / sessionStorage. That storage
// does NOT survive the email round-trip — a magic link opens in a new tab (empty
// sessionStorage) or on a different device (empty localStorage) — so the merge
// silently no-opped and the brand-new profile kept its email-derived placeholder
// name (the "John Stewart -> johnstew777" bug). Binding to the *verified* session
// email works no matter where the link is opened. A stored token is still
// honored when the client managed to keep one (same-browser, or a signup under a
// different email than the invite was addressed to).
//
// Promotion mirrors the proven invite / public-claim repoint: move the ghost's
// claims and story_riders onto the real account, restore the invited identity
// onto the profile (name first, other fields only when empty), leave a
// merged_from_id breadcrumb for old-URL redirects, mark the invite claimed, and
// delete the ghost.
//
// Ordering note: /auth/complete calls this BEFORE /api/public/claim-complete.
// Both can match a ghost by verified email, but this route deletes the
// email-invite ghost first, so claim-complete (which only handles public "I was
// there" ghosts — those have invite_email but no invites row) never double-
// processes it.
//
// Idempotent + graceful: no matching invite, an already-claimed invite, or a
// normal signup with no invite all resolve to { claimed: false } with a 200,
// never a 500.

interface GhostIdentity {
  display_name: string | null
  birth_year: number | null
  riding_since: number | null
  bio: string | null
  avatar_url: string | null
}

interface InviteRow {
  id: string
  person_id: string | null
  claimed_at: string | null
  email: string | null
}

export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  let token: string | null = null
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string }
    token = body?.token?.trim() || null
  } catch {
    /* no/!json body — email binding still applies */
  }

  const email = user.email?.toLowerCase().trim() || null
  const db = getServiceClient()
  const nowIso = new Date().toISOString()

  // ── Resolve the invite: explicit token first, else by verified email ────────
  let invite: InviteRow | null = null

  if (token) {
    const { data } = await db
      .from("invites")
      .select("id, person_id, claimed_at, email")
      .eq("id", token)
      .maybeSingle()
    invite = (data as InviteRow | null) ?? null
  }

  if (!invite && email) {
    // Most-recent unclaimed invite addressed to this verified email. Emails are
    // stored lowercase by POST /api/invite, mirroring claim-complete's lookup.
    const { data } = await db
      .from("invites")
      .select("id, person_id, claimed_at, email")
      .eq("email", email)
      .is("claimed_at", null)
      .order("expires_at", { ascending: false })
      .limit(1)
    invite = ((data as InviteRow[] | null) ?? [])[0] ?? null
  }

  if (!invite || !invite.person_id) {
    return NextResponse.json({ ok: true, claimed: false })
  }
  if (invite.claimed_at) {
    return NextResponse.json({ ok: true, claimed: false, reason: "already_claimed" })
  }

  const oldId = invite.person_id

  // Never let an account claim itself (defensive: token reuse, or a re-invite of
  // someone who is already a member). Still mark the invite resolved.
  if (oldId === user.id) {
    await db.from("invites").update({ claimed_at: nowIso, claimed_by: user.id }).eq("id", invite.id)
    return NextResponse.json({ ok: true, claimed: false, reason: "self" })
  }

  // ── Read the invited identity off the ghost before we delete it ─────────────
  const { data: ghostRow } = await db
    .from("people")
    .select("display_name, birth_year, riding_since, bio, avatar_url")
    .eq("id", oldId)
    .maybeSingle()
  const ghost = (ghostRow as GhostIdentity | null) ?? null

  // ── Repoint the ghost's data onto the real account (invite-claim parity) ────
  await db
    .from("claims")
    .update({ subject_id: user.id })
    .eq("subject_id", oldId)
    .eq("subject_type", "person")
  await db
    .from("claims")
    .update({ object_id: user.id })
    .eq("object_id", oldId)
    .eq("object_type", "person")
  await db.from("claims").update({ asserted_by: user.id }).eq("asserted_by", oldId)
  await db.from("story_riders").update({ rider_id: user.id }).eq("rider_id", oldId)

  // ── Restore the invited identity onto the profile ───────────────────────────
  // Name: overwrite only a blank or email-placeholder name — never a real name
  // the user typed during onboarding. Other fields: fill only when the profile's
  // is empty, so we never clobber values the member set themselves.
  const placeholder = email ? email.split("@")[0] : null
  const { data: profRow } = await db
    .from("profiles")
    .select("display_name, birth_year, riding_since, bio, avatar_url, merged_from_id")
    .eq("id", user.id)
    .maybeSingle()
  const profile = profRow as (GhostIdentity & { merged_from_id: string | null }) | null

  const update: Record<string, unknown> = {
    node_status: "claimed",
    claimed_at: nowIso,
  }
  // Only set the breadcrumb if the account hasn't already absorbed another node.
  if (!profile?.merged_from_id) update.merged_from_id = oldId

  const nameIsPlaceholder =
    !profile?.display_name || (placeholder !== null && profile.display_name === placeholder)
  if (nameIsPlaceholder && ghost?.display_name) update.display_name = ghost.display_name
  if (!profile?.birth_year && ghost?.birth_year) update.birth_year = ghost.birth_year
  if (!profile?.riding_since && ghost?.riding_since) update.riding_since = ghost.riding_since
  if (!profile?.bio && ghost?.bio) update.bio = ghost.bio
  if (!profile?.avatar_url && ghost?.avatar_url) update.avatar_url = ghost.avatar_url

  await db.from("profiles").update(update).eq("id", user.id)

  // ── Mark the invite claimed and retire the ghost ────────────────────────────
  await db.from("invites").update({ claimed_at: nowIso, claimed_by: user.id }).eq("id", invite.id)
  await db.from("people").delete().eq("id", oldId)

  return NextResponse.json({
    ok: true,
    claimed: true,
    display_name: (update.display_name as string | undefined) ?? profile?.display_name ?? null,
  })
}
