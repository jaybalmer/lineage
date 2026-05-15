import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { isUserFacingDeclineCategory } from "@/lib/decline-categories"
import { logTagAction, logTagActions } from "@/lib/tag-action-log"
import { fireEditorDeclineNotification } from "@/lib/emails/tag-decision-emails"
import type { TagEventDeclineCategory } from "@/types"

// PATCH /api/admin/tag-events/[id]/decide
// Body: { action: "decline", category: TagEventDeclineCategory, note?: string }
//
// PB-009 Phase 3 — editor preemptive takedown of a pending tag. Phase 3 ONLY
// supports action="decline" on status="pending" (Q3). Override-on-approved
// is reserved for Phase 4+ and will land on a separate endpoint (or here
// behind an unlocked action whitelist).
//
// Side effects:
//   1. tag_events row updated to status='declined'
//   2. Open tag_reports against this tag_event auto-close to status='reviewed'
//   3. tag_action_log row written for the decline + one per closed report
//   4. Owner notification fired via tag_decision_notifications (dedup'd)

const MAX_NOTE = 280

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response } = await requireModerator()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (body?.action !== "decline") {
    return NextResponse.json(
      { error: "Phase 3 only supports action='decline' on pending tags." },
      { status: 400 },
    )
    // PB-009 Phase 4: override-on-approved support lands here. Phase 3 only allows decline on pending.
  }

  const category = body?.category as TagEventDeclineCategory | undefined
  if (!category || !isUserFacingDeclineCategory(category)) {
    return NextResponse.json({ error: "category required" }, { status: 400 })
  }
  const note = category === "other" && typeof body?.note === "string"
    ? body.note.slice(0, MAX_NOTE)
    : null

  const db = getServiceClient()

  // Re-read status under the same service-role client to guard against a
  // stale UI. 409 on non-pending makes the racing path obvious to the caller.
  const { data: ev, error: readErr } = await db
    .from("tag_events")
    .select("id, subject_id, asserter_id, status")
    .eq("id", id)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (ev.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot decide a ${ev.status} tag` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  // (1) Tag_events update
  const { error: updErr } = await db
    .from("tag_events")
    .update({
      status:                   "declined",
      decision_by:              user!.id,
      decision_at:              now,
      decision_reason_category: category,
      decision_reason_note:     note,
    })
    .eq("id", id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // (2) Auto-close open tag_reports for this tag_event
  const { data: closedReports } = await db
    .from("tag_reports")
    .update({ status: "reviewed", reviewed_by: user!.id, reviewed_at: now })
    .eq("tag_event_id", id)
    .eq("status", "open")
    .select("id")
  const closedIds = ((closedReports ?? []) as { id: string }[]).map((r) => r.id)

  // (3) Log the decline + per-report close
  await logTagAction(db, {
    tagEventId:     id,
    asserterId:     (ev.asserter_id as string | null) ?? null,
    actorId:        user!.id,
    actorRole:      "editor",
    action:         "decline",
    priorStatus:    "pending",
    newStatus:      "declined",
    reasonCategory: category,
    reasonNote:     note,
  })
  if (closedIds.length > 0) {
    await logTagActions(db, closedIds.map((rid) => ({
      tagEventId:     id,
      asserterId:     (ev.asserter_id as string | null) ?? null,
      actorId:        user!.id,
      actorRole:      "editor" as const,
      action:         "report_close_action" as const,
      relatedReport:  rid,
    })))
  }

  // (4) Owner notification — fire-and-forget; failures are logged.
  fireEditorDeclineNotification(db, {
    tagEventId:     id,
    ownerId:        ev.subject_id as string,
    decidedBy:      user!.id,
    reasonCategory: category,
  }).catch((err) => console.error("[admin/decide] notification error:", err))

  return NextResponse.json({ ok: true, closed_reports: closedIds.length })
}
