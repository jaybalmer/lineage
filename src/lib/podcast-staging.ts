// Podcast archive staging: the pure half (brief: podcast-archive-staging-brief-v2.md).
//
// Client-safe and dependency-light BY DESIGN. Three consumers:
//   * scripts/load-podcast-staging.mjs runs it under bare Node (type stripping
//     plus a small @/ alias hook), so it must not import anything that drags in
//     next/* or the service client;
//   * the staging admin pages import its types and labels;
//   * the Phase 2 "Re-check against catalog" route will call resolveNode().
//
// Node identity and matching build on the SAME normalizeName / significantTokens
// / isNearMiss the single-episode importer uses (mention-import.ts), so a staged
// plan behaves like an import. The four staging-only rules from the pilot
// re-match (T4a to T4e) live here and NOT in mention-import.ts, because the
// importer and its mirror script depend on the shared helpers as they are.

import { isNearMiss, normalizeName, significantTokens } from "@/lib/mention-import"

export type StagingSubjectType = "person" | "place" | "org" | "board" | "event"

export const STAGING_SUBJECT_TYPES: StagingSubjectType[] = ["person", "place", "org", "board", "event"]

export type NodeResolution = "unresolved" | "matched" | "ambiguous" | "review" | "new" | "needs_detail"

export type NodeDecision = "pending" | "approved" | "hold" | "rejected"

export type StoryDecision = "pending" | "approved" | "trimmed" | "hold_sensitive"

/** Why a catalog row is offered on a node. */
export type CandidateKind =
  /** Exact match after folding and normalizing. */
  | "exact"
  /** Token containment (the importer's isNearMiss). */
  | "near"
  /** Edit-distance ratio 0.85 or higher (T4c). */
  | "spelling"
  /** Only overlap is a one-word catalog name (T4d). Never blocks. */
  | "weak"
  /** Same event series, different or missing year (T4a / D9). */
  | "series"
  /** Same board brand and model, year to pick (D8). */
  | "model"

export type NodeCandidate = { id: string; label: string; kind: CandidateKind }

export type NodeFlag =
  /** Every mention of this node had its name inferred (D7). */
  | "all_inferred"
  /** At least one mention had its name inferred. */
  | "some_inferred"
  /** Two or more catalog rows are the same name after folding (T4e). */
  | "catalog_duplicate"
  /** A one-word catalog name overlaps, listed but not blocking (T4d). */
  | "weak_candidate"
  /** An editor picked the catalog row; edits and re-checks never undo it. */
  | "manual_match"

// ── copy (brief section 7) ──────────────────────────────────────────────────

export const RESOLUTION_LABEL: Record<NodeResolution, string> = {
  matched: "In catalog",
  ambiguous: "Pick a match",
  review: "Close match, check it",
  new: "New",
  needs_detail: "Needs a year",
  unresolved: "Not checked yet",
}

export const TYPE_LABEL: Record<StagingSubjectType, string> = {
  person: "Person", place: "Place", org: "Brand", board: "Board", event: "Event",
}

export const FLAG_LABEL: Record<NodeFlag, string> = {
  all_inferred: "Name inferred every time",
  some_inferred: "Name inferred sometimes",
  catalog_duplicate: "Catalog duplicate to merge",
  weak_candidate: "One-word catalog name nearby",
  manual_match: "Match picked by hand",
}

// ── normalization ───────────────────────────────────────────────────────────

