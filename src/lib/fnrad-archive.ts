// The FNRad Archive (briefs/fnrad-archive-surface-brief-v1.md, Part A1).
//
// Server only. Builds the small index the /fnrad/archive page ships with: every
// subject named on a LIVE FNRad episode, how many live episodes and stories name
// it, and who it shares stories with. No excerpts: stories load on demand per
// node from GET /api/mentions?shape=capped (D3).
//
// Public tables only (D1). podcast_staging_* is never read here: "published
// mention on a live episode" is the single switch for what the world sees.
//
// One build is shared by every visitor through unstable_cache (revalidated
// hourly, tag FNRAD_ARCHIVE_TAG). The staging publish and unpublish routes and
// the event public-link route invalidate the tag, so a newly live episode shows
// up without waiting for the hour.

import { unstable_cache } from "next/cache"
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force"
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force"
import { getServiceClient } from "@/lib/auth"
import { FNRAD_ARCHIVE_HREF, FNRAD_HOST_NAMES, FNRAD_SHOW_SLUG, episodeDisplayLabel } from "@/lib/fnrad"
import { mentionHref } from "@/lib/mention-links"
import type { PublicTimelineEntities } from "@/lib/public-timeline-read"
import type { MentionSubjectType } from "@/types"
import { ARCHIVE_TYPES, FNRAD_ARCHIVE_TAG, archiveScaleLine } from "@/lib/fnrad-archive-shared"
import type { ArchiveCardData, ArchiveEdge, ArchiveEpisode, ArchiveIndex, ArchiveNode, ArchiveNodeStories, ArchiveType } from "@/lib/fnrad-archive-shared"

export { ARCHIVE_TYPES, FNRAD_ARCHIVE_TAG, REPORT_HREF, TYPE_LABELS, archiveScaleLine, findFocus } from "@/lib/fnrad-archive-shared"
export type { ArchiveCardData, ArchiveEdge, ArchiveEpisode, ArchiveIndex, ArchiveNode, ArchiveNodeStories, ArchiveType } from "@/lib/fnrad-archive-shared"

/** A story naming more subjects than this is a roll call, not a connection. */
const ROLL_CALL = 12
/** Edges kept per node (union of each endpoint's heaviest). Mobile shows 12. */
const EDGES_PER_NODE = 12

const PAGE = 1000 // PostgREST row cap per request
const ID_CHUNK = 150 // keeps .in() URLs well under the gateway limit

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

function isLive(row: { public_enabled: boolean | null; publish_at: string | null }, now: number): boolean {
  if (row.public_enabled !== true) return false
  if (!row.publish_at) return true
  const at = Date.parse(row.publish_at)
  return Number.isFinite(at) && at <= now
}

/** The show's own label and the year, never the internal episode_number (Part C). */
function episodeLabel(e: { episode_label: string | null; year: number | null; start_date: string | null }): string {
  const year = e.year ?? (e.start_date ? Number(e.start_date.slice(0, 4)) : null)
  return [episodeDisplayLabel(e), year ? String(year) : null].filter(Boolean).join(" · ")
}

type EpisodeRow = {
  id: string
  name: string
  public_slug: string | null
  start_date: string | null
  year: number | null
  episode_label: string | null
  public_enabled: boolean | null
  publish_at: string | null
}
type MentionRow = { episode_event_id: string; subject_type: MentionSubjectType; subject_id: string; timestamp_seconds: number | null }

const emptyIndex = (): ArchiveIndex => ({
  built_at: new Date().toISOString(),
  totals: { episodes: 0, stories: 0, people: 0, places: 0, orgs: 0, boards: 0, events: 0 },
  nodes: [],
  edges: [],
  episodes: [],
})

