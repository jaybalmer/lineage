import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { MENTION_SUBJECT_TYPES } from "@/lib/mentions"
import { hydrateEpisodes } from "@/lib/mentions-server"
import type { Mention, MentionSubjectType } from "@/types"

// Podcast pass Session B: editor-only mention creation.
//
// POST /api/admin/mentions
//   Accepts a single mention object, or { mentions: [...] } for bulk entry
//   (save-and-add-another today, the transcript-skill seed import in Session D).
//
// A duplicate (same episode + subject + timestamp, per the mentions_dedupe
// unique index) comes back as 409 with the existing row's id rather than
// landing a silent second row.

const MAX_BULK = 200

type Incoming = {
  episode_event_id?: unknown
  subject_type?: unknown
  subject_id?: unknown
  timestamp_seconds?: unknown
  excerpt?: unknown
  status?: unknown
}

type NormalizedRow = {
  episode_event_id: string
  subject_type: MentionSubjectType
  subject_id: string
  timestamp_seconds: number | null
  excerpt: string | null
  status: "draft" | "published"
  created_by: string
}

function normalize(raw: Incoming, userId: string): NormalizedRow | { error: string } {
  const episodeId = typeof raw.episode_event_id === "string" ? raw.episode_event_id.trim() : ""
  if (!episodeId) return { error: "episode_event_id is required" }

  const subjectType = typeof raw.subject_type === "string" ? raw.subject_type.trim() : ""
  if (!MENTION_SUBJECT_TYPES.includes(subjectType as MentionSubjectType)) {
    return { error: "Invalid subject_type" }
  }

  const subjectId = typeof raw.subject_id === "string" ? raw.subject_id.trim() : ""
  if (!subjectId) return { error: "subject_id is required" }

  let ts: number | null = null
  if (raw.timestamp_seconds !== undefined && raw.timestamp_seconds !== null && raw.timestamp_seconds !== "") {
    const n = Number(raw.timestamp_seconds)
    if (!Number.isFinite(n) || n < 0) return { error: "timestamp_seconds must be a non-negative number" }
    ts = Math.floor(n)
  }

  const excerptRaw = typeof raw.excerpt === "string" ? raw.excerpt.trim() : ""
  const status = raw.status === "draft" ? "draft" : "published"

  return {
    episode_event_id: episodeId,
    subject_type: subjectType as MentionSubjectType,
    subject_id: subjectId,
    timestamp_seconds: ts,
    excerpt: excerptRaw || null,
    status,
    created_by: userId,
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireEditor()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const incoming: Incoming[] = Array.isArray((body as { mentions?: unknown }).mentions)
    ? ((body as { mentions: Incoming[] }).mentions)
    : [body as Incoming]

  if (incoming.length === 0) return NextResponse.json({ error: "No mentions supplied" }, { status: 400 })
  if (incoming.length > MAX_BULK) {
    return NextResponse.json({ error: `At most ${MAX_BULK} mentions per request` }, { status: 400 })
  }

  const rows: NormalizedRow[] = []
  for (const raw of incoming) {
    const result = normalize(raw, user.id)
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    rows.push(result)
  }

  const db = getServiceClient()

  // The episode must exist (the FK would catch this, but a 404 reads better
  // than a raw constraint message).
  const episodeIds = Array.from(new Set(rows.map((r) => r.episode_event_id)))
  const { data: found } = await db.from("events").select("id").in("id", episodeIds)
  const foundIds = new Set(((found ?? []) as { id: string }[]).map((e) => e.id))
  const missing = episodeIds.find((id) => !foundIds.has(id))
  if (missing) return NextResponse.json({ error: "Episode not found" }, { status: 404 })

  const { data, error } = await db.from("mentions").insert(rows).select("*")

  if (error) {
    // 23505 = unique violation on mentions_dedupe. Hand back the existing row so
    // the UI can say "already mapped" and link to it instead of failing blind.
    if (error.code === "23505") {
      const first = rows[0]
      let dupeQuery = db
        .from("mentions")
        .select("id")
        .eq("episode_event_id", first.episode_event_id)
        .eq("subject_type", first.subject_type)
        .eq("subject_id", first.subject_id)
      dupeQuery = first.timestamp_seconds === null
        ? dupeQuery.is("timestamp_seconds", null)
        : dupeQuery.eq("timestamp_seconds", first.timestamp_seconds)
      const { data: existing } = await dupeQuery.maybeSingle()
      return NextResponse.json(
        { error: "Already mapped", existing_id: (existing as { id: string } | null)?.id ?? null },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hydrated = await hydrateEpisodes((data ?? []) as Mention[])
  return NextResponse.json(hydrated, { status: 201 })
}
