import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { isUserFacingDeclineCategory } from "@/lib/decline-categories"
import { logTagAction, logTagActions } from "@/lib/tag-action-log"
import type { TagEventDeclineCategory } from "@/types"

// PATCH /api/me/tags/[id]/decide
// Body: { action: 'approve' | 'decline', decline_category?, decline_note? }
//
// Authorisation: caller must be the tag_event's subject. We re-check status
// on the row before update so a stale UI doesn't drive an already-decided
// row into a different terminal state (returns 409 instead of silently
// overwriting decision_at).
//
// PB-009 Phase 3 (§9 owner-decide lifecycle): every owner decision auto-
// closes any open tag_reports against this tag_event (status='reviewed'),
// and writes per-decision tag_action_log rows for forensics. Editor
// peer-accountability counts depend on this.

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
    .select("id, subject_id, asserter_id, status")
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

    await closeOpenReports(db, id, user.id, now, ev.asserter_id as string | null)
    await logTagAction(db, {
      tagEventId:  id,
      asserterId:  (ev.asserter_id as string | null) ?? null,
      actorId:     user.id,
      actorRole:   "owner",
      action:      "approve",
      priorStatus: "pending",
      newStatus:   "approved",
    })
    return NextResponse.json({ ok: true })
  }

  // Decline
  const category = body.decline_category as TagEventDeclineCategory | undefined
  if (!category || !isUserFacingDeclineCategory(category)) {
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

  await closeOpenReports(db, id, user.id, now, ev.asserter_id as string | null)
  await logTagAction(db, {
    tagEventId:     id,
    asserterId:     (ev.asserter_id as string | null) ?? null,
    actorId:        user.id,
    actorRole:      "owner",
    action:         "decline",
    priorStatus:    "pending",
    newStatus:      "declined",
    reasonCategory: category,
    reasonNote:     note,
  })
  return NextResponse.json({ ok: true })
}

// Helper: close any open reports against this tag_event when the OWNER acts.
// Owner decision is more direct evidence than editor review for non-abuse
// cases — reports filed against an owner-decided tag are answered.
async function closeOpenReports(
  db: SupabaseClient,
  tagEventId: string,
  ownerId: string,
  now: string,
  asserterId: string | null,
): Promise<void> {
  const { data: closed } = await db
    .from("tag_reports")
    .update({ status: "reviewed", reviewed_by: ownerId, reviewed_at: now })
    .eq("tag_event_id", tagEventId)
    .eq("status", "open")
    .select("id")
  const ids = ((closed ?? []) as { id: string }[]).map((r) => r.id)
  if (ids.length === 0) return
  await logTagActions(db, ids.map((rid) => ({
    tagEventId:    tagEventId,
    asserterId,
    actorId:       ownerId,
    actorRole:     "owner" as const,
    action:        "report_close_action" as const,
    relatedReport: rid,
  })))
}