/** Names for every subject, by type, chunked. Profiles first, catalog people win. */
async function resolveNames(db: ReturnType<typeof getServiceClient>, ids: Record<ArchiveType, string[]>) {
  const entities: PublicTimelineEntities = { people: {}, places: {}, events: {}, orgs: {}, boards: {} }
  const read = async <T>(table: string, cols: string, list: string[]): Promise<T[]> => {
    const out: T[] = []
    await Promise.all(
      chunks(list, ID_CHUNK).map(async (part) => {
        const { data, error } = await db.from(table).select(cols).in("id", part)
        if (error) throw new Error(`${table}: ${error.message}`)
        out.push(...((data ?? []) as T[]))
      }),
    )
    return out
  }
  type Named = { id: string; name: string }
  type Person = { id: string; display_name: string | null }
  type Board = { id: string; brand: string; model: string; model_year: number | null }
  const [profiles, people, places, orgs, events, boards] = await Promise.all([
    read<Person>("profiles", "id, display_name", ids.person),
    read<Person>("people", "id, display_name", ids.person),
    read<Named>("places", "id, name", ids.place),
    read<Named>("orgs", "id, name", ids.org),
    read<Named>("events", "id, name", ids.event),
    read<Board>("boards", "id, brand, model, model_year", ids.board),
  ])
  // mentionHref only reads the name fields; the rest of each Lite shape is unused here.
  for (const r of [...profiles, ...people]) {
    if (r.display_name) entities.people[r.id] = { id: r.id, display_name: r.display_name } as never
  }
  for (const r of places) entities.places[r.id] = { id: r.id, name: r.name } as never
  for (const r of orgs) entities.orgs[r.id] = { id: r.id, name: r.name } as never
  for (const r of events) entities.events[r.id] = { id: r.id, name: r.name } as never
  for (const r of boards) entities.boards[r.id] = r as never
  return entities
}

function nameOf(type: ArchiveType, id: string, e: PublicTimelineEntities): string | null {
  if (type === "person") return e.people[id]?.display_name ?? null
  if (type === "place") return e.places[id]?.name ?? null
  if (type === "org") return e.orgs[id]?.name ?? null
  if (type === "event") return e.events[id]?.name ?? null
  const b = e.boards[id]
  return b ? [b.brand, b.model].filter(Boolean).join(" ") || null : null
}

