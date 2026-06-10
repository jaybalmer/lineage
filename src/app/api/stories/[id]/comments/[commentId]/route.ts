import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { captureServerEvent } from "@/lib/analytics-server"

// DELETE /api/stories/[id]/comments/[commentId]
//
// Allowed when the caller is the comment author, the story author, or an
// editor. The editor check mirrors requireEditor() (is_editor OR founding
// tier) but runs inline: calling requireEditor() directly would 403 ordinary
// members before the self/story-author checks get a chance to pass.
//
// Hard delete, no tombstone. The deleted_by analytics prop is the only trace
// of an editor delete (locked decision, June 9 2026).

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()

  const { data: comment } = await db
    .from("story_comments")
    .select("id, story_id, author_id")
    .eq("id", commentId)
    .eq("story_id", id)
    .maybeSingle()
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

  const { data: story } = await db
    .from("stories")
    .select("author_id")
    .eq("id", id)
    .maybeSingle()

  let deletedBy: "self" | "story_author" | "editor" | null = null
  if (comment.author_id === user.id) {
    deletedBy = "self"
  } else if (story?.author_id === user.id) {
    deletedBy = "story_author"
  } else {
    const { data: profile } = await db
      .from("profiles")
      .select("is_editor, membership_tier")
      .eq("id", user.id)
      .single()
    if (profile?.is_editor || profile?.membership_tier === "founding") {
      deletedBy = "editor"
    }
  }
  if (!deletedBy) {
    return NextResponse.json({ error: "Not authorized to delete this comment" }, { status: 403 })
  }

  const { error } = await db.from("story_comments").delete().eq("id", commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await captureServerEvent({
    category: "content",
    event: "story_comment_deleted",
    actorId: user.id,
    props: { story_id: id, deleted_by: deletedBy },
  })

  return NextResponse.json({ ok: true })
}
