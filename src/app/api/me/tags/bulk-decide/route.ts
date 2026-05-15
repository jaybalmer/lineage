import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { isUserFacingDeclineCategory } from "@/lib/decline-categories"
import { logTagActions } from "@/lib/tag-action-log"
import type { TagEventDeclineCategory } from "@/types"

// POST /api/me/tags/bulk-decide
// Body: { ids: string[], action: 'approve' | 'decline', decline_category?, decline_note? }
//
// One SQL update with `IN (ids) AND subject_id = user.id AND status = 'pending'`
// so a stranger-supplied id never touches another user's row. Anything not
// transitioned (already decided, wrong subject, missing) returns in `skipped`.

const MAX_IDS = 200

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  if (body.ids.length > MAX_IDS) {
    return NextResponse.json({ error: `ids capped at ${MAX_IDS}` }, { status: 400 })
  }
  if (body.action !== "approve" && body.action !== "decline") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const ids = body.ids.filter((s: unknown): s is string => typeof s === "string")
  const db  = getServiceClient()
  const now = new Date().toISOString()

  const baseUpdate: Record<string, unknown> = {
    decision_by: user.id,
    decision_at: now,
  }
  if (body.action === "approve") {
    baseUpdate.status = "approved"
  } else {
    const category = body.decline_category as TagEventDeclineCategory | undefined
    if (!category || !isUserFacingDeclineCategory(category)) {
      return NextResponse.json({ error: "decline_category required" }, { status: 400 })
    }
    const note = category === "other" && typeof body.decline_note === "string"
      ? body.decline_note.slice(0, 280)
      : null
    baseUpdate.status = "declined"
    baseUpdate.decision_reason_category = category
    baseUpdate.decision_reason_note = note
  }

  // The single-update form runs the eligibility filter server-side. Returning
  // the affected ids lets us compute `skipped` without a second round-trip.
  const { data: decided, error } = await db
    .from("tag_events")
    .update(baseUpdate)
    .in("id", ids)
    .eq("subject_id", user.id)
    .eq("status", "pending")
    .select("id, asserter_id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const decidedRows = (decided ?? []) as { id: string; asserter_id: string | null }[]
  const decidedSet = new Set(decidedRows.map((r) => r.id))
  const skipped = ids.filter((id: string) => !decidedSet.has(id))

  // PB-009 Phase 3 (§9): log each owner action; auto-close any open reports
  // against the decided tag_events; log the report-close per row.
  if (decidedRows.length > 0) {
    const newStatus = body.action === "approve" ? "approved" : "declined"
    const reasonCategory = body.action === "approve" ? null : (baseUpdate.decision_reason_category as TagEventDeclineCategory)
    const reasonNote = body.action === "approve" ? null : (baseUpdate.decision_reason_note as string | null)

    await logTagActions(db, decidedRows.map((r) => ({
      tagEventId:     r.id,
      asserterId:     r.asserter_id,
      actorId:        user.id,
      actorRole:      "owner" as const,
      action:         body.action as "approve" | "decline",
      priorStatus:    "pending" as const,
      newStatus,
      reasonCategory,
      reasonNote,
    })))

    const decidedIds = decidedRows.map((r) => r.id)
    const { data: closedReports } = await db
      .from("tag_reports")
      .update({ status: "reviewed", reviewed_by: user.id, reviewed_at: now })
      .in("tag_event_id", decidedIds)
      .eq("status", "open")
      .select("id, tag_event_id")

    const closedRows = (closedReports ?? []) as { id: string; tag_event_id: string }[]
    if (closedRows.length > 0) {
      const asserterByEvent = new Map(decidedRows.map((r) => [r.id, r.asserter_id]))
      await logTagActions(db, closedRows.map((c) => ({
        tagEventId:    c.tag_event_id,
        asserterId:    asserterByEvent.get(c.tag_event_id) ?? null,
        actorId:       user.id,
        actorRole:     "owner" as const,
        action:        "report_close_action" as const,
        relatedReport: c.id,
      })))
    }
  }

  return NextResponse.json({
    decided: Array.from(decidedSet),
    skipped,
  })
}
