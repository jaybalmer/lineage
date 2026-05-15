// PB-009 Phase 3 — tag_action_log write helpers.
//
// Centralised so every action-bearing route writes the same shape. Failures
// are logged but non-fatal — the underlying state change is the source of
// truth and the log is for forensics. A missing log entry doesn't break
// product behaviour; corrupting the request to enforce it would.
//
// Schema reminder (see 20260514000001_pb009_phase3_reports_and_action_log.sql):
//   tag_event_id   nullable; required for everything except restrict/unrestrict
//   asserter_id    denormalised; populate when the tag_event has one
//   actor_id       NULL for system actions
//
// The cascade trigger (apply_block_cascade) writes its own log rows inside the
// PL/pgSQL block. Application code should NOT also log block_cascade rows.

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  TagActionActorRole,
  TagActionKind,
  TagEventDeclineCategory,
  TagEventStatus,
} from "@/types"

export interface LogTagActionInput {
  tagEventId: string | null
  asserterId?: string | null
  actorId?: string | null
  actorRole: TagActionActorRole
  action: TagActionKind
  priorStatus?: TagEventStatus | null
  newStatus?: TagEventStatus | null
  reasonCategory?: TagEventDeclineCategory | null
  reasonNote?: string | null
  relatedReport?: string | null
}

export async function logTagAction(
  supabase: SupabaseClient,
  input: LogTagActionInput,
): Promise<void> {
  const { error } = await supabase.from("tag_action_log").insert({
    tag_event_id:    input.tagEventId,
    asserter_id:     input.asserterId ?? null,
    actor_id:        input.actorId ?? null,
    actor_role:      input.actorRole,
    action:          input.action,
    prior_status:    input.priorStatus ?? null,
    new_status:      input.newStatus ?? null,
    reason_category: input.reasonCategory ?? null,
    reason_note:     input.reasonNote ?? null,
    related_report:  input.relatedReport ?? null,
  })
  if (error) {
    console.error("[tag-action-log] insert failed:", error.message, {
      action: input.action,
      tagEventId: input.tagEventId,
    })
  }
}

/**
 * Batch helper for cases where multiple log entries land for the same
 * conceptual event (e.g. an editor decline that auto-closes N reports).
 * Returns void; logs errors per the same posture as logTagAction.
 */
export async function logTagActions(
  supabase: SupabaseClient,
  inputs: LogTagActionInput[],
): Promise<void> {
  if (inputs.length === 0) return
  const rows = inputs.map((input) => ({
    tag_event_id:    input.tagEventId,
    asserter_id:     input.asserterId ?? null,
    actor_id:        input.actorId ?? null,
    actor_role:      input.actorRole,
    action:          input.action,
    prior_status:    input.priorStatus ?? null,
    new_status:      input.newStatus ?? null,
    reason_category: input.reasonCategory ?? null,
    reason_note:     input.reasonNote ?? null,
    related_report:  input.relatedReport ?? null,
  }))
  const { error } = await supabase.from("tag_action_log").insert(rows)
  if (error) {
    console.error("[tag-action-log] batch insert failed:", error.message, {
      count: rows.length,
    })
  }
}
