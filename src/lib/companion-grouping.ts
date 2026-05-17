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
 * (around line 504) for the RLS reasoning.
 *
 * The shape is correct at the data layer but produces N+1 timeline cards when
 * we really want one. This pass folds the companion `rode_with` rows into the
 * matching `rode_at` row, keyed by (subject_id, start_date, end_date), so the
 * timeline renders a single card with a companion chip list.
 *
 * Grouping rules:
 * - Both claims must have a start_date. Year-only dates are fine.
 * - The `rode_with` rolls into the `rode_at` only when exactly one `rode_at`
 *   matches the key. If the asserter logged two `rode_at` rows on the same
 *   date (e.g. year-only Aspen 2003 and Vail 2003 with the same companions),
 *   we leave the rows alone rather than guess which trip they belong to.
 * - Standalone `rode_with` claims with no matching `rode_at` are untouched
 *   and continue to render as their own cards.
 */
export function groupRodeAtCompanions(claims: Claim[]): GroupedClaims {
  const rodeAtByKey = new Map<string, Claim[]>()
  for (const c of claims) {
    if (c.predicate !== "rode_at" || !c.start_date) continue
    const key = `${c.subject_id}|${c.start_date}|${c.end_date ?? ""}`
    const list = rodeAtByKey.get(key)
    if (list) list.push(c)
    else rodeAtByKey.set(key, [c])
  }

  const companionMap: CompanionMap = new Map()
  const absorbed = new Set<string>()

  for (const c of claims) {
    if (c.predicate !== "rode_with" || !c.start_date) continue
    const key = `${c.subject_id}|${c.start_date}|${c.end_date ?? ""}`
    const matches = rodeAtByKey.get(key)
    if (!matches || matches.length !== 1) continue
    const target = matches[0]
    const list = companionMap.get(target.id)
    if (list) list.push(c.object_id)
    else companionMap.set(target.id, [c.object_id])
    absorbed.add(c.id)
  }

  if (absorbed.size === 0) {
    return { claims, companionMap }
  }

  return {
    claims: claims.filter((c) => !absorbed.has(c.id)),
    companionMap,
  }
}
