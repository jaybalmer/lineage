// PB-009 Phase 1 — Tag-event helpers (server-side)
//
// Every person-implicating insert into story_riders or claims pairs with a
// tag_event row. These helpers centralise:
//
//   - getSubjectTier(subject_id)         — which tier moderates this person
//   - expiryForSource(source)            — TTL for pending tags (Phase 4)
//   - insertTagEventForStoryRider(...)   — used by /api/stories POST + PATCH
//   - insertTagEventForClaim(...)        — used by /api/tag-event
//
// Phase 1 defaults source='member' inserts to status='approved' to preserve
// existing product behaviour. Phase 2 will flip the member default to
// 'pending' and add the /me/tags inbox; the rest of this module stays put.

import type { SupabaseClient } from "@supabase/supabase-js"
import { logTagActions } from "@/lib/tag-action-log"
import type {
  TagActionActorRole,
  TagEventSource,
  TagEventStatus,
  TagEventSubjectTier,
  TagEventDisplayState,
  TagEventMomentRef,
  TagEventVisitorRecord,
} from "@/types"

// ── Subject-tier resolution ─────────────────────────────────────────────────
// Phase 1 keeps this simple — read node_status + node_tier_cache off the
// subject's profile row when it exists, fall back to 'standard'. Phase 4 will
// extend it with claim-count and is_notable signals; the public signature
// stays stable so callers don't change.

