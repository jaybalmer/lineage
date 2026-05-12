import { NextResponse } from "next/server"

// PostHog stub mirroring /api/track/claim-event. PostHog is not wired into
// this project yet; the invite surfaces still POST here so the call site
// exists and is easy to fill in once the SDK is added.
//
// Expected payload (sent fire-and-forget by the invite surfaces):
//   {
//     event: "share_link_copied" | "invite_email_added" | "invite_email_sent",
//     props: Record<string, unknown>
//   }
//
// When PostHog lands, replace the body of this handler with a real
// captureServerEvent(event, props) call.
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
