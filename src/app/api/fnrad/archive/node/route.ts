// GET /api/fnrad/archive/node?focus={type}:{id}
//
// Public and read-only: every story about one archive node, with its years and
// the other subjects named in it. Feeds the archive's Path view, the pair panel
// and the full story list. Published mentions on live episodes only.

import { NextResponse } from "next/server"
import { ARCHIVE_TYPES, getArchiveNodeStories } from "@/lib/fnrad-archive"
import type { ArchiveType } from "@/lib/fnrad-archive"

export async function GET(req: Request) {
  const focus = new URL(req.url).searchParams.get("focus") ?? ""
  const at = focus.indexOf(":")
  const type = focus.slice(0, at) as ArchiveType
  const id = focus.slice(at + 1)
  if (at < 1 || !id || !ARCHIVE_TYPES.includes(type)) {
    return NextResponse.json({ error: "focus must be {type}:{id}" }, { status: 400 })
  }
  try {
    const data = await getArchiveNodeStories(type, id)
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } })
  } catch (e) {
    console.error("[fnrad-archive] node stories failed", e)
    return NextResponse.json({ error: "stories unavailable" }, { status: 503 })
  }
}
