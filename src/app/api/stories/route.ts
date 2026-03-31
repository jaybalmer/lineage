import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET /api/stories ─────────────────────────────────────────────────────────
// Query params: author_id | place_id | event_id | org_id | board_id | rider_id | limit
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const authorId  = searchParams.get("author_id")
  const placeId   = searchParams.get("place_id")
  const eventId   = searchParams.get("event_id")
  const orgId     = searchParams.get("org_id")
  const boardId   = searchParams.get("board_id")
  const riderId   = searchParams.get("rider_id")  // stories that tag this rider
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
  const offset    = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0)

  try {
    let query = supabase
      .from("stories")
      .select(`
        *,
        photos:story_photos(id, url, caption, sort_order),
        boards:story_boards(board_id),
        riders:story_riders(rider_id),
        author:profiles!author_id(display_name, avatar_url)
      `)
      .eq("visibility", "public")
      .order("story_date", { ascending: false })
      .range(offset, offset + limit - 1)

    if (authorId)  query = query.eq("author_id", authorId)
    if (placeId)   query = query.eq("linked_place_id", placeId)
    if (eventId)   query = query.eq("linked_event_id", eventId)
    if (orgId)     query = query.eq("linked_org_id", orgId)

    // board_id and rider_id require a join filter — fetch IDs then filter
    if (boardId) {
      const { data: ids } = await supabase
        .from("story_boards")
        .select("story_id")
        .eq("board_id", boardId)
      const storyIds = (ids ?? []).map((r: { story_id: string }) => r.story_id)
      if (storyIds.length === 0) return NextResponse.json([])
      query = query.in("id", storyIds)
    }

    if (riderId) {
      const { data: ids } = await supabase
        .from("story_riders")
        .select("story_id")
        .eq("rider_id", riderId)
      const storyIds = (ids ?? []).map((r: { story_id: string }) => r.story_id)
      if (storyIds.length === 0) return NextResponse.json([])
      query = query.in("id", storyIds)
    }

    const { data, error } = await query
    if (error) throw error

    // Normalise joined arrays to flat ID arrays
    const stories = (data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      board_ids: ((s.boards as { board_id: string }[]) ?? []).map((b) => b.board_id),
      rider_ids: ((s.riders as { rider_id: string }[]) ?? []).map((r) => r.rider_id),
      boards: undefined,
      riders: undefined,
    }))

    return NextResponse.json(stories)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST /api/stories ────────────────────────────────────────────────────────
// Body: { author_id, title?, body, story_date, visibility?, linked_event_id?,
//         linked_place_id?, board_ids?, rider_ids?, photos? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      author_id, title, body: storyBody, story_date, visibility = "public",
      linked_event_id, linked_place_id, linked_org_id,
      board_ids = [], rider_ids = [],
      photos = [],   // [{ url, caption?, sort_order? }]
      youtube_url,
      url,
    } = body

    if (!author_id || !story_date) {
      return NextResponse.json({ error: "author_id and story_date are required" }, { status: 400 })
    }

    // Insert story
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .insert({
        author_id, title: title || null, body: storyBody ?? "",
        story_date, visibility,
        linked_event_id: linked_event_id || null,
        linked_place_id: linked_place_id || null,
        linked_org_id: linked_org_id || null,
        youtube_url: youtube_url || null,
        url: url || null,
      })
      .select()
      .single()

    if (storyErr || !story) throw storyErr ?? new Error("Insert failed")

    const storyId = story.id

    // Insert photos
    if (photos.length > 0) {
      await supabase.from("story_photos").insert(
        photos.map((p: { url: string; caption?: string; sort_order?: number }, i: number) => ({
          story_id: storyId, url: p.url, caption: p.caption ?? null,
          sort_order: p.sort_order ?? i,
        }))
      )
    }

    // Insert board links
    if (board_ids.length > 0) {
      await supabase.from("story_boards").insert(
        board_ids.map((bid: string) => ({ story_id: storyId, board_id: bid }))
      )
    }

    // Insert rider tags
    if (rider_ids.length > 0) {
      await supabase.from("story_riders").insert(
        rider_ids.map((rid: string) => ({ story_id: storyId, rider_id: rid }))
      )
    }

    return NextResponse.json({ id: storyId }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH /api/stories ───────────────────────────────────────────────────────
// Body: { id, title?, body, story_date, visibility?, linked_event_id?,
//         linked_place_id?, board_ids?, rider_ids?,
//         keep_photo_ids?, new_photos? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      title, body: storyBody, story_date, visibility,
      linked_event_id, linked_place_id, linked_org_id,
      board_ids = [], rider_ids = [],
      keep_photo_ids = [],
      new_photos = [],
      youtube_url,
      url,
    } = body

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    // Update story row
    const { error: updateErr } = await supabase
      .from("stories")
      .update({
        title: title || null,
        body: storyBody ?? "",
        story_date,
        visibility,
        linked_event_id: linked_event_id || null,
        linked_place_id: linked_place_id || null,
        linked_org_id: linked_org_id || null,
        youtube_url: youtube_url ?? null,
        url: url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateErr) throw updateErr

    // Delete photos not in keep list
    if (keep_photo_ids.length === 0) {
      await supabase.from("story_photos").delete().eq("story_id", id)
    } else {
      await supabase
        .from("story_photos")
        .delete()
        .eq("story_id", id)
        .not("id", "in", `(${keep_photo_ids.join(",")})`)
    }

    // Append new photos after existing ones
    if (new_photos.length > 0) {
      const { data: existing } = await supabase
        .from("story_photos")
        .select("sort_order")
        .eq("story_id", id)
        .order("sort_order", { ascending: false })
        .limit(1)
      const maxOrder = (existing?.[0]?.sort_order ?? -1) as number
      await supabase.from("story_photos").insert(
        (new_photos as { url: string; caption?: string }[]).map((p, i) => ({
          story_id: id, url: p.url, caption: p.caption ?? null,
          sort_order: maxOrder + 1 + i,
        }))
      )
    }

    // Replace junction rows
    await supabase.from("story_boards").delete().eq("story_id", id)
    await supabase.from("story_riders").delete().eq("story_id", id)
    if (board_ids.length > 0) {
      await supabase.from("story_boards").insert(
        (board_ids as string[]).map((bid) => ({ story_id: id, board_id: bid }))
      )
    }
    if (rider_ids.length > 0) {
      await supabase.from("story_riders").insert(
        (rider_ids as string[]).map((rid) => ({ story_id: id, rider_id: rid }))
      )
    }

    // Return updated photos list
    const { data: photos } = await supabase
      .from("story_photos")
      .select("id, url, caption, sort_order")
      .eq("story_id", id)
      .order("sort_order")

    return NextResponse.json({ ok: true, photos: photos ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── DELETE /api/stories?id=xxx ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const { error } = await supabase.from("stories").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
