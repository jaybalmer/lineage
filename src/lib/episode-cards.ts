// Episode cards: a show's published podcast episodes rendered as story-style
// timeline cards (YouTube thumbnail, title, date, guests, link to the episode
// page). Derived at read time from the episode event itself (events.show_org_id,
// media_url, public_slug, event_guests), so there is no story row to keep in
// sync: a new or edited episode shows up everywhere on the next read.
//
// No "use client" and no store imports: this file is shared by the server read
// (episode-cards-server.ts), the public chromeless pages and the in-app pages.

import { parseYouTubeId } from "@/lib/utils"
import { dateToSortNum } from "@/lib/timeline-grouping"

export interface EpisodeCardGuest {
  id: string
  display_name: string
  avatar_url: string | null
}

export interface EpisodeCardData {
  id: string
  title: string
  episode_number: number | null
  /** Episode date (events.start_date, YYYY-MM-DD) or null when undated. */
  date: string | null
  year: number | null
  /** Podcast link (YouTube or otherwise). */
  media_url: string | null
  /** The episode's public page slug (/t/{slug}). Always set: only live episodes
   *  with a published page become cards. */
  slug: string
  show: { id: string; name: string; logo_url: string | null }
  guests: EpisodeCardGuest[]
}

/** YouTube's stock hq thumbnail for a media URL, or null when it is not YouTube. */
export function episodeThumbnailUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

/** Sort key shared with the timelines (YYYYMMDD number, 0 when undated). */
export function episodeSortNum(ep: Pick<EpisodeCardData, "date" | "year">): number {
  return dateToSortNum(ep.date ?? (ep.year ? String(ep.year) : undefined))
}
