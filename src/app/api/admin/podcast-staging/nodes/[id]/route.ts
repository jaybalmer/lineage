import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { getNode } from "@/lib/podcast-staging-queries"
import { isUuid, patchNode } from "@/lib/podcast-staging-actions"

// Podcast archive staging (Phase 1, read-only). Strict gate: requireModerator
// (is_editor = true only; founding members get 403, brief D5). Same query
// module as the /admin/podcast/staging pages, so page and API cannot drift.
//
// GET   /api/admin/podcast-staging/nodes/[id]  node plus every story naming it
// PATCH /api/admin/podcast-staging/nodes/[id]  { action: approve | hold | reject | reset |
//       rename {name} | set_match {subject_id} | confirm_new | ghost {ghost} |
//       link_aka {other_id} | unlink_aka }

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireModerator()
  if (response) return response
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  const result = await patchNode(getServiceClient(), user.id, id, body as Record<string, unknown>)
  if (!result.ok) {
    const { status, ok: _ok, ...rest } = result
    void _ok
    return NextResponse.json(rest, { status })
  }
  return NextResponse.json(result)
}
