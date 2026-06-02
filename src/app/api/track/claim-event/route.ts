import { NextResponse } from "next/server"
import { captureServerEvent } from "@/lib/analytics-server"

// PostHog sink for claim-request events. The claim-request handlers
// (src/app/api/claim-requests/*) POST here fire-and-forget; this adapter
// forwards to the capture layer (PostHog + an analytics_events row) under
// category 'moderation'.
//
// Expected payload:
//   {
//     event: "claim_requested" | "vouch_added" | "claim_status_changed",
//     props: Record<string, unknown>   // surface, person_id, predicate, actor_id, ...
//   }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.event === "string") {
      const props = body.props && typeof body.props === "object" ? body.props : {}
      await captureServerEvent({
        category: "moderation",
        event: body.event,
        props,
        actorId: typeof props.actor_id === "string" ? props.actor_id : null,
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
