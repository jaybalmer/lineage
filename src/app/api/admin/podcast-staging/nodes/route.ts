import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { listNodes, parseNodeFilters } from "@/lib/podcast-staging-queries"

// Podcast archive staging (Phase 1, read-only). Strict gate: requireModerator
// (is_editor = true only; founding members get 403, brief D5). Same query
// module as the /admin/podcast/staging pages, so page and API cannot drift.
//
// GET /api/admin/podcast-staging/nodes?type=&resolution=&flagged=1&q=&page=

export async function GET(req: NextRequest) {
  const { response } = await requireModerator()
  if (response) return response
  const filters = parseNodeFilters(Object.fromEntries(req.nextUrl.searchParams))
  try {
    return NextResponse.json(await listNodes(getServiceClient(), filters))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
