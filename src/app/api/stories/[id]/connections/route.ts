import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { captureServerEvent } from "@/lib/analytics-server"
import { fireTagEvents } from "@/lib/invite-tracking-server"
import { pairStoryRiderTagEvents, isAsserterGloballyBlocked } from "@/lib/tag-events"
import { awardContributionTokens } from "@/lib/tokens"

// POST   /api/stories/[id]/connections — any signed-in member connects a
//        rider, place, or event to a public (or shared) story.
// DELETE /api/stories/[id]/connections?type=&entity_id= — the adder, the
//        story author, or an editor removes a community connection.
//
// Riders are person-implicating, so the full PB-009 caller contract applies:
// caller-level global-block precheck BEFORE the junction insert (the pair
// helper's internal check is defense-in-depth, not the gate), then insert,
// pair, and fire the ambient-growth fan-out. Places and events are not
// person-implicating: plain junction rows, no tag_events, removal rights are
// the control. See Operations/story-connections-brief.md (June 9, 2026).

type ConnectionType = "rider" | "place" | "event"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface StoryRow {
  id: string
  author_id: string
  visibility: string
  linked_place_id: string | null
  linked_event_id: string | null
  community_id: string | null
}

async function loadStory(db: SupabaseClient, storyId: string): Promise<StoryRow | null> {
  const { data } = await db
    .from("stories")
    .select("id, author_id, visibility, linked_place_id, linked_event_id, community_id")
    .eq("id", storyId)
    .maybeSingle()
  return (data as StoryRow | null) ?? null
}

/** Mirrors requireEditor() (is_editor OR founding tier) inline, so ordinary
 *  members pass through to the adder/author checks instead of 403ing early. */
