// Shared validation vocabulary for the /api/claims route family.
// Extracted from the POST handler so PATCH/DELETE in [id]/route.ts apply
// exactly the same field rules. Keep these in sync with the Claim interface
// in src/types/index.ts and the predicate list in CLAUDE.md.

export const PREDICATES = new Set([
  "rode_at", "worked_at", "sponsored_by", "part_of_team", "fan_of",
  "rode_with", "shot_by", "competed_at", "spectated_at", "organized_at",
  "owned_board", "coached_by", "organized", "located_at",
])
export const ENTITY_TYPES = new Set(["person", "place", "org", "board", "event"])
export const CONFIDENCE = new Set(["self-reported", "corroborated", "documented", "partner-verified"])
export const VISIBILITY = new Set(["private", "shared", "public"])

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t || t.length > max) return null
  return t
}

export function optStr(v: unknown, max: number): string | null {
  if (v === undefined || v === null || v === "") return null
  return str(v, max)
}
