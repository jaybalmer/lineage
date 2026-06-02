import { NextResponse } from "next/server"
import { captureServerError } from "@/lib/analytics-server"
import type { AnalyticsCategory } from "@/types"

// Generic error sink. Client trackError() (src/lib/analytics.ts) POSTs
// { category, tag, payload } here fire-and-forget. The handler always returns
// 204 and never lets a capture failure surface (brief D-LOCKED-1,
// D-LOCKED-2). The stored row uses category='error' with the domain recorded
// in props.domain.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.category === "string" && typeof body.tag === "string") {
      await captureServerError({
        category: body.category as AnalyticsCategory,
        tag: body.tag,
        payload: body.payload && typeof body.payload === "object" ? body.payload : {},
      })
    }
  } catch {
    // never throw
  }
  return new NextResponse(null, { status: 204 })
}
