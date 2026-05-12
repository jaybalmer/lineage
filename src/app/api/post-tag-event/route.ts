import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { fireTagEvents } from "@/lib/invite-tracking-server"

// ── POST /api/post-tag-event ──────────────────────────────────────────────────
//
// Bridge endpoint for the PB-008 Phase 2 Session 4 ambient-growth loop. Every
// client-side write path that names a person (Add Claim, Add Story’s rider
// tags, future Add Riding Day) posts the person ids here after the underlying
// write succeeds. The route fans out to distinct_tagger_summary +
// person_invite_notifications via the invite-tracking lib.
//
// Body: { person_ids: string[] }
// Auth: required; the asserter is the caller’s session user.
// Response: { results: ThresholdFireResult[] }
//
// Failures inside the helper are non-fatal — every person id resolves to a
// per-person result with `fired: false` and a `reason`. The caller does not
// need to do anything with the response; it’s returned for debugging and
// telemetry (the diagnostics work in `Operations/diagnostics-system-brief.md`
// will pipe the results into PostHog).
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const personIds = (body as { person_ids?: unknown })?.person_ids
  if (!Array.isArray(personIds) || personIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "person_ids must be an array of strings" },
      { status: 400 }
    )
  }
  if (personIds.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const results = await fireTagEvents(personIds as string[], user.id)
  return NextResponse.json({ results })
}