export async function buildArchiveIndex(): Promise<ArchiveIndex> {
  const db = getServiceClient()
  const now = Date.now()

  // A failed lookup must throw, not read as "no show": an empty index returned
  // here used to be cached for the hour and blanked /fnrad/archive.
  const { data: show, error: showError } = await db.from("orgs").select("id").eq("public_slug", FNRAD_SHOW_SLUG).maybeSingle()
  if (showError) throw new Error(`show: ${showError.message}`)
  const showId = (show as { id: string } | null)?.id
  if (!showId) return emptyIndex()

  const episodeRows: EpisodeRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("events")
      .select("id, name, public_slug, start_date, year, episode_label, public_enabled, publish_at")
      .eq("event_type", "episode")
      .eq("show_org_id", showId)
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`episodes: ${error.message}`)
    const page = (data ?? []) as EpisodeRow[]
    episodeRows.push(...page)
    if (page.length < PAGE) break
  }
  const live = episodeRows.filter((e) => isLive(e, now))
  if (!live.length) return emptyIndex()

  // Every published mention on a live episode, paged per episode chunk.
  const mentions: MentionRow[] = []
  await Promise.all(
    chunks(live.map((e) => e.id), 40).map(async (ids) => {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from("mentions")
          .select("episode_event_id, subject_type, subject_id, timestamp_seconds")
          .in("episode_event_id", ids)
          .eq("status", "published")
          .order("id")
          .range(from, from + PAGE - 1)
        if (error) throw new Error(`mentions: ${error.message}`)
        const page = (data ?? []) as MentionRow[]
        mentions.push(...page)
        if (page.length < PAGE) break
      }
    }),
  )

  // Per subject: live episodes and stories. A story is one (episode, timestamp).
  type Stat = { type: ArchiveType; id: string; episodes: Set<string>; stories: Set<string> }
  const stats = new Map<string, Stat>()
  const storySubjects = new Map<string, Set<string>>()
  for (const m of mentions) {
    if (!(ARCHIVE_TYPES as readonly string[]).includes(m.subject_type)) continue
    const key = `${m.subject_type}:${m.subject_id}`
    let s = stats.get(key)
    if (!s) {
      s = { type: m.subject_type as ArchiveType, id: m.subject_id, episodes: new Set(), stories: new Set() }
      stats.set(key, s)
    }
    s.episodes.add(m.episode_event_id)
    if (m.timestamp_seconds == null) continue
    const story = `${m.episode_event_id}|${m.timestamp_seconds}`
    s.stories.add(story)
    const set = storySubjects.get(story) ?? new Set<string>()
    set.add(key)
    storySubjects.set(story, set)
  }

  const idsByType = Object.fromEntries(ARCHIVE_TYPES.map((t) => [t, [] as string[]])) as Record<ArchiveType, string[]>
  for (const s of stats.values()) idsByType[s.type].push(s.id)
  const entities = await resolveNames(db, idsByType)

  // Drop anything whose catalog row cannot be read: never render a bare id.
  const hosts = FNRAD_HOST_NAMES.map((n) => n.toLowerCase())
  type Draft = { key: string; type: ArchiveType; id: string; name: string; href: string | null; eps: number; stories: number; host: boolean }
  const drafts: Draft[] = []
  let dropped = 0
  for (const [key, s] of stats) {
    const name = nameOf(s.type, s.id, entities)
    if (!name) {
      dropped++
      continue
    }
    drafts.push({
      key,
      type: s.type,
      id: s.id,
      name,
      href: mentionHref(s.type, s.id, entities),
      eps: s.episodes.size,
      stories: s.stories.size,
      host: s.type === "person" && hosts.includes(name.trim().toLowerCase()),
    })
  }
  if (dropped) console.warn(`[fnrad-archive] dropped ${dropped} subjects with no readable catalog row`)
  drafts.sort((a, b) => b.eps - a.eps || b.stories - a.stories || a.name.localeCompare(b.name))
  const indexOf = new Map(drafts.map((d, i) => [d.key, i]))

  // Edges: subjects named in the same story, weight = shared stories.
  const weights = new Map<string, number>()
  for (const subjects of storySubjects.values()) {
    if (subjects.size < 2 || subjects.size > ROLL_CALL) continue
    const idx = [...subjects].map((k) => indexOf.get(k)).filter((i): i is number => i != null).sort((a, b) => a - b)
    for (let i = 0; i < idx.length; i++) {
      for (let j = i + 1; j < idx.length; j++) {
        const k = `${idx[i]},${idx[j]}`
        weights.set(k, (weights.get(k) ?? 0) + 1)
      }
    }
  }
  const all: ArchiveEdge[] = [...weights].map(([k, w]) => {
    const [a, b] = k.split(",").map(Number)
    return [a, b, w]
  })
  const byNode = new Map<number, ArchiveEdge[]>()
  for (const e of all) {
    for (const n of [e[0], e[1]]) {
      const list = byNode.get(n) ?? []
      list.push(e)
      byNode.set(n, list)
    }
  }
  const keep = new Set<ArchiveEdge>()
  for (const list of byNode.values()) {
    list.sort((x, y) => y[2] - x[2])
    for (const e of list.slice(0, EDGES_PER_NODE)) keep.add(e)
  }
  const edges = [...keep].sort((x, y) => x[0] - y[0] || x[1] - y[1])

  // Stories per episode: distinct (episode, timestamp), the same definition as totals.stories.
  const storiesByEpisode = new Map<string, number>()
  for (const story of storySubjects.keys()) {
    const ep = story.slice(0, story.indexOf("|"))
    storiesByEpisode.set(ep, (storiesByEpisode.get(ep) ?? 0) + 1)
  }
  const episodes: ArchiveEpisode[] = live
    .map((e): ArchiveEpisode => [e.id, e.public_slug, episodeLabel(e), e.name, e.start_date ?? "", storiesByEpisode.get(e.id) ?? 0])
    .sort((a, b) => b[4].localeCompare(a[4]) || a[3].localeCompare(b[3]))

  const count = (t: ArchiveType) => drafts.filter((d) => d.type === t).length
  return {
    built_at: new Date().toISOString(),
    totals: {
      episodes: live.length,
      stories: storySubjects.size,
      people: count("person"),
      places: count("place"),
      orgs: count("org"),
      boards: count("board"),
      events: count("event"),
    },
    nodes: drafts.map((d): ArchiveNode => [ARCHIVE_TYPES.indexOf(d.type), d.id, d.name, d.href, d.eps, d.stories, d.host]),
    edges,
    episodes,
  }
}

