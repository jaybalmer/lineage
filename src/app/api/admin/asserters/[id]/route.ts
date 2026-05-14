import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"

// GET /api/admin/asserters/[id]
//
// PB-009 Phase 3 — rap sheet data for a single asserter. Aggregates across
// tag_events, tag_action_log, tag_reports, tag_blocklist. Multi-pass fetch
// (Phase 1 feedback: avoid embedded selects for rap-sheet-shaped queries).
//
// Recent actions are capped at 50 (Q3.3 — pagination beyond that deferred).

const RECENT_ACTIONS_LIMIT = 50

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: asserterId } = await params
  const { response } = await requireModerator()
  if (response) return response

  const db = getServiceClient()

  // Asserter profile
  const { data: asserterProfile } = await db
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", asserterId)
    .maybeSingle()
  if (!asserterProfile) {
    return NextResponse.json({ error: "Asserter not found" }, { status: 404 })
  }

  // Current restriction (global block)
  const { data: restrictionRow } = await db
    .from("tag_blocklist")
    .select("created_at, reason, created_by")
    .eq("blocked_party", asserterId)
    .eq("block_kind", "user")
    .eq("scope", "global")
    .maybeSingle()

  // Aggregates: all tag_events for this asserter, grouped by status
  const { data: allTags } = await db
    .from("tag_events")
    .select("id, subject_id, status, predicate, source")
    .eq("asserter_id", asserterId)

  const byStatus = { pending: 0, approved: 0, declined: 0, disabled: 0 }
  const distinctSubjects = new Set<string>()
  for (const t of (allTags ?? []) as { id: string; subject_id: string; status: keyof typeof byStatus }[]) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    distinctSubjects.add(t.subject_id)
  }
  const totalTags = (allTags ?? []).length

  // distinct_decline_editors via tag_action_log
  const { data: declineLog } = await db
    .from("tag_action_log")
    .select("actor_id, action, actor_role")
    .eq("asserter_id", asserterId)
    .eq("action", "decline")
    .eq("actor_role", "editor")

  const declineByEditorTotal = (declineLog ?? []).length
  const distinctDeclineEditors = new Set(
    ((declineLog ?? []) as { actor_id: string | null }[])
      .map((r) => r.actor_id)
      .filter((x): x is string => !!x),
  ).size

  // Distinct owners who blocked this asserter (subject-scope blocks)
  const { data: subjectBlocks } = await db
    .from("tag_blocklist")
    .select("subject_id")
    .eq("blocked_party", asserterId)
    .eq("block_kind", "user")
    .eq("scope", "subject")
  const distinctOwnersWhoBlocked = new Set(
    ((subjectBlocks ?? []) as { subject_id: string | null }[])
      .map((b) => b.subject_id)
      .filter((x): x is string => !!x),
  ).size

  // Reports filed against this asserter's tag_events
  const tagEventIds = ((allTags ?? []) as { id: string }[]).map((t) => t.id)
  let reportCountAgainst = 0
  if (tagEventIds.length > 0) {
    const { count } = await db
      .from("tag_reports")
      .select("id", { count: "exact", head: true })
      .in("tag_event_id", tagEventIds)
    reportCountAgainst = count ?? 0
  }

  // Recent actions (cap RECENT_ACTIONS_LIMIT)
  const { data: recentActions } = await db
    .from("tag_action_log")
    .select("id, tag_event_id, actor_id, actor_role, action, prior_status, new_status, reason_category, created_at")
    .eq("asserter_id", asserterId)
    .order("created_at", { ascending: false })
    .limit(RECENT_ACTIONS_LIMIT)

  // Resolve actor names + minimal tag_event context for the recent-actions feed
  const actorIds = Array.from(new Set(
    ((recentActions ?? []) as { actor_id: string | null }[])
      .map((r) => r.actor_id)
      .filter((x): x is string => !!x),
  ))
  const restrictCreatedBy = (restrictionRow as { created_by?: string | null } | null)?.created_by ?? null
  if (restrictCreatedBy) actorIds.push(restrictCreatedBy)

  const profileLookupIds = Array.from(new Set([...actorIds]))
  const profilesById = new Map<string, { id: string; display_name: string | null }>()
  if (profileLookupIds.length > 0) {
    const { data: rows } = await db
      .from("profiles")
      .select("id, display_name")
      .in("id", profileLookupIds)
    for (const p of (rows ?? []) as { id: string; display_name: string | null }[]) {
      profilesById.set(p.id, p)
    }
  }

  const tagEventIdsInLog = Array.from(new Set(
    ((recentActions ?? []) as { tag_event_id: string | null }[])
      .map((r) => r.tag_event_id)
      .filter((x): x is string => !!x),
  ))
  const tagEventsById = new Map<string, { id: string; subject_id: string; predicate: string }>()
  if (tagEventIdsInLog.length > 0) {
    const { data: rows } = await db
      .from("tag_events")
      .select("id, subject_id, predicate")
      .in("id", tagEventIdsInLog)
    for (const e of (rows ?? []) as { id: string; subject_id: string; predicate: string }[]) {
      tagEventsById.set(e.id, e)
    }
  }

  // Reports filed BY this asserter (counter-signal)
  const { data: reportsFiled } = await db
    .from("tag_reports")
    .select("id, tag_event_id, status, reason_category, created_at")
    .eq("reported_by", asserterId)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    asserter: {
      id:           asserterProfile.id,
      display_name: asserterProfile.display_name,
      avatar_url:   asserterProfile.avatar_url,
      current_restriction: restrictionRow
        ? {
            created_at:        restrictionRow.created_at,
            reason:            restrictionRow.reason,
            created_by:        restrictCreatedBy,
            created_by_name:   restrictCreatedBy ? profilesById.get(restrictCreatedBy)?.display_name ?? null : null,
          }
        : null,
    },
    aggregates: {
      total_tags:                  totalTags,
      by_status:                   byStatus,
      distinct_owners_who_blocked: distinctOwnersWhoBlocked,
      decline_by_editor: {
        total:            declineByEditorTotal,
        distinct_editors: distinctDeclineEditors,
      },
      report_count_against:        reportCountAgainst,
    },
    recent_actions: ((recentActions ?? []) as {
      id: string; tag_event_id: string | null;
      actor_id: string | null; actor_role: string; action: string;
      prior_status: string | null; new_status: string | null;
      reason_category: string | null; created_at: string;
    }[]).map((r) => ({
      log_id:           r.id,
      tag_event_id:     r.tag_event_id,
      tag_event_summary: r.tag_event_id ? tagEventsById.get(r.tag_event_id) ?? null : null,
      actor_id:         r.actor_id,
      actor_role:       r.actor_role,
      actor_name:       r.actor_id ? profilesById.get(r.actor_id)?.display_name ?? null : null,
      action:           r.action,
      prior_status:     r.prior_status,
      new_status:       r.new_status,
      reason_category:  r.reason_category,
      created_at:       r.created_at,
    })),
    reports_filed_by_asserter: (reportsFiled ?? []) as {
      id: string; tag_event_id: string;
      status: string; reason_category: string; created_at: string;
    }[],
  })
}
