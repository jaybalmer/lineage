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
import type { Mention } from "@/types"

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
    .select("id, name, start_date, episode_number, media_url, show_org_id")
    .in("id", episodeIds)

  const eventRows = (events ?? []) as {
    id: string
    name: string
    start_date?: string
    episode_number?: number | null
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
        media_url: ev.media_url ?? null,
        show_org_id: ev.show_org_id ?? null,
        show_name: ev.show_org_id ? showNames.get(ev.show_org_id) ?? null : null,
      },
    }
  })
}
