// Board-claim relationship helpers (owned_board claims only).
//
// A board on a rider's timeline can be "rode" (they rode it), "own" (it is in
// their collection), or "both". The two states are surfaced in the UI as two
// independent toggles ("Rode it" / "In my collection"); this module maps between
// those toggles and the stored `board_relationship` value, and centralises the
// label / filter rules used by the add flow and the board shelf.
//
// Pure module (no React, no "use client") so the API validation and both server
// and client components can import it.

import type { BoardRelationship } from "@/types"

export type BoardShelfFilter = "all" | "rode" | "collection"

/** Map the two independent toggles to a stored value. Null when neither is set (cannot save). */
export function toBoardRelationship(rode: boolean, own: boolean): BoardRelationship | null {
  if (rode && own) return "both"
  if (rode) return "rode"
  if (own) return "own"
  return null
}

/** Expand a stored value to the two toggle booleans. Null / unknown grandfathers to "rode". */
export function boardRelationshipFlags(rel: BoardRelationship | null | undefined): { rode: boolean; own: boolean } {
  if (rel === "own") return { rode: false, own: true }
  if (rel === "both") return { rode: true, own: true }
  return { rode: true, own: false } // "rode" + grandfathered NULL
}

/** Normalise any input (incl. null) to a concrete relationship; NULL becomes "rode". */
export function normalizeBoardRelationship(rel: BoardRelationship | null | undefined): BoardRelationship {
  const { rode, own } = boardRelationshipFlags(rel)
  return toBoardRelationship(rode, own) ?? "rode"
}

/** Merge two relationships (used to collapse multiple claim rows for one board). */
export function mergeBoardRelationships(
  a: BoardRelationship | null | undefined,
  b: BoardRelationship | null | undefined,
): BoardRelationship {
  const fa = boardRelationshipFlags(a)
  const fb = boardRelationshipFlags(b)
  return toBoardRelationship(fa.rode || fb.rode, fa.own || fb.own) ?? "rode"
}

/** Does a board with this relationship belong under the given sub-toggle? */
export function matchesBoardFilter(rel: BoardRelationship | null | undefined, filter: BoardShelfFilter): boolean {
  if (filter === "all") return true
  const { rode, own } = boardRelationshipFlags(rel)
  return filter === "rode" ? rode : own
}

/** Badge labels for a relationship: "Rode", "Collection", or both. */
export function boardRelationshipBadges(rel: BoardRelationship | null | undefined): ("Rode" | "Collection")[] {
  const { rode, own } = boardRelationshipFlags(rel)
  const out: ("Rode" | "Collection")[] = []
  if (rode) out.push("Rode")
  if (own) out.push("Collection")
  return out
}

/**
 * Relationship-aware label for the optional claim year.
 * rode / both -> "Rode {year}" (riding is the stronger signal), own -> "Got it {year}".
 */
export function boardYearLabel(rel: BoardRelationship | null | undefined, year: string | number): string {
  const { rode } = boardRelationshipFlags(rel)
  return rode ? `Rode ${year}` : `Got it ${year}`
}
