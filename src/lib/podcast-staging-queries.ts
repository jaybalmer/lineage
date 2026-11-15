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
const NODE_DECISIONS: NodeDecision[] = ["pending", "approved", "hold", "rejected"]

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
  pending_count: number
  approved_count: number
  held_count: number
  trimmed_count: number
  /** Approved stories whose mention of this node will publish and has not yet. */
  ready_count: number
  published_story_count: number
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
  pending_count: number
  approved_count: number
  held_count: number
  /** Approved stories with at least one mention that will publish and has not yet. */
  ready_count: number
  published_story_count: number
}

export type CastChip = {
  mention_id: string
  node_id: string
  name: string
  subject_type: StagingSubjectType
  resolution: NodeResolution
  heard_as: string | null
  inferred: boolean
  /** "rejected" drops this subject from an otherwise approved story (T9). */
  decision: "inherit" | "rejected"
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
  /** D11: newer seed content waiting beside a decided story. */
  revision_pending: { excerpt?: string; activity?: string | null; skip_reason?: string | null; decision?: string } | null
  episode: StoryEpisode | null
  cast: CastChip[]
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number }

// ── filters ─────────────────────────────────────────────────────────────────

export type NodeFilters = {
  type?: StagingSubjectType | null
  resolution?: NodeResolution | null
  flagged?: boolean
  decision?: NodeDecision | null
  q?: string | null
  page?: number
}

/** Parse filters from URL search params, dropping anything not on the list. */
export function parseNodeFilters(sp: Record<string, string | string[] | undefined>): NodeFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const type = one("type")
  const resolution = one("resolution")
  const decision = one("decision")
  return {
    decision: decision && NODE_DECISIONS.includes(decision as NodeDecision) ? (decision as NodeDecision) : null,
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
    .select("id, subject_type, name, resolution, subject_id, candidates, flags, decision, heard_as, episode_count, story_count, kept_story_count, mention_count, inferred_count, pending_count, approved_count, held_count, trimmed_count, ready_count, published_story_count", { count: "exact" })
    .is("merged_into", null)
  if (f.type) q = q.eq("subject_type", f.type)
  if (f.resolution) q = q.eq("resolution", f.resolution)
  if (f.flagged) q = q.neq("flags", "{}")
  if (f.decision) q = q.eq("decision", f.decision)
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
  byDecision: Record<string, number>
}> {
  // Head-only counts: a single select is capped at 1000 rows and the archive
  // will hold several thousand nodes, so never pull rows to count them.
  const base = () => db.from("podcast_staging_nodes").select("id", { count: "exact", head: true }).is("merged_into", null)
  const count = async (q: ReturnType<typeof base>) => {
    const { count: n, error } = await q
    if (error) throw new Error(`node facets: ${error.message}`)
    return n ?? 0
  }
  const [total, flagged, typeCounts, resolutionCounts, decisionCounts] = await Promise.all([
    count(base()),
    count(base().neq("flags", "{}")),
    Promise.all(STAGING_SUBJECT_TYPES.map((t) => count(base().eq("subject_type", t)))),
    Promise.all(RESOLUTIONS.map((r) => count(base().eq("resolution", r)))),
    Promise.all(NODE_DECISIONS.map((d) => count(base().eq("decision", d)))),
  ])
  return {
    total,
    flagged,
    byDecision: Object.fromEntries(NODE_DECISIONS.map((d, i) => [d, decisionCounts[i]])),
    byType: Object.fromEntries(STAGING_SUBJECT_TYPES.map((t, i) => [t, typeCounts[i]])),
    byResolution: Object.fromEntries(RESOLUTIONS.map((r, i) => [r, resolutionCounts[i]])),
  }
}

export type NodeDetail = NodeListRow & {
  ghost: Record<string, unknown>
  decided_at: string | null
  also_known_as: { id: string; name: string; subject_type: StagingSubjectType } | null
  /** One page of this node's stories (NODE_STORY_PAGE_SIZE), not all of them. */
  stories: StoryCardData[]
  storyTotal: number
  storyPage: number
  storyPageSize: number
  storyDecision: StoryDecision | null
}

/** Stories per page on a node page. A busy node (the host, Burton) has 800 to 1,200. */
export const NODE_STORY_PAGE_SIZE = 25

export function parseNodeStoryFilters(sp: Record<string, string | string[] | undefined>): { decision: StoryDecision | null; page: number } {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const decision = one("decision")
  return {
    decision: decision && STORY_DECISIONS.includes(decision as StoryDecision) ? (decision as StoryDecision) : null,
    page: Math.max(1, Number(one("page")) || 1),
  }
}

/**
 * One page of the stories that name a node, oldest air date first, then by
 * position in the episode. Only the light sort keys are read for the whole set
 * (in 1,000-row pages, the PostgREST cap); full cards are built for one page.
 */
