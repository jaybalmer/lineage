import { NextResponse } from "next/server"
import { captureServerEvent } from "@/lib/analytics-server"
import type { AnalyticsCategory } from "@/types"

// Generic product-event sink. Client trackEvent() (src/lib/analytics.ts) POSTs
// { category, event, props, actor_id, distinct_id } here fire-and-forget. The
// handler always returns 204 and never lets a capture failure surface
// (brief D-LOCKED-1, D-LOCKED-2).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.category === "string" && typeof body.event === "string") {
      await captureServerEvent({
        category: body.category as AnalyticsCategory,
        event: body.event,
        props: body.props && typeof body.props === "object" ? body.props : {},
        actorId: typeof body.actor_id === "string" ? body.actor_id : null,
        distinctId: typeof body.distinct_id === "string" ? body.distinct_id : null,
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
