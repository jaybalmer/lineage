// PB-009 Phase 1 — Tag-event helpers (server-side)
//
// Every person-implicating insert into story_riders or claims pairs with a
// tag_event row. These helpers centralise:
//
//   - getSubjectTier(subject_id)         — which tier moderates this person
//   - expiryForSource(source)            — TTL for pending tags (Phase 4)
//   - insertTagEventForStoryRider(...)   — used by /api/stories POST + PATCH
//   - insertTagEventForClaim(...)        — used by /api/post-tag-event
//
// Phase 1 defaults source='member' inserts to status='approved' to preserve
// existing product behaviour. Phase 2 will flip the member default to
// 'pending' and add the /me/tags inbox; the rest of this module stays put.

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  TagEventSource,
  TagEventStatus,
  TagEventSubjectTier,
  TagEventDisplayState,
  TagEventMomentRef,
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

// ── Default status for Phase 1 ──────────────────────────────────────────────
// Phase 1: every NEW source='member' insert lands as 'approved' so the live
// product behaviour stays unchanged. Phase 2 will flip this default to
// 'pending' once /me/tags exists. The single point of change is here.

export function defaultStatusForPhase1(source: TagEventSource): TagEventStatus {
  switch (source) {
    case "member":               return "approved"
    case "editor":               return "approved"
    case "system":               return "approved"
    case "public_timeline_embed":return "pending"  // PB-010 default
    default:                     return "pending"
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
}

export async function insertTagEvent(
  supabase: SupabaseClient,
  input: InsertTagEventInput,
): Promise<string | null> {
  const subjectTier = await getSubjectTier(supabase, input.subjectId)
  const status = defaultStatusForPhase1(input.source)
  const displayState = defaultDisplayStateForSource(input.source)
  // Approved rows don't expire; pending rows get the source-typed TTL.
  const expiresAt = status === "approved" ? null : expiryForSource(input.source)

  const { data, error } = await supabase
    .from("tag_events")
    .insert({
      source: input.source,
      asserter_id: input.asserterId,
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

// ── Story-rider write-path helper ───────────────────────────────────────────
// Inserts one tag_event per rider id, then updates the story_riders row with
// the new tag_event_id. Asserter is the story's author. Subject is each
// rider_id. Self-tags (author tagging themselves in their own story) get a
// tag_event too — they're trivially approved, but having the row keeps the
// view filter coherent and Phase 2's owner inbox can ignore them.

export async function pairStoryRiderTagEvents(
  supabase: SupabaseClient,
  args: {
    storyId: string
    riderIds: string[]
    authorId: string
    communityId?: string | null
  },
): Promise<{ paired: number; failed: number }> {
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
  return { paired, failed }
}

// ── Claim write-path helper ─────────────────────────────────────────────────
// Used by /api/post-tag-event after the client-side claim insert lands. For a
// person-implicating claim we insert ONE tag_event per non-asserter person in
// (subject, object) and FK the claim's tag_event_id to the FIRST one. Storing
// moment_ref={claim_id} on each lets us reconstruct the relationship even
// when the claim FK only points at the first event.
//
// Returns the count of paired tag_events for telemetry / debugging.

export async function pairClaimTagEvents(
  supabase: SupabaseClient,
  args: {
    claimId: string
    asserterId: string
    personIds: string[]
    predicate: string
    communityId?: string | null
  },
): Promise<{ paired: number; failed: number; firstTagEventId: string | null }> {
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
  return { paired, failed, firstTagEventId }
}
