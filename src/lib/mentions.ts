// Podcast pass Session B: pure mention helpers.
//
// Client-safe by design: this module is imported by MentionRow and the editor
// modal, so it must never reach for the service client or anything else that
// pulls next/headers into a client bundle. The server-side episode hydration
// lives in mentions-server.ts for exactly that reason.

import type { Mention, MentionSubjectType } from "@/types"

export const MENTION_SUBJECT_TYPES: MentionSubjectType[] = [
  "person", "place", "org", "board", "event",
]

/**
 * Parse a timestamp input into whole seconds. Accepts `mm:ss`, `h:mm:ss`, or a
 * raw seconds count. Returns null for empty input and undefined for garbage,
 * so a caller can tell "clear this" from "reject this".
 */
export function parseTimestampInput(raw: string): number | null | undefined {
  const value = raw.trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  const parts = value.split(":")
  if (parts.length < 2 || parts.length > 3) return undefined
  if (!parts.every((p) => /^\d+$/.test(p.trim()))) return undefined
  const nums = parts.map((p) => parseInt(p.trim(), 10))
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]]
  if (m > 59 || s > 59) return undefined
  return h * 3600 + m * 60 + s
}

export type MomentGroup<T> = {
  key: string
  timestamp_seconds: number | null
  excerpt: string | null
  /** Headline for the moment, from the first row that carries one. */
  story_title: string | null
  items: T[]
}

/**
 * Fold mentions that describe the same moment into one group.
 *
 * The transcript-to-mentions workflow writes a story once per subject: the
 * 1986 Worlds road trip is six rows sharing a timestamp and a paragraph, so
 * that the story lands whole on all six timelines. That is right for a person's
 * timeline, where they see it once, and wrong for the episode page, which shows
 * every subject and would otherwise print the same paragraph six times.
 *
 * Grouping is on timestamp AND excerpt together, so two subjects that merely
 * happen to share a timestamp are never merged. A mention with no excerpt is
 * always its own group: there is no story text to be duplicated, and two blank
 * mentions at the same moment are far more likely to be unrelated hand-added
 * rows than one story.
 *
 * Input order is preserved, so a timestamp-ordered read stays ordered.
 */
export function groupMentionsByMoment<
  T extends {
    timestamp_seconds?: number | null
    excerpt?: string | null
    story_title?: string | null
  },
>(rows: T[]): MomentGroup<T>[] {
  const order: string[] = []
  const byKey = new Map<string, MomentGroup<T>>()

  rows.forEach((row, index) => {
    const ts = row.timestamp_seconds ?? null
    const excerpt = (row.excerpt ?? "").trim() || null
    const key = excerpt === null ? `solo:${index}` : `${ts ?? -1}|${excerpt}`
    let group = byKey.get(key)
    if (!group) {
      group = { key, timestamp_seconds: ts, excerpt, story_title: null, items: [] }
      byKey.set(key, group)
      order.push(key)
    }
    // The title is denormalized across the story's rows, so the first non-empty
    // one wins rather than requiring every row to agree.
    if (!group.story_title) group.story_title = (row.story_title ?? "").trim() || null
    group.items.push(row)
  })

  return order.map((key) => byKey.get(key)!)
}

export type EpisodeGroup<T> = {
  key: string
  /** The episode all rows share, or null for a solo (episode-less) row. */
  episode_event_id: string | null
  items: T[]
}

/**
 * Fold mentions that come from the same episode into one group (BUG-172).
 *
 * On a person's timeline every mention already belongs to that one person, so a
 * run of N mentions from FNRad #142 renders as N near-identical stacked rows on
 * the same episode date. Grouping on `episode_event_id` collapses that run into
 * one card while leaving a lone mention untouched (the caller renders a group of
 * 1 as a bare row).
 *
 * This is deliberately a different key from `groupMentionsByMoment`, which folds
 * one story written once per subject and folds nothing on a single person's
 * timeline. A row with no `episode_event_id` is always its own group.
 *
 * Input order is preserved, so a caller that pre-sorted (episode date, then
 * listening order) keeps that order both across groups and within one.
 */
export function groupMentionsByEpisode<
  T extends { episode_event_id?: string | null },
>(rows: T[]): EpisodeGroup<T>[] {
  const order: string[] = []
  const byKey = new Map<string, EpisodeGroup<T>>()

  rows.forEach((row, index) => {
    const epId = row.episode_event_id ?? null
    const key = epId === null ? `solo:${index}` : `ep:${epId}`
    let group = byKey.get(key)
    if (!group) {
      group = { key, episode_event_id: epId, items: [] }
      byKey.set(key, group)
      order.push(key)
    }
    group.items.push(row)
  })

  return order.map((key) => byKey.get(key)!)
}

