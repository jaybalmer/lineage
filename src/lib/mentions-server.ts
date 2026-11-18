// Podcast pass Session B: server-side mention hydration.
//
// Split out of mentions.ts because that module is imported by client
// components, and getServiceClient drags next/headers into the client bundle.
// Keep anything touching the service client in here.
//
// One place that knows how to hydrate a mention row with its episode context,
// so the episode-side read and the subject-side (timeline) read can never
// drift. Deliberately three flat queries rather than a PostgREST embedded
// select: mentions.episode_event_id is a text FK against the mixed-type
// events.id, and embedded selects across it are not reliable.

import { getServiceClient } from "@/lib/auth"
import { SUBJECT_MENTION_CAP, YEAR_ROLLUP_THRESHOLD } from "@/lib/mentions"
import type { MentionYearStub, SubjectMentionsPayload } from "@/lib/mentions"
import type { Mention, MentionSubjectType } from "@/types"

/**
 * Podcast pass Session C: every PUBLISHED mention on an episode, timestamp
 * order (nulls last, then insertion order), matching GET /api/mentions.
 *
 * Read directly rather than through the route because the public /t/[slug] page
 * is a server component that never calls its own HTTP routes. Published-only
 * with no editor escape hatch: this feeds a public surface, so a draft must not
 * be reachable here even for an editor previewing the page.
 *
 * Episode context is NOT hydrated: every caller already knows the episode.
 */
export async function readPublishedMentions(episodeId: string): Promise<Mention[]> {
  if (!episodeId) return []
  const db = getServiceClient()
  const { data } = await db
    .from("mentions")
    .select("*")
    .eq("episode_event_id", episodeId)
    .eq("status", "published")
    .order("timestamp_seconds", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  return (data ?? []) as Mention[]
}

/**
 * Drop mentions whose episode is not live (public_enabled AND past publish_at,
 * the same isEpisodeLive rule the episode page uses).
 *
 * Podcast archive staging, Phase 3 (brief F11): bulk publishing creates a
 * HIDDEN episode and writes its mentions as published, so the episode's public
 * flag is the single switch. Without this filter those stories would reach a
 * person's timeline before the episode page they link to is public.
 *
 * MIRROR of isEpisodeLive in public-timeline-read.ts, inlined because that
 * module imports this one. Keep the two rules identical.
 */
function episodeIsLive(row: { public_enabled: boolean | null; publish_at: string | null }, now: number): boolean {
  if (row.public_enabled !== true) return false
  if (!row.publish_at) return true
  const at = Date.parse(row.publish_at)
  return Number.isFinite(at) && at <= now
}

export async function filterLiveEpisodes(rows: Mention[]): Promise<Mention[]> {
  if (rows.length === 0) return []
  const db = getServiceClient()
  const ids = Array.from(new Set(rows.map((m) => m.episode_event_id)))
  const { data } = await db.from("events").select("id, public_enabled, publish_at").in("id", ids)
  const now = Date.now()
  const live = new Set(
    ((data ?? []) as { id: string; public_enabled: boolean | null; publish_at: string | null }[])
      .filter((e) => episodeIsLive(e, now))
      .map((e) => e.id),
  )
  return rows.filter((m) => live.has(m.episode_event_id))
}

/** Attach { episode } context to a set of raw mention rows, in place of a join. */
export async function hydrateEpisodes(rows: Mention[]): Promise<Mention[]> {
  if (rows.length === 0) return []
  const db = getServiceClient()

  const episodeIds = Array.from(new Set(rows.map((m) => m.episode_event_id)))
  const { data: events } = await db
    .from("events")
    .select("id, name, start_date, episode_number, episode_label, media_url, show_org_id")
    .in("id", episodeIds)

  const eventRows = (events ?? []) as {
    id: string
    name: string
    start_date?: string
    episode_number?: number | null
    episode_label?: string | null
    media_url?: string | null
    show_org_id?: string | null
  }[]

  const showIds = Array.from(
    new Set(eventRows.map((e) => e.show_org_id).filter((v): v is string => Boolean(v)))
  )
  const showNames = new Map<string, string>()
  if (showIds.length > 0) {
    const { data: orgs } = await db.from("orgs").select("id, name").in("id", showIds)
    for (const o of (orgs ?? []) as { id: string; name: string }[]) showNames.set(o.id, o.name)
  }

  const byId = new Map(eventRows.map((e) => [e.id, e]))
  return rows.map((m) => {
    const ev = byId.get(m.episode_event_id)
    if (!ev) return m
    return {
      ...m,
      episode: {
        id: ev.id,
        name: ev.name,
        start_date: ev.start_date,
        episode_number: ev.episode_number ?? null,
        episode_label: ev.episode_label ?? null,
        media_url: ev.media_url ?? null,
        show_org_id: ev.show_org_id ?? null,
        show_name: ev.show_org_id ? showNames.get(ev.show_org_id) ?? null : null,
      },
    }
  })
}

// ---------------------------------------------------------------------------
// Capped subject read (Jay, 2026-11-15).
//
// A subject named in hundreds of episodes (Burton, Craig Kelly) used to ship
// every mention row to the browser on every page view, though the year rollup
// then hid nearly all of them behind collapsed year cards. This read sends the
// full rows only for what renders up front:
//
//   - total at or under SUBJECT_MENTION_CAP: every mention, the same set the
//     uncapped read returns, so small and mid-size pages do not change at all;
//   - above it: full rows for years that stay unfolded, and a count-only stub
//     for every year that rollupEpisodesByYear would fold anyway. The year card
//     fetches its rows with `year` when opened.
//
// The fold rule is the same one the client applies (more than
// YEAR_ROLLUP_THRESHOLD episodes in an air year), so a stub year is exactly a
// year that would have rendered collapsed.

const PAGE = 1000
const ID_CHUNK = 100

type EpisodeMeta = { id: string; start_date: string | null; show_org_id: string | null }

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** Light pass: which live episodes mention this subject, and how many times. */
async function subjectEpisodeCounts(
  subjectType: MentionSubjectType,
  subjectId: string,
): Promise<{ counts: Map<string, number>; episodes: Map<string, EpisodeMeta> }> {
  const db = getServiceClient()
  const counts = new Map<string, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("mentions")
      .select("id, episode_event_id")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .eq("status", "published")
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { id: string; episode_event_id: string }[]
    for (const r of rows) counts.set(r.episode_event_id, (counts.get(r.episode_event_id) ?? 0) + 1)
    if (rows.length < PAGE) break
  }

  const episodes = new Map<string, EpisodeMeta>()
  const now = Date.now()
  for (const ids of chunks([...counts.keys()], ID_CHUNK)) {
    const { data, error } = await db
      .from("events")
      .select("id, start_date, show_org_id, public_enabled, publish_at")
      .in("id", ids)
    if (error) throw new Error(error.message)
    for (const e of (data ?? []) as (EpisodeMeta & { public_enabled: boolean | null; publish_at: string | null })[]) {
      if (episodeIsLive(e, now)) episodes.set(e.id, { id: e.id, start_date: e.start_date ?? null, show_org_id: e.show_org_id ?? null })
    }
  }
  for (const id of [...counts.keys()]) if (!episodes.has(id)) counts.delete(id)
  return { counts, episodes }
}

