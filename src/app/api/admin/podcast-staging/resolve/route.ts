import { NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { recheckCatalog } from "@/lib/podcast-staging-actions"

// Podcast archive staging, Phase 2 decisions. Strict gate: requireModerator
// (is_editor only, brief D5). Writes only podcast_staging_* rows, stamped with
// the editor as decided_by (T12). Logic lives in src/lib/podcast-staging-actions.ts.
//
// POST /api/admin/podcast-staging/resolve   "Re-check against catalog"
// Re-runs the resolver over every node nobody has acted on yet. Nodes with a
// decided_by (a person approved, held, matched or edited them) are left alone.

export const maxDuration = 300

export async function POST() {
  const { response } = await requireModerator()
  if (response) return response
  try {
    const result = await recheckCatalog(getServiceClient())
  if (!result.ok) {
    const { status, ok: _ok, ...rest } = result
    void _ok
    return NextResponse.json(rest, { status })
  }
  return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
