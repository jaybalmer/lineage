import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"
import { fireTagEvents } from "@/lib/invite-tracking-server"
import { pairStoryRiderTagEvents, isAsserterGloballyBlocked } from "@/lib/tag-events"
import { logTagActions } from "@/lib/tag-action-log"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
    const supabase = getServiceClient()

    // PB-009 Phase 1: rider_ids are fetched separately from story_riders_public
    // so the read goes through the approved-only view. Boards and photos stay
    // as embedded selects (not subject to PB-009 — neither table implicates a
    // person tag). The embed pattern can't directly reference a view with
    // PostgREST's relationship inference in every case, so the explicit
    // separate-fetch removes that risk.
    let query = supabase
      .from("stories")
      .select(`
        *,
        photos:story_photos(id, url, caption, sort_order),
        boards:story_boards(board_id),
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
        .from("story_riders_public")
        .select("story_id")
        .eq("rider_id", riderId)
      const storyIds = (ids ?? []).map((r: { story_id: string }) => r.story_id)
      if (storyIds.length === 0) return NextResponse.json([])
      query = query.in("id", storyIds)
    }

    const { data, error } = await query
    if (error) throw error

    // Fetch rider_ids for the resulting stories from the approved-only view.
    const storyIds = (data ?? []).map((s: Record<string, unknown>) => s.id as string)
    let ridersByStory: Map<string, string[]> = new Map()
    if (storyIds.length > 0) {
      const { data: riderRows } = await supabase
        .from("story_riders_public")
        .select("story_id, rider_id")
        .in("story_id", storyIds)
      for (const r of (riderRows ?? []) as { story_id: string; rider_id: string }[]) {
        const arr = ridersByStory.get(r.story_id) ?? []
        arr.push(r.rider_id)
        ridersByStory.set(r.story_id, arr)
      }
    }

    // Normalise joined arrays to flat ID arrays
    const stories = (data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      board_ids: ((s.boards as { board_id: string }[]) ?? []).map((b) => b.board_id),
      rider_ids: ridersByStory.get(s.id as string) ?? [],
      boards: undefined,
    }))

    return NextResponse.json(stories)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST /api/stories ────────────────────────────────────────────────────────
// Body: { title?, body, story_date, visibility?, linked_event_id?,
//         linked_place_id?, board_ids?, rider_ids?, photos? }
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  try {
    const supabase = getServiceClient()
    const body = await req.json()
    const {
      title, body: storyBody, story_date, visibility = "public",
      linked_event_id, linked_place_id, linked_org_id,
      board_ids = [], rider_ids = [],
      photos = [],   // [{ url, caption?, sort_order? }]
      youtube_url,
      url,
    } = body

    if (!story_date) {
      return NextResponse.json({ error: "story_date is required" }, { status: 400 })
    }

    // PB-009 Phase 3: refuse the entire write if the author is globally
    // restricted AND the story tags riders. Stories with no riders are not
    // person-implicating, so a restricted author can still write them.
    // Tag-only restriction is Q4's locked decision.
    if ((rider_ids as string[]).length > 0
        && await isAsserterGloballyBlocked(supabase, user.id)) {
      return NextResponse.json(
        { ok: false, reason: "globally_blocked", error: "You don't have permission to create tags right now." },
        { status: 403 },
      )
    }

    // Insert story -- author_id always comes from the authenticated session
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .insert({
        author_id: user.id, title: title || null, body: storyBody ?? "",
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

    // Junction inserts surface errors. Before PB-008 Phase 2 these awaited
    // without checking the return; story_riders silently lost ghost riders
    // because of a stale FK to profiles(id). Now every junction failure is
    // visible to the caller.
    if (photos.length > 0) {
      const { error } = await supabase.from("story_photos").insert(
        photos.map((p: { url: string; caption?: string; sort_order?: number }, i: number) => ({
          story_id: storyId, url: p.url, caption: p.caption ?? null,
          sort_order: p.sort_order ?? i,
        }))
      )
      if (error) throw new Error(`story_photos insert failed: ${error.message}`)
    }

    if (board_ids.length > 0) {
      const { error } = await supabase.from("story_boards").insert(
        board_ids.map((bid: string) => ({ story_id: storyId, board_id: bid }))
      )
      if (error) throw new Error(`story_boards insert failed: ${error.message}`)
    }

    if (rider_ids.length > 0) {
      const { error } = await supabase.from("story_riders").insert(
        rider_ids.map((rid: string) => ({ story_id: storyId, rider_id: rid }))
      )
      if (error) throw new Error(`story_riders insert failed: ${error.message}`)

      // PB-009 Phase 1: pair every story_riders row with a tag_event. Phase 1
      // status defaults to 'approved' so behaviour is unchanged; the rows
      // exist so the _public view enforces correctly and Phase 2's owner
      // inbox has data to drive.
      const { paired, failed } = await pairStoryRiderTagEvents(supabase, {
        storyId, riderIds: rider_ids as string[], authorId: user.id,
      })
      if (failed > 0) {
        console.error(`[stories POST] tag_event pairing: ${paired} ok, ${failed} failed`)
      }
    }

    // Ambient-growth threshold: fire tag-event for every rider that's a
    // person id, in the background. Failures are non-fatal — the story is
    // already saved and the event endpoint logs its own errors.
    if (rider_ids.length > 0) {
      fireTagEvents(rider_ids as string[], user.id).catch((e) => {
        console.error("[stories] tag-event background fan-out failed:", e)
      })
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
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  try {
    const supabase = getServiceClient()
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

    // Verify ownership
    const { data: existing } = await supabase
      .from("stories")
      .select("author_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Story not found" }, { status: 404 })
    if (existing.author_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to edit this story" }, { status: 403 })
    }

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
      const { data: existingPhotos } = await supabase
        .from("story_photos")
        .select("sort_order")
        .eq("story_id", id)
        .order("sort_order", { ascending: false })
        .limit(1)
      const maxOrder = (existingPhotos?.[0]?.sort_order ?? -1) as number
      await supabase.from("story_photos").insert(
        (new_photos as { url: string; caption?: string }[]).map((p, i) => ({
          story_id: id, url: p.url, caption: p.caption ?? null,
          sort_order: maxOrder + 1 + i,
        }))
      )
    }

    // Boards junction — boards don't tag persons, so wipe-and-rebuild is fine.
    await supabase.from("story_boards").delete().eq("story_id", id)
    if (board_ids.length > 0) {
      const { error } = await supabase.from("story_boards").insert(
        (board_ids as string[]).map((bid) => ({ story_id: id, board_id: bid }))
      )
      if (error) throw new Error(`story_boards insert failed: ${error.message}`)
    }

    // PB-009 follow-up: diff rider sets instead of wipe-and-rebuild. Survivors
    // keep their existing tag_event so an approved rider stays approved after
    // an unrelated title edit (the prior Phase 1 wipe was acceptable only
    // because every fresh tag was 'approved' anyway; once the Phase 2 flip
    // landed, wipe-and-rebuild silently re-pendinged every approved rider on
    // every story edit). Removed riders flip their tag_event to 'disabled'
    // so the tagged rider sees the unattributed moment in /me/tags Disabled.
    // Added riders get fresh tag_events at the source-default status.
    const uniqueRiderIds: string[] = Array.from(new Set(rider_ids as string[]))
    const { data: oldRows } = await supabase
      .from("story_riders")
      .select("rider_id, tag_event_id")
      .eq("story_id", id)
    const oldByRider = new Map<string, string | null>(
      ((oldRows ?? []) as { rider_id: string; tag_event_id: string | null }[])
        .map((r) => [r.rider_id, r.tag_event_id])
    )
    const newRiderSet = new Set(uniqueRiderIds)
    const removedRiderIds = [...oldByRider.keys()].filter((rid) => !newRiderSet.has(rid))
    const addedRiderIds   = uniqueRiderIds.filter((rid) => !oldByRider.has(rid))

    if (removedRiderIds.length > 0) {
      const tagIdsToDisable = removedRiderIds
        .map((rid) => oldByRider.get(rid) ?? null)
        .filter((tid): tid is string => !!tid)
      if (tagIdsToDisable.length > 0) {
        await supabase
          .from("tag_events")
          .update({ status: "disabled", decision_at: new Date().toISOString() })
          .in("id", tagIdsToDisable)
      }
      await supabase
        .from("story_riders")
        .delete()
        .eq("story_id", id)
        .in("rider_id", removedRiderIds)
    }

    if (addedRiderIds.length > 0) {
      // PB-009 Phase 3: refuse adding new riders if the author is globally
      // restricted. Survivor + removed paths still run because they don't
      // create new tags; this only gates new additions.
      if (await isAsserterGloballyBlocked(supabase, user.id)) {
        return NextResponse.json(
          { ok: false, reason: "globally_blocked", error: "You don't have permission to create tags right now." },
          { status: 403 },
        )
      }

      const { error } = await supabase.from("story_riders").insert(
        addedRiderIds.map((rid) => ({ story_id: id, rider_id: rid }))
      )
      if (error) throw new Error(`story_riders insert failed: ${error.message}`)

      const { paired, failed } = await pairStoryRiderTagEvents(supabase, {
        storyId: id, riderIds: addedRiderIds, authorId: user.id,
      })
      if (failed > 0) {
        console.error(`[stories PATCH] tag_event pairing: ${paired} ok, ${failed} failed`)
      }
    }

    // Fan-out invite-notification side-effects only for newly added riders;
    // survivors already got their notification on the prior write.
    if (addedRiderIds.length > 0) {
      fireTagEvents(addedRiderIds, user.id).catch((e) => {
        console.error("[stories PATCH] tag-event background fan-out failed:", e)
      })
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
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  const supabase = getServiceClient()
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  // Verify ownership
  const { data: existing } = await supabase
    .from("stories")
    .select("author_id")
    .eq("id", id)
    .single()

  if (!existing) return NextResponse.json({ error: "Story not found" }, { status: 404 })
  if (existing.author_id !== user.id) {
    return NextResponse.json({ error: "Not authorized to delete this story" }, { status: 403 })
  }

  // PB-009 follow-up: disable any tag_events paired with this story BEFORE
  // deleting. tag_events has no FK from stories — without this step the rows
  // would be orphaned at their last status (typically 'approved') and would
  // keep showing in the tagged rider's /me/tags Approved filter despite the
  // moment no longer existing.
  const { data: srRows } = await supabase
    .from("story_riders")
    .select("tag_event_id")
    .eq("story_id", id)
    .not("tag_event_id", "is", null)
  const tagIdsToDisable = ((srRows ?? []) as { tag_event_id: string | null }[])
    .map((r) => r.tag_event_id)
    .filter((tid): tid is string => !!tid)
  if (tagIdsToDisable.length > 0) {
    // Fetch asserter + prior status for action log denormalisation
    const { data: priorEvs } = await supabase
      .from("tag_events")
      .select("id, asserter_id, status")
      .in("id", tagIdsToDisable)
    const priorById = new Map(
      ((priorEvs ?? []) as { id: string; asserter_id: string | null; status: string }[])
        .map((e) => [e.id, e]),
    )

    await supabase
      .from("tag_events")
      .update({
        status:                   "disabled",
        decision_at:              new Date().toISOString(),
        decision_reason_category: "lifecycle_destroyed",
      })
      .in("id", tagIdsToDisable)

    // PB-009 Phase 3: auto-close any open tag_reports against these tag_events
    // as resolved_moment_destroyed. The report has no actionable target once
    // the underlying story is gone.
    await supabase
      .from("tag_reports")
      .update({
        status:      "resolved_moment_destroyed",
        reviewed_at: new Date().toISOString(),
      })
      .in("tag_event_id", tagIdsToDisable)
      .eq("status", "open")

    // Log the lifecycle_disable for each affected tag_event
    await logTagActions(supabase, tagIdsToDisable.map((tid) => {
      const prior = priorById.get(tid)
      return {
        tagEventId:     tid,
        asserterId:     prior?.asserter_id ?? null,
        actorId:        null,
        actorRole:      "system" as const,
        action:         "lifecycle_disable" as const,
        priorStatus:    (prior?.status ?? null) as null | "pending" | "approved" | "declined" | "disabled",
        newStatus:      "disabled" as const,
        reasonCategory: "lifecycle_destroyed" as const,
      }
    }))
  }

  const { error } = await supabase.from("stories").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