async function nodeStoryPage(
  db: SupabaseClient,
  nodeId: string,
  opts: { decision: StoryDecision | null; page: number },
): Promise<Paged<StoryCardData>> {
  type Key = { id: string; t: number; air: string }
  const keys = new Map<string, Key>()
  for (let from = 0; ; from += 1000) {
    let q = db
      .from("podcast_staging_mentions")
      .select("story:podcast_staging_stories!inner(id, decision, timestamp_seconds, episode:podcast_staging_episodes(air_date))")
      .eq("node_id", nodeId)
    if (opts.decision) q = q.eq("story.decision", opts.decision)
    const { data, error } = await q.order("id", { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`node stories: ${error.message}`)
    const rows = (data ?? []) as unknown as { story: { id: string; timestamp_seconds: number; episode: { air_date: string | null } | null } | null }[]
    for (const r of rows) {
      if (r.story) keys.set(r.story.id, { id: r.story.id, t: r.story.timestamp_seconds, air: r.story.episode?.air_date ?? "" })
    }
    if (rows.length < 1000) break
  }
  const ordered = [...keys.values()].sort((a, b) => (a.air === b.air ? a.t - b.t : a.air < b.air ? -1 : 1))
  const total = ordered.length
  const page = Math.min(opts.page, Math.max(1, Math.ceil(total / NODE_STORY_PAGE_SIZE)))
  const ids = ordered.slice((page - 1) * NODE_STORY_PAGE_SIZE, page * NODE_STORY_PAGE_SIZE).map((k) => k.id)
  const rows = await storiesByIds(db, ids)
  const pos = new Map(ids.map((sid, i) => [sid, i]))
  rows.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
  return { rows, total, page, pageSize: NODE_STORY_PAGE_SIZE }
}

export async function getNode(
  db: SupabaseClient,
  id: string,
  opts: { decision: StoryDecision | null; page: number } = { decision: null, page: 1 },
): Promise<NodeDetail | null> {
  const { data: node, error } = await db
    .from("podcast_staging_node_stats")
    .select("id, subject_type, name, resolution, subject_id, candidates, flags, decision, heard_as, episode_count, story_count, kept_story_count, mention_count, inferred_count, pending_count, approved_count, held_count, trimmed_count, ready_count, published_story_count")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`get node: ${error.message}`)
  if (!node) return null

  const { data: extraRow } = await db
    .from("podcast_staging_nodes")
    .select("ghost, decided_at, also_known_as")
    .eq("id", id)
    .maybeSingle()
  const extra = extraRow as { ghost: Record<string, unknown> | null; decided_at: string | null; also_known_as: string | null } | null
  let aka: { id: string; name: string; subject_type: StagingSubjectType } | null = null
  if (extra?.also_known_as) {
    const { data: akaRow } = await db.from("podcast_staging_nodes").select("id, name, subject_type").eq("id", extra.also_known_as).maybeSingle()
    aka = (akaRow as typeof aka) ?? null
  }

  const storyPage = await nodeStoryPage(db, id, opts)

  return {
    ...(node as NodeListRow),
    ghost: extra?.ghost ?? {},
    decided_at: extra?.decided_at ?? null,
    also_known_as: aka,
    stories: storyPage.rows,
    storyTotal: storyPage.total,
    storyPage: storyPage.page,
    storyPageSize: storyPage.pageSize,
    storyDecision: opts.decision,
  }
}

// ── episodes ────────────────────────────────────────────────────────────────

export async function listEpisodes(db: SupabaseClient, page = 1): Promise<Paged<EpisodeListRow>> {
  const [from, to] = range(page)
  const { data, count, error } = await db
    .from("podcast_staging_episode_stats")
    .select("id, archive_label, guest, episode_name, proposed_episode_number, air_date, video_id, status, episode_event_id, series_note, wave, story_count, trimmed_count, mention_count, inferred_count, pending_count, approved_count, held_count, ready_count, published_story_count", { count: "exact" })
    .order("air_date", { ascending: true, nullsFirst: false })
    .order("episode_name", { ascending: true })
    .range(from, to)
  if (error) throw new Error(`list episodes: ${error.message}`)
  return { rows: (data ?? []) as EpisodeListRow[], total: count ?? 0, page, pageSize: PAGE_SIZE }
}