/** Full, hydrated rows for the given episodes, in the uncapped read's order. */
async function subjectMentionsOn(
  subjectType: MentionSubjectType,
  subjectId: string,
  episodeIds: string[],
): Promise<Mention[]> {
  const db = getServiceClient()
  const rows: Mention[] = []
  // Every row of one episode lands in one chunk, so the timestamp order inside
  // an episode (the only order the callers rely on) holds across chunks.
  for (const ids of chunks(episodeIds, ID_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("mentions")
        .select("*")
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .in("episode_event_id", ids)
        .order("timestamp_seconds", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      const page = (data ?? []) as Mention[]
      rows.push(...page)
      if (page.length < PAGE) break
    }
  }
  return hydrateEpisodes(rows)
}

const yearOf = (e: EpisodeMeta | undefined) => e?.start_date?.slice(0, 4) || null

export async function readSubjectMentionsCapped(
  subjectType: MentionSubjectType,
  subjectId: string,
  cap = SUBJECT_MENTION_CAP,
): Promise<SubjectMentionsPayload> {
  const { counts, episodes } = await subjectEpisodeCounts(subjectType, subjectId)
  const total = [...counts.values()].reduce((n, c) => n + c, 0)
  if (total === 0) return { mentions: [], years: [], total: 0 }
  if (total <= cap) {
    return { mentions: await subjectMentionsOn(subjectType, subjectId, [...counts.keys()]), years: [], total }
  }

  const byYear = new Map<string, string[]>()
  for (const id of counts.keys()) {
    const y = yearOf(episodes.get(id))
    if (y) byYear.set(y, [...(byYear.get(y) ?? []), id])
  }
  const folded = new Set([...byYear].filter(([, ids]) => ids.length > YEAR_ROLLUP_THRESHOLD).map(([y]) => y))
  const loose = [...counts.keys()].filter((id) => {
    const y = yearOf(episodes.get(id))
    return !y || !folded.has(y)
  })

  const showIds = new Set<string>()
  for (const y of folded) for (const id of byYear.get(y)!) {
    const s = episodes.get(id)?.show_org_id
    if (s) showIds.add(s)
  }
  const showNames = new Map<string, string>()
  if (showIds.size > 0) {
    const { data } = await getServiceClient().from("orgs").select("id, name").in("id", [...showIds])
    for (const o of (data ?? []) as { id: string; name: string }[]) showNames.set(o.id, o.name)
  }

  const years: MentionYearStub[] = [...folded].map((year) => {
    const ids = byYear.get(year)!
    const shows = new Set(ids.map((id) => episodes.get(id)?.show_org_id ?? null))
    const only = shows.size === 1 ? [...shows][0] : null
    return {
      year,
      episodeCount: ids.length,
      mentionCount: ids.reduce((n, id) => n + (counts.get(id) ?? 0), 0),
      showName: only ? showNames.get(only) ?? null : null,
      latestDate: ids.map((id) => episodes.get(id)?.start_date ?? "").sort().at(-1) ?? `${year}-01-01`,
    }
  }).sort((a, b) => b.year.localeCompare(a.year))

  const mentions = loose.length > 0 ? await subjectMentionsOn(subjectType, subjectId, loose) : []
  return { mentions, years, total }
}

/** Every published mention of a subject on live episodes that aired in `year`. */
export async function readSubjectMentionYear(
  subjectType: MentionSubjectType,
  subjectId: string,
  year: string,
): Promise<Mention[]> {
  const { counts, episodes } = await subjectEpisodeCounts(subjectType, subjectId)
  const ids = [...counts.keys()].filter((id) => yearOf(episodes.get(id)) === year)
  return ids.length > 0 ? subjectMentionsOn(subjectType, subjectId, ids) : []
}
