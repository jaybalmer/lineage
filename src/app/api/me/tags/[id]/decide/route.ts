import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import type { TagEventDeclineCategory } from "@/types"

// PATCH /api/me/tags/[id]/decide
// Body: { action: 'approve' | 'decline', decline_category?, decline_note? }
//
// Authorisation: caller must be the tag_event's subject. We re-check status
// on the row before update so a stale UI doesn't drive an already-decided
// row into a different terminal state (returns 409 instead of silently
// overwriting decision_at).

const DECLINE_CATEGORIES = new Set<TagEventDeclineCategory>([
  "this_wasnt_me", "wrong_moment", "preference", "spam", "other",
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body || (body.action !== "approve" && body.action !== "decline")) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const db = getServiceClient()

  const { data: ev, error: readErr } = await db
    .from("tag_events")
    .select("id, subject_id, status")
    .eq("id", id)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!ev || ev.subject_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (ev.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot decide a ${ev.status} tag` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  if (body.action === "approve") {
    const { error } = await db.from("tag_events").update({
      status: "approved",
      decision_by: user.id,
      decision_at: now,
    }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Decline
  const category = body.decline_category as TagEventDeclineCategory | undefined
  if (!category || !DECLINE_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "decline_category required" }, { status: 400 })
  }
  const note = category === "other" && typeof body.decline_note === "string"
    ? body.decline_note.slice(0, 280)
    : null

  const { error } = await db.from("tag_events").update({
    status: "declined",
    decision_by: user.id,
    decision_at: now,
    decision_reason_category: category,
    decision_reason_note: note,
  }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
