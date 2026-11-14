import { NextRequest, NextResponse } from "next/server"
import { getServiceClient, isEditorSession } from "@/lib/auth"
import { MENTION_SUBJECT_TYPES } from "@/lib/mentions"
import { filterLiveEpisodes, hydrateEpisodes } from "@/lib/mentions-server"
import type { Mention, MentionSubjectType } from "@/types"

// Podcast pass Session B: public mention reads.
//
// GET /api/mentions?episode_id=X                       every mention on an episode
// GET /api/mentions?subject_type=person&subject_id=Y   every mention of a subject
//
// Published rows on LIVE episodes only (public_enabled and past publish_at).
// `?include_drafts=1` is honored ONLY for an editor session, and only on the
// episode-side read (the subject-side read feeds public timelines, which must
// never show a draft or a mention from an episode that is not public yet: the
// podcast archive publishes into hidden episodes, brief F11).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const episodeId = searchParams.get("episode_id")?.trim() || null
  const subjectType = searchParams.get("subject_type")?.trim() || null
  const subjectId = searchParams.get("subject_id")?.trim() || null
  const wantsDrafts = searchParams.get("include_drafts") === "1"

  if (!episodeId && !(subjectType && subjectId)) {
    return NextResponse.json(
      { error: "episode_id, or subject_type + subject_id, is required" },
      { status: 400 },
    )
  }
  if (subjectType && !MENTION_SUBJECT_TYPES.includes(subjectType as MentionSubjectType)) {
    return NextResponse.json({ error: "Invalid subject_type" }, { status: 400 })
  }

  const includeDrafts = Boolean(episodeId) && wantsDrafts && (await isEditorSession())

  const db = getServiceClient()
  let query = db.from("mentions").select("*")
  if (episodeId) query = query.eq("episode_event_id", episodeId)
  if (subjectType && subjectId) {
    query = query.eq("subject_type", subjectType).eq("subject_id", subjectId)
  }
  if (!includeDrafts) query = query.eq("status", "published")

  // Timestamp order, nulls last, then insertion order. Matches the episode-page
  // reading order; the timeline surface re-sorts by episode date anyway.
  const { data, error } = await query
    .order("timestamp_seconds", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // An editor previewing an episode's drafts sees that episode whatever its
  // flag; every other read is limited to live episodes.
  const visible = includeDrafts ? ((data ?? []) as Mention[]) : await filterLiveEpisodes((data ?? []) as Mention[])
  const rows = await hydrateEpisodes(visible)
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store, max-age=0" } })
}