/** Never cache an empty index. The live archive always has episodes, so an
 *  empty build means a read went wrong; throwing keeps it out of the cache and
 *  the next request rebuilds, instead of serving an empty archive for an hour. */
async function buildNonEmptyArchiveIndex(): Promise<ArchiveIndex> {
  const index = await buildArchiveIndex()
  if (!index.totals.episodes || !index.nodes.length) throw new Error("empty archive index, not caching")
  return index
}

/** The shared, cached index. One build per hour, or per invalidation. A failed
 *  or empty build throws (and is not cached); callers fall back to emptyIndex(). */
export const getArchiveIndex = unstable_cache(buildNonEmptyArchiveIndex, ["fnrad-archive-index-v4"], {
  revalidate: 3600,
  tags: [FNRAD_ARCHIVE_TAG],
})

export async function readArchiveIndex(): Promise<ArchiveIndex> {
  try {
    return await getArchiveIndex()
  } catch (e) {
    console.error("[fnrad-archive] index build failed", e)
    return emptyIndex()
  }
}

// ── The archive card (briefs/fnrad-archive-front-doors-brief-v1.md, A1) ──────

const SKY_NODES = 70
const SKY_LABELS = 8
const SKY_W = 1000
const SKY_H = 600

type SkyNode = SimulationNodeDatum & { i: number; r: number }
type SkyLink = SimulationLinkDatum<SkyNode> & { w: number }

/** Same population rule as the live sky (two or more episodes, host left out),
 *  laid out once with d3-force. d3-force seeds its own random source and the
 *  starting spiral is fixed, so one index always gives the same picture. */
