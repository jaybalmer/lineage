// GET /api/fnrad/archive/retold
//
// Public and read-only: the stories told more than once on FNRad (Pass B
// groupings), each with its tellings on live episodes, their story titles and
// excerpts, and who is named across them. Feeds the archive's Retold view.

import { NextResponse } from "next/server"
import { getArchiveRetold } from "@/lib/fnrad-archive"

export async function GET() {
  try {
    const data = await getArchiveRetold()
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } })
  } catch (e) {
    console.error("[fnrad-archive] retold failed", e)
    return NextResponse.json({ error: "retold unavailable" }, { status: 503 })
  }
}
