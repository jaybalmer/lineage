import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import type { TagEventDeclineCategory } from "@/types"

// POST /api/me/tags/bulk-decide
// Body: { ids: string[], action: 'approve' | 'decline', decline_category?, decline_note? }
//
// One SQL update with `IN (ids) AND subject_id = user.id AND status = 'pending'`
// so a stranger-supplied id never touches another user's row. Anything not
// transitioned (already decided, wrong subject, missing) returns in `skipped`.

const DECLINE_CATEGORIES = new Set<TagEventDeclineCategory>([
  "this_wasnt_me", "wrong_moment", "preference", "spam", "other",
])
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
    if (!category || !DECLINE_CATEGORIES.has(category)) {
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
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const decidedSet = new Set((decided ?? []).map((r: { id: string }) => r.id))
  const skipped = ids.filter((id: string) => !decidedSet.has(id))

  return NextResponse.json({
    decided: Array.from(decidedSet),
    skipped,
  })
}
