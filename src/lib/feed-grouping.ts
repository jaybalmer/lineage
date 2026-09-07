import type { Claim, Predicate } from "@/types"

// BUG-076: fold a run of one member's claims posted on the same day into a single
// feed card, so the feed reads as stories with claims as context rather than a
// wall of one-line claim cards. Runs on the post-companion-fold claim set (see
// companion-grouping.ts) so a rode_at that already absorbed its rode_with
// companions counts once here.
//
// Grouping key: the member who ADDED the claims (asserted_by) + the subject
// person whose timeline they landed on + the calendar day the claims were added
// (created_at), in the viewer's local time. BUG-183: keying on asserted_by (not
// subject_id) is what makes the grouped card read as "MEMBER added X to
// SUBJECT's timeline" truthfully; keeping subject_id in the key means every
// group is single-subject, so that sentence is always unambiguous. This is a
// "added X" summary, so it only makes sense in the Recently-added sort; the feed
// page skips this pass in Date-happened mode, where event chronology is the
// point. Claims with no parseable created_at, or no asserter, never group.

export const CLAIM_GROUP_THRESHOLD = 3

type ClaimFamily = "place" | "board" | "event" | "connection" | "entry"

function familyOf(predicate: Predicate): ClaimFamily {
  switch (predicate) {
    case "rode_at":
      return "place"
    case "owned_board":
      return "board"
    case "competed_at":
    case "spectated_at":
    case "organized_at":
    case "organized":
      return "event"
    case "rode_with":
      return "connection"
    default:
      return "entry"
  }
}

// Ordered so the summary always reads places, then boards, then events, then
// connections, then the catch-all, regardless of claim order in the group.
const FAMILY_ORDER: ClaimFamily[] = ["place", "board", "event", "connection", "entry"]

const FAMILY_NOUN: Record<ClaimFamily, [singular: string, plural: string]> = {
  place: ["place", "places"],
  board: ["board", "boards"],
  event: ["event", "events"],
  connection: ["connection", "connections"],
  entry: ["entry", "entries"],
}

// "4 places" / "4 places and 2 boards" / "4 places, 2 boards and 1 event".
// No Oxford comma, no em dashes.
function joinParts(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/**
 * The type summary that sits in a group card header, e.g. "4 places and 2
 * boards". Counts by family and renders in FAMILY_ORDER so mixed sessions read
 * consistently.
 */
export function summarizeClaimTypes(claims: Claim[]): string {
  const counts = new Map<ClaimFamily, number>()
  for (const c of claims) {
    const f = familyOf(c.predicate)
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  const parts = FAMILY_ORDER.flatMap((f) => {
    const n = counts.get(f)
    if (!n) return []
    const [singular, plural] = FAMILY_NOUN[f]
    return [`${n} ${n === 1 ? singular : plural}`]
  })
  return joinParts(parts)
}

// Local calendar day of a created_at timestamp. Returns "" for a missing or
// unparseable value so the caller can leave that claim ungrouped.
function dayKey(iso: string | undefined | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export interface ClaimDayGroups {
  // Every claim id that belongs to a kept group (>= threshold).
  groupedIds: Set<string>
  // Anchor claim id (the first of its group in the input order) -> the group's
  // claims, in input order. The feed renders one group card at the anchor's
  // position and skips the rest.
  anchorToClaims: Map<string, Claim[]>
}

/**
 * Fold an ORDERED claim list (already sorted the way the feed will render, and
 * already companion-folded) into per-author-per-day groups of `threshold` or
 * more. The first claim of each kept group in the input order is its anchor, so
 * a group renders where its newest member would have sat.
 */
export function groupClaimsByAuthorDay(
  orderedClaims: Claim[],
  threshold: number = CLAIM_GROUP_THRESHOLD,
): ClaimDayGroups {
  const buckets = new Map<string, Claim[]>()
  for (const c of orderedClaims) {
    const day = dayKey(c.created_at)
    // No asserter means we cannot attribute the group to a member, so leave
    // those claims ungrouped (they render as individual, "A rider" cards).
    if (!day || !c.asserted_by) continue
    const key = `${c.asserted_by}|${c.subject_id}|${day}`
    const list = buckets.get(key)
    if (list) list.push(c)
    else buckets.set(key, [c])
  }

  const groupedIds = new Set<string>()
  const anchorToClaims = new Map<string, Claim[]>()
  for (const list of buckets.values()) {
    if (list.length < threshold) continue
    for (const c of list) groupedIds.add(c.id)
    anchorToClaims.set(list[0].id, list)
  }

  return { groupedIds, anchorToClaims }
}
