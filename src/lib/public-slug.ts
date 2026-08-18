// PB-010 Phase 1: public-timeline slug helper (server-side)
//
// public_slug is the first stored slug column for a profile (person links were
// derived from display_name on the fly until now; see src/lib/entity-links.ts).
// This module is the one place that derives a unique public_slug, so both the
// one-time backfill and Phase 2's "enable public timeline" toggle call it and
// can never drift apart.
//
// The collision rule mirrors the person-link rule in entity-links.ts: a bare
// name slug is only safe when it is unique, so on collision we append a short,
// stable suffix taken from the profile id (rather than the whole id, which
// would make for an ugly URL). The suffix is deterministic, so re-running is
// idempotent for a given profile.

import type { SupabaseClient } from "@supabase/supabase-js"
import { nameToSlug } from "./utils"

// FNRad Featured Timelines Phase 1: the /t/{slug} public-link namespace is shared
// across profiles, orgs (shows), and events (episodes), so one shareable shape
// (linestry.com/t/{slug}) serves people, shows, and episodes and no two owners
// can collide. The minter below checks every table in this namespace.
export type PublicSlugOwnerType = "profile" | "org" | "event"

const OWNER_TABLE: Record<PublicSlugOwnerType, string> = {
  profile: "profiles",
  org: "orgs",
  event: "events",
}

/** The base public slug for a display name, e.g. "Jay Balmer" -> "jay_balmer".
 *  Returns "" when the name has no slug-able characters (the caller falls back
 *  to an id-derived slug). Thin wrapper over nameToSlug so the slug rule lives
 *  in exactly one place. */
export function basePublicSlug(displayName: string | null | undefined): string {
  return nameToSlug(displayName ?? "")
}

/** A short, URL-clean, stable suffix derived from a profile id. For a uuid this
 *  is the first 8 hex chars; for a legacy non-uuid id it is the first 8
 *  alphanumerics. Used to disambiguate colliding name slugs. */
