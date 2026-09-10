import { NextResponse } from "next/server"
import { captureServerEvent } from "@/lib/analytics-server"

// PostHog sink for invite/share events. The invite UI, /api/invite,
// /api/tag-event, and maybeFireThresholdNotification POST here fire-and-forget
// (see src/lib/invite-tracking.ts); this adapter forwards to the capture layer
// (PostHog + an analytics_events row) under category 'invite'.
//
// Expected payload:
//   {
//     event:
//       | "invite_modal_opened" | "invite_modal_dismissed" | "invite_link_created"
//       | "invite_email_sent" | "invite_link_copied" | "invite_prompt_shown"
//       | "invite_prompt_clicked" | "invite_prompt_dismissed" | "share_link_copied"
//       | "invite_email_added" | "tag_threshold_notification_sent",
//     props: Record<string, unknown>   // surface, person_id, predicate, inviter_id, ...
//   }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.event === "string") {
      const props = body.props && typeof body.props === "object" ? body.props : {}
      const actorId =
        typeof body.actor_id === "string"
          ? body.actor_id
          : typeof props.inviter_id === "string"
            ? props.inviter_id
            : typeof props.actor_id === "string"
              ? props.actor_id
              : null
      await captureServerEvent({
        category: "invite",
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
