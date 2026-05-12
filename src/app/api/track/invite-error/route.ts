import { NextResponse } from "next/server"

// Sentry stub for invite error events. Not wired yet; the API routes
// POST here so the instrumentation site exists and can be filled in once
// the Sentry SDK is added.
//
// Expected payload (sent fire-and-forget by /api/invite, the invite UI, and
// the maybeFireThresholdNotification helper):
//   {
//     tag:
//       | "invite_resend_failed"
//       | "invite_db_insert_failed"
//       | "invite_target_not_claimable"
//       | "invite_post_fetch_failed"
//       | "threshold_notification_dedup_violation"   // Session 4 Item 1
//       | "threshold_notification_send_failed"       // Session 4 Item 1
//       | "threshold_count_query_failed",            // Session 4 Item 1
//     payload: Record<string, unknown>
//   }
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
