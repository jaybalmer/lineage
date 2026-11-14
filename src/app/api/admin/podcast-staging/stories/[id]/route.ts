import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { decideStory, isUuid } from "@/lib/podcast-staging-actions"

// Podcast archive staging, Phase 2 decisions. Strict gate: requireModerator
// (is_editor only, brief D5). Writes only podcast_staging_* rows, stamped with
// the editor as decided_by (T12). Logic lives in src/lib/podcast-staging-actions.ts.
//
// PATCH /api/admin/podcast-staging/stories/[id]
//   { action: approve | trim {activity, reason} | hold_sensitive | restore |
//             accept_revision | dismiss_revision }

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
  const result = await decideStory(getServiceClient(), user.id, id, body as Record<string, unknown>)
  if (!result.ok) {
    const { status, ok: _ok, ...rest } = result
    void _ok
    return NextResponse.json(rest, { status })
  }
  return NextResponse.json(result)
}
