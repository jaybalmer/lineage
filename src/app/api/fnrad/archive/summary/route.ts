// GET /api/fnrad/archive/summary?focus={type}:{id}
//
// Public and read-only: whether one node is in the FNRad Archive, and how many
// episodes and stories name it. Lets entity pages link to the node's Path
// without shipping the whole index. { inArchive: false } when it is not.

import { NextResponse } from "next/server"
import { ARCHIVE_TYPES, findFocus, readArchiveIndex } from "@/lib/fnrad-archive"

export async function GET(req: Request) {
  const focus = new URL(req.url).searchParams.get("focus") ?? undefined
  const index = await readArchiveIndex()
  const i = findFocus(index, focus)
  const headers = { "Cache-Control": index.totals.episodes ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" }
  if (i == null) return NextResponse.json({ inArchive: false }, { headers })
  const n = index.nodes[i]
  return NextResponse.json(
    { inArchive: true, type: ARCHIVE_TYPES[n[0]], id: n[1], name: n[2], episodes: n[4], stories: n[5] },
    { headers },
  )
}
