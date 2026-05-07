import { NextResponse } from "next/server"

// PostHog stub mirroring /api/track/node-redirect. PostHog is not wired into
// this project yet; the API routes still POST here so the call site exists
// and is easy to fill in once the SDK is added.
//
// Expected payload (sent fire-and-forget by the claim-request handlers):
//   {
//     event: "claim_requested" | "vouch_added" | "claim_status_changed",
//     props: Record<string, unknown>
//   }
//
// When PostHog lands, replace the body of this handler with a real
// captureServerEvent(event, props) call.
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
