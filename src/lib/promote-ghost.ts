import type { SupabaseClient } from "@supabase/supabase-js"

interface GhostIdentity {
  display_name: string | null
  birth_year: number | null
  riding_since: number | null
  bio: string | null
  avatar_url: string | null
}

/**
 * Promote an unclaimed ghost/node into a real account: repoint the ghost's
 * claims and story_riders onto the account, restore the ghost's typed identity
 * onto the profile (name only over a blank or email placeholder, other fields
 * only when empty), leave a merged_from_id breadcrumb for old-URL redirects,
 * and delete the ghost.
 *
 * Extracted verbatim from the PB-010 Phase 4b claim-complete repoint block so
 * the public tag-to-claim completion and the admin-invite completion share one
 * promotion path. The CALLER decides whether promotion is allowed: the public
 * "I was there" path enforces the 7-day hold before calling this; the
 * admin-invite path skips the hold because an admin already approved. This
 * helper only performs the fold-in, never gates it.
 */
export async function promoteGhostToAccount(
  db: SupabaseClient,
  args: { ghostId: string; userId: string; placeholderName: string },
): Promise<{ claimed: boolean }> {
  const { ghostId, userId, placeholderName } = args
  const nowIso = new Date().toISOString()

  // Read the visitor's identity off the ghost before we delete it. The public
  // "I was there" form stored the typed name as people.display_name; a seeded
  // legend node carries the editorial name. Either way it is the name we restore.
  const { data: ghostRow } = await db
    .from("people")
    .select("display_name, birth_year, riding_since, bio, avatar_url")
    .eq("id", ghostId)
    .maybeSingle()
  const ghostIdentity = (ghostRow as GhostIdentity | null) ?? null

  // ── Repoint the ghost's data onto the real account (invite-claim parity) ──
  await db
    .from("claims")
    .update({ subject_id: userId })
    .eq("subject_id", ghostId)
    .eq("subject_type", "person")
  await db
    .from("claims")
    .update({ object_id: userId })
    .eq("object_id", ghostId)
    .eq("object_type", "person")
  await db.from("claims").update({ asserted_by: userId }).eq("asserted_by", ghostId)
  await db.from("story_riders").update({ rider_id: userId }).eq("rider_id", ghostId)

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
    .eq("id", userId)
    .maybeSingle()
  const profile = profRow as (GhostIdentity & { merged_from_id: string | null }) | null

  const profUpdate: Record<string, unknown> = {
    node_status: "claimed",
    claimed_at: nowIso,
  }
  if (!profile?.merged_from_id) profUpdate.merged_from_id = ghostId

  const nameIsPlaceholder =
    !profile?.display_name || profile.display_name === placeholderName
  if (nameIsPlaceholder && ghostIdentity?.display_name) profUpdate.display_name = ghostIdentity.display_name
  if (!profile?.birth_year && ghostIdentity?.birth_year) profUpdate.birth_year = ghostIdentity.birth_year
  if (!profile?.riding_since && ghostIdentity?.riding_since) profUpdate.riding_since = ghostIdentity.riding_since
  if (!profile?.bio && ghostIdentity?.bio) profUpdate.bio = ghostIdentity.bio
  if (!profile?.avatar_url && ghostIdentity?.avatar_url) profUpdate.avatar_url = ghostIdentity.avatar_url

  await db.from("profiles").update(profUpdate).eq("id", userId)

  // The ghost has served its purpose — remove it so it no longer shows as a
  // separate unclaimed node.
  await db.from("people").delete().eq("id", ghostId)
  return { claimed: true }
}
