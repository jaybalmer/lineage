import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { isUuid } from "@/lib/podcast-staging-actions"
import { unpublishEpisode } from "@/lib/podcast-staging-publish"

// Podcast archive staging, Phase 3 unpublish (T17, HUMAN-RUN). Strict gate.
//
// POST /api/admin/podcast-staging/unpublish  { episode_id, dryRun?: boolean }
//
// Deletes exactly the catalog mentions a publish inserted for this episode (by
// published_mention_id, scoped to its episode event) and clears the pointers.
// Created nodes and the episode event are NOT deleted; they are listed.
// dryRun defaults to TRUE.

export async function POST(req: NextRequest) {
  const { user, response } = await requireModerator()
  if (response) return response
  const body = (await req.json().catch(() => null)) as { episode_id?: unknown; dryRun?: unknown } | null
  if (!isUuid(body?.episode_id)) return NextResponse.json({ error: "episode_id is required" }, { status: 400 })
  try {
    const result = await unpublishEpisode(getServiceClient(), user.id, body!.episode_id as string, { apply: body?.dryRun === false })
    if ("error" in result) return NextResponse.json(result, { status: 404 })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
