import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"

// GET /api/admin/tag-queue
//
// PB-009 Phase 3 — paginated list of tag_reports grouped by tag_event, with
// asserter + owner context attached. Two-pass fetch instead of an embedded
// PostgREST select (Phase 1 feedback flagged the embed pattern as fragile).
//
// Query params:
//   status  open | reviewed | dismissed | all   (default: open)
//   sort    report_count_desc | recent | oldest_open   (default: report_count_desc)
//   offset, limit                                (default: 0, 50; max 200)
//
// Phase 3 also filters source!='system' (Q5) — backfilled system tags are
// non-actionable.

type QueueSort = "report_count_desc" | "recent" | "oldest_open"

interface QueueRow {
  tag_event: {
    id: string
    source: string
    subject_id: string
    asserter_id: string | null
    predicate: string
    status: string
    moment_ref: Record<string, unknown>
    created_at: string
  }
  asserter: { id: string; display_name: string | null; avatar_url: string | null } | null
  owner:    { id: string; display_name: string | null; avatar_url: string | null } | null
  asserter_context: {
    total_tags: number
    declined_count: number
    distinct_decline_editors: number
    is_first_time: boolean
    current_restriction: { created_at: string; reason: string | null } | null
  }
  reports: {
    id: string
    reported_by: string
    reported_by_name: string | null
    reason_category: string
    reason_note: string | null
    status: string
    created_at: string
  }[]
}

