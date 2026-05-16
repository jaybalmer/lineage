import { NextResponse } from "next/server"

// PostHog stub mirroring /api/track/claim-event. PostHog is not wired into
// this project yet; the API routes still POST here so the call site exists
// and is easy to fill in once the SDK is added.
//
// Expected payload (sent fire-and-forget by invite UI, /api/invite,
// /api/tag-event, and maybeFireThresholdNotification):
//   {
//     event:
//       | "invite_modal_opened"
//       | "invite_modal_dismissed"
//       | "invite_link_created"
//       | "invite_email_sent"
//       | "invite_link_copied"
//       | "invite_prompt_shown"
//       | "invite_prompt_clicked"
//       | "invite_prompt_dismissed"
//       | "share_link_copied"                  // Session 4 Item 2 (Help connect card)
//       | "invite_email_added"                 // Session 4 Item 2 (Help connect card)
//       | "tag_threshold_notification_sent",   // Session 4 Item 1 (threshold notif)
//     props: Record<string, unknown>
//   }
//
// `props` typically carries: surface, person_id, predicate, inviter_id,
// has_email, count (for bulk prompts), distinct_tagger_count (threshold).
// When PostHog lands, replace the body of this handler with a real
// captureServerEvent(event, props) call.
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