export async function getEpisode(db: SupabaseClient, id: string): Promise<(EpisodeListRow & { notes: string | null; published_mentions: number; stories: StoryCardData[] }) | null> {
  const { data: ep, error } = await db
    .from("podcast_staging_episode_stats")
    .select("id, archive_label, guest, episode_name, proposed_episode_number, air_date, video_id, status, episode_event_id, series_note, wave, story_count, trimmed_count, mention_count, inferred_count, pending_count, approved_count, held_count, ready_count, published_story_count")
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
  // How many of this episode's staged mentions a publish has written out.
  let published = 0
  const storyIdList = stories.map((st) => st.id)
  for (let i = 0; i < storyIdList.length; i += 150) {
    const { count } = await db
      .from("podcast_staging_mentions")
      .select("id", { count: "exact", head: true })
      .in("story_id", storyIdList.slice(i, i + 150))
      .not("published_mention_id", "is", null)
    published += count ?? 0
  }
  return { ...(ep as EpisodeListRow), notes: (extra as { notes: string | null } | null)?.notes ?? null, published_mentions: published, stories }
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
        "id, timestamp_seconds, title, excerpt, decision, activity, skip_reason, revision_pending, " +
          "episode:podcast_staging_episodes(id, archive_label, guest, episode_name, video_id, air_date), " +
          "mentions:podcast_staging_mentions(id, heard_as, inferred, decision, node:podcast_staging_nodes(id, name, subject_type, resolution))",
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
      revision_pending: StoryCardData["revision_pending"]
      episode: StoryEpisode | null
      mentions: { id: string; heard_as: string | null; inferred: boolean; decision: "inherit" | "rejected"; node: { id: string; name: string; subject_type: StagingSubjectType; resolution: NodeResolution } | null }[]
    }[]) {
      out.push({
        id: s.id,
        timestamp_seconds: s.timestamp_seconds,
        title: s.title,
        excerpt: s.excerpt,
        decision: s.decision,
        activity: s.activity,
        skip_reason: s.skip_reason,
        revision_pending: s.revision_pending,
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
            decision: m.decision,
          }))
          .sort((a, b) => STAGING_SUBJECT_TYPES.indexOf(a.subject_type) - STAGING_SUBJECT_TYPES.indexOf(b.subject_type) || a.name.localeCompare(b.name)),
      })
    }
  }
  return out
}

// ── catalog search (the "pick a match" picker) ──────────────────────────────

export type CatalogHit = { id: string; label: string }

/** Up to 20 catalog rows of one type whose name contains the term. Episodes excluded. */
export async function searchCatalog(db: SupabaseClient, type: StagingSubjectType, q: string): Promise<CatalogHit[]> {
  const term = likeTerm(q)
  if (type === "person") {
    const [{ data: people }, { data: profiles }] = await Promise.all([
      db.from("people").select("id, display_name, node_status").ilike("display_name", term).limit(20),
      db.from("profiles").select("id, display_name, is_archived").ilike("display_name", term).limit(20),
    ])
    const out: CatalogHit[] = []
    const seen = new Set<string>()
    for (const p of (profiles ?? []) as { id: string; display_name: string; is_archived: boolean | null }[]) {
      if (p.is_archived) continue
      seen.add(p.id)
      out.push({ id: p.id, label: `${p.display_name} (member)` })
    }
    for (const p of (people ?? []) as { id: string; display_name: string; node_status: string | null }[]) {
      if (!seen.has(p.id)) out.push({ id: p.id, label: `${p.display_name} (${p.node_status})` })
    }
    return out.slice(0, 20)
  }
  if (type === "place") {
    const { data } = await db.from("places").select("id, name, place_type").ilike("name", term).order("name").limit(20)
    return ((data ?? []) as { id: string; name: string; place_type: string | null }[]).map((p) => ({ id: p.id, label: `${p.name} (${p.place_type})` }))
  }
  if (type === "org") {
    const { data } = await db.from("orgs").select("id, name, org_type").ilike("name", term).order("name").limit(20)
    return ((data ?? []) as { id: string; name: string; org_type: string | null }[]).map((o) => ({ id: o.id, label: `${o.name} (${o.org_type})` }))
  }
  if (type === "event") {
    const { data } = await db
      .from("events")
      .select("id, name, year")
      .ilike("name", term)
      .neq("event_type", "episode")
      .order("year")
      .limit(20)
    return ((data ?? []) as { id: string; name: string; year: number | null }[]).map((e) => ({ id: e.id, label: `${e.name}${e.year ? ` (${e.year})` : ""}` }))
  }
  // Boards: every word must appear in the brand or the model.
  let bq = db.from("boards").select("id, brand, model, model_year")
  for (const w of q.split(/\s+/).filter(Boolean).slice(0, 4)) {
    const t = likeTerm(w)
    bq = bq.or(`brand.ilike.${t},model.ilike.${t}`)
  }
  const { data } = await bq.order("brand").order("model").order("model_year").limit(20)
  return ((data ?? []) as { id: string; brand: string; model: string; model_year: number | null }[]).map((b) => ({
    id: b.id,
    label: `${b.brand} ${b.model}${b.model_year ? ` ${b.model_year}` : ""}`,
  }))
}
