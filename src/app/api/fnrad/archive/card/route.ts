// GET /api/fnrad/archive/card (briefs/fnrad-archive-front-doors-brief-v1.md, A1).
//
// Public and read-only: the archive card's data for client pages (home,
// /snowboarding, the FNRad brand page). No auth, no user data. Server pages
// call getArchiveCardData() directly. Null body when the archive is empty or
// the build failed; every placement renders nothing on null.

import { NextResponse } from "next/server"
import { getArchiveCardData } from "@/lib/fnrad-archive"

export async function GET() {
  const data = await getArchiveCardData()
  return NextResponse.json(data, {
    headers: { "Cache-Control": data ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" },
  })
}
