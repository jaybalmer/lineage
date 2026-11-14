// Podcast archive staging: read queries for the admin surface.
//
// One implementation shared by the server-component pages under
// /admin/podcast/staging and the GET routes under /api/admin/podcast-staging,
// so the page and the API cannot drift. Everything is filtered, sorted and
// paginated in SQL (the archive projects to 35,000+ mentions); nothing here is
// meant for the Zustand store.
//
// The caller passes a service-role client after its own strict gate
// (requireModeratorPage / requireModerator): the tables are RLS-on with no
// policies, so nothing else can read them.

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  NodeCandidate,
  NodeDecision,
  NodeFlag,
  NodeResolution,
  StagingSubjectType,
  StoryDecision,
} from "@/lib/podcast-staging"
import { STAGING_SUBJECT_TYPES } from "@/lib/podcast-staging"

export const PAGE_SIZE = 50

const RESOLUTIONS: NodeResolution[] = ["unresolved", "matched", "ambiguous", "review", "new", "needs_detail"]
const STORY_DECISIONS: StoryDecision[] = ["pending", "approved", "trimmed", "hold_sensitive"]

// ── shapes ──────────────────────────────────────────────────────────────────

export type NodeListRow = {
  id: string
  subject_type: StagingSubjectType
  name: string
  resolution: NodeResolution
  subject_id: string | null
  candidates: NodeCandidate[]
  flags: NodeFlag[]
  decision: NodeDecision
  heard_as: string[]
  episode_count: number
  story_count: number
  kept_story_count: number
  mention_count: number
  inferred_count: number
}

export type EpisodeListRow = {
  id: string
  archive_label: string | null
  guest: string | null
  episode_name: string
  proposed_episode_number: number | null
  air_date: string | null
  video_id: string
  status: string
  episode_event_id: string | null
  series_note: string | null
  wave: string | null
  story_count: number
  trimmed_count: number
  mention_count: number
  inferred_count: number
}

export type CastChip = {
  mention_id: string
  node_id: string
  name: string
  subject_type: StagingSubjectType
  resolution: NodeResolution
  heard_as: string | null
  inferred: boolean
}

export type StoryEpisode = {
  id: string
  archive_label: string | null
  guest: string | null
  episode_name: string
  video_id: string
  air_date: string | null
}

export type StoryCardData = {
  id: string
  timestamp_seconds: number
  title: string
  excerpt: string
  decision: StoryDecision
  activity: string | null
  skip_reason: string | null
  episode: StoryEpisode | null
  cast: CastChip[]
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number }

// ── filters ─────────────────────────────────────────────────────────────────

export type NodeFilters = {
  type?: StagingSubjectType | null
  resolution?: NodeResolution | null
  flagged?: boolean
  q?: string | null
  page?: number
}

/** Parse filters from URL search params, dropping anything not on the list. */
export function parseNodeFilters(sp: Record<string, string | string[] | undefined>): NodeFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const type = one("type")
  const resolution = one("resolution")
  return {
    type: type && STAGING_SUBJECT_TYPES.includes(type as StagingSubjectType) ? (type as StagingSubjectType) : null,
    resolution: resolution && RESOLUTIONS.includes(resolution as NodeResolution) ? (resolution as NodeResolution) : null,
    flagged: one("flagged") === "1",
    q: one("q")?.trim() || null,
    page: Math.max(1, Number(one("page")) || 1),
  }
}

export function parseStoryFilters(sp: Record<string, string | string[] | undefined>): { q: string | null; decision: StoryDecision | null; page: number } {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const decision = one("decision")
  return {
    q: one("q")?.trim() || null,
    decision: decision && STORY_DECISIONS.includes(decision as StoryDecision) ? (decision as StoryDecision) : null,
    page: Math.max(1, Number(one("page")) || 1),
  }
}

/** Escape ilike wildcards and PostgREST or-filter syntax in a search term. */
function likeTerm(q: string): string {
  return `%${q.replace(/([%_\\])/g, "\\$1").replace(/[,()]/g, " ")}%`
}

const range = (page: number) => [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1] as const

// ── nodes ───────────────────────────────────────────────────────────────────

