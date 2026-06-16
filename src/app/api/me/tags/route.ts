import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import type {
  TagEvent,
  TagEventMomentRef,
  TagEventSource,
  TagEventStatus,
} from "@/types"

// GET /api/me/tags?status=<pending|approved|declined|disabled|all>&source=<member|public_timeline_embed|editor|system|all>
//
// Returns the caller's tag_events (subject_id = current user) plus enough joined
// data for the Owner Inbox to render asserter names and moment previews without
// further round-trips. RLS on tag_events is locked (no policies), so the read
// must come through the service client after a session check — same pattern as
// every other mutating route in the codebase.

const STATUS_VALUES: ReadonlyArray<TagEventStatus | "all"> = [
  "pending", "approved", "declined", "disabled", "all",
]
const SOURCE_VALUES: ReadonlyArray<TagEventSource | "all"> = [
  "member", "public_timeline_embed", "editor", "system", "all",
]

interface AsserterSummary {
  id: string
  display_name: string | null
  avatar_url: string | null
}

interface MomentSummary {
  type: "story" | "claim"
  title?: string
  snippet?: string
  start_date?: string | null
  end_date?: string | null
  story_id?: string
  claim_id?: string
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get("status") ?? "pending"
  const sourceParam = searchParams.get("source") ?? "all"
  const status = STATUS_VALUES.includes(statusParam as TagEventStatus | "all")
    ? (statusParam as TagEventStatus | "all")
    : "pending"
  const source = SOURCE_VALUES.includes(sourceParam as TagEventSource | "all")
    ? (sourceParam as TagEventSource | "all")
    : "all"

  const db = getServiceClient()

  // Pending count travels with every response so the inbox can keep the
  // header badge stable across filter changes.
  const { count: pendingCount } = await db
    .from("tag_events")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", user.id)
    .eq("status", "pending")

  let query = db
    .from("tag_events")
    .select("*")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)

  if (status !== "all") query = query.eq("status", status)
  if (source !== "all") query = query.eq("source", source)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tags = (data ?? []) as TagEvent[]
  if (tags.length === 0) {
    return NextResponse.json({
      tags: [],
      asserters: {},
      moments: {},
      pendingCount: pendingCount ?? 0,
    })
  }

  const asserterIds = Array.from(new Set(
    tags.map((t) => t.asserter_id).filter((id): id is string => !!id),
  ))
  const asserters: Record<string, AsserterSummary> = {}
  if (asserterIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", asserterIds)
    for (const p of (profiles ?? []) as AsserterSummary[]) {
      asserters[p.id] = p
    }
  }

  const storyIds: string[] = []
  const claimIds: string[] = []
  for (const t of tags) {
    const ref = (t.moment_ref ?? {}) as TagEventMomentRef
    // A story_id in the moment ref always wins the preview (member story_tag and
    // PB-010 embed story co-presence both carry one); otherwise fall to the claim.
    if (ref.story_id) storyIds.push(ref.story_id)
    else if (ref.claim_id) claimIds.push(ref.claim_id)
  }
  const uniqueStoryIds = Array.from(new Set(storyIds))
  const uniqueClaimIds = Array.from(new Set(claimIds))
  const moments: Record<string, MomentSummary> = {}

  if (uniqueStoryIds.length > 0) {
    const { data: stories } = await db
      .from("stories")
      .select("id, title, body, story_date")
      .in("id", uniqueStoryIds)
    for (const s of (stories ?? []) as Array<{ id: string; title: string | null; body: string | null; story_date: string | null }>) {
      const body = s.body ?? ""
      const snippet = body.split(/(?<=[.!?])\s+/)[0]?.slice(0, 140) ?? ""
      moments[s.id] = {
        type: "story",
        title: s.title ?? "Untitled story",
        snippet,
        start_date: s.story_date,
        story_id: s.id,
      }
    }
  }

  if (uniqueClaimIds.length > 0) {
    const { data: claims } = await db
      .from("claims")
      .select("id, start_date, end_date")
      .in("id", uniqueClaimIds)
    for (const c of (claims ?? []) as Array<{ id: string; start_date: string | null; end_date: string | null }>) {
      moments[c.id] = {
        type: "claim",
        start_date: c.start_date,
        end_date: c.end_date,
        claim_id: c.id,
      }
    }
  }

  return NextResponse.json({
    tags,
    asserters,
    moments,
    pendingCount: pendingCount ?? 0,
  })
}
