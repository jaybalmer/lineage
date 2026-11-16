// Podcast archive staging: the payload behind the Sketches tab.
//
// Built from the live staging tables (brief B2), so merges and trims made in
// staging show up in the sketches. One moderator-gated GET route calls this
// after its own gate; the tables are RLS-on with no policies.
//
// The shape is compact tuples (the same idea as podcast_archive's
// build_viz_data.py) because it carries every story with an excerpt, roughly
// 3 MB. The client fetches it once per tab open and keeps it in component
// state, never in the Zustand store or localStorage.
//
// Stories have no dates in staging yet (Part C adds them), so there is no year
// field here. The client draws the year views empty-safe.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { NodeDecision, StagingSubjectType, StoryDecision } from "@/lib/podcast-staging"

/** Sketch type index order. Drives colors and the type chips in the sketch. */
export const SKETCH_TYPES: StagingSubjectType[] = ["person", "place", "org", "event", "board"]

/** The show's host. In every episode, so the sketches leave him out by default (brief B4). */
export const SKETCH_HOST_NAMES = ["erik traulsen"]

/** [title, archive label, air date (YYYY-MM-DD or ""), YouTube video id, staging episode id] */
export type SketchEpisode = [string, string, string, string, string]
/** [staging node id, name, type index into SKETCH_TYPES, decision, is host] */
export type SketchNode = [string, string, number, NodeDecision, boolean]
/** [episode index, timestamp seconds, title, excerpt, node indexes, decision, staging story id] */
export type SketchStory = [number, number, string, string, number[], StoryDecision, string]

export type SketchPayload = {
  episodes: SketchEpisode[]
  nodes: SketchNode[]
  stories: SketchStory[]
  meta: { built_at: string; episodes: number; stories: number; nodes: number }
}

const PAGE = 1000 // the PostgREST row cap per request
const EXCERPT_MAX = 250

type Filter = { neq?: [string, string]; isNull?: string }

// A narrow view of the PostgREST builder. Threading the real generic builder
// through a helper makes tsc recurse too deep (TS2589), and this only ever
// needs these five calls.
type PgResult = { data: unknown[] | null; count: number | null; error: { message: string } | null }
type LooseQuery = PromiseLike<PgResult> & {
  neq(col: string, v: string): LooseQuery
  is(col: string, v: null): LooseQuery
  order(col: string, o: { ascending: boolean }): LooseQuery
  range(from: number, to: number): LooseQuery
}
type LooseTable = { select(cols: string, opts?: { count?: "exact"; head?: boolean }): LooseQuery }

/** Read a whole table in parallel 1,000-row pages (count first, then every page at once). */
async function readAll<T>(db: SupabaseClient, table: string, cols: string, f: Filter = {}): Promise<T[]> {
  const from = () => db.from(table) as unknown as LooseTable
  const apply = (q: LooseQuery): LooseQuery => {
    let out = q
    if (f.neq) out = out.neq(f.neq[0], f.neq[1])
    if (f.isNull) out = out.is(f.isNull, null)
    return out
  }
  const { count, error } = await apply(from().select("id", { count: "exact", head: true }))
  if (error) throw new Error(`${table} count: ${error.message}`)
  const pages = Math.ceil((count ?? 0) / PAGE)
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      apply(from().select(cols)).order("id", { ascending: true }).range(i * PAGE, (i + 1) * PAGE - 1),
    ),
  )
  const rows: T[] = []
  for (const r of results) {
    if (r.error) throw new Error(`${table}: ${r.error.message}`)
    rows.push(...((r.data ?? []) as T[]))
  }
  return rows
}

function shorten(ex: string): string {
  if (ex.length <= EXCERPT_MAX) return ex
  const cut = ex.slice(0, EXCERPT_MAX - 3)
  const sp = cut.lastIndexOf(" ")
  return `${sp > 0 ? cut.slice(0, sp) : cut}...`
}

export async function buildSketchPayload(db: SupabaseClient): Promise<SketchPayload> {
  type Ep = { id: string; guest: string | null; episode_name: string; archive_label: string | null; air_date: string | null; video_id: string }
  type St = { id: string; episode_id: string; timestamp_seconds: number; title: string; excerpt: string; decision: StoryDecision }
  type Me = { id: string; story_id: string; node_id: string }
  type No = { id: string; name: string; subject_type: StagingSubjectType; decision: NodeDecision }

  const [eps, stories, mentions, nodes] = await Promise.all([
    readAll<Ep>(db, "podcast_staging_episodes", "id, guest, episode_name, archive_label, air_date, video_id"),
    readAll<St>(db, "podcast_staging_stories", "id, episode_id, timestamp_seconds, title, excerpt, decision"),
    // A rejected mention drops that subject from an otherwise kept story.
    readAll<Me>(db, "podcast_staging_mentions", "id, story_id, node_id", { neq: ["decision", "rejected"] }),
    readAll<No>(db, "podcast_staging_nodes", "id, name, subject_type, decision", { isNull: "merged_into" }),
  ])

  // Oldest episode first, so episode indexes read in air order.
  eps.sort((a, b) => (a.air_date ?? "9999").localeCompare(b.air_date ?? "9999") || a.episode_name.localeCompare(b.episode_name))
  const epIdx = new Map(eps.map((e, i) => [e.id, i]))
  const storyById = new Map(stories.map((s) => [s.id, s]))
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  // Which nodes each story names, and the episodes each node appears in.
  const byStory = new Map<string, string[]>()
  const nodeEps = new Map<string, Set<string>>()
  for (const m of mentions) {
    const s = storyById.get(m.story_id)
    if (!s || !nodeById.has(m.node_id)) continue
    let list = byStory.get(m.story_id)
    if (!list) byStory.set(m.story_id, (list = []))
    if (!list.includes(m.node_id)) list.push(m.node_id)
    let set = nodeEps.get(m.node_id)
    if (!set) nodeEps.set(m.node_id, (set = new Set()))
    set.add(s.episode_id)
  }

  // Same drawing rule as the sketch page: threads that come up in two or more
  // episodes. The client applies it again after its trimmed and host toggles.
  const isHost = (n: No) => SKETCH_HOST_NAMES.includes(n.name.trim().toLowerCase())
  const kept = nodes.filter((n) => (nodeEps.get(n.id)?.size ?? 0) >= 2 || isHost(n))
  kept.sort((a, b) => (nodeEps.get(b.id)?.size ?? 0) - (nodeEps.get(a.id)?.size ?? 0) || a.name.localeCompare(b.name))
  const nIdx = new Map(kept.map((n, i) => [n.id, i]))

  const outStories: SketchStory[] = []
  for (const s of stories) {
    const ids = (byStory.get(s.id) ?? []).map((id) => nIdx.get(id)).filter((i): i is number => i !== undefined)
    const ei = epIdx.get(s.episode_id)
    if (!ids.length || ei === undefined) continue
    outStories.push([ei, s.timestamp_seconds, s.title, shorten(s.excerpt ?? ""), ids, s.decision, s.id])
  }
  outStories.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  return {
    episodes: eps.map((e) => [e.guest || e.episode_name, e.archive_label ?? "", e.air_date ?? "", e.video_id, e.id]),
    nodes: kept.map((n) => [n.id, n.name, Math.max(0, SKETCH_TYPES.indexOf(n.subject_type)), n.decision, isHost(n)]),
    stories: outStories,
    meta: { built_at: new Date().toISOString(), episodes: eps.length, stories: outStories.length, nodes: kept.length },
  }
}