async function viewerIsEditor(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await db
    .from("profiles")
    .select("is_editor, membership_tier")
    .eq("id", userId)
    .single()
  return !!profile?.is_editor || profile?.membership_tier === "founding"
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  try {
    const payload = await req.json().catch(() => null)
    const type = payload?.type as ConnectionType | undefined
    const entityId = typeof payload?.entity_id === "string" ? payload.entity_id.trim() : ""
    if (!type || !["rider", "place", "event"].includes(type) || !entityId) {
      return NextResponse.json(
        { error: "type (rider | place | event) and entity_id are required" },
        { status: 400 },
      )
    }

    const db = getServiceClient()
    const story = await loadStory(db, storyId)
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 })

    // Public and shared stories accept community connections (June 9 call:
    // small friendly cohort at launch). Private stories refuse unless the
    // caller is the author.
    if (story.visibility === "private" && story.author_id !== user.id) {
      return NextResponse.json(
        { error: "This story doesn't accept connections" },
        { status: 403 },
      )
    }

    if (type === "place" || type === "event") {
      const table = type === "place" ? "story_places" : "story_events"
      const idColumn = type === "place" ? "place_id" : "event_id"
      const authorLink = type === "place" ? story.linked_place_id : story.linked_event_id

      // The author's own primary link counts as already-connected so the UI
      // never renders a duplicate chip.
      if (authorLink === entityId) {
        return NextResponse.json({ ok: true, already: true })
      }

      const { error } = await db
        .from(table)
        .insert({ story_id: storyId, [idColumn]: entityId, added_by: user.id })
      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ ok: true, already: true })
        }
        if (error.code === "23503") {
          return NextResponse.json({ error: `Unknown ${type}` }, { status: 400 })
        }
        throw new Error(`${table} insert failed: ${error.message}`)
      }
    } else {
      // ── Rider: full PB-009 caller contract ────────────────────────────────
      if (!UUID_RE.test(entityId)) {
        return NextResponse.json({ error: "Unknown rider" }, { status: 400 })
      }

      // (a) Caller-level global-block precheck. Must run BEFORE the junction
      // insert: if only the pair helper refused, the story_riders row would
      // land with tag_event_id=NULL and the _public view's NULL fallback
      // would render it as approved.
      if (await isAsserterGloballyBlocked(db, user.id)) {
        return NextResponse.json(
          { ok: false, reason: "globally_blocked", error: "You don't have permission to create tags right now." },
          { status: 403 },
        )
      }

      // (b) Idempotency against the UNDERLYING table — a deliberate,
      // documented exception to PB-009 read-through-the-view discipline,
      // because a declined tag must not be silently re-created.
      const { data: existing } = await db
        .from("story_riders")
        .select("rider_id, tag_event_id")
        .eq("story_id", storyId)
        .eq("rider_id", entityId)
        .maybeSingle()
      if (existing) {
        if (existing.tag_event_id) {
          const { data: tagEvent } = await db
            .from("tag_events")
            .select("status")
            .eq("id", existing.tag_event_id)
            .maybeSingle()
          if (tagEvent && (tagEvent.status === "declined" || tagEvent.status === "disabled")) {
            return NextResponse.json(
              { ok: false, reason: "previously_declined" },
              { status: 409 },
            )
          }
        }
        return NextResponse.json({ ok: true, already: true })
      }

      // (c) Junction insert.
      const { error: insertErr } = await db
        .from("story_riders")
        .insert({ story_id: storyId, rider_id: entityId })
      if (insertErr) {
        if (insertErr.code === "23505") {
          return NextResponse.json({ ok: true, already: true })
        }
        throw new Error(`story_riders insert failed: ${insertErr.message}`)
      }

      // (d) Pair the tag_event. The adder is the asserter. Unlike the author
      // write paths, a pairing failure here rolls the junction row back: a
      // community-added tag with tag_event_id=NULL would render as approved
      // and carry no decline/report path, which this feature cannot accept.
      const { paired, refused } = await pairStoryRiderTagEvents(db, {
        storyId,
        riderIds: [entityId],
        authorId: user.id,
        communityId: story.community_id,
      })
      if (refused > 0 || paired === 0) {
        await db
          .from("story_riders")
          .delete()
          .eq("story_id", storyId)
          .eq("rider_id", entityId)
          .is("tag_event_id", null)
        if (refused > 0) {
          return NextResponse.json(
            { ok: false, reason: "globally_blocked", error: "You don't have permission to create tags right now." },
            { status: 403 },
          )
        }
        return NextResponse.json(
          { error: "Could not create the tag. Please try again." },
          { status: 500 },
        )
      }

      // (e) Ambient-growth fan-out, fire-and-forget, matching author adds.
      fireTagEvents([entityId], user.id).catch((e) => {
        console.error("[story connections] tag-event background fan-out failed:", e)
      })
    }

    // Token earning (brief §5.1): a community connection is +1. Every
    // already-connected or declined case returned earlier, so reaching here
    // always means a new connection landed. Best-effort, never blocks.
    await awardContributionTokens(db, user.id, 1, "contribution_connection")

    await captureServerEvent({
      category: "content",
      event: "story_connection_added",
      actorId: user.id,
      props: {
        story_id: storyId,
        connection_type: type,
        entity_id: entityId,
        is_self: entityId === user.id,
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") as ConnectionType | null
    const entityId = searchParams.get("entity_id")?.trim() ?? ""
    if (!type || !["rider", "place", "event"].includes(type) || !entityId) {
      return NextResponse.json(
        { error: "type (rider | place | event) and entity_id are required" },
        { status: 400 },
      )
    }

    const db = getServiceClient()
    const story = await loadStory(db, storyId)
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 })

    let removedByRole: "adder" | "author" | "editor" | null = null

    if (type === "place" || type === "event") {
      const table = type === "place" ? "story_places" : "story_events"
      const idColumn = type === "place" ? "place_id" : "event_id"

      const { data: row } = await db
        .from(table)
        .select("added_by")
        .eq("story_id", storyId)
        .eq(idColumn, entityId)
        .maybeSingle()
      if (!row) return NextResponse.json({ ok: true })

      if (row.added_by === user.id) removedByRole = "adder"
      else if (story.author_id === user.id) removedByRole = "author"
      else if (await viewerIsEditor(db, user.id)) removedByRole = "editor"
      if (!removedByRole) {
        return NextResponse.json(
          { error: "Not authorized to remove this connection" },
          { status: 403 },
        )
      }

      const { error } = await db
        .from(table)
        .delete()
        .eq("story_id", storyId)
        .eq(idColumn, entityId)
      if (error) throw new Error(`${table} delete failed: ${error.message}`)
    } else {
      const { data: row } = await db
        .from("story_riders")
        .select("rider_id, tag_event_id")
        .eq("story_id", storyId)
        .eq("rider_id", entityId)
        .maybeSingle()
      if (!row) return NextResponse.json({ ok: true })

      // The adder is the tag_event's asserter. Grandfathered rows
      // (tag_event_id null) have no recorded adder, so rights fall to the
      // story author and editors. The tagged rider themselves declines via
      // /me/tags rather than this route, except when they are also the
      // asserter (self-undo of "I was there").
      let asserterId: string | null = null
      if (row.tag_event_id) {
        const { data: tagEvent } = await db
          .from("tag_events")
          .select("asserter_id")
          .eq("id", row.tag_event_id)
          .maybeSingle()
        asserterId = (tagEvent?.asserter_id as string | null) ?? null
      }

      if (asserterId && asserterId === user.id) removedByRole = "adder"
      else if (story.author_id === user.id) removedByRole = "author"
      else if (await viewerIsEditor(db, user.id)) removedByRole = "editor"
      if (!removedByRole) {
        return NextResponse.json(
          { error: "Not authorized to remove this connection" },
          { status: 403 },
        )
      }

      // Mirror the PATCH removed-rider path: flip the paired tag_event to
      // disabled, then delete the junction row. Grandfathered rows have no
      // tag_event to touch.
      if (row.tag_event_id) {
        await db
          .from("tag_events")
          .update({ status: "disabled", decision_at: new Date().toISOString() })
          .eq("id", row.tag_event_id)
      }
      const { error } = await db
        .from("story_riders")
        .delete()
        .eq("story_id", storyId)
        .eq("rider_id", entityId)
      if (error) throw new Error(`story_riders delete failed: ${error.message}`)
    }

    await captureServerEvent({
      category: "content",
      event: "story_connection_removed",
      actorId: user.id,
      props: {
        story_id: storyId,
        connection_type: type,
        entity_id: entityId,
        removed_by_role: removedByRole,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