export function buildArchiveCardData(index: ArchiveIndex): ArchiveCardData | null {
  if (!index.totals.episodes) return null

  // index.nodes is already sorted by episodes, then stories.
  const picks: number[] = []
  for (let i = 0; i < index.nodes.length && picks.length < SKY_NODES; i++) {
    const n = index.nodes[i]
    if (!n[6] && n[4] >= 2) picks.push(i)
  }
  const pos = new Map(picks.map((i, k) => [i, k]))
  // Radius is in final viewBox units; the layout is scaled, the stars are not.
  const radiusOf = (eps: number) => 2 + Math.sqrt(eps) * 1.8
  const nodes: SkyNode[] = picks.map((i, k) => {
    const a = k * 2.399963 // golden angle
    const d = 14 * Math.sqrt(k + 1)
    return { i, r: radiusOf(index.nodes[i][4]), x: Math.cos(a) * d * 1.6, y: Math.sin(a) * d }
  })
  const links: SkyLink[] = []
  for (const [a, b, w] of index.edges) {
    const ka = pos.get(a)
    const kb = pos.get(b)
    if (ka != null && kb != null) links.push({ source: nodes[ka], target: nodes[kb], w })
  }
  const sim = forceSimulation(nodes)
    .force("link", forceLink<SkyNode, SkyLink>(links).distance((l) => 90 - Math.min(40, l.w)).strength((l) => Math.min(0.7, 0.05 + l.w / 50)))
    .force("charge", forceManyBody().strength(-260))
    .force("x", forceX(0).strength(0.02))
    .force("y", forceY(0).strength(0.07))
    .force("collide", forceCollide<SkyNode>((d) => d.r * 1.8 + 12))
    .force("center", forceCenter(0, 0))
    .stop()
  for (let t = 0; t < 300; t++) sim.tick()

  // Fit into the right of the viewBox so the left stays quiet for the text.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x!); maxX = Math.max(maxX, n.x!)
    minY = Math.min(minY, n.y!); maxY = Math.max(maxY, n.y!)
  }
  const box = { x0: 480, x1: SKY_W - 45, y0: 95, y1: SKY_H - 55 }
  const kx = (box.x1 - box.x0) / (maxX - minX || 1)
  const ky = (box.y1 - box.y0) / (maxY - minY || 1)
  const round = (v: number) => Math.round(v * 10) / 10
  const placed = nodes.map((n) => ({
    x: round(box.x0 + (n.x! - minX) * kx),
    y: round(box.y0 + (n.y! - minY) * ky),
    r: round(n.r),
  }))

  // Labels on the largest stars whose label box clears every label already placed.
  const labelled = new Set<number>()
  const boxes: [number, number, number, number][] = []
  for (let j = 0; j < placed.length && labelled.size < SKY_LABELS; j++) {
    const { x, y, r } = placed[j]
    const w = index.nodes[nodes[j].i][2].length * 9.5
    const bx: [number, number, number, number] = [x - w / 2, y - r - 26, x + w / 2, y - r - 4]
    if (bx[0] < 20 || bx[2] > SKY_W - 10 || bx[1] < 10) continue
    if (boxes.some((o) => bx[0] < o[2] + 8 && bx[2] > o[0] - 8 && bx[1] < o[3] + 4 && bx[3] > o[1] - 4)) continue
    boxes.push(bx)
    labelled.add(j)
  }

  const sky: ArchiveCardData["sky"] = {
    nodes: placed.map(({ x, y, r }, j) => [x, y, r, index.nodes[nodes[j].i][0], labelled.has(j) ? index.nodes[nodes[j].i][2] : null]),
    edges: links.map((l) => [pos.get((l.source as SkyNode).i)!, pos.get((l.target as SkyNode).i)!]),
  }

  // D5: the top person, place and brand by story count. Never hardcoded.
  const featured: ArchiveCardData["featured"] = []
  for (const type of ["person", "place", "org"] as const) {
    const t = ARCHIVE_TYPES.indexOf(type)
    let best: ArchiveNode | null = null
    for (const n of index.nodes) {
      if (n[0] !== t || n[6]) continue
      if (!best || n[5] > best[5]) best = n
    }
    if (best && best[5] > 0) {
      const focus = `${type}:${best[1]}`
      featured.push({ type: t, name: best[2], stories: best[5], focus, href: `${FNRAD_ARCHIVE_HREF}?focus=${encodeURIComponent(focus)}` })
    }
  }

  return { totals: index.totals, scaleLine: archiveScaleLine(index.totals), sky, featured }
}

const getArchiveCardDataCached = unstable_cache(
  async () => buildArchiveCardData(await getArchiveIndex()),
  ["fnrad-archive-card-v4"],
  { revalidate: 3600, tags: [FNRAD_ARCHIVE_TAG] },
)

/** The card data, or null when the archive is empty or the build failed. Every
 *  placement renders nothing on null. */
export async function getArchiveCardData(): Promise<ArchiveCardData | null> {
  try {
    return await getArchiveCardDataCached()
  } catch (e) {
    console.error("[fnrad-archive] card build failed", e)
    return null
  }
}

// ── One node's stories (Path view, pair panel, story list) ───────────────────

