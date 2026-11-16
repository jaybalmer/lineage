// Podcast archive staging: load story dates (Pass A) and replay links into
// podcast_staging_stories (brief podcast-staging-sort-and-sketches v1, Part C,
// C3 + C4).
//
// Called by scripts/load-podcast-staging.mjs --dates / --replays. Dry run by
// default; nothing is written without { apply: true }. Writes only the date
// columns and replay_of on existing staging stories: never a decision, never a
// new row, never anything outside staging.
//
// Join key, the one the dating pass was told to copy exactly: the episode's
// YouTube video id, plus the story timestamp, plus the story title. Rows that
// do not match are reported and nothing is written for them.
//
// Runs under bare Node type stripping (see the loader), so: no enums, no
// parameter properties, type-only imports marked `import type`.

import type { SupabaseClient } from "@supabase/supabase-js"
import { selectAll } from "@/lib/podcast-staging-server"
import { readTimestamp } from "@/lib/mention-import"

export const DATE_BASES = ["stated", "relative", "anchor", "timeline", "outside", "neighbor"] as const
const CONFIDENCES = ["high", "medium", "low"]

/** One Pass A file: <folder>/dates/<slug>.json */
export type DatesFile = {
  file: string
  episode?: { video_id?: string; slug?: string }
  stories?: {
    timestamp?: string
    title?: string
    undatable?: boolean
    reason?: string
    start_year?: number
    end_year?: number
    basis?: string
    confidence?: string
    evidence?: string
    note?: string
  }[]
}

/** One entry of podcast_archive/replays.json. */
export type ReplayEntry = {
  copy: { video_id: string; timestamp: string; title: string }
  original: { video_id: string; timestamp: string; title: string }
}

type DatePatch = {
  start_year: number | null
  end_year: number | null
  date_basis: string | null
  date_confidence: string | null
  date_evidence: string | null
  date_undatable_reason: string | null
}
type StoryRow = DatePatch & { id: string; episode_id: string; timestamp_seconds: number; title: string; replay_of: string | null }

export type LoadReport = {
  matched: number
  alreadyLoaded: number
  written: number
  unmatched: { where: string; why: string }[]
}

const DATE_COLS = "start_year, end_year, date_basis, date_confidence, date_evidence, date_undatable_reason"

async function index(db: SupabaseClient) {
  const [eps, stories] = await Promise.all([
    selectAll<{ id: string; video_id: string }>(db, "podcast_staging_episodes", "id, video_id"),
    selectAll<StoryRow>(db, "podcast_staging_stories", `id, episode_id, timestamp_seconds, title, replay_of, ${DATE_COLS}`),
  ])
  const epByVideo = new Map(eps.map((e) => [e.video_id, e.id]))
  const byKey = new Map(stories.map((s) => [`${s.episode_id}|${s.timestamp_seconds}|${s.title}`, s]))
  const find = (videoId: string | undefined, ts: string | undefined, title: string | undefined): StoryRow | string => {
    const epId = videoId ? epByVideo.get(videoId) : undefined
    if (!epId) return `no staged episode for video ${videoId ?? "(none)"}`
    const secs = readTimestamp(ts ?? null)
    if (secs == null) return `unreadable timestamp "${ts ?? ""}"`
    return byKey.get(`${epId}|${secs}|${title ?? ""}`) ?? "no staged story with this timestamp and title"
  }
  return { find, storyCount: stories.length }
}

/** Write patches with a small amount of concurrency (one row per update; there is no bulk partial update). */
async function writeAll(db: SupabaseClient, writes: { id: string; patch: Record<string, unknown> }[]): Promise<number> {
  let done = 0
  for (let i = 0; i < writes.length; i += 20) {
    const chunk = writes.slice(i, i + 20)
    const results = await Promise.all(chunk.map((w) => db.from("podcast_staging_stories").update(w.patch).eq("id", w.id)))
    for (const r of results) if (r.error) throw new Error(`write: ${r.error.message}`)
    done += chunk.length
  }
  return done
}

