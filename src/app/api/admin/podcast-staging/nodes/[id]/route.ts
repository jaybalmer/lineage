import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { getNode } from "@/lib/podcast-staging-queries"

// Podcast archive staging (Phase 1, read-only). Strict gate: requireModerator
// (is_editor = true only; founding members get 403, brief D5). Same query
// module as the /admin/podcast/staging pages, so page and API cannot drift.
//
// GET /api/admin/podcast-staging/nodes/[id]  node plus every story naming it

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireModerator()
  if (response) return response
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const node = await getNode(getServiceClient(), id)
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(node)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