const nodeStoriesCached = unstable_cache(
  async (type: ArchiveType, id: string): Promise<ArchiveNodeStories> => {
    const index = await getArchiveIndex()
    const live = new Set(index.episodes.map((e) => e[0]))
    const date = new Map(index.episodes.map((e) => [e[0], e[4]]))
    const db = getServiceClient()

    type Own = { episode_event_id: string; timestamp_seconds: number | null; story_title: string | null; excerpt: string | null; story_start_year: number | null; story_end_year: number | null }
    const own: Own[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("mentions")
        .select("episode_event_id, timestamp_seconds, story_title, excerpt, story_start_year, story_end_year")
        .eq("subject_type", type)
        .eq("subject_id", id)
        .eq("status", "published")
        .order("id")
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`node mentions: ${error.message}`)
      const page = (data ?? []) as Own[]
      own.push(...page)
      if (page.length < PAGE) break
    }

    // One row per story (episode, timestamp) on a live episode.
    const stories = new Map<string, Own>()
    for (const m of own) {
      if (!live.has(m.episode_event_id) || m.timestamp_seconds == null) continue
      const k = `${m.episode_event_id}|${m.timestamp_seconds}`
      if (!stories.has(k)) stories.set(k, m)
    }

    // Everyone else named in those stories.
    const withByStory = new Map<string, Set<string>>()
    const episodes = [...new Set([...stories.values()].map((s) => s.episode_event_id))]
    const self = `${ARCHIVE_TYPES.indexOf(type)}:${id}`
    await Promise.all(
      chunks(episodes, 40).map(async (ids) => {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await db
            .from("mentions")
            .select("episode_event_id, timestamp_seconds, subject_type, subject_id")
            .in("episode_event_id", ids)
            .eq("status", "published")
            .order("id")
            .range(from, from + PAGE - 1)
          if (error) throw new Error(`co-mentions: ${error.message}`)
          const page = (data ?? []) as MentionRow[]
          for (const m of page) {
            const k = `${m.episode_event_id}|${m.timestamp_seconds}`
            if (!stories.has(k)) continue
            const t = ARCHIVE_TYPES.indexOf(m.subject_type as ArchiveType)
            if (t < 0) continue
            const key = `${t}:${m.subject_id}`
            if (key === self) continue
            const set = withByStory.get(k) ?? new Set<string>()
            set.add(key)
            withByStory.set(k, set)
          }
          if (page.length < PAGE) break
        }
      }),
    )

    const out: ArchiveNodeStories["stories"] = [...stories.entries()].map(([k, s]) => {
      const others = [...(withByStory.get(k) ?? [])]
      return [
        s.episode_event_id,
        s.timestamp_seconds!,
        s.story_title ?? "",
        s.excerpt ?? "",
        s.story_start_year,
        s.story_end_year,
        // A roll call names too many to mean anything together (same rule as the edges).
        others.length + 1 > ROLL_CALL ? [] : others,
      ]
    })
    out.sort((a, b) => (date.get(b[0]) ?? "").localeCompare(date.get(a[0]) ?? "") || a[1] - b[1])

    // Media links for the "Listen at" links on each story.
    const media: Record<string, string> = {}
    await Promise.all(
      chunks(episodes, ID_CHUNK).map(async (ids) => {
        const { data, error } = await db.from("events").select("id, media_url").in("id", ids)
        if (error) throw new Error(`episode media: ${error.message}`)
        for (const r of (data ?? []) as { id: string; media_url: string | null }[]) if (r.media_url) media[r.id] = r.media_url
      }),
    )
    return { stories: out, media }
  },
  ["fnrad-archive-node-v1"],
  { revalidate: 3600, tags: [FNRAD_ARCHIVE_TAG] },
)

/** Every story about one node, with its years and the other subjects in it. */
export async function getArchiveNodeStories(type: ArchiveType, id: string): Promise<ArchiveNodeStories> {
  return nodeStoriesCached(type, id)
}
