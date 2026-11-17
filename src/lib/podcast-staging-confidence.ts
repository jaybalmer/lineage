// Podcast archive staging: confidence pass (auto-approve).
//
// Pure rules that decide which pending nodes and stories are safe to approve
// without a person looking at each one, so manual review shrinks to the risky
// remainder. Client-safe and dependency-light, like podcast-staging.ts.
//
// Approving here is NOT publishing. A mention reaches the catalog only when an
// editor runs Publish on its episode, and every approval can still be undone
// (Restore / Reset) until then. The rules are deliberately conservative: when a
// signal is missing or mixed, the item stays pending with a reason.
//
// Node rules (all must hold):
//   * untouched: still pending, never decided or edited by a person
//   * approvable: approveBlocker() is null (matched to a catalog row, or new
//     with every NOT NULL column it needs)
//   * no catalog_duplicate or weak_candidate flag
//   * heard directly at least once (not all_inferred), and at least half of its
//     mentions heard directly unless it shows up in 3 or more episodes
//   * in at least one story that is not trimmed
//   * a person needs a full name (two or more name tokens): a first name alone
//     ("Brett", "Crystal") cannot be told apart from every other Brett
//   * a NEW node seen once (one mention, one episode) needs its name heard
//     exactly as written; a seed-side spelling fix on a one-off is a guess
//   * no near twin: another live staging node of the same type whose key is a
//     close spelling ("Shawn Farmer" / "Sean Farmer") would mint a duplicate
//
// Story rules (all must hold):
//   * untouched: still pending, never decided by a person, no pending revision
//   * at least one kept mention heard directly (not only inferred names)
//   * excerpt long enough to stand on its own (120+ characters)
//   * no sensitive keyword in the title or excerpt (the FNRad sensitive parks
//     default to trimmed; anything that smells like one is left for a person)

import { SPELLING_RATIO, approveBlocker, similarity, stagingTokens } from "@/lib/podcast-staging"
import type { NodeDecision, NodeFlag, NodeResolution, StagingGhost, StagingSubjectType, StoryDecision } from "@/lib/podcast-staging"

// ── nodes ───────────────────────────────────────────────────────────────────

export type ConfidenceNode = {
  id: string
  subject_type: StagingSubjectType
  name: string
  normalized_name: string
  resolution: NodeResolution
  subject_id: string | null
  ghost: StagingGhost | null
  heard_as: string[] | null
  flags: NodeFlag[] | null
  decision: NodeDecision
  merged_into: string | null
  decided_by: string | null
  // from podcast_staging_node_stats
  episode_count: number
  mention_count: number
  inferred_count: number
  kept_story_count: number
}

export type NodeHoldReason =
  | "touched"
  | "not_resolved"
  | "catalog_flag"
  | "inferred"
  | "mostly_inferred"
  | "no_kept_story"
  | "first_name_only"
  | "one_off_respelled"
  | "near_twin"

export const NODE_HOLD_LABEL: Record<NodeHoldReason, [string, string]> = {
  touched: ["already handled by a person", "already handled by a person"],
  not_resolved: ["needs a match, a year or a check", "need a match, a year or a check"],
  catalog_flag: ["catalog duplicate or one-word name nearby", "catalog duplicates or one-word names nearby"],
  inferred: ["name inferred every time", "names inferred every time"],
  mostly_inferred: ["name mostly inferred", "names mostly inferred"],
  no_kept_story: ["only in trimmed stories", "only in trimmed stories"],
  first_name_only: ["first name only", "first names only"],
  one_off_respelled: ["heard once and respelled", "heard once and respelled"],
  near_twin: ["close spelling of another node", "close spellings of other nodes"],
}

/** Order the reasons are checked in, cheapest and most decisive first. */
const NODE_REASON_ORDER: NodeHoldReason[] = Object.keys(NODE_HOLD_LABEL) as NodeHoldReason[]

/**
 * Pairs of live, same-type staging nodes whose keys are a close spelling of
 * each other. Only multi-token keys are compared: a one-word node ("Mike")
 * is never approved here anyway, and comparing it would flag every Mike.
 */
export function nearTwinIds(nodes: Pick<ConfidenceNode, "id" | "subject_type" | "normalized_name" | "name" | "merged_into">[]): Set<string> {
  // Bucket on type plus a key-length band; a close spelling is within 3
  // characters of length, so only the same and the next band are compared.
  const buckets = new Map<string, { id: string; key: string }[]>()
  for (const n of nodes) {
    if (n.merged_into || stagingTokens(n.name).length < 2) continue
    const k = `${n.subject_type}|${Math.floor(n.normalized_name.length / 4)}`
    const list = buckets.get(k) ?? []
    list.push({ id: n.id, key: n.normalized_name })
    buckets.set(k, list)
  }
  const twins = new Set<string>()
  for (const [k, list] of buckets) {
    const [type, band] = k.split("|")
    const next = buckets.get(`${type}|${Number(band) + 1}`) ?? []
    list.forEach((a, i) => {
      for (const b of [...list.slice(i + 1), ...next]) {
        if (Math.abs(a.key.length - b.key.length) > 3) continue
        if (similarity(a.key, b.key) >= SPELLING_RATIO) {
          twins.add(a.id)
          twins.add(b.id)
        }
      }
    })
  }
  return twins
}

