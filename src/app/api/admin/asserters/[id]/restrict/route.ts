import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { logTagAction } from "@/lib/tag-action-log"

// POST   /api/admin/asserters/[id]/restrict — restrict an asserter from new tags
// DELETE /api/admin/asserters/[id]/restrict — reverse the restriction
//
// PB-009 Phase 3 (Q4). Restriction is implemented as a tag_blocklist row with
// scope='global', block_kind='user'. The DB trigger apply_block_cascade()
// handles the cascade (pending → declined; approved → disabled per Q7) and
// writes its own tag_action_log rows for each cascade-affected tag_event.
// We additionally log a single 'restrict_asserter' summary row here.
//
// Side notes on unrestrict (Q4 explicit): previously-cascade-declined tags
// STAY declined; previously-cascade-disabled tags STAY disabled. The asserter
// can create new tags going forward.

const MAX_REASON = 500

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: asserterId } = await params
  const { user, response } = await requireModerator()
  if (response) return response

  if (!asserterId) {
    return NextResponse.json({ error: "asserter id required" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === "string"
    ? body.reason.slice(0, MAX_REASON)
    : null

  const db = getServiceClient()

  // Pre-snapshot the affected counts before the trigger fires so the response
  // can report what just happened. The trigger flips status atomically inside
  // the AFTER INSERT, so reading these counts after the insert would already
  // reflect the new state.
  const [{ count: pendingCount }, { count: approvedCount }] = await Promise.all([
    db.from("tag_events").select("id", { count: "exact", head: true })
      .eq("asserter_id", asserterId).eq("status", "pending"),
    db.from("tag_events").select("id", { count: "exact", head: true })
      .eq("asserter_id", asserterId).eq("status", "approved"),
  ])

  const { error } = await db.from("tag_blocklist").insert({
    subject_id:    null,
    blocked_party: asserterId,
    block_kind:    "user",
    scope:         "global",
    created_by:    user!.id,
    reason,
  })

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json(
        { ok: false, reason: "already_restricted" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Summary log row — the per-tag_event block_cascade rows are written by the
  // trigger function itself (see apply_block_cascade() in Migration B).
  await logTagAction(db, {
    tagEventId: null,            // CHECK constraint allows null for restrict_asserter
    asserterId,
    actorId:    user!.id,
    actorRole:  "editor",
    action:     "restrict_asserter",
    reasonNote: reason,
  })

  return NextResponse.json({
    ok: true,
    cascade_summary: {
      pending_declined:  pendingCount ?? 0,
      approved_disabled: approvedCount ?? 0,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: asserterId } = await params
  const { user, response } = await requireModerator()
  if (response) return response

  const db = getServiceClient()
  const { data: deleted, error } = await db
    .from("tag_blocklist")
    .delete()
    .eq("blocked_party", asserterId)
    .eq("block_kind", "user")
    .eq("scope", "global")
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "not_restricted" },
      { status: 404 },
    )
  }

  await logTagAction(db, {
    tagEventId: null,
    asserterId,
    actorId:    user!.id,
    actorRole:  "editor",
    action:     "unrestrict_asserter",
  })

  return NextResponse.json({ ok: true })
}
