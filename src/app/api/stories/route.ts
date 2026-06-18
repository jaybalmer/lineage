import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { captureServerEvent } from "@/lib/analytics-server"
import { fireTagEvents } from "@/lib/invite-tracking-server"
import { pairStoryRiderTagEvents, isAsserterGloballyBlocked } from "@/lib/tag-events"
import { logTagActions } from "@/lib/tag-action-log"
import { awardContributionTokens } from "@/lib/tokens"
import type { StoryReactionType } from "@/types"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET /api/stories ─────────────────────────────────────────────────────────
// Query params: id | author_id | place_id | event_id | org_id | board_id | rider_id | limit | sort
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const storyId   = searchParams.get("id")        // single-story fetch (focus pin)
  const authorId  = searchParams.get("author_id")
  const placeId   = searchParams.get("place_id")
  const eventId   = searchParams.get("event_id")
  const orgId     = searchParams.get("org_id")
  const boardId   = searchParams.get("board_id")
  const riderId   = searchParams.get("rider_id")  // stories that tag this rider
  // Story-author timeline toggle: "true"/"false" filters by on_timeline.
  // Absent = no filter, so the community feed and entity pages are unchanged.
  const onTimeline = searchParams.get("on_timeline")
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
  const offset    = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0)
  // BUG-055: the feed's "Recently added" sort needs stories paginated by when
  // they were POSTED (created_at), not by when the event happened (story_date).
  // Default stays story_date so every other caller is unchanged.
  const orderColumn = searchParams.get("sort") === "recent" ? "created_at" : "story_date"

  try {
    const supabase = getServiceClient()

    // Optional viewer identity, used for viewer_reaction and for letting an
    // author fetch their own non-public story via ?id=. requireAuth() is
    // deliberately not used here: this route must stay public, so a missing
    // session simply resolves to a null viewer.
    let viewerId: string | null = null
    try {
      const session = await createServerSupabaseClient()
      const { data: { user } } = await session.auth.getUser()
      viewerId = user?.id ?? null
    } catch {
      viewerId = null
    }

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
      .order(orderColumn, { ascending: false })
      .range(offset, offset + limit - 1)

    // Single-story fetch mirrors the stories RLS rule: public, or the viewer
    // is the author. The list fetch stays public-only.
    if (storyId) {
      query = query.eq("id", storyId)
      query = viewerId
        ? query.or(`visibility.eq.public,author_id.eq.${viewerId}`)
        : query.eq("visibility", "public")
    } else {
      query = query.eq("visibility", "public")
    }

    if (authorId)  query = query.eq("author_id", authorId)
    if (onTimeline === "true")  query = query.eq("on_timeline", true)
    if (onTimeline === "false") query = query.eq("on_timeline", false)
    if (orgId)     query = query.eq("linked_org_id", orgId)

    // Story Connections: place and event filters are a union of the author's
    // primary linked_* column and the community junction, so a community-
    // connected story surfaces on the place/event pages. Junction errors
    // (e.g. migration not yet applied) and ids unsafe to embed in a
    // PostgREST or() filter both degrade to the original plain eq.
    if (placeId) {
      const { data: cpRows, error: cpErr } = await supabase
        .from("story_places")
        .select("story_id")
        .eq("place_id", placeId)
      const cpIds = cpErr ? [] : ((cpRows ?? []) as { story_id: string }[]).map((r) => r.story_id)
      query = cpIds.length > 0 && !/[,()'"]/.test(placeId)
        ? query.or(`linked_place_id.eq.${placeId},id.in.(${cpIds.join(",")})`)
        : query.eq("linked_place_id", placeId)
    }
    if (eventId) {
      const { data: ceRows, error: ceErr } = await supabase
        .from("story_events")
        .select("story_id")
        .eq("event_id", eventId)
      const ceIds = ceErr ? [] : ((ceRows ?? []) as { story_id: string }[]).map((r) => r.story_id)
      query = ceIds.length > 0 && !/[,()'"]/.test(eventId)
        ? query.or(`linked_event_id.eq.${eventId},id.in.(${ceIds.join(",")})`)
        : query.eq("linked_event_id", eventId)
    }

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

    // Reactions + comment counts, grouped per story in JS. At launch volume
    // fetching the raw rows is fine; if these tables grow, swap both fetches
    // for a grouped-count RPC without changing the response shape. Errors
    // degrade to empty counts so a story list never fails on this block
    // (also keeps the route deploy-order safe relative to the migration).
    const reactionsByStory = new Map<string, Partial<Record<StoryReactionType, number>>>()
    const viewerReactionByStory = new Map<string, StoryReactionType>()
    const commentCountByStory = new Map<string, number>()
    // Story Connections: community-added place/event links per story. Both
    // junctions read the base table directly — they carry no tag_events, so
    // PB-009 view discipline does not apply to them.
    const communityPlacesByStory = new Map<string, { place_id: string; added_by: string | null }[]>()
    const communityEventsByStory = new Map<string, { event_id: string; added_by: string | null }[]>()
    if (storyIds.length > 0) {
      const [reactionRes, commentRes, cPlaceRes, cEventRes] = await Promise.all([
        supabase
          .from("story_reactions")
          .select("story_id, reactor_id, reaction_type")
          .in("story_id", storyIds),
        supabase
          .from("story_comments")
          .select("story_id")
          .in("story_id", storyIds),
        supabase
          .from("story_places")
          .select("story_id, place_id, added_by")
          .in("story_id", storyIds),
        supabase
          .from("story_events")
          .select("story_id, event_id, added_by")
          .in("story_id", storyIds),
      ])
      if (reactionRes.error) {
        console.error("[stories GET] reactions fetch failed:", reactionRes.error.message)
      }
      for (const r of (reactionRes.data ?? []) as { story_id: string; reactor_id: string; reaction_type: StoryReactionType }[]) {
        const summary = reactionsByStory.get(r.story_id) ?? {}
        summary[r.reaction_type] = (summary[r.reaction_type] ?? 0) + 1
        reactionsByStory.set(r.story_id, summary)
        if (viewerId && r.reactor_id === viewerId) {
          viewerReactionByStory.set(r.story_id, r.reaction_type)
        }
      }
      if (commentRes.error) {
        console.error("[stories GET] comment counts fetch failed:", commentRes.error.message)
      }
      for (const c of (commentRes.data ?? []) as { story_id: string }[]) {
        commentCountByStory.set(c.story_id, (commentCountByStory.get(c.story_id) ?? 0) + 1)
      }
      if (cPlaceRes.error) {
        console.error("[stories GET] story_places fetch failed:", cPlaceRes.error.message)
      }
      for (const r of (cPlaceRes.data ?? []) as { story_id: string; place_id: string; added_by: string | null }[]) {
        const arr = communityPlacesByStory.get(r.story_id) ?? []
        arr.push({ place_id: r.place_id, added_by: r.added_by })
        communityPlacesByStory.set(r.story_id, arr)
      }
      if (cEventRes.error) {
        console.error("[stories GET] story_events fetch failed:", cEventRes.error.message)
      }
      for (const r of (cEventRes.data ?? []) as { story_id: string; event_id: string; added_by: string | null }[]) {
        const arr = communityEventsByStory.get(r.story_id) ?? []
        arr.push({ event_id: r.event_id, added_by: r.added_by })
        communityEventsByStory.set(r.story_id, arr)
      }
    }

    // Normalise joined arrays to flat ID arrays
    const stories = (data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      board_ids: ((s.boards as { board_id: string }[]) ?? []).map((b) => b.board_id),
      rider_ids: ridersByStory.get(s.id as string) ?? [],
      community_places: communityPlacesByStory.get(s.id as string) ?? [],
      community_events: communityEventsByStory.get(s.id as string) ?? [],
      boards: undefined,
      reaction_summary: reactionsByStory.get(s.id as string) ?? {},
      viewer_reaction: viewerReactionByStory.get(s.id as string) ?? null,
      comment_count: commentCountByStory.get(s.id as string) ?? 0,
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
      on_timeline = true,
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
        on_timeline,
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

    // Token earning (brief §5.1): entry +1; media +1 when the story carries
    // at least one photo (one per story, not per photo); source +2 when it
    // links out (YouTube or article URL). Best-effort, never blocks the save.
    await awardContributionTokens(supabase, user.id, 1, "contribution_entry")
    if ((photos as unknown[]).length > 0) {
      await awardContributionTokens(supabase, user.id, 1, "contribution_media")
    }
    if (youtube_url || url) {
      await awardContributionTokens(supabase, user.id, 2, "contribution_source")
    }

    await captureServerEvent({
      category: "content",
      event: "story_created",
      actorId: user.id,
      props: {
        story_id: storyId,
        visibility,
        photo_count: (photos as unknown[]).length,
        rider_count: (rider_ids as unknown[]).length,
        board_count: (board_ids as unknown[]).length,
        has_youtube: !!youtube_url,
        has_link: !!(linked_place_id || linked_event_id || linked_org_id),
      },
    })

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
      on_timeline,
      linked_event_id, linked_place_id, linked_org_id,
      board_ids = [], rider_ids = [],
      keep_photo_ids = [],
      new_photos = [],
      youtube_url,
      url,
    } = body

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    // Verify ownership (also read on_timeline so an old client payload that
    // omits it falls back to the stored value instead of forcing true).
    const { data: existing } = await supabase
      .from("stories")
      .select("author_id, on_timeline")
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
        on_timeline: on_timeline ?? existing.on_timeline ?? true,
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
    let removedRiderIds = [...oldByRider.keys()].filter((rid) => !newRiderSet.has(rid))
    const addedRiderIds   = uniqueRiderIds.filter((rid) => !oldByRider.has(rid))

    // Story Connections guard: the author's edit modal is populated from
    // story_riders_public, but this diff reads the underlying table. A
    // community-added tag that is pending AND hidden by the subject's
    // require_tag_approval gate is invisible to the author, so any unrelated
    // edit would diff it as removed and silently disable it. Exclude pending
    // tags asserted by someone other than the author from the removal set;
    // those are removed via the chip's x (DELETE /connections), which
    // handles any status. See Operations/story-connections-brief.md §6.3.
    if (removedRiderIds.length > 0) {
      const candidateTagIds = removedRiderIds
        .map((rid) => oldByRider.get(rid) ?? null)
        .filter((tid): tid is string => !!tid)
      if (candidateTagIds.length > 0) {
        const { data: candidateEvents } = await supabase
          .from("tag_events")
          .select("id, status, asserter_id")
          .in("id", candidateTagIds)
        const protectedTagIds = new Set(
          ((candidateEvents ?? []) as { id: string; status: string; asserter_id: string | null }[])
            .filter((e) => e.status === "pending" && e.asserter_id !== user.id)
            .map((e) => e.id),
        )
        if (protectedTagIds.size > 0) {
          removedRiderIds = removedRiderIds.filter((rid) => {
            const tid = oldByRider.get(rid)
            return !(tid && protectedTagIds.has(tid))
          })
        }
      }
    }

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

    await captureServerEvent({
      category: "content",
      event: "story_edited",
      actorId: user.id,
      props: {
        story_id: id,
        visibility,
        rider_count: uniqueRiderIds.length,
        board_count: (board_ids as unknown[]).length,
      },
    })

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

  await captureServerEvent({
    category: "content",
    event: "story_deleted",
    actorId: user.id,
    props: { story_id: id },
  })

  return NextResponse.json({ ok: true })
}
