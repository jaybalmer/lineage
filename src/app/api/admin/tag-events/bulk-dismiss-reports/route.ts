import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { logTagActions } from "@/lib/tag-action-log"

// POST /api/admin/tag-events/bulk-dismiss-reports
// Body: { report_ids: string[] }
//
// PB-009 Phase 3 — bulk dismiss reports (Q6 — bulk dismiss allowed; bulk
// decline NOT allowed). Dismisses REPORTS without touching the underlying
// tag_events.

const MAX_IDS = 200

export async function POST(req: NextRequest) {
  const { user, response } = await requireModerator()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.report_ids) || body.report_ids.length === 0) {
    return NextResponse.json({ error: "report_ids required" }, { status: 400 })
  }
  if (body.report_ids.length > MAX_IDS) {
    return NextResponse.json({ error: `report_ids capped at ${MAX_IDS}` }, { status: 400 })
  }
  const reportIds = body.report_ids.filter((s: unknown): s is string => typeof s === "string")

  const db = getServiceClient()
  const now = new Date().toISOString()

  const { data: dismissed, error } = await db
    .from("tag_reports")
    .update({ status: "dismissed", reviewed_by: user!.id, reviewed_at: now })
    .in("id", reportIds)
    .eq("status", "open")
    .select("id, tag_event_id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = ((dismissed ?? []) as { id: string; tag_event_id: string }[])
  if (rows.length > 0) {
    // Need asserter_id for each tag_event for the rap-sheet hot path. One
    // extra query keeps the log denormalised.
    const tagEventIds = Array.from(new Set(rows.map((r) => r.tag_event_id)))
    const { data: evs } = await db
      .from("tag_events")
      .select("id, asserter_id")
      .in("id", tagEventIds)
    const asserterById = new Map(
      ((evs ?? []) as { id: string; asserter_id: string | null }[])
        .map((e) => [e.id, e.asserter_id]),
    )

    await logTagActions(db, rows.map((r) => ({
      tagEventId:    r.tag_event_id,
      asserterId:    asserterById.get(r.tag_event_id) ?? null,
      actorId:       user!.id,
      actorRole:     "editor" as const,
      action:        "report_close_dismiss" as const,
      relatedReport: r.id,
    })))
  }

  const dismissedSet = new Set(rows.map((r) => r.id))
  const skipped = reportIds.filter((id: string) => !dismissedSet.has(id))

  return NextResponse.json({
    dismissed: rows.length,
    skipped:   skipped.length,
  })
}
