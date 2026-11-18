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
import { getServiceClient } from "@/lib/auth"
import { FNRAD_HOST_NAMES, FNRAD_SHOW_SLUG, episodeDisplayLabel } from "@/lib/fnrad"
import { mentionHref } from "@/lib/mention-links"
import type { PublicTimelineEntities } from "@/lib/public-timeline-read"
import type { MentionSubjectType } from "@/types"
import { ARCHIVE_TYPES, FNRAD_ARCHIVE_TAG } from "@/lib/fnrad-archive-shared"
import type { ArchiveEdge, ArchiveEpisode, ArchiveIndex, ArchiveNode, ArchiveType } from "@/lib/fnrad-archive-shared"

export { ARCHIVE_TYPES, FNRAD_ARCHIVE_TAG, REPORT_HREF, TYPE_LABELS, archiveScaleLine, findFocus } from "@/lib/fnrad-archive-shared"
export type { ArchiveEdge, ArchiveEpisode, ArchiveIndex, ArchiveNode, ArchiveType } from "@/lib/fnrad-archive-shared"

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

  const { data: show } = await db.from("orgs").select("id").eq("public_slug", FNRAD_SHOW_SLUG).maybeSingle()
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

  const episodes: ArchiveEpisode[] = live
    .map((e): ArchiveEpisode => [e.id, e.public_slug, episodeLabel(e), e.name, e.start_date ?? ""])
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

/** The shared, cached index. One build per hour, or per invalidation. A failed
 *  build throws (and is not cached); callers fall back to emptyArchiveIndex(). */
export const getArchiveIndex = unstable_cache(buildArchiveIndex, ["fnrad-archive-index-v2"], {
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