/** T4b. NFKD and drop combining marks, so "Riksgränsen" reads "Riksgransen". */
export function foldAccents(raw: unknown): string {
  return String(raw ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
}

/** Node identity key: the importer's normalizeName, after folding accents. */
export function stagingKey(raw: unknown): string {
  return normalizeName(foldAccents(raw))
}

/** Identity-bearing tokens after folding. */
export function stagingTokens(raw: unknown): string[] {
  return significantTokens(foldAccents(raw))
}

/** Importer near-miss rule, after folding. */
export function stagingNearMiss(a: unknown, b: unknown): boolean {
  return isNearMiss(foldAccents(a), foldAccents(b))
}

/** Levenshtein distance, two-row. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let cur = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]
}

/** Similarity ratio in [0, 1] on two already-normalized keys. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest
}

export const SPELLING_RATIO = 0.85

// ── event names (T4a) ───────────────────────────────────────────────────────

/**
 * Split a leading or trailing four-digit year off an event name. Catalog event
 * names put the year first, last, or nowhere (F14), so names are compared on
 * the base and the year is compared separately against events.year.
 */
export function splitEventYear(raw: unknown): { base: string; year: number | null } {
  const name = String(raw ?? "").trim()
  const lead = name.match(/^((?:19|20)\d{2})\b\s*(.*)$/)
  if (lead) return { base: stagingKey(lead[2]), year: Number(lead[1]) }
  const trail = name.match(/^(.*?)\s*\b((?:19|20)\d{2})$/)
  if (trail) return { base: stagingKey(trail[1]), year: Number(trail[2]) }
  return { base: stagingKey(name), year: null }
}

/** Year from a ghost: start_date "1985" or "1985-02-01", else ghost.year. */
export function ghostYear(ghost: StagingGhost | null | undefined): number | null {
  if (!ghost) return null
  const raw = ghost.start_date ? String(ghost.start_date) : ""
  const m = raw.match(/^((?:19|20)\d{2})/)
  if (m) return Number(m[1])
  return typeof ghost.year === "number" ? ghost.year : null
}

// ── the resolver (T4) ───────────────────────────────────────────────────────

export type StagingGhost = {
  place_type?: string
  org_type?: string
  brand?: string
  model?: string
  model_year?: number
  start_date?: string
  year?: number
  [key: string]: unknown
}

/** One catalog row as the resolver sees it. */
export type CatalogEntry = {
  id: string
  name: string
  label: string
  /** events only */
  year?: number | null
  /** boards only */
  brand?: string | null
  model?: string | null
  model_year?: number | null
}

export type ResolverNode = {
  subject_type: StagingSubjectType
  name: string
  ghost: StagingGhost
}

export type ResolveResult = {
  resolution: NodeResolution
  subject_id: string | null
  candidates: NodeCandidate[]
  flags: NodeFlag[]
}

/** Cap on candidates stored per node; a board model can span 30 years. */
const MAX_CANDIDATES = 25

const cand = (e: CatalogEntry, kind: CandidateKind): NodeCandidate => ({ id: e.id, label: e.label, kind })

function dedupeCandidates(list: NodeCandidate[]): NodeCandidate[] {
  const seen = new Set<string>()
  const out: NodeCandidate[] = []
  for (const c of list) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
    if (out.length >= MAX_CANDIDATES) break
  }
  return out
}

/**
 * A name that is literally one word ("Peter", "Tony", "Vancouver"). Counted on
 * the normalized words, NOT the significant tokens: "Norquay Ski Resort" is a
 * full name whose generic words happen to drop out, not a one-word name.
 */
const isOneWord = (name: string): boolean => stagingKey(name).split(" ").filter(Boolean).length === 1

/**
 * Near and spelling candidates for a name against a list, split strong / weak.
 *
 * `weakOneWord` turns on T4d, for people only: a catalog person called "Peter"
 * says almost nothing about "Peter Line". It stays off for brands and places,
 * where a one-word catalog name is normal ("Atlantis" for "Atlantis
 * Snowboards", "Forum" for "Forum Snowboards") and IS the likely match.
 */
function closeMatches(
  key: string,
  name: string,
  index: CatalogEntry[],
  keyOf: (e: CatalogEntry) => string,
  weakOneWord = false,
): { strong: NodeCandidate[]; weak: NodeCandidate[] } {
  const strong: NodeCandidate[] = []
  const weak: NodeCandidate[] = []
  const nodeOneWord = isOneWord(name)
  for (const e of index) {
    const k = keyOf(e)
    if (!k) continue
    if (stagingNearMiss(key, k)) {
      // T4d: the only overlap is a one-word catalog name against a fuller
      // staged name. Listed, never blocking.
      if (weakOneWord && isOneWord(e.name) && !nodeOneWord) weak.push(cand(e, "weak"))
      else strong.push(cand(e, "near"))
      continue
    }
    if (similarity(key, k) >= SPELLING_RATIO) strong.push(cand(e, "spelling"))
  }
  return { strong, weak }
}

