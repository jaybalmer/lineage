import { NextResponse } from "next/server"
import { captureServerError } from "@/lib/analytics-server"

// Sentry sink for invite error events. /api/invite, the invite UI, and
// maybeFireThresholdNotification POST here fire-and-forget; this adapter
// forwards to the capture layer (Sentry + an analytics_events row with
// category='error', domain='invite').
//
// Expected payload:
//   {
//     tag:
//       | "invite_resend_failed" | "invite_db_insert_failed"
//       | "invite_target_not_claimable" | "invite_post_fetch_failed"
//       | "threshold_notification_dedup_violation"
//       | "threshold_notification_send_failed" | "threshold_count_query_failed",
//     payload: Record<string, unknown>
//   }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.tag === "string") {
      await captureServerError({
        category: "invite",
        tag: body.tag,
        payload: body.payload && typeof body.payload === "object" ? body.payload : {},
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
