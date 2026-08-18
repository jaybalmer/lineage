import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"

// GET /api/stats/community-images
//
// Public source of REAL photos for the FTUE opening mosaic. Story photos are a
// far richer source than the catalog entity pages: members attach real photos to
// stories, and those stories are usually linked to a place or an event, so each
// photo comes with a caption we can stand behind. The catalog's own image_url
// columns are nearly all empty, so the mosaic sourced from them showed almost
// nothing real.
//
// Published/public stories only. One photo per story (the first by sort order)
// so a single photo-heavy story cannot dominate the grid. Caption is the linked
// place, else the linked event, else the story title. Returns an empty list on
// any failure so the mosaic degrades to its generated fallback tiles.

export const dynamic = "force-dynamic"

type Img = { url: string; caption: string; kind: "place" | "event" | "story" }

export async function GET() {
  let db
  try {
    db = getServiceClient()
  } catch {
    return NextResponse.json({ images: [] as Img[] })
  }

  // Public stories that can caption a photo, most recent first so a growing
  // archive keeps the opening beat fresh.
  const { data: stories, error: sErr } = await db
    .from("stories")
    .select("id, title, linked_place_id, linked_event_id, story_date")
    .eq("visibility", "public")
    .order("story_date", { ascending: false })

  if (sErr || !stories || stories.length === 0) {
    return NextResponse.json({ images: [] as Img[] })
  }

  const storyIds = stories.map((s) => s.id)

  // First photo per story (lowest sort_order). Ordering the fetch by sort_order
  // lets us keep the first url we see for each story.
  const { data: photos, error: pErr } = await db
    .from("story_photos")
    .select("url, story_id, sort_order")
    .in("story_id", storyIds)
    .order("sort_order", { ascending: true })

  if (pErr || !photos) {
    return NextResponse.json({ images: [] as Img[] })
  }

  const firstPhoto = new Map<string, string>()
  for (const ph of photos) {
    if (ph.url && !firstPhoto.has(ph.story_id)) firstPhoto.set(ph.story_id, ph.url)
  }

  // Resolve caption names for the linked place / event ids.
  const placeIds = [...new Set(stories.map((s) => s.linked_place_id).filter(Boolean))]
  const eventIds = [...new Set(stories.map((s) => s.linked_event_id).filter(Boolean))]
  const [placeRes, eventRes] = await Promise.all([
    placeIds.length
      ? db.from("places").select("id, name").in("id", placeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    eventIds.length
      ? db.from("events").select("id, name").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const placeName = new Map((placeRes.data ?? []).map((p) => [p.id, p.name]))
  const eventName = new Map((eventRes.data ?? []).map((e) => [e.id, e.name]))

  const images: Img[] = []
  const seenUrl = new Set<string>()
  for (const s of stories) {
    const url = firstPhoto.get(s.id)
    if (!url || seenUrl.has(url)) continue
    seenUrl.add(url)

    let caption = ""
    let kind: Img["kind"] = "story"
    const pn = s.linked_place_id ? placeName.get(s.linked_place_id) : undefined
    const en = s.linked_event_id ? eventName.get(s.linked_event_id) : undefined
    if (pn) {
      caption = pn
      kind = "place"
    } else if (en) {
      caption = en
      kind = "event"
    } else if (s.title) {
      caption = s.title
      kind = "story"
    }

    images.push({ url, caption, kind })
    if (images.length >= 16) break
  }

  return NextResponse.json({ images })
}
