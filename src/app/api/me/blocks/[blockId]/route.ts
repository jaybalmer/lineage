import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// DELETE /api/me/blocks/[blockId] — unblock by block row id.
//
// Unblocking does NOT restore declined tag_events from the past — those stay
// declined. Future tags from this asserter return to pending review.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  const { blockId } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { error } = await db
    .from("tag_blocklist")
    .delete()
    .eq("id", blockId)
    .eq("subject_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