function shortIdSuffix(profileId: string): string {
  const cleaned = (profileId ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase()
  return cleaned.slice(0, 8) || "x"
}

/** True when `slug` is already used by any owner in the shared namespace
 *  (profiles, orgs, events), excluding the owner being minted for. Each table's
 *  partial unique index on public_slug guarantees at most one row per table, so
 *  maybeSingle is safe per table.
 *
 *  A slug reserved in public_slug_aliases (an outgoing slug kept resolvable for
 *  already-shared links; BUG-159) also counts as taken, so a re-minted slug is
 *  never handed to a different owner and old links keep redirecting. An alias
 *  owned by THIS same owner is reclaimable (a rename back to a former name),
 *  so it is not treated as taken for that owner. */
async function slugTaken(
  client: SupabaseClient,
  slug: string,
  ownerType: PublicSlugOwnerType,
  ownerId: string,
): Promise<boolean> {
  for (const type of Object.keys(OWNER_TABLE) as PublicSlugOwnerType[]) {
    let query = client.from(OWNER_TABLE[type]).select("id").eq("public_slug", slug)
    // Only the same-table same-id row is "self"; a row in another table with the
    // same id (ids are not unique across tables) is still a real collision.
    if (type === ownerType) query = query.neq("id", ownerId)
    const { data } = await query.maybeSingle()
    if (data !== null) return true
  }

  const { data: alias } = await client
    .from("public_slug_aliases")
    .select("owner_type, owner_id")
    .eq("slug", slug)
    .maybeSingle()
  if (alias && !(alias.owner_type === ownerType && alias.owner_id === ownerId)) return true

  return false
}

/** The fallback slug prefix when a name has no slug-able characters, per owner
 *  type, so an id-derived URL still reads sensibly. */
const FALLBACK_PREFIX: Record<PublicSlugOwnerType, string> = {
  profile: "rider",
  org: "show",
  event: "episode",
}

/** Derive a unique public_slug for an owner (profile, org, or event),
 *  collision-safe across the entire shared /t/{slug} namespace. Returns the slug
 *  to store; does NOT write it (the caller decides when to persist, so this is
 *  reusable by the profile backfill and by the Phase 2/3 "enable public link"
 *  toggles). `ownerType` defaults to 'profile' so existing profile callers are
 *  unchanged.
 *
 *  Order: the bare name slug when free; else name slug + short id suffix; else
 *  (vanishingly rare) progressively longer id suffixes; else the id suffix
 *  alone when the name has no slug-able characters. */
export async function ensureUniquePublicSlug(
  displayName: string | null | undefined,
  ownerId: string,
  client: SupabaseClient,
  ownerType: PublicSlugOwnerType = "profile",
): Promise<string> {
  const base = basePublicSlug(displayName)
  const suffix = shortIdSuffix(ownerId)
  const fallback = FALLBACK_PREFIX[ownerType]

  // Candidates in preference order. An empty base (name had no slug-able
  // characters) skips straight to the id-derived forms.
  const candidates = base
    ? [base, `${base}_${suffix}`]
    : [`${fallback}_${suffix}`]

  for (const candidate of candidates) {
    if (!(await slugTaken(client, candidate, ownerType, ownerId))) return candidate
  }

  // Extremely unlikely fall-through (two owners share both a name slug and the
  // same 8-char id prefix). Widen the suffix until unique.
  const wideBase = base || fallback
  const fullId = (ownerId ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase() || "x"
  for (let len = 9; len <= fullId.length; len++) {
    const candidate = `${wideBase}_${fullId.slice(0, len)}`
    if (!(await slugTaken(client, candidate, ownerType, ownerId))) return candidate
  }

  // Last resort: the whole sanitized id. Guaranteed unique by construction.
  return `${wideBase}_${fullId}`
}

/** Re-mint an owner's public_slug to match a changed display name (BUG-159).
 *
 *  public_slug is minted once on first enable and then frozen, so a member who
 *  renamed keeps a Stack URL that reads as their old name while their timeline
 *  URL follows the new one. Call this after writing a new display_name.
 *
 *  Behaviour:
 *   - No-op (returns the current slug) when the owner has no slug yet (nothing to
 *     resync; the enable path mints on first enable), or when the freshly derived
 *     slug equals the current one (a rename that does not change the slug).
 *   - Otherwise reserves the outgoing slug in public_slug_aliases so links already
 *     shared keep resolving, then updates the owner row to the new slug. If the
 *     new slug was itself a prior alias of this owner (a rename back), that alias
 *     row is removed so no alias ever collides with a live slug.
 *
 *  Retries once on the partial-unique-index violation (23505), mirroring the
 *  enable path, in case a concurrent mint grabbed the derived slug. Returns the
 *  slug now stored on the owner row. */
export async function resyncPublicSlug(
  ownerType: PublicSlugOwnerType,
  ownerId: string,
  displayName: string | null | undefined,
  client: SupabaseClient,
): Promise<string | null> {
  const table = OWNER_TABLE[ownerType]
  const { data: cur } = await client
    .from(table)
    .select("public_slug")
    .eq("id", ownerId)
    .maybeSingle()
  const currentSlug: string | null =
    (cur as { public_slug: string | null } | null)?.public_slug ?? null

  // Nothing minted yet: the enable path is responsible for the first slug.
  if (!currentSlug) return null

  for (let attempt = 0; attempt < 2; attempt++) {
    const desired = await ensureUniquePublicSlug(displayName, ownerId, client, ownerType)
    if (desired === currentSlug) return currentSlug

    // Keep the outgoing slug resolvable for links already shared.
    await client
      .from("public_slug_aliases")
      .upsert(
        { slug: currentSlug, owner_type: ownerType, owner_id: ownerId },
        { onConflict: "slug" },
      )
    // If the new slug was a prior alias of this owner, promote it back to live so
    // it never sits in both the live column and the alias table at once.
    await client.from("public_slug_aliases").delete().eq("slug", desired)

    const { error } = await client
      .from(table)
      .update({ public_slug: desired })
      .eq("id", ownerId)
    if (!error) return desired
    if (error.code !== "23505" || attempt === 1) throw new Error(error.message)
    // 23505: a concurrent mint took `desired` between the check and the write;
    // loop re-derives, which now finds it taken and appends the id suffix.
  }

  return currentSlug
}

/** Resolve a /t/ slug that missed every live lookup to the owner's CURRENT slug
 *  via the alias table, so an old shared link 308-redirects instead of 404ing
 *  (BUG-159). Returns the current canonical slug (guaranteed different from the
 *  input), or null when the slug is not an alias or the owner has no live slug. */
export async function resolvePublicSlugAlias(
  slug: string,
  client: SupabaseClient,
): Promise<string | null> {
  const { data: alias } = await client
    .from("public_slug_aliases")
    .select("owner_type, owner_id")
    .eq("slug", slug)
    .maybeSingle()
  if (!alias) return null

  const table = OWNER_TABLE[alias.owner_type as PublicSlugOwnerType]
  if (!table) return null

  const { data: owner } = await client
    .from(table)
    .select("public_slug")
    .eq("id", alias.owner_id)
    .maybeSingle()
  const current = (owner as { public_slug: string | null } | null)?.public_slug ?? null
  if (!current || current === slug) return null
  return current
}
