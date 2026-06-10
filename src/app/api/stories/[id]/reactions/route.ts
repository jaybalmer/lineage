import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { captureServerEvent } from "@/lib/analytics-server"
import { isStoryReactionType } from "@/lib/story-reactions"
import type { StoryReactionType } from "@/types"

// PUT    /api/stories/[id]/reactions  — set/replace the caller's reaction
// DELETE /api/stories/[id]/reactions  — remove the caller's reaction
//
// One reaction per member per story: the composite PK (story_id, reactor_id)
// makes PUT a plain upsert. Both verbs return the recomputed summary for this
// story so the card reconciles its optimistic state without a refetch.

/** Story must exist and be public, or the viewer must be its author. */
async function loadReactableStory(db: SupabaseClient, storyId: string, viewerId: string) {
  const { data: story } = await db
    .from("stories")
    .select("id, author_id, visibility")
    .eq("id", storyId)
    .maybeSingle()
  if (!story) return null
  if (story.visibility !== "public" && story.author_id !== viewerId) return null
  return story as { id: string; author_id: string; visibility: string }
}

async function reactionSummaryFor(db: SupabaseClient, storyId: string, viewerId: string) {
  const { data } = await db
    .from("story_reactions")
    .select("reactor_id, reaction_type")
    .eq("story_id", storyId)
  const summary: Partial<Record<StoryReactionType, number>> = {}
  let viewerReaction: StoryReactionType | null = null
  for (const r of (data ?? []) as { reactor_id: string; reaction_type: StoryReactionType }[]) {
    summary[r.reaction_type] = (summary[r.reaction_type] ?? 0) + 1
    if (r.reactor_id === viewerId) viewerReaction = r.reaction_type
  }
  return { summary, viewerReaction }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const reactionType = body?.reaction_type
  // Validate against the allowed set here; never lean on the DB check error.
  if (!isStoryReactionType(reactionType)) {
    return NextResponse.json({ error: "Unknown reaction_type" }, { status: 400 })
  }

  const db = getServiceClient()
  const story = await loadReactableStory(db, id, user.id)
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 })

  // Prior reaction feeds the `changed` analytics prop (upsert that replaced
  // a different type).
  const { data: prior } = await db
    .from("story_reactions")
    .select("reaction_type")
    .eq("story_id", id)
    .eq("reactor_id", user.id)
    .maybeSingle()

  const { error } = await db
    .from("story_reactions")
    .upsert(
      { story_id: id, reactor_id: user.id, reaction_type: reactionType },
      { onConflict: "story_id,reactor_id" },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { summary, viewerReaction } = await reactionSummaryFor(db, id, user.id)

  await captureServerEvent({
    category: "content",
    event: "story_reaction_set",
    actorId: user.id,
    props: {
      story_id: id,
      reaction_type: reactionType,
      changed: !!prior && prior.reaction_type !== reactionType,
    },
  })

  return NextResponse.json({ ok: true, reaction_summary: summary, viewer_reaction: viewerReaction })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { error } = await db
    .from("story_reactions")
    .delete()
    .eq("story_id", id)
    .eq("reactor_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { summary } = await reactionSummaryFor(db, id, user.id)

  await captureServerEvent({
    category: "content",
    event: "story_reaction_removed",
    actorId: user.id,
    props: { story_id: id },
  })

  return NextResponse.json({ ok: true, reaction_summary: summary, viewer_reaction: null })
}
