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
 *  maybeSingle is safe per table. */
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
