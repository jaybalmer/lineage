// Podcast pass Session B: pure mention helpers.
//
// Client-safe by design: this module is imported by MentionRow and the editor
// modal, so it must never reach for the service client or anything else that
// pulls next/headers into a client bundle. The server-side episode hydration
// lives in mentions-server.ts for exactly that reason.

import type { MentionSubjectType } from "@/types"

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

/** Seconds to `mm:ss`, or `h:mm:ss` past the hour mark. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
