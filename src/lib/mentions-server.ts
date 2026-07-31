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
