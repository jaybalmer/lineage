import type { SupabaseClient } from "@supabase/supabase-js"

interface GhostIdentity {
  display_name: string | null
  birth_year: number | null
  riding_since: number | null
  bio: string | null
  avatar_url: string | null
}

/**
 * Promote an unclaimed ghost/node into a real account: fold the ghost's entire
 * reference graph onto the account, restore the ghost's typed identity onto the
 * profile (name only over a blank or email placeholder, other fields only when
 * empty), and delete the ghost.
 *
 * The fold-in itself is delegated to the public.merge_person_into RPC
 * (canonical_kind='profiles'), which is the single, schema-current repoint list
 * shared with the admin merge path. That RPC repoints EVERY person-referencing
 * column (not just claims + story_riders), deduplicates composite-key rows,
 * writes person_slug_aliases + a merge_log snapshot, sets the canonical's
 * merged_from_id breadcrumb, and hard-deletes the ghost, all in one transaction.
 * Before this delegation these paths repointed only 4 of ~20 columns and dropped
 * the rest on the ghost delete (BUG-179 follow-up 1, Defect 2).
 *
 * The RPC does not know about the visitor's typed identity, so this helper keeps
 * the identity-restore step: read the ghost's fields before the fold, then apply
 * them to the profile afterwards. The CALLER decides whether promotion is
 * allowed (the public "I was there" path enforces the 7-day hold; the
 * admin-invite path skips it); this helper only performs the fold-in.
 *
 * Never throws: the RPC is transactional, so on any failure nothing changed and
 * we report { claimed: false }, preserving the callers' never-500 contract.
 */
export async function promoteGhostToAccount(
  db: SupabaseClient,
  args: { ghostId: string; userId: string; placeholderName: string; note?: string },
): Promise<{ claimed: boolean; display_name: string | null }> {
  const { ghostId, userId, placeholderName, note } = args
  const nowIso = new Date().toISOString()

  // Read the visitor's identity off the ghost BEFORE the fold deletes it. The
  // public "I was there" form stored the typed name as people.display_name; a
  // seeded legend node carries the editorial name. Either way it is the name we
  // restore.
  const { data: ghostRow } = await db
    .from("people")
    .select("display_name, birth_year, riding_since, bio, avatar_url")
    .eq("id", ghostId)
    .maybeSingle()
  const ghostIdentity = (ghostRow as GhostIdentity | null) ?? null

  // ── Fold the ghost into the account via the shared repoint list ─────────────
  // canonical_kind='profiles': the account lives in profiles, not people. Not a
  // dry run. p_admin_id is the account itself (self-claim attribution in
  // merge_log). The RPC also stamps profiles.merged_from_id = ghost.
  const { error: mergeErr } = await db.rpc("merge_person_into", {
    p_ghost_id: ghostId,
    p_canonical_id: userId,
    p_canonical_kind: "profiles",
    p_admin_id: userId,
    p_dry_run: false,
    p_note: note ?? "promote_ghost",
  })
  if (mergeErr) {
    // Transactional: nothing was repointed or deleted. Report not-claimed rather
    // than 500 so a stale/missing/already-folded ghost degrades gracefully.
    console.error("[promoteGhostToAccount] merge_person_into failed", {
      ghostId,
      userId,
      error: mergeErr.message,
    })
    return { claimed: false, display_name: null }
  }

  // ── Restore the visitor's identity onto the profile ─────────────────────────
  // Name: overwrite only a blank or email-placeholder name, never a real name
  // the user typed during onboarding. Other fields: fill only when the profile's
  // is empty, so we never clobber values the member set themselves. merged_from_id
  // is already set by the RPC, so it is not touched here.
  const { data: profRow } = await db
    .from("profiles")
    .select("display_name, birth_year, riding_since, bio, avatar_url")
    .eq("id", userId)
    .maybeSingle()
  const profile = profRow as GhostIdentity | null

  const profUpdate: Record<string, unknown> = {
    node_status: "claimed",
    claimed_at: nowIso,
  }

  const nameIsPlaceholder =
    !profile?.display_name || profile.display_name === placeholderName
  if (nameIsPlaceholder && ghostIdentity?.display_name) profUpdate.display_name = ghostIdentity.display_name
  if (!profile?.birth_year && ghostIdentity?.birth_year) profUpdate.birth_year = ghostIdentity.birth_year
  if (!profile?.riding_since && ghostIdentity?.riding_since) profUpdate.riding_since = ghostIdentity.riding_since
  if (!profile?.bio && ghostIdentity?.bio) profUpdate.bio = ghostIdentity.bio
  if (!profile?.avatar_url && ghostIdentity?.avatar_url) profUpdate.avatar_url = ghostIdentity.avatar_url

  await db.from("profiles").update(profUpdate).eq("id", userId)

  const displayName =
    (profUpdate.display_name as string | undefined) ?? profile?.display_name ?? null
  return { claimed: true, display_name: displayName }
}
