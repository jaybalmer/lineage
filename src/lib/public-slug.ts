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

/** True when `slug` is already used by a different profile. The partial unique
 *  index on profiles.public_slug guarantees at most one row, so maybeSingle is
 *  safe. */
async function slugTaken(
  client: SupabaseClient,
  slug: string,
  exceptProfileId: string,
): Promise<boolean> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("public_slug", slug)
    .neq("id", exceptProfileId)
    .maybeSingle()
  return data !== null
}

/** Derive a unique public_slug for a profile, collision-safe against the live
 *  profiles table. Returns the slug to store; does NOT write it (the caller
 *  decides when to persist, so this is reusable by the backfill and by Phase 2).
 *
 *  Order: the bare name slug when free; else name slug + short id suffix; else
 *  (vanishingly rare) progressively longer id suffixes; else the id suffix
 *  alone when the name has no slug-able characters. */
export async function ensureUniquePublicSlug(
  displayName: string | null | undefined,
  profileId: string,
  client: SupabaseClient,
): Promise<string> {
  const base = basePublicSlug(displayName)
  const suffix = shortIdSuffix(profileId)

  // Candidates in preference order. An empty base (name had no slug-able
  // characters) skips straight to the id-derived forms.
  const candidates = base
    ? [base, `${base}_${suffix}`]
    : [`rider_${suffix}`]

  for (const candidate of candidates) {
    if (!(await slugTaken(client, candidate, profileId))) return candidate
  }

  // Extremely unlikely fall-through (two profiles share both a name slug and
  // the same 8-char id prefix). Widen the suffix until unique.
  const wideBase = base || "rider"
  const fullId = (profileId ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase() || "x"
  for (let len = 9; len <= fullId.length; len++) {
    const candidate = `${wideBase}_${fullId.slice(0, len)}`
    if (!(await slugTaken(client, candidate, profileId))) return candidate
  }

  // Last resort: the whole sanitized id. Guaranteed unique by construction.
  return `${wideBase}_${fullId}`
}
