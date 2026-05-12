import { NextResponse } from "next/server"

// Sentry stub for invite error events. Not wired yet; the invite surfaces
// POST here so the instrumentation site exists and can be filled in once the
// Sentry SDK is added.
//
// Expected payload (sent fire-and-forget by the invite surfaces):
//   {
//     tag: "clipboard_unavailable" | "invite_email_send_failed",
//     payload: Record<string, unknown>
//   }
export async function POST(_req: Request) {
  return new NextResponse(null, { status: 204 })
}