export async function GET(req: NextRequest) {
  const { response } = await requireModerator()
  if (response) return response

  const url = new URL(req.url)
  const statusParam = url.searchParams.get("status") ?? "open"
  const sort = (url.searchParams.get("sort") ?? "report_count_desc") as QueueSort
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0)
  const limit  = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50"), 1), 200)

  const db = getServiceClient()

  // Pass 1: load reports matching the status filter, group by tag_event_id.
  let q = db
    .from("tag_reports")
    .select("id, tag_event_id, reported_by, reason_category, reason_note, status, created_at")
    .order("created_at", { ascending: false })

  if (statusParam !== "all") {
    q = q.eq("status", statusParam)
  }

  const { data: reportRows, error: reportErr } = await q
  if (reportErr) return NextResponse.json({ error: reportErr.message }, { status: 500 })

  const reports = (reportRows ?? []) as {
    id: string; tag_event_id: string; reported_by: string;
    reason_category: string; reason_note: string | null;
    status: string; created_at: string
  }[]

  if (reports.length === 0) {
    return NextResponse.json({ rows: [], total: 0 })
  }

  // Group by tag_event_id
  const byTagEvent = new Map<string, typeof reports>()
  for (const r of reports) {
    const arr = byTagEvent.get(r.tag_event_id) ?? []
    arr.push(r)
    byTagEvent.set(r.tag_event_id, arr)
  }

  const tagEventIds = Array.from(byTagEvent.keys())

  // Pass 2: fetch tag_events (filtered: not system, Q5)
  const { data: evRows } = await db
    .from("tag_events")
    .select("id, source, subject_id, asserter_id, predicate, status, moment_ref, created_at")
    .in("id", tagEventIds)
    .neq("source", "system")

  const events = (evRows ?? []) as QueueRow["tag_event"][]
  const eventById = new Map(events.map((e) => [e.id, e]))

  // Profile lookups: asserters, owners, reporters
  const asserterIds = Array.from(new Set(events.map((e) => e.asserter_id).filter((x): x is string => !!x)))
  const ownerIds    = Array.from(new Set(events.map((e) => e.subject_id))).filter((s) => /^[0-9a-f-]{36}$/i.test(s))
  const reporterIds = Array.from(new Set(reports.map((r) => r.reported_by)))
  const allProfileIds = Array.from(new Set([...asserterIds, ...ownerIds, ...reporterIds]))

  const profilesById = new Map<string, { id: string; display_name: string | null; avatar_url: string | null }>()
  if (allProfileIds.length > 0) {
    const { data: profileRows } = await db
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", allProfileIds)
    for (const p of (profileRows ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]) {
      profilesById.set(p.id, p)
    }
  }

  // Asserter context: aggregate counts from tag_action_log + tag_events
  const asserterAggByAsserter = new Map<string, {
    total_tags: number; declined_count: number; distinct_decline_editors: number;
  }>()
  if (asserterIds.length > 0) {
    // total_tags = count of tag_events grouped by asserter_id
    const { data: totalRows } = await db
      .from("tag_events")
      .select("asserter_id, status")
      .in("asserter_id", asserterIds)
    for (const aid of asserterIds) asserterAggByAsserter.set(aid, { total_tags: 0, declined_count: 0, distinct_decline_editors: 0 })
    for (const r of (totalRows ?? []) as { asserter_id: string | null; status: string }[]) {
      if (!r.asserter_id) continue
      const agg = asserterAggByAsserter.get(r.asserter_id)
      if (!agg) continue
      agg.total_tags += 1
      if (r.status === "declined") agg.declined_count += 1
    }

    // distinct_decline_editors: tag_action_log entries with action='decline' and actor_role='editor'
    const { data: declineLog } = await db
      .from("tag_action_log")
      .select("asserter_id, actor_id")
      .in("asserter_id", asserterIds)
      .eq("action", "decline")
      .eq("actor_role", "editor")
    const editorsByAsserter = new Map<string, Set<string>>()
    for (const row of (declineLog ?? []) as { asserter_id: string | null; actor_id: string | null }[]) {
      if (!row.asserter_id || !row.actor_id) continue
      const s = editorsByAsserter.get(row.asserter_id) ?? new Set<string>()
      s.add(row.actor_id)
      editorsByAsserter.set(row.asserter_id, s)
    }
    for (const [aid, set] of editorsByAsserter) {
      const agg = asserterAggByAsserter.get(aid)
      if (agg) agg.distinct_decline_editors = set.size
    }
  }

  // Current restriction lookup
  const restrictions = new Map<string, { created_at: string; reason: string | null }>()
  if (asserterIds.length > 0) {
    const { data: blockRows } = await db
      .from("tag_blocklist")
      .select("blocked_party, created_at, reason")
      .in("blocked_party", asserterIds)
      .eq("block_kind", "user")
      .eq("scope", "global")
    for (const b of (blockRows ?? []) as { blocked_party: string; created_at: string; reason: string | null }[]) {
      restrictions.set(b.blocked_party, { created_at: b.created_at, reason: b.reason })
    }
  }

  // Build rows
  const rowsRaw: QueueRow[] = []
  for (const tagEventId of tagEventIds) {
    const ev = eventById.get(tagEventId)
    if (!ev) continue   // filtered out (e.g. source='system')

    const tagReports = byTagEvent.get(tagEventId) ?? []
    const asserter = ev.asserter_id ? profilesById.get(ev.asserter_id) ?? null : null
    const owner    = profilesById.get(ev.subject_id) ?? null

    const agg = ev.asserter_id ? asserterAggByAsserter.get(ev.asserter_id) : null
    const restriction = ev.asserter_id ? restrictions.get(ev.asserter_id) ?? null : null

    rowsRaw.push({
      tag_event: ev,
      asserter,
      owner,
      asserter_context: {
        total_tags:               agg?.total_tags ?? 0,
        declined_count:           agg?.declined_count ?? 0,
        distinct_decline_editors: agg?.distinct_decline_editors ?? 0,
        is_first_time:            (agg?.total_tags ?? 0) <= 1,
        current_restriction:      restriction,
      },
      reports: tagReports.map((r) => ({
        id:                r.id,
        reported_by:       r.reported_by,
        reported_by_name:  profilesById.get(r.reported_by)?.display_name ?? null,
        reason_category:   r.reason_category,
        reason_note:       r.reason_note,
        status:            r.status,
        created_at:        r.created_at,
      })),
    })
  }

  // Sort
  if (sort === "report_count_desc") {
    rowsRaw.sort((a, b) => b.reports.length - a.reports.length)
  } else if (sort === "oldest_open") {
    rowsRaw.sort((a, b) => {
      const aMin = Math.min(...a.reports.map((r) => +new Date(r.created_at)))
      const bMin = Math.min(...b.reports.map((r) => +new Date(r.created_at)))
      return aMin - bMin
    })
  } else {
    rowsRaw.sort((a, b) => +new Date(b.tag_event.created_at) - +new Date(a.tag_event.created_at))
  }

  const total = rowsRaw.length
  const rows  = rowsRaw.slice(offset, offset + limit)

  return NextResponse.json({ rows, total })
}
