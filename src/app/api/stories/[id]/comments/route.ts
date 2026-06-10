import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { captureServerEvent } from "@/lib/analytics-server"
import { fireCommentNotification } from "@/lib/emails/comment-emails"

// GET  /api/stories/[id]/comments — public, chronological, paginated
// POST /api/stories/[id]/comments — signed-in members add a flat comment

const COMMENT_SELECT = "id, story_id, author_id, body, created_at, author:profiles!author_id(display_name, avatar_url)"

/** Story must exist and be public, or the viewer must be its author. */
async function loadReadableStory(db: SupabaseClient, storyId: string, viewerId: string | null) {
  const { data: story } = await db
    .from("stories")
    .select("id, author_id, visibility")
    .eq("id", storyId)
    .maybeSingle()
  if (!story) return null
  if (story.visibility !== "public" && story.author_id !== viewerId) return null
  return story as { id: string; author_id: string; visibility: string }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0)

  try {
    const db = getServiceClient()

    // Optional viewer: lets an author read comments on their own non-public
    // story. The route stays public, so a missing session is fine.
    let viewerId: string | null = null
    try {
      const session = await createServerSupabaseClient()
      const { data: { user } } = await session.auth.getUser()
      viewerId = user?.id ?? null
    } catch {
      viewerId = null
    }

    const story = await loadReadableStory(db, id, viewerId)
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 })

    const { data, error } = await db
      .from("story_comments")
      .select(COMMENT_SELECT)
      .eq("story_id", id)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  try {
    const payload = await req.json().catch(() => null)
    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    if (body.length < 1 || body.length > 2000) {
      return NextResponse.json(
        { error: "Comment must be between 1 and 2000 characters" },
        { status: 400 },
      )
    }

    const db = getServiceClient()
    const story = await loadReadableStory(db, id, user.id)
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 })

    const { data: comment, error } = await db
      .from("story_comments")
      .insert({ story_id: id, author_id: user.id, body })
      .select(COMMENT_SELECT)
      .single()
    if (error || !comment) throw error ?? new Error("Insert failed")

    // Author notification is fire-and-forget: an email problem must never
    // block or fail the comment write.
    fireCommentNotification(db, {
      storyId: id,
      commenterId: user.id,
      commentBody: body,
    }).catch((err) => console.error("[stories comments] notification error:", err))

    await captureServerEvent({
      category: "content",
      event: "story_comment_added",
      actorId: user.id,
      props: {
        story_id: id,
        body_length: body.length,
        is_self_comment: story.author_id === user.id,
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
