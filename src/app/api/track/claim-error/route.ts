import { NextResponse } from "next/server"

// Sentry stub for claim-request error events. Not wired yet; the API routes
// POST here so the instrumentation site exists and can be filled in once the
// Sentry SDK is added.
//
// Expected payload (sent fire-and-forget by the vouch handler):
//   {
//     tag: "vouch_self_target" | "vouch_duplicate" | "vouch_append_race_condition" | "threshold_check_failed",
//     payload: Record<string, unknown>
//   }
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