/**
 * Resolve one staged node against the catalog for its type.
 *
 *   matched       exactly one exact match (after folding and normalizing)
 *   ambiguous     two or more exact matches; flagged as a catalog duplicate
 *   review        a near miss or a close spelling; a person decides
 *   new           nothing close (weak one-word candidates may be listed)
 *   needs_detail  a board with no model year (D8) or an event with no year (D9)
 */
export function resolveNode(node: ResolverNode, index: CatalogEntry[]): ResolveResult {
  if (node.subject_type === "event") return resolveEvent(node, index)
  if (node.subject_type === "board") return resolveBoard(node, index)

  const key = stagingKey(node.name)
  const exact = index.filter((e) => stagingKey(e.name) === key)
  if (exact.length === 1) {
    return { resolution: "matched", subject_id: exact[0].id, candidates: [cand(exact[0], "exact")], flags: [] }
  }
  if (exact.length > 1) {
    // T4e: two catalog rows equal each other after folding. Staging never
    // merges catalog rows; it shows both and flags the duplicate.
    return {
      resolution: "ambiguous",
      subject_id: null,
      candidates: dedupeCandidates(exact.map((e) => cand(e, "exact"))),
      flags: ["catalog_duplicate"],
    }
  }

  const { strong, weak } = closeMatches(key, node.name, index, (e) => stagingKey(e.name), node.subject_type === "person")
  if (strong.length > 0) {
    return {
      resolution: "review",
      subject_id: null,
      candidates: dedupeCandidates([...strong, ...weak]),
      flags: weak.length ? ["weak_candidate"] : [],
    }
  }
  return {
    resolution: "new",
    subject_id: null,
    candidates: dedupeCandidates(weak),
    flags: weak.length ? ["weak_candidate"] : [],
  }
}

/** T4a. Base name plus year, never the full string. Episodes are excluded upstream. */
function resolveEvent(node: ResolverNode, index: CatalogEntry[]): ResolveResult {
  const staged = splitEventYear(node.name)
  const year = staged.year ?? ghostYear(node.ghost)
  const baseOf = (e: CatalogEntry) => splitEventYear(e.name).base

  const series = index.filter((e) => baseOf(e) === staged.base)
  if (series.length > 0) {
    const sameYear = year === null ? [] : series.filter((e) => e.year === year)
    if (sameYear.length === 1) {
      return { resolution: "matched", subject_id: sameYear[0].id, candidates: [cand(sameYear[0], "exact")], flags: [] }
    }
    if (sameYear.length > 1) {
      return {
        resolution: "ambiguous",
        subject_id: null,
        candidates: dedupeCandidates(sameYear.map((e) => cand(e, "exact"))),
        flags: ["catalog_duplicate"],
      }
    }
    // Same series, no year said or a year the catalog does not hold: D9's
    // picker offers that series' dated editions.
    const byYear = [...series].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    return {
      resolution: "needs_detail",
      subject_id: null,
      candidates: dedupeCandidates(byYear.map((e) => cand(e, "series"))),
      flags: [],
    }
  }

  const { strong, weak } = closeMatches(staged.base, staged.base, index, baseOf)
  const candidates = dedupeCandidates([...strong, ...weak])
  const flags: NodeFlag[] = weak.length ? ["weak_candidate"] : []
  // D9: an event said without a year cannot become a node (events.start_date
  // is NOT NULL), whatever else is true about it.
  if (year === null) return { resolution: "needs_detail", subject_id: null, candidates, flags }
  if (strong.length > 0) return { resolution: "review", subject_id: null, candidates, flags }
  return { resolution: "new", subject_id: null, candidates, flags }
}