export async function listNodes(db: SupabaseClient, f: NodeFilters): Promise<Paged<NodeListRow>> {
  const page = f.page ?? 1
  let q = db
    .from("podcast_staging_node_stats")
    .select("id, subject_type, name, resolution, subject_id, candidates, flags, decision, heard_as, episode_count, story_count, kept_story_count, mention_count, inferred_count", { count: "exact" })
    .is("merged_into", null)
  if (f.type) q = q.eq("subject_type", f.type)
  if (f.resolution) q = q.eq("resolution", f.resolution)
  if (f.flagged) q = q.neq("flags", "{}")
  if (f.q) q = q.ilike("name", likeTerm(f.q))
  const [from, to] = range(page)
  const { data, count, error } = await q
    .order("episode_count", { ascending: false })
    .order("story_count", { ascending: false })
    .order("name", { ascending: true })
    .range(from, to)
  if (error) throw new Error(`list nodes: ${error.message}`)
  return { rows: (data ?? []) as NodeListRow[], total: count ?? 0, page, pageSize: PAGE_SIZE }
}

/** Counts behind the filter chips: per type and per resolution, unfiltered. */
export async function nodeFacetCounts(db: SupabaseClient): Promise<{
  total: number
  flagged: number
  byType: Record<string, number>
  byResolution: Record<string, number>
}> {
  // Head-only counts: a single select is capped at 1000 rows and the archive
  // will hold several thousand nodes, so never pull rows to count them.
  const base = () => db.from("podcast_staging_nodes").select("id", { count: "exact", head: true }).is("merged_into", null)
  const count = async (q: ReturnType<typeof base>) => {
    const { count: n, error } = await q
    if (error) throw new Error(`node facets: ${error.message}`)
    return n ?? 0
  }
  const [total, flagged, typeCounts, resolutionCounts] = await Promise.all([
    count(base()),
    count(base().neq("flags", "{}")),
    Promise.all(STAGING_SUBJECT_TYPES.map((t) => count(base().eq("subject_type", t)))),
    Promise.all(RESOLUTIONS.map((r) => count(base().eq("resolution", r)))),
  ])
  return {
    total,
    flagged,
    byType: Object.fromEntries(STAGING_SUBJECT_TYPES.map((t, i) => [t, typeCounts[i]])),
    byResolution: Object.fromEntries(RESOLUTIONS.map((r, i) => [r, resolutionCounts[i]])),
  }
}

export type NodeDetail = NodeListRow & {
  ghost: Record<string, unknown>
  stories: StoryCardData[]
}

export async function getNode(db: SupabaseClient, id: string): Promise<NodeDetail | null> {
  const { data: node, error } = await db
    .from("podcast_staging_node_stats")
    .select("id, subject_type, name, resolution, subject_id, candidates, flags, decision, heard_as, episode_count, story_count, kept_story_count, mention_count, inferred_count")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`get node: ${error.message}`)
  if (!node) return null

  const { data: ghostRow } = await db.from("podcast_staging_nodes").select("ghost").eq("id", id).maybeSingle()

  const { data: mentions, error: mErr } = await db
    .from("podcast_staging_mentions")
    .select("story_id")
    .eq("node_id", id)
    .range(0, 9999)
  if (mErr) throw new Error(`node mentions: ${mErr.message}`)
  const storyIds = [...new Set(((mentions ?? []) as { story_id: string }[]).map((m) => m.story_id))]
  const stories = await storiesByIds(db, storyIds)
  // Across episodes, oldest air date first, then position in the episode.
  stories.sort((a, b) =>
    (a.episode?.air_date ?? "") === (b.episode?.air_date ?? "")
      ? a.timestamp_seconds - b.timestamp_seconds
      : (a.episode?.air_date ?? "") < (b.episode?.air_date ?? "") ? -1 : 1,
  )

  return {
    ...(node as NodeListRow),
    ghost: ((ghostRow as { ghost: Record<string, unknown> } | null)?.ghost ?? {}) as Record<string, unknown>,
    stories,
  }
}

// ── episodes ────────────────────────────────────────────────────────────────

export async function listEpisodes(db: SupabaseClient, page = 1): Promise<Paged<EpisodeListRow>> {
  const [from, to] = range(page)
  const { data, count, error } = await db
    .from("podcast_staging_episode_stats")
    .select("id, archive_label, guest, episode_name, proposed_episode_number, air_date, video_id, status, episode_event_id, series_note, wave, story_count, trimmed_count, mention_count, inferred_count", { count: "exact" })
    .order("air_date", { ascending: true, nullsFirst: false })
    .order("episode_name", { ascending: true })
    .range(from, to)
  if (error) throw new Error(`list episodes: ${error.message}`)
  return { rows: (data ?? []) as EpisodeListRow[], total: count ?? 0, page, pageSize: PAGE_SIZE }
}

