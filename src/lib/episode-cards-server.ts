// Server read for episode cards (see episode-cards.ts). One query path for every
// surface: the in-app brand page and guest profile (via GET /api/episodes), the
// public show page (readOrgStack) and the public member timeline
// (buildProfilePayload), so "which episodes are public" can never drift.
//
// Only LIVE episodes with a public page become cards: public_enabled AND past
// publish_at (isEpisodeLive), AND a public_slug. A scheduled or unpublished
// episode stays invisible on every timeline until its page is live, matching
// the public show page's own rule.

import { getServiceClient } from "@/lib/auth"
import type { EpisodeCardData, EpisodeCardGuest } from "@/lib/episode-cards"

type EpisodeRow = {
  id: string
  name: string | null
  episode_number: number | null
  year: number | null
  start_date: string | null
  media_url: string | null
  youtube_url: string | null
  public_slug: string | null
  public_enabled: boolean | null
  publish_at: string | null
  show_org_id: string | null
}

const EPISODE_COLS =
  "id, name, episode_number, year, start_date, media_url, youtube_url, public_slug, public_enabled, publish_at, show_org_id"

function isLive(row: EpisodeRow, now: number): boolean {
  if (row.public_enabled !== true) return false
  if (!row.publish_at) return true
  const at = Date.parse(row.publish_at)
  return Number.isFinite(at) && at <= now
}

/** Live episode cards for a show (`showOrgId`) or a guest (`guestId`), newest
 *  first. Pass exactly one. Returns [] on any read failure: the cards are an
 *  additive layer and must never break the page they sit on. */
export async function readEpisodeCards(
  opts: { showOrgId?: string; guestId?: string },
): Promise<EpisodeCardData[]> {
  const db = getServiceClient()

  let rows: EpisodeRow[] = []
  if (opts.showOrgId) {
    const { data } = await db
      .from("events")
      .select(EPISODE_COLS)
      .eq("show_org_id", opts.showOrgId)
    rows = (data ?? []) as EpisodeRow[]
  } else if (opts.guestId) {
    const { data: links } = await db
      .from("event_guests")
      .select("event_id")
      .eq("person_id", opts.guestId)
    const ids = [...new Set(((links ?? []) as { event_id: string }[]).map((l) => l.event_id))]
    if (ids.length === 0) return []
    const { data } = await db
      .from("events")
      .select(EPISODE_COLS)
      .in("id", ids)
      .not("show_org_id", "is", null)
    rows = (data ?? []) as EpisodeRow[]
  } else {
    return []
  }

  const now = Date.now()
  const live = rows.filter((r) => r.public_slug && r.show_org_id && isLive(r, now))
  if (live.length === 0) return []

  const eventIds = live.map((r) => r.id)
  const showIds = [...new Set(live.map((r) => r.show_org_id!))]

  const [showsRes, guestLinksRes] = await Promise.all([
    db.from("orgs").select("id, name, logo_url").in("id", showIds),
    db.from("event_guests").select("event_id, person_id, position").in("event_id", eventIds),
  ])
  const shows = new Map(
    ((showsRes.data ?? []) as { id: string; name: string | null; logo_url: string | null }[])
      .map((s) => [s.id, { id: s.id, name: s.name ?? "Show", logo_url: s.logo_url ?? null }]),
  )
  const guestLinks = ((guestLinksRes.data ?? []) as { event_id: string; person_id: string; position: number | null }[])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  // Guests are people (ghost/unclaimed nodes) or profiles (members); a member
  // row wins when both exist, matching the catalog merge.
  const personIds = [...new Set(guestLinks.map((g) => g.person_id))]
  const people = new Map<string, EpisodeCardGuest>()
  if (personIds.length > 0) {
    const [peopleRes, profilesRes] = await Promise.all([
      db.from("people").select("id, display_name").in("id", personIds),
      db.from("profiles").select("id, display_name, avatar_url").in("id", personIds),
    ])
    for (const p of (peopleRes.data ?? []) as { id: string; display_name: string | null }[]) {
      if (p.display_name) people.set(p.id, { id: p.id, display_name: p.display_name, avatar_url: null })
    }
    for (const p of (profilesRes.data ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]) {
      if (p.display_name) people.set(p.id, { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url ?? null })
    }
  }

  const cards: EpisodeCardData[] = live.map((r) => ({
    id: r.id,
    title: r.name ?? "Episode",
    episode_number: r.episode_number ?? null,
    date: r.start_date ?? null,
    year: r.year ?? (r.start_date ? parseInt(r.start_date.slice(0, 4)) || null : null),
    media_url: r.media_url ?? r.youtube_url ?? null,
    slug: r.public_slug!,
    show: shows.get(r.show_org_id!) ?? { id: r.show_org_id!, name: "Show", logo_url: null },
    guests: guestLinks
      .filter((g) => g.event_id === r.id)
      .map((g) => people.get(g.person_id))
      .filter((g): g is EpisodeCardGuest => Boolean(g)),
  }))

  return cards.sort((a, b) => (b.date ?? String(b.year ?? "")).localeCompare(a.date ?? String(a.year ?? "")))
}
