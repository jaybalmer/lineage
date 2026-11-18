import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { FNRAD_ARCHIVE_TAG } from "@/lib/fnrad-archive-shared"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { isUuid } from "@/lib/podcast-staging-actions"
import { publishEpisodes } from "@/lib/podcast-staging-publish"

// Podcast archive staging, Phase 3 publish (HUMAN-RUN). Strict gate:
// requireModerator (is_editor only).
//
// POST /api/admin/podcast-staging/publish  { episodeIds: string[], dryRun?: boolean }
//
// dryRun defaults to TRUE. The dry run returns the episodes to create, new
// nodes by type, mentions to insert, and every left-out row with its reason.
// Applying needs an explicit dryRun: false, same rule as the import route.
// Episodes are created HIDDEN; nothing reaches a timeline until the episode is
// made public from its episode page (GET /api/mentions only serves live
// episodes). No contribution tokens: nothing goes through /api/catalog/entity.

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { user, response } = await requireModerator()
  if (response) return response
  const body = (await req.json().catch(() => null)) as { episodeIds?: unknown; dryRun?: unknown } | null
  const ids = Array.isArray(body?.episodeIds) ? body!.episodeIds.filter(isUuid) : []
  if (!ids.length) return NextResponse.json({ error: "episodeIds must list staged episode ids" }, { status: 400 })
  if (ids.length > 25) return NextResponse.json({ error: "Publish at most 25 episodes per batch" }, { status: 400 })
  try {
    const plan = await publishEpisodes(getServiceClient(), user.id, ids, { apply: body?.dryRun === false })
    // The FNRad Archive index counts published mentions; drop its cached build.
    if (plan.applied) revalidateTag(FNRAD_ARCHIVE_TAG, { expire: 0 })
    return NextResponse.json(plan)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