function toPatch(s: NonNullable<DatesFile["stories"]>[number]): DatePatch | string {
  if (s.undatable) {
    if (!s.reason?.trim()) return "undatable without a reason"
    return { start_year: null, end_year: null, date_basis: null, date_confidence: null, date_evidence: null, date_undatable_reason: s.reason.trim() }
  }
  const a = s.start_year
  const z = s.end_year ?? s.start_year
  if (!Number.isInteger(a) || !Number.isInteger(z) || (z as number) < (a as number)) return `bad years ${a} to ${z}`
  if (!s.basis || !(DATE_BASES as readonly string[]).includes(s.basis)) return `unknown basis "${s.basis ?? ""}"`
  const evidence = [s.evidence?.trim(), s.note?.trim() ? `Note: ${s.note.trim()}` : ""].filter(Boolean).join(" ")
  return {
    start_year: a as number,
    end_year: z as number,
    date_basis: s.basis,
    date_confidence: s.confidence && CONFIDENCES.includes(s.confidence) ? s.confidence : null,
    date_evidence: evidence || null,
    date_undatable_reason: null,
  }
}

const same = (row: DatePatch, p: DatePatch) =>
  row.start_year === p.start_year && row.end_year === p.end_year && row.date_basis === p.date_basis &&
  row.date_confidence === p.date_confidence && row.date_evidence === p.date_evidence && row.date_undatable_reason === p.date_undatable_reason

export async function loadStoryDates(db: SupabaseClient, files: DatesFile[], opts: { apply: boolean }): Promise<LoadReport & { stagedWithoutDates: number }> {
  const { find, storyCount } = await index(db)
  const report: LoadReport = { matched: 0, alreadyLoaded: 0, written: 0, unmatched: [] }
  const writes = new Map<string, { id: string; patch: Record<string, unknown> }>()
  const seen = new Set<string>()
  for (const f of files) {
    for (const s of f.stories ?? []) {
      const where = `${f.file} ${s.timestamp ?? "?"} "${s.title ?? ""}"`
      const row = find(f.episode?.video_id, s.timestamp, s.title)
      if (typeof row === "string") { report.unmatched.push({ where, why: row }); continue }
      if (seen.has(row.id)) { report.unmatched.push({ where, why: "a second dates row for the same story; first one kept" }); continue }
      seen.add(row.id)
      const patch = toPatch(s)
      if (typeof patch === "string") { report.unmatched.push({ where, why: patch }); continue }
      report.matched++
      if (same(row, patch)) report.alreadyLoaded++
      else writes.set(row.id, { id: row.id, patch })
    }
  }
  if (opts.apply) report.written = await writeAll(db, [...writes.values()])
  return { ...report, stagedWithoutDates: storyCount - seen.size }
}

export async function loadReplays(db: SupabaseClient, replays: ReplayEntry[], opts: { apply: boolean }): Promise<LoadReport> {
  const { find } = await index(db)
  const report: LoadReport = { matched: 0, alreadyLoaded: 0, written: 0, unmatched: [] }
  const writes: { id: string; patch: Record<string, unknown> }[] = []
  for (const r of replays) {
    const where = `${r.copy.video_id} ${r.copy.timestamp} "${r.copy.title}"`
    const copy = find(r.copy.video_id, r.copy.timestamp, r.copy.title)
    if (typeof copy === "string") { report.unmatched.push({ where, why: `copy: ${copy}` }); continue }
    const orig = find(r.original.video_id, r.original.timestamp, r.original.title)
    if (typeof orig === "string") { report.unmatched.push({ where, why: `original: ${orig}` }); continue }
    if (orig.id === copy.id) { report.unmatched.push({ where, why: "copy and original are the same staged story" }); continue }
    if (orig.replay_of) { report.unmatched.push({ where, why: "the original is itself marked as a replay" }); continue }
    report.matched++
    if (copy.replay_of === orig.id) report.alreadyLoaded++
    else writes.push({ id: copy.id, patch: { replay_of: orig.id } })
  }
  if (opts.apply) report.written = await writeAll(db, writes)
  return report
}
