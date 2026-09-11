import { NextResponse } from "next/server"
import { captureServerEvent } from "@/lib/analytics-server"
import type { AnalyticsCategory } from "@/types"

// Conservative, case-insensitive bot user-agent match. We STAMP props.bot = true
// rather than dropping the event (brief D8): the scoreboard RPCs filter these out
// while /admin/activity stays honest as a raw tail, and the call is reversible.
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|headlesschrome|python-requests|curl\/|wget|facebookexternalhit/i

// Generic product-event sink. Client trackEvent() (src/lib/analytics.ts) POSTs
// { category, event, props, actor_id, distinct_id, occurred_at } here fire-and-forget. The
// handler always returns 204 and never lets a capture failure surface
// (brief D-LOCKED-1, D-LOCKED-2).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.category === "string" && typeof body.event === "string") {
      const props = body.props && typeof body.props === "object" ? { ...body.props } : {}
      const ua = req.headers.get("user-agent") ?? ""
      if (ua && BOT_UA.test(ua)) props.bot = true
      await captureServerEvent({
        category: body.category as AnalyticsCategory,
        event: body.event,
        props,
        actorId: typeof body.actor_id === "string" ? body.actor_id : null,
        distinctId: typeof body.distinct_id === "string" ? body.distinct_id : null,
        occurredAt: typeof body.occurred_at === "string" ? body.occurred_at : null,
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