/** A year folds into one card once it holds MORE than this many episodes. */
export const YEAR_ROLLUP_THRESHOLD = 3

export type MentionYearItem<T> =
  | { kind: "episode"; group: EpisodeGroup<T> }
  | { kind: "year"; key: string; year: string; groups: EpisodeGroup<T>[]; mentionCount: number }

/**
 * Fold a subject's episode groups by air year (Jay, 2026-11-15).
 *
 * Once the FNRad archive publishes, a rider like Craig Kelly is named in about
 * 170 episodes and Burton in about 200, so one card per episode buries the rest
 * of a timeline. Any year with more than `threshold` episodes becomes a single
 * "talked about N times in Y episodes in <year>" card that opens to the episode
 * cards; quieter years keep their episode cards as before.
 *
 * The year is the episode's AIR year (when it was talked about), not when the
 * story happened. Groups with no year are never folded. A year card takes the
 * position of its first group, so input order is preserved, and the groups
 * inside keep input order too.
 */
export function rollupEpisodesByYear<T>(
  groups: EpisodeGroup<T>[],
  yearOf: (g: EpisodeGroup<T>) => string | null,
  threshold = YEAR_ROLLUP_THRESHOLD,
): MentionYearItem<T>[] {
  const byYear = new Map<string, EpisodeGroup<T>[]>()
  for (const g of groups) {
    const y = yearOf(g)
    if (y) byYear.set(y, [...(byYear.get(y) ?? []), g])
  }
  const out: MentionYearItem<T>[] = []
  const placed = new Set<string>()
  for (const g of groups) {
    const y = yearOf(g)
    const yearGroups = y ? byYear.get(y)! : null
    if (!y || !yearGroups || yearGroups.length <= threshold) {
      out.push({ kind: "episode", group: g })
      continue
    }
    if (placed.has(y)) continue
    placed.add(y)
    out.push({
      kind: "year",
      key: `year:${y}`,
      year: y,
      groups: yearGroups,
      mentionCount: yearGroups.reduce((n, x) => n + x.items.length, 0),
    })
  }
  return out
}

/**
 * Mentions a subject page downloads up front (Jay, 2026-11-15). At or under this
 * the page gets every mention, exactly as before. Above it, each year that would
 * fold into a year card arrives as a count only (MentionYearStub) and its
 * mentions load when the reader opens that card. Set from the archive's shape:
 * 99% of subjects have 93 or fewer kept mentions, while Burton has about 750 and
 * Craig Kelly about 550, and those big pages are also the most visited.
 */
export const SUBJECT_MENTION_CAP = 100

/** A folded year whose mentions have not been downloaded yet. */
export type MentionYearStub = {
  year: string
  episodeCount: number
  mentionCount: number
  /** The show name when every episode that year is one show, else null. */
  showName: string | null
  /** Latest episode air date in the year (YYYY-MM-DD), for placement. */
  latestDate: string
}

/** GET /api/mentions?subject_type=&subject_id=&shape=capped */
export type SubjectMentionsPayload = {
  mentions: Mention[]
  years: MentionYearStub[]
  total: number
}

function subjectQuery(subjectType: MentionSubjectType, subjectId: string): string {
  return `subject_type=${subjectType}&subject_id=${encodeURIComponent(subjectId)}`
}

/** A subject's mentions, capped: never throws, an error reads as empty. */
export async function fetchSubjectMentions(
  subjectType: MentionSubjectType,
  subjectId: string,
): Promise<SubjectMentionsPayload> {
  const empty: SubjectMentionsPayload = { mentions: [], years: [], total: 0 }
  try {
    const r = await fetch(`/api/mentions?${subjectQuery(subjectType, subjectId)}&shape=capped`)
    if (!r.ok) return empty
    const d = (await r.json()) as Partial<SubjectMentionsPayload>
    return {
      mentions: Array.isArray(d.mentions) ? d.mentions : [],
      years: Array.isArray(d.years) ? d.years : [],
      total: typeof d.total === "number" ? d.total : 0,
    }
  } catch {
    return empty
  }
}

/** The mentions of one folded year, fetched when its card is opened. */
export async function fetchSubjectMentionYear(
  subjectType: MentionSubjectType,
  subjectId: string,
  year: string,
): Promise<Mention[]> {
  const r = await fetch(`/api/mentions?${subjectQuery(subjectType, subjectId)}&year=${encodeURIComponent(year)}`)
  if (!r.ok) throw new Error(`mentions ${r.status}`)
  const d = await r.json()
  return Array.isArray(d) ? (d as Mention[]) : []
}

/** Seconds to `mm:ss`, or `h:mm:ss` past the hour mark. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
