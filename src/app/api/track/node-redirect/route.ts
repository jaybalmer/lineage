import { NextResponse } from "next/server"

// PostHog stub for the `node_redirect` event fired by the redirect middleware.
// PostHog is not yet wired into this project; the middleware still POSTs to
// this endpoint so the call site exists and is easy to fill in once the SDK
// is added.
//
// Expected payload (sent fire-and-forget by the middleware):
//   {
//     from_slug: string,           // the segment the user requested
//     to_slug: string,             // the canonical segment we redirected to
//     reason: 'merged' | 'reslugged' | 'manual' | 'route-migration',
//   }
//
// When PostHog lands, replace the body of this handler with a real
// captureServerEvent('node_redirect', payload) call.
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
