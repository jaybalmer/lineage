import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { isUserFacingDeclineCategory } from "@/lib/decline-categories"
import { logTagAction } from "@/lib/tag-action-log"
import type { TagEventDeclineCategory } from "@/types"

// POST /api/me/tags/[id]/report
// Body: { category: TagEventDeclineCategory, note?: string }
//
// PB-009 Phase 3 — any logged-in member can report any tag. Reporter identity
// is visible to editors only. UNIQUE (tag_event_id, reported_by) prevents a
// single member from spamming the queue with multiple reports on the same
// tag; a duplicate insert surfaces as { already_reported: true } so the UI
// can show the right toast.

const MAX_NOTE = 280

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const category = body?.category as TagEventDeclineCategory | undefined
  if (!category || !isUserFacingDeclineCategory(category)) {
    return NextResponse.json({ error: "category required" }, { status: 400 })
  }
  const note = category === "other" && typeof body?.note === "string"
    ? body.note.slice(0, MAX_NOTE)
    : null

  const db = getServiceClient()

  // Confirm the tag_event exists. 404 short-circuits a bad client guess
  // without exposing whether the id is real but inaccessible.
  const { data: ev } = await db
    .from("tag_events")
    .select("id, asserter_id")
    .eq("id", id)
    .maybeSingle()
  if (!ev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: inserted, error } = await db
    .from("tag_reports")
    .insert({
      tag_event_id:    id,
      reported_by:     user.id,
      reason_category: category,
      reason_note:     note,
      status:          "open",
    })
    .select("id")
    .maybeSingle()

  if (error) {
    // UNIQUE violation → user already reported this tag. Surface as ok with
    // a flag so the UI shows a friendly "already reported" toast.
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ ok: true, already_reported: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log the report-open action. tag_event_id required (CHECK constraint).
  await logTagAction(db, {
    tagEventId:    id,
    asserterId:    (ev.asserter_id as string | null) ?? null,
    actorId:       user.id,
    actorRole:     "reporter",
    action:        "report_open",
    reasonCategory: category,
    reasonNote:    note,
    relatedReport: inserted?.id ?? null,
  })

  return NextResponse.json({ ok: true, report_id: inserted?.id ?? null })
}