/** D8. Brand plus model is the identity; a board with no year needs one. */
function resolveBoard(node: ResolverNode, index: CatalogEntry[]): ResolveResult {
  const g = node.ghost ?? {}
  const brand = g.brand ? stagingKey(g.brand) : ""
  const model = g.model ? stagingKey(g.model) : ""
  const year = typeof g.model_year === "number" ? g.model_year : null

  const sameModel = brand && model
    ? index.filter((b) => stagingKey(b.brand) === brand && stagingKey(b.model) === model)
    : index.filter((b) => stagingKey(b.model) === stagingKey(node.name) || stagingKey(b.name) === stagingKey(node.name))

  const byYear = (list: CatalogEntry[]) => [...list].sort((a, b) => (a.model_year ?? 0) - (b.model_year ?? 0))

  if (year !== null && sameModel.length > 0) {
    const exact = sameModel.filter((b) => b.model_year === year)
    if (exact.length === 1) {
      return { resolution: "matched", subject_id: exact[0].id, candidates: [cand(exact[0], "exact")], flags: [] }
    }
    if (exact.length > 1) {
      return {
        resolution: "ambiguous",
        subject_id: null,
        candidates: dedupeCandidates(exact.map((b) => cand(b, "exact"))),
        flags: ["catalog_duplicate"],
      }
    }
  }

  let candidates: NodeCandidate[] = dedupeCandidates(byYear(sameModel).map((b) => cand(b, "model")))
  if (candidates.length === 0) {
    const probe = brand && model ? `${g.brand} ${g.model}` : node.name
    const near = index.filter((b) => stagingNearMiss(probe, b.name))
    candidates = dedupeCandidates(byYear(near).map((b) => cand(b, "near")))
  }

  // No year: unpublishable until a catalog board is picked or a year entered.
  if (year === null) return { resolution: "needs_detail", subject_id: null, candidates, flags: [] }
  // A year the catalog does not hold for a known model, or a close name: check it.
  if (candidates.length > 0) return { resolution: "review", subject_id: null, candidates, flags: [] }
  return { resolution: "new", subject_id: null, candidates: [], flags: [] }
}

/** Inference flags from a node's mention counts. */
export function inferenceFlags(mentionCount: number, inferredCount: number): NodeFlag[] {
  if (mentionCount > 0 && inferredCount === mentionCount) return ["all_inferred"]
  if (inferredCount > 0) return ["some_inferred"]
  return []
}

// ── decisions (Phase 2) ─────────────────────────────────────────────────────

/**
 * Why a node cannot be approved yet, or null when it can.
 *
 * A node is publishable only once it is resolved: matched to a catalog row, or
 * confirmed new with every column its table requires (boards.model_year and
 * events.start_date are NOT NULL, D8 / D9). Approving anything else would let
 * Phase 3 mint a node the catalog cannot hold.
 */
export function approveBlocker(node: {
  subject_type: StagingSubjectType
  resolution: NodeResolution
  subject_id: string | null
  ghost: StagingGhost | null
}): string | null {
  const g = node.ghost ?? {}
  switch (node.resolution) {
    case "matched":
      return node.subject_id ? null : "Matched but no catalog row is set. Pick a match."
    case "new":
      if (node.subject_type === "board" && (!g.brand || !g.model || typeof g.model_year !== "number")) {
        return "A new board needs a brand, a model and a model year."
      }
      if (node.subject_type === "event" && ghostYear(g) === null) return "A new event needs a year."
      return null
    case "needs_detail":
      return node.subject_type === "board" ? "Needs a year: pick a catalog board or enter a model year." : "Needs a year: pick a dated event or enter a year."
    case "review":
      return "Close match: pick the catalog row or confirm it is new first."
    case "ambiguous":
      return "Several catalog rows match: pick one first."
    default:
      return "Not checked against the catalog yet."
  }
}

/** Ghost fields an editor may fill, per type (T8). Anything else is ignored. */
export const GHOST_FIELDS: Record<StagingSubjectType, string[]> = {
  person: [],
  place: ["place_type", "region", "country"],
  org: ["org_type", "brand_category", "country"],
  board: ["brand", "model", "model_year", "shape"],
  event: ["start_date", "event_type"],
}

/** Plural-aware reason line for the bulk previews (T11). */
export function reasonsLine(parts: [number, string, string][]): string {
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(", ")
}

// ── episodes ────────────────────────────────────────────────────────────────

/** YouTube id from any watch / youtu.be / embed URL, or a bare id. */
export function youTubeId(raw: unknown): string | null {
  const s = String(raw ?? "").trim()
  if (!s) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

/** D12: bonus episodes (S9BONUS8, S12B2) carry no episode number. */
export function isBonusLabel(label: unknown): boolean {
  return /^S\d+(BONUS|B)\d+$/i.test(String(label ?? "").trim())
}

/** Timestamped YouTube link for a story. */
export function videoLink(videoId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.floor(seconds))}s`
}