export async function getSubjectTier(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<TagEventSubjectTier> {
  if (!subjectId) return "standard"

  // profiles.id is uuid; ghost ids in `people` are also uuid-format after
  // PB-008. Anything non-uuid is a legacy catalog id — treat as 'catalog'.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)
  if (!isUuid) return "catalog"

  // Check profiles first (claimed accounts). node_tier_cache is the
  // authoritative cached tier; node_status is the lifecycle state.
  const { data: profile } = await supabase
    .from("profiles")
    .select("node_tier_cache, node_status")
    .eq("id", subjectId)
    .maybeSingle()

  if (profile) {
    const cached = profile.node_tier_cache as TagEventSubjectTier | null
    if (cached) return cached
    // No cache yet → derive from node_status for Phase 1's purposes
    return "standard"
  }

  // Not in profiles → check people (ghost catalog). node_status governs.
  const { data: ghost } = await supabase
    .from("people")
    .select("node_status")
    .eq("id", subjectId)
    .maybeSingle()

  if (!ghost) return "catalog"

  switch (ghost.node_status as string | null) {
    case "unclaimed": return "unclaimed"
    case "catalog":   return "catalog"
    default:          return "standard"
  }
}

// ── Expiry policy ───────────────────────────────────────────────────────────
// Spec §4: member-asserted tags age out at 14 days, public-timeline-embed
// tags at 7 days. Editor- and system-asserted tags don't expire.

export function expiryForSource(source: TagEventSource): string | null {
  const now = Date.now()
  switch (source) {
    case "member":
      return new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString()
    case "public_timeline_embed":
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

// ── Default status for new tag_event inserts ───────────────────────────────
// Single source of truth for status defaults at insert time, keyed on source.
// Member tags land as 'pending' and route through the Owner Inbox at /me/tags
// before becoming publicly visible. Rollback: flipping `case "member"` back
// to 'approved' restores pre-Phase-2 product behaviour without a data
// migration — pending rows already in the DB are unaffected by the rollback
// and can be cleaned up offline.

export function defaultStatusForSource(source: TagEventSource): TagEventStatus {
  switch (source) {
    case "member":               return "pending"
    case "editor":               return "approved"
    case "system":               return "approved"
    case "public_timeline_embed":return "pending"  // PB-010 default
    default:                     return "pending"
  }
}

// ── Predicate → human-readable label (Phase 2) ─────────────────────────────
// Returns the predicate clause used after the asserter name. The Owner Inbox
// at /me/tags renders this as second-person ("tagged you in a story"); the
// editor queue and other third-party views pass the owner's name so it reads
// as "tagged <Owner> in a story".
//
// Fallback covers any predicate added later without a brief update.

export function tagPredicateLabel(predicate: string, ownerName?: string): string {
  const subject = ownerName ?? "you"
  switch (predicate) {
    case "story_tag":     return `tagged ${subject} in a story`
    case "rode_with":     return ownerName ? `said they rode with ${ownerName}` : "said you rode together"
    // PB-010 Phase 4 — public-embed co-presence tags. The owner's moment
    // (place / event) shows in the preview below, so these stay short.
    case "rode_at":       return ownerName ? `marked the same place as ${ownerName}` : "marked they were there too"
    case "spectated_at":  return ownerName ? `said they were at ${ownerName}'s event` : "said they were at this event too"
    case "competed_at":   return ownerName ? `said they competed at ${ownerName}'s event` : "said they competed here too"
    case "shot_by":       return ownerName ? `said ${ownerName} photographed them` : "said you photographed them"
    case "sponsored_by":  return ownerName ? `said ${ownerName} sponsored them` : "said you sponsored them"
    case "coached_by":    return ownerName ? `said ${ownerName} coached them` : "said you coached them"
    case "part_of_team":  return `added ${subject} to a team`
    case "organized":     return ownerName ? `said ${ownerName} organized an event` : "said you organized an event"
    default:              return `tagged ${subject} in a ${predicate}`
  }
}

// ── Default display state ───────────────────────────────────────────────────

export function defaultDisplayStateForSource(source: TagEventSource): TagEventDisplayState {
  switch (source) {
    case "member":               return "attributed"
    case "editor":               return "attributed"
    case "system":               return "attributed"
    case "public_timeline_embed":return "anonymous_aggregate"
    default:                     return "anonymous_aggregate"
  }
}

// ── Shared insert primitive ─────────────────────────────────────────────────
// Returns the new tag_event row id, or null if the insert failed. Failures
// surface to the caller; they are non-fatal at the call site (the underlying
// story_riders / claims row is preserved with tag_event_id=NULL, which the
// _public view treats as approved — same as grandfathered rows).

export interface InsertTagEventInput {
  source: TagEventSource
  asserterId: string | null
  subjectId: string
  predicate: string
  momentRef: TagEventMomentRef
  communityId?: string | null
  /** PB-010 Phase 4: anonymous public-timeline-embed tags carry their asserter
   *  here (hashed email + ip, name, role) since asserterId is null. The
   *  blocklist cascade trigger keys off ->>'email_hash' / ->>'ip_hash'. */
  asserterVisitorRecord?: TagEventVisitorRecord | null
}

export async function insertTagEvent(
  supabase: SupabaseClient,
  input: InsertTagEventInput,
): Promise<string | null> {
  const subjectTier = await getSubjectTier(supabase, input.subjectId)
  const status = defaultStatusForSource(input.source)
  const displayState = defaultDisplayStateForSource(input.source)
  // Approved rows don't expire; pending rows get the source-typed TTL.
  const expiresAt = status === "approved" ? null : expiryForSource(input.source)

  const { data, error } = await supabase
    .from("tag_events")
    .insert({
      source: input.source,
      asserter_id: input.asserterId,
      asserter_visitor_record: input.asserterVisitorRecord ?? null,
      subject_id: input.subjectId,
      subject_tier_at_assert: subjectTier,
      predicate: input.predicate,
      moment_ref: input.momentRef,
      community_id: input.communityId ?? null,
      status,
      decision_at: status === "approved" ? new Date().toISOString() : null,
      display_state: displayState,
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[tag-events] insertTagEvent failed:", error?.message ?? error)
    return null
  }
  return data.id as string
}

// ── Global-block precheck (Phase 3) ─────────────────────────────────────────
//
// Editors can restrict an asserter from creating new tags by inserting a
// scope='global', block_kind='user' row into tag_blocklist. Before any
// new tag_event paired-write fires we ask: is this asserter currently
// globally restricted? If so, the caller refuses the underlying write —
// the alternative (insert with tag_event_id=NULL) would render as approved
// via the _public view because legacy rows are treated that way.
//
// Soft-fail-closed: on DB error, return false so legitimate writes still
// land. The cost of a missed block (one more tag from a restricted asserter
// until editor takes another action) is lower than the cost of refusing
// every write during a transient Supabase blip.
export async function isAsserterGloballyBlocked(
  supabase: SupabaseClient,
  asserterId: string,
): Promise<boolean> {
  if (!asserterId) return false
  const { data, error } = await supabase
    .from("tag_blocklist")
    .select("id")
    .eq("blocked_party", asserterId)
    .eq("block_kind", "user")
    .eq("scope", "global")
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error("[tag-events] global block check failed:", error.message)
    return false
  }
  return data !== null
}

// ── Story-rider write-path helper ───────────────────────────────────────────
// Inserts one tag_event per rider id, then updates the story_riders row with
// the new tag_event_id. Asserter is the story's author. Subject is each
// rider_id. Self-tags (author tagging themselves in their own story) get a
// tag_event too — they're trivially approved, but having the row keeps the
// view filter coherent and Phase 2's owner inbox can ignore them.

export interface PairResult {
  paired: number
  failed: number
  refused: number
  refusalReason?: "globally_blocked"
}

export async function pairStoryRiderTagEvents(
  supabase: SupabaseClient,
  args: {
    storyId: string
    riderIds: string[]
    authorId: string
    communityId?: string | null
  },
): Promise<PairResult> {
  // Phase 3 precheck — globally restricted asserter cannot create new tags.
  // Caller is expected to also refuse the underlying story_riders.insert(),
  // otherwise the junction row lands with tag_event_id=NULL and the _public
  // view treats it as approved.
  if (await isAsserterGloballyBlocked(supabase, args.authorId)) {
    return {
      paired: 0,
      failed: 0,
      refused: args.riderIds.length,
      refusalReason: "globally_blocked",
    }
  }

  let paired = 0
  let failed = 0

  for (const riderId of args.riderIds) {
    const tagEventId = await insertTagEvent(supabase, {
      source: "member",
      asserterId: args.authorId,
      subjectId: riderId,
      predicate: "story_tag",
      momentRef: { story_id: args.storyId, rider_id: riderId },
      communityId: args.communityId,
    })
    if (!tagEventId) { failed += 1; continue }

    const { error } = await supabase
      .from("story_riders")
      .update({ tag_event_id: tagEventId })
      .eq("story_id", args.storyId)
      .eq("rider_id", riderId)

    if (error) {
      console.error("[tag-events] story_riders.tag_event_id update failed:", error.message)
      failed += 1
    } else {
      paired += 1
    }
  }
  return { paired, failed, refused: 0 }
}

// ── Claim write-path helper ─────────────────────────────────────────────────
// Used by /api/tag-event after the client-side claim insert lands. For a
// person-implicating claim we insert ONE tag_event per non-asserter person in
// (subject, object) and FK the claim's tag_event_id to the FIRST one. Storing
// moment_ref={claim_id} on each lets us reconstruct the relationship even
// when the claim FK only points at the first event.
//
// Returns the count of paired tag_events for telemetry / debugging.

export interface ClaimPairResult extends PairResult {
  firstTagEventId: string | null
}

export async function pairClaimTagEvents(
  supabase: SupabaseClient,
  args: {
    claimId: string
    asserterId: string
    personIds: string[]
    predicate: string
    communityId?: string | null
  },
): Promise<ClaimPairResult> {
  // Phase 3 precheck — see pairStoryRiderTagEvents for rationale. Note that
  // claims are inserted client-side from the store; this precheck is the
  // defense-in-depth half of the Q2 dual-precheck design. The client-side
  // GET /api/me/can-tag precheck refuses early; this server-side check
  // refuses after the fact and triggers the caller to delete the orphan
  // claim. See /api/tag-event for the rollback wiring.
  if (await isAsserterGloballyBlocked(supabase, args.asserterId)) {
    return {
      paired: 0,
      failed: 0,
      refused: args.personIds.length,
      refusalReason: "globally_blocked",
      firstTagEventId: null,
    }
  }

  let paired = 0
  let failed = 0
  let firstTagEventId: string | null = null

  for (const personId of args.personIds) {
    // Defensive: drop self-tags before insertion. The caller usually does
    // this filter, but cheap to double-check.
    if (!personId || personId === args.asserterId) continue

    const tagEventId = await insertTagEvent(supabase, {
      source: "member",
      asserterId: args.asserterId,
      subjectId: personId,
      predicate: args.predicate,
      momentRef: { claim_id: args.claimId },
      communityId: args.communityId,
    })
    if (!tagEventId) { failed += 1; continue }

    if (firstTagEventId === null) {
      firstTagEventId = tagEventId
      const { error } = await supabase
        .from("claims")
        .update({ tag_event_id: tagEventId })
        .eq("id", args.claimId)
      if (error) {
        console.error("[tag-events] claims.tag_event_id update failed:", error.message)
        failed += 1
        firstTagEventId = null
        continue
      }
    }
    paired += 1
  }
  return { paired, failed, refused: 0, firstTagEventId }
}

// ── Claim-deletion lifecycle cascade (PB-009 Phase 3, Q10) ──────────────────
// When a claim row is destroyed, its paired tag_events must not survive as
// pending/approved: flip them to disabled, auto-close any open tag_reports as
// resolved_moment_destroyed, and write one lifecycle_disable log row each.
// Shared by the /api/admin claims-delete path (system-attributed) and
// DELETE /api/claims/[id] (asserter- or editor-attributed).
//
// Two shapes converge here: the FK on claims.tag_event_id points at the FIRST
// paired tag_event (per pairClaimTagEvents above); the rest of the per-person
// rows for multi-person claims live keyed by moment_ref->>claim_id. Union both.

export async function disableClaimTagEventsForDeletion(
  supabase: SupabaseClient,
  claimId: string,
  actor: { actorId: string | null; actorRole: TagActionActorRole },
): Promise<void> {
  const { data: claimRow } = await supabase
    .from("claims")
    .select("id, tag_event_id")
    .eq("id", claimId)
    .maybeSingle()
  const firstTagEventId = (claimRow as { tag_event_id?: string | null } | null)?.tag_event_id ?? null

  const { data: paired } = await supabase
    .from("tag_events")
    .select("id, asserter_id, status")
    .or(
      firstTagEventId
        ? `id.eq.${firstTagEventId},moment_ref->>claim_id.eq.${claimId}`
        : `moment_ref->>claim_id.eq.${claimId}`,
    )

  const toDisable = ((paired ?? []) as { id: string; asserter_id: string | null; status: string }[])
    .filter((t) => t.status === "pending" || t.status === "approved")
  if (toDisable.length === 0) return

  const tagIds = toDisable.map((t) => t.id)
  await supabase
    .from("tag_events")
    .update({
      status:                   "disabled",
      decision_at:              new Date().toISOString(),
      decision_reason_category: "lifecycle_destroyed",
    })
    .in("id", tagIds)

  // Auto-close open tag_reports as resolved_moment_destroyed
  await supabase
    .from("tag_reports")
    .update({ status: "resolved_moment_destroyed", reviewed_at: new Date().toISOString() })
    .in("tag_event_id", tagIds)
    .eq("status", "open")

  await logTagActions(supabase, toDisable.map((t) => ({
    tagEventId:     t.id,
    asserterId:     t.asserter_id,
    actorId:        actor.actorId,
    actorRole:      actor.actorRole,
    action:         "lifecycle_disable" as const,
    priorStatus:    t.status as "pending" | "approved",
    newStatus:      "disabled" as const,
    reasonCategory: "lifecycle_destroyed" as const,
  })))
}