/** Why a node stays pending, or null when it is confident enough to approve. */
export function nodeHoldReason(n: ConfidenceNode, twins: Set<string>): NodeHoldReason | null {
  const flags = n.flags ?? []
  const mentions = Number(n.mention_count)
  const inferred = Number(n.inferred_count)
  const episodes = Number(n.episode_count)
  const checks: Record<NodeHoldReason, () => boolean> = {
    touched: () => n.decision !== "pending" || !!n.decided_by || !!n.merged_into || flags.includes("manual_match"),
    not_resolved: () => approveBlocker(n) !== null,
    catalog_flag: () => flags.includes("catalog_duplicate") || flags.includes("weak_candidate"),
    inferred: () => mentions === 0 || inferred >= mentions,
    mostly_inferred: () => episodes < 3 && inferred * 2 > mentions,
    no_kept_story: () => Number(n.kept_story_count) < 1,
    first_name_only: () => n.subject_type === "person" && stagingTokens(n.name).length < 2,
    one_off_respelled: () =>
      n.resolution === "new" && mentions <= 1 && episodes <= 1 && (n.heard_as ?? []).some((h) => h && h !== n.name),
    near_twin: () => n.resolution === "new" && twins.has(n.id),
  }
  for (const r of NODE_REASON_ORDER) if (checks[r]()) return r
  return null
}

// ── stories ─────────────────────────────────────────────────────────────────

export type ConfidenceStory = {
  id: string
  title: string
  excerpt: string
  decision: StoryDecision
  decided_by: string | null
  revision_pending: unknown
  kept_mentions: number
  direct_mentions: number
}

export type StoryHoldReason = "touched" | "only_inferred" | "too_short" | "sensitive"

export const STORY_HOLD_LABEL: Record<StoryHoldReason, [string, string]> = {
  touched: ["already handled by a person", "already handled by a person"],
  only_inferred: ["only inferred names", "only inferred names"],
  too_short: ["excerpt too short", "excerpts too short"],
  sensitive: ["possibly sensitive", "possibly sensitive"],
}

export const MIN_EXCERPT = 120

/**
 * Words that put a story in front of a person. Broad on purpose: a false hit
 * only costs a manual look, a miss could publish something that should have
 * been trimmed (death of a private person, drug use, legal trouble, etc.).
 * Left out on purpose after a dry run on the FNRad queue: high, shot, crash,
 * fight, avalanche. They were mostly riding talk (high school, photo shot)
 * and a real tragedy still hits died / killed / death.
 */
export const SENSITIVE_PATTERN =
  /\b(die[ds]?|dying|death|dead|passed away|funeral|memorial|suicid\w*|overdos\w*|cancer|tumou?r|illness|disease|hospital\w*|coma|paraly\w*|arrest\w*|jail\w*|prison|cops?|police|court|lawsuit|sued|su(e|ing)|lawyer|drugs?|cocaine|heroin|meth|weed|pot|stoned|acid|lsd|mushrooms|pills?|rehab|sober\w*|addict\w*|alcohol\w*|drunk\w*|wasted|hangover|divorc\w*|girlfriend|boyfriend|wife|husband|dating|affair|sex\w*|naked|fired|bankrupt\w*|depress\w*|anxiety|mental|therapy|killed|murder\w*|gun|injur\w*|broke (his|her|my) (back|neck)|punch\w*|racis\w*|abuse\w*)\b/i

export function storyHoldReason(s: ConfidenceStory): StoryHoldReason | null {
  if (s.decision !== "pending" || s.decided_by || s.revision_pending) return "touched"
  if (Number(s.direct_mentions) < 1) return "only_inferred"
  if ((s.excerpt ?? "").trim().length < MIN_EXCERPT) return "too_short"
  if (SENSITIVE_PATTERN.test(`${s.title}\n${s.excerpt}`)) return "sensitive"
  return null
}

// ── tallies ─────────────────────────────────────────────────────────────────

/** Count reasons into "12 first names only, 3 names inferred every time". */
export function tallyLine<R extends string>(counts: Partial<Record<R, number>>, labels: Record<R, [string, string]>): string {
  return (Object.keys(labels) as R[])
    .filter((r) => (counts[r] ?? 0) > 0)
    .map((r) => `${counts[r]} ${counts[r] === 1 ? labels[r][0] : labels[r][1]}`)
    .join(", ")
}
