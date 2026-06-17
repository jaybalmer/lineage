import type { Claim } from "@/types"

export type CompanionMap = Map<string, string[]>

interface GroupedClaims {
  claims: Claim[]
  companionMap: CompanionMap
}

/**
 * AddClaimModal writes a `rode_at` claim plus N parallel `rode_with` claims
 * (one per tagged companion) so that every row keeps the asserter as the
 * subject and clears the claims RLS. See the comment in add-claim-modal.tsx
 * for the RLS reasoning.
 *
 * The shape is correct at the data layer but produces N+1 timeline cards when
 * we really want one. This pass folds the per-ride companion `rode_with` rows
 * into their matching `rode_at` row so the timeline renders a single card with
 * a companion chip list.
 *
 * Grouping rules (BUG-066):
 * - Primary: a companion `rode_with` carries `parent_claim_id` pointing at its
 *   `rode_at`. Fold by that explicit link. This is exact and immune to the
 *   year-only date collision that used to leak companions as standalone cards
 *   (two place visits in the same year share the key `subject|2026|`).
 * - Crew rows: a standalone / crew `rode_with` has `parent_claim_id = NULL` and
 *   is the one-card-per-pair relationship row. It must NOT fold; it renders as
 *   its own card (with a year range). A pair that already has a parented
 *   companion fold is therefore excluded from the legacy fallback below.
 * - Legacy fallback: rows written before parent_claim_id existed have NULL
 *   parent. For those, fall back to the old date-key fold, but only when
 *   exactly one `rode_at` matches and the (subject, object) pair has no
 *   parented fold (so a real crew row is never absorbed). When two `rode_at`
 *   rows share the key we leave the row alone rather than guess.
 */
export function groupRodeAtCompanions(claims: Claim[]): GroupedClaims {
  const rodeAtById = new Map<string, Claim>()
  const rodeAtByKey = new Map<string, Claim[]>()
  for (const c of claims) {
    if (c.predicate !== "rode_at" || !c.start_date) continue
    rodeAtById.set(c.id, c)
    const key = `${c.subject_id}|${c.start_date}|${c.end_date ?? ""}`
    const list = rodeAtByKey.get(key)
    if (list) list.push(c)
    else rodeAtByKey.set(key, [c])
  }

  const companionMap: CompanionMap = new Map()
  const absorbed = new Set<string>()
  // (subject|object) pairs that already folded via an explicit parent link.
  // Their NULL-parent rows are crew relationships and must stay standalone.
  const parentedPairs = new Set<string>()

  const addCompanion = (target: Claim, c: Claim) => {
    const list = companionMap.get(target.id)
    if (list) list.push(c.object_id)
    else companionMap.set(target.id, [c.object_id])
    absorbed.add(c.id)
  }

  // Pass 1: fold parented companions by their explicit parent_claim_id link.
  for (const c of claims) {
    if (c.predicate !== "rode_with" || !c.parent_claim_id) continue
    const target = rodeAtById.get(c.parent_claim_id)
    if (!target) continue
    addCompanion(target, c)
    parentedPairs.add(`${c.subject_id}|${c.object_id}`)
  }

  // Pass 2: legacy fallback for NULL-parent companion rows (un-backfilled).
  for (const c of claims) {
    if (c.predicate !== "rode_with" || c.parent_claim_id || !c.start_date) continue
    if (parentedPairs.has(`${c.subject_id}|${c.object_id}`)) continue
    const matches = rodeAtByKey.get(`${c.subject_id}|${c.start_date}|${c.end_date ?? ""}`)
    if (!matches || matches.length !== 1) continue
    addCompanion(matches[0], c)
  }

  if (absorbed.size === 0) {
    return { claims, companionMap }
  }

  return {
    claims: claims.filter((c) => !absorbed.has(c.id)),
    companionMap,
  }
}
