import { NextResponse } from "next/server"
import { captureServerError } from "@/lib/analytics-server"

// Sentry sink for claim-request error events. The vouch handler POSTs here
// fire-and-forget; this adapter forwards to the capture layer (Sentry + an
// analytics_events row with category='error', domain='moderation').
//
// Expected payload:
//   {
//     tag: "vouch_self_target" | "vouch_duplicate" | "vouch_append_race_condition" | "threshold_check_failed",
//     payload: Record<string, unknown>
//   }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.tag === "string") {
      await captureServerError({
        category: "moderation",
        tag: body.tag,
        payload: body.payload && typeof body.payload === "object" ? body.payload : {},
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
