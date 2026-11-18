// The FNRad Archive index shape (briefs/fnrad-archive-surface-brief-v1.md, A1).
// Client-safe: types and pure helpers only. The server build lives in
// src/lib/fnrad-archive.ts, which re-exports everything here.

import type { MentionSubjectType } from "@/types"
import { LEGAL_CONTACT } from "@/components/legal/legal-shell"

/** Cache tag for the shared index build. Writers that change what is live invalidate it. */
export const FNRAD_ARCHIVE_TAG = "fnrad-archive"

/** Type index order used in ArchiveIndex.nodes. */
export const ARCHIVE_TYPES = ["person", "place", "org", "event", "board"] as const satisfies readonly MentionSubjectType[]
export type ArchiveType = (typeof ARCHIVE_TYPES)[number]

/** [type index, subject id, name, href, live episode count, story count, is host] */
export type ArchiveNode = [number, string, string, string | null, number, number, boolean]
/** [node index a, node index b, shared story count], a < b */
export type ArchiveEdge = [number, number, number]
/** [event id, public slug, display label, title, air date (YYYY-MM-DD or ""), story count] */
export type ArchiveEpisode = [string, string | null, string, string, string, number]

export type ArchiveIndex = {
  built_at: string
  totals: { episodes: number; stories: number; people: number; places: number; orgs: number; boards: number; events: number }
  nodes: ArchiveNode[]
  edges: ArchiveEdge[]
  episodes: ArchiveEpisode[]
}

/** The archive card's data (briefs/fnrad-archive-front-doors-brief-v1.md, A1).
 *  The sky is laid out on the server into a 1000 x 600 viewBox, so the card
 *  draws inline SVG and never loads d3. */
export type ArchiveCardData = {
  totals: ArchiveIndex["totals"]
  scaleLine: string
  sky: {
    /** [x, y, r, type index, label or null] */
    nodes: [number, number, number, number, string | null][]
    /** [node a, node b] into sky.nodes */
    edges: [number, number][]
  }
  /** Top person, place and brand by story count (D5), up to 3. */
  featured: { type: number; name: string; stories: number; focus: string; href: string }[]
}

/** Parse ?focus={type}:{id} against the index. Null on anything unknown. */
export function findFocus(index: ArchiveIndex, focus: string | string[] | undefined): number | null {
  if (typeof focus !== "string") return null
  const at = focus.indexOf(":")
  if (at < 1) return null
  const t = ARCHIVE_TYPES.indexOf(focus.slice(0, at) as ArchiveType)
  const id = focus.slice(at + 1)
  if (t < 0 || !id) return null
  const i = index.nodes.findIndex((n) => n[0] === t && n[1] === id)
  return i < 0 ? null : i
}

/** Section and chip labels, in ARCHIVE_TYPES order (Appendix A). */
export const TYPE_LABELS = ["People", "Places", "Brands and shops", "Events", "Boards"]

/** "Report a problem" (A6): no feedback widget reaches a chromeless page, so a
 *  mailto to the same contact /privacy uses. */
export function REPORT_HREF(name?: string): string {
  const subject = name ? `FNRad Archive: problem with ${name}` : "FNRad Archive: problem with a story"
  return `mailto:${LEGAL_CONTACT}?subject=${encodeURIComponent(subject)}`
}

/** "{episodes} episodes · {stories} stories · ..." from the index totals (Appendix A). */
export function archiveScaleLine(t: ArchiveIndex["totals"]): string {
  const f = (n: number) => n.toLocaleString("en-US")
  return [
    `${f(t.episodes)} episodes`,
    `${f(t.stories)} stories`,
    `${f(t.people)} riders`,
    `${f(t.places)} places`,
    `${f(t.orgs)} brands and shops`,
  ].join(" · ")
}
