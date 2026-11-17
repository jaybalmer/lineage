import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import {
  bulkApproveConfidentNodes,
  bulkApproveConfidentStories,
  bulkApproveEpisodeStories,
  bulkApproveExactNodes,
} from "@/lib/podcast-staging-actions"

// Podcast archive staging, Phase 2 decisions. Strict gate: requireModerator
// (is_editor only, brief D5). Writes only podcast_staging_* rows, stamped with
// the editor as decided_by (T12). Logic lives in src/lib/podcast-staging-actions.ts.
//
// POST /api/admin/podcast-staging/bulk
//   { kind: "episode_stories", episode_id, dryRun }   approve pending stories in one episode
//   { kind: "exact_nodes", type?, dryRun }            approve exact catalog matches
//   { kind: "confident_nodes", type?, dryRun }        confidence pass over pending nodes
//   { kind: "confident_stories", dryRun }             confidence pass over pending stories
//     (rules: src/lib/podcast-staging-confidence.ts)
// dryRun defaults to TRUE: the preview (count plus what is left out and why) is
// the default, and applying needs an explicit dryRun: false.

export async function POST(req: NextRequest) {
  const { user, response } = await requireModerator()
  if (response) return response
  const body = (await req.json().catch(() => null)) as { kind?: unknown; episode_id?: unknown; type?: unknown; dryRun?: unknown } | null
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  const apply = body.dryRun === false
  const db = getServiceClient()
  const result =
    body.kind === "episode_stories"
      ? await bulkApproveEpisodeStories(db, user.id, body.episode_id, apply)
      : body.kind === "exact_nodes"
        ? await bulkApproveExactNodes(db, user.id, body.type, apply)
        : body.kind === "confident_nodes"
          ? await bulkApproveConfidentNodes(db, user.id, body.type, apply)
          : body.kind === "confident_stories"
            ? await bulkApproveConfidentStories(db, user.id, apply)
            : ({ ok: false, status: 400, error: "kind must be episode_stories, exact_nodes, confident_nodes or confident_stories" } as const)
  if (!result.ok) {
    const { status, ok: _ok, ...rest } = result
    void _ok
    return NextResponse.json(rest, { status })
  }
  return NextResponse.json(result)
}