export async function getEpisode(db: SupabaseClient, id: string): Promise<(EpisodeListRow & { notes: string | null; stories: StoryCardData[] }) | null> {
  const { data: ep, error } = await db
    .from("podcast_staging_episode_stats")
    .select("id, archive_label, guest, episode_name, proposed_episode_number, air_date, video_id, status, episode_event_id, series_note, wave, story_count, trimmed_count, mention_count, inferred_count")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`get episode: ${error.message}`)
  if (!ep) return null
  const { data: extra } = await db.from("podcast_staging_episodes").select("notes").eq("id", id).maybeSingle()

  const { data: storyRows, error: sErr } = await db
    .from("podcast_staging_stories")
    .select("id")
    .eq("episode_id", id)
    .range(0, 9999)
  if (sErr) throw new Error(`episode stories: ${sErr.message}`)
  const stories = await storiesByIds(db, ((storyRows ?? []) as { id: string }[]).map((s) => s.id))
  stories.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
  return { ...(ep as EpisodeListRow), notes: (extra as { notes: string | null } | null)?.notes ?? null, stories }
}

// ── stories ─────────────────────────────────────────────────────────────────

export async function listStories(
  db: SupabaseClient,
  f: { q: string | null; decision: StoryDecision | null; page: number },
): Promise<Paged<StoryCardData>> {
  let q = db.from("podcast_staging_stories").select("id", { count: "exact" })
  if (f.q) {
    const term = likeTerm(f.q)
    q = q.or(`title.ilike.${term},excerpt.ilike.${term}`)
  }
  if (f.decision) q = q.eq("decision", f.decision)
  const [from, to] = range(f.page)
  const { data, count, error } = await q
    // Grouped by episode, in episode order within each, so a page reads as runs
    // of one conversation rather than a shuffle.
    .order("episode_id", { ascending: true })
    .order("timestamp_seconds", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to)
  if (error) throw new Error(`list stories: ${error.message}`)
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id)
  const rows = await storiesByIds(db, ids)
  const order = new Map(ids.map((id, i) => [id, i]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return { rows, total: count ?? 0, page: f.page, pageSize: PAGE_SIZE }
}

/** Stories with their episode and full cast, in chunks small enough for an IN list. */
async function storiesByIds(db: SupabaseClient, ids: string[]): Promise<StoryCardData[]> {
  const out: StoryCardData[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const { data, error } = await db
      .from("podcast_staging_stories")
      .select(
        "id, timestamp_seconds, title, excerpt, decision, activity, skip_reason, " +
          "episode:podcast_staging_episodes(id, archive_label, guest, episode_name, video_id, air_date), " +
          "mentions:podcast_staging_mentions(id, heard_as, inferred, node:podcast_staging_nodes(id, name, subject_type, resolution))",
      )
      .in("id", chunk)
    if (error) throw new Error(`stories: ${error.message}`)
    for (const s of (data ?? []) as unknown as {
      id: string
      timestamp_seconds: number
      title: string
      excerpt: string
      decision: StoryDecision
      activity: string | null
      skip_reason: string | null
      episode: StoryEpisode | null
      mentions: { id: string; heard_as: string | null; inferred: boolean; node: { id: string; name: string; subject_type: StagingSubjectType; resolution: NodeResolution } | null }[]
    }[]) {
      out.push({
        id: s.id,
        timestamp_seconds: s.timestamp_seconds,
        title: s.title,
        excerpt: s.excerpt,
        decision: s.decision,
        activity: s.activity,
        skip_reason: s.skip_reason,
        episode: s.episode,
        cast: (s.mentions ?? [])
          .filter((m) => m.node)
          .map((m) => ({
            mention_id: m.id,
            node_id: m.node!.id,
            name: m.node!.name,
            subject_type: m.node!.subject_type,
            resolution: m.node!.resolution,
            heard_as: m.heard_as,
            inferred: m.inferred,
          }))
          .sort((a, b) => STAGING_SUBJECT_TYPES.indexOf(a.subject_type) - STAGING_SUBJECT_TYPES.indexOf(b.subject_type) || a.name.localeCompare(b.name)),
      })
    }
  }
  return out
}
