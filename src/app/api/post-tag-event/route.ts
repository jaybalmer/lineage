import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"
import { fireTagEvents } from "@/lib/invite-tracking-server"
import { pairClaimTagEvents } from "@/lib/tag-events"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── POST /api/post-tag-event ──────────────────────────────────────────────────
//
// Bridge endpoint for the PB-008 Phase 2 Session 4 ambient-growth loop AND
// the PB-009 Phase 1 tag_event pairing.
//
// Body: { person_ids: string[], claim_id?: string, predicate?: string }
// Auth: required; the asserter is the caller's session user.
// Response: { results, paired }
//
// PB-008 path (always): person_ids is fanned out to distinct_tagger_summary +
// person_invite_notifications via fireTagEvents(). Threshold emails fire here.
//
// PB-009 path (when claim_id is present): one tag_event row is inserted per
// non-asserter person id, and the FIRST tag_event_id is FK'd back onto the
// claim. Phase 1 status defaults to 'approved' so user-visible behaviour is
// unchanged; Phase 2 flips this to 'pending' once /me/tags is live.
//
// Note: PB-008 callers that don't yet pass claim_id still work — the PB-009
// pairing step is skipped, the threshold fan-out still runs. This lets us
// roll the change out gradually if needed (today both callers below pass it).
// The brief calls out renaming this to /api/tag-event in Phase 4; do not
// rename yet.
//
// Failures inside fireTagEvents are non-fatal — each person resolves to a
// per-person result with `fired: false` and a `reason`. Pairing failures are
// logged but do not 500 the request (the underlying claim is preserved with
// tag_event_id=NULL, which the _public view treats as approved).
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as {
    person_ids?: unknown
    claim_id?: unknown
    predicate?: unknown
  }

  const personIds = parsed.person_ids
  if (!Array.isArray(personIds) || personIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "person_ids must be an array of strings" },
      { status: 400 }
    )
  }
  if (personIds.length === 0) {
    return NextResponse.json({ results: [], paired: 0 })
  }

  // PB-008 fan-out
  const results = await fireTagEvents(personIds as string[], user.id)

  // PB-009 pairing — only when the caller named the claim. Stories pair their
  // tag_events server-side in /api/stories, so they don't pass claim_id here.
  let paired = 0
  let failed = 0
  if (typeof parsed.claim_id === "string" && parsed.claim_id) {
    const predicate = typeof parsed.predicate === "string" && parsed.predicate
      ? parsed.predicate
      : "claim_tag"
    const supabase = getServiceClient()
    const pairResult = await pairClaimTagEvents(supabase, {
      claimId: parsed.claim_id,
      asserterId: user.id,
      personIds: personIds as string[],
      predicate,
    })
    paired = pairResult.paired
    failed = pairResult.failed
    if (failed > 0) {
      console.error(`[post-tag-event] claim ${parsed.claim_id}: ${paired} paired, ${failed} failed`)
    }
  }

  return NextResponse.json({ results, paired })
}
