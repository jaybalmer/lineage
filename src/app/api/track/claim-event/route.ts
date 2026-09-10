import { NextResponse } from "next/server"
import { captureServerEvent } from "@/lib/analytics-server"

// PostHog sink for claim-request events. The claim-request handlers
// (src/app/api/claim-requests/*, admin/invite-node, public/claim-node) POST
// here fire-and-forget; this adapter forwards to the capture layer (PostHog +
// an analytics_events row). Most events are 'moderation'; the two growth events
// below are re-categorised to 'invite' (brief D3) so the /admin/activity
// moderation count is honest and an invite-category rollup can see them.
// Historical rows keep whatever category they were written with; see
// docs/analytics-events.md for the seam date.
//
// Expected payload:
//   {
//     event: "claim_requested" | "vouch_added" | "claim_status_changed"
//            | "claim_node_invited" | "claim_node_requested" | ...,
//     props: Record<string, unknown>,  // surface, person_id, predicate, ...
//     actor_id?, distinct_id?, occurred_at?
//   }
const GROWTH_EVENTS = new Set(["claim_node_invited", "claim_node_requested"])

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.event === "string") {
      const props = body.props && typeof body.props === "object" ? body.props : {}
      // body.actor_id is the value the shared trackServerEvent helper sends;
      // props.actor_id is the compat fallback for any caller not yet updated.
      const actorId =
        typeof body.actor_id === "string"
          ? body.actor_id
          : typeof props.actor_id === "string"
            ? props.actor_id
            : null
      await captureServerEvent({
        category: GROWTH_EVENTS.has(body.event) ? "invite" : "moderation",
        event: body.event,
        props,
        actorId,
        distinctId: typeof body.distinct_id === "string" ? body.distinct_id : null,
        occurredAt: typeof body.occurred_at === "string" ? body.occurred_at : null,
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
