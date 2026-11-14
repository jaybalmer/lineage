import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { isUuid, mergeNode } from "@/lib/podcast-staging-actions"

// Podcast archive staging, Phase 2 decisions. Strict gate: requireModerator
// (is_editor only, brief D5). Writes only podcast_staging_* rows, stamped with
// the editor as decided_by (T12). Logic lives in src/lib/podcast-staging-actions.ts.
//
// POST /api/admin/podcast-staging/nodes/[id]/merge  { target_id }
// Merges this node into target_id (same type). Mentions repoint; duplicates in
// a story the target is already in are removed; this node keeps merged_into.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireModerator()
  if (response) return response
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = (await req.json().catch(() => null)) as { target_id?: unknown } | null
  const result = await mergeNode(getServiceClient(), user.id, id, body?.target_id)
  if (!result.ok) {
    const { status, ok: _ok, ...rest } = result
    void _ok
    return NextResponse.json(rest, { status })
  }
  return NextResponse.json(result)
}
