import { NextResponse } from "next/server"
import { captureServerEvent } from "@/lib/analytics-server"

// PostHog sink for the node_redirect event fired by the redirect proxy
// (src/proxy.ts). The proxy POSTs here fire-and-forget; this adapter forwards
// to the capture layer (PostHog + an analytics_events row) under category
// 'redirect'.
//
// Expected payload (sent fire-and-forget by the proxy):
//   {
//     from_slug: string,   // the segment the user requested
//     to_slug: string,     // the canonical segment we redirected to
//     reason: 'merged' | 'reslugged' | 'manual' | 'route-migration',
//   }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.from_slug === "string" && typeof body.to_slug === "string") {
      await captureServerEvent({
        category: "redirect",
        event: "node_redirect",
        props: {
          from_slug: body.from_slug,
          to_slug: body.to_slug,
          reason: typeof body.reason === "string" ? body.reason : "unknown",
        },
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
