import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// GET /api/me/lookup-tag-event?story_id=X&rider_id=Y
// GET /api/me/lookup-tag-event?claim_id=X&rider_id=Y
//
// PB-009 Phase 3 — resolve the tag_event_id for a given moment+rider pair
// so a third-party viewer can report a tag they see on a story/claim card.
// The report endpoint itself is keyed on tag_event_id; the viewing surfaces
// (feed, /people, story detail) only have the moment_ref shape, so this
// thin lookup bridges them.
//
// Service-role read so we can see non-approved tag_events too if needed.
// Returns 404 if no matching tag_event exists.

export async function GET(req: NextRequest) {
  const { response } = await requireAuth()
  if (response) return response

  const url = new URL(req.url)
  const storyId = url.searchParams.get("story_id")
  const claimId = url.searchParams.get("claim_id")
  const riderId = url.searchParams.get("rider_id")

  if (!riderId || (!storyId && !claimId)) {
    return NextResponse.json(
      { error: "rider_id and one of story_id|claim_id required" },
      { status: 400 },
    )
  }

  const db = getServiceClient()

  // Match against moment_ref JSONB. Two shapes:
  //   story:  moment_ref->>'story_id' = X AND moment_ref->>'rider_id' = Y
  //   claim:  moment_ref->>'claim_id' = X AND subject_id = Y
  // (Claims pair tag_events per-person, so subject_id is the rider — the
  // claim_id alone isn't enough to disambiguate which tagged person.)
  let q = db
    .from("tag_events")
    .select("id, asserter_id, subject_id, predicate, status")
    .limit(1)

  if (storyId) {
    q = q.eq("moment_ref->>story_id", storyId).eq("subject_id", riderId)
  } else if (claimId) {
    q = q.eq("moment_ref->>claim_id", claimId).eq("subject_id", riderId)
  }

  const { data, error } = await q.maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    tag_event_id: data.id,
    asserter_id:  data.asserter_id,
    predicate:    data.predicate,
    status:       data.status,
  })
}
