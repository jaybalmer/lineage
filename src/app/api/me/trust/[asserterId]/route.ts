import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// DELETE /api/me/trust/[asserterId] — remove a trust row.
//
// Only operates on (subject_id = user.id, trusted_asserter_id = asserterId).
// Future tags from that asserter return to the default pending flow.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ asserterId: string }> },
) {
  const { asserterId } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { error } = await db
    .from("tag_trust")
    .delete()
    .eq("subject_id", user.id)
    .eq("trusted_asserter_id", asserterId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
