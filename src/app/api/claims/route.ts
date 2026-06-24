import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { fireTagEvents } from "@/lib/invite-tracking-server"
import { pairClaimTagEvents, isAsserterGloballyBlocked } from "@/lib/tag-events"
import { awardContributionTokens } from "@/lib/tokens"
import { PREDICATES, ENTITY_TYPES, CONFIDENCE, VISIBILITY, BOARD_RELATIONSHIPS, str, optStr } from "./validation"

// Maps a claim object_type to the catalog table that holds the target row.
// person is special: the people catalog merges both `people` (ghosts) and
// `profiles` (registered users), so a person object_id can live in either.
const OBJECT_TABLE: Record<string, string> = {
  place: "places", org: "orgs", board: "boards", event: "events",
}

// Referential guard (PB-010 orphan-claims audit). object_id is a polymorphic
// reference (the target table depends on object_type) so no DB foreign key can
// enforce it. Without this check a claim can be saved against a mock/local id
// that only the asserter's own browser resolves (localStorage userEntities +
// the mock-data fallback); every other viewer and every server-side read sees
// the target as "Unknown". Returns true when the referenced row exists.
async function objectIdExists(
  db: ReturnType<typeof getServiceClient>,
  objectType: string,
  objectId: string,
): Promise<boolean> {
  if (objectType === "person") {
    const [people, profiles] = await Promise.all([
      db.from("people").select("id").eq("id", objectId).limit(1),
      db.from("profiles").select("id").eq("id", objectId).limit(1),
    ])
    return (people.data?.length ?? 0) > 0 || (profiles.data?.length ?? 0) > 0
  }
  const table = OBJECT_TABLE[objectType]
  if (!table) return false
  const { data } = await db.from(table).select("id").eq("id", objectId).limit(1)
  return (data?.length ?? 0) > 0
}

// POST /api/claims
//
// Authed member claim creation (BUG-022). The store's addClaim used to insert
// into `claims` client-side with the anon key; the claims INSERT policy only
// admits rows whose subject is the caller (subject_id = auth.uid()), so every
// claim ABOUT someone else (the whole PB-009 member-tagging flow, including
// the event page Add People path) was rejected with 42501 and the error was
// discarded. Moving the write here keeps RLS tight and is consistent with the
// PB-009 write-path direction: validation, the global-block precheck, the
// PB-008 threshold fan-out, and the tag_event pairing all run server-side in
// one request. This route replaces the store's claims.insert + /api/tag-event
// call pair (that route remains for back-compat until its callers are gone).
//
// Auth: required. asserted_by is ALWAYS the session user; the client value is
// ignored so it cannot be spoofed. Visibility of person-implicating claims is
// governed by the paired tag_events through claims_public, exactly as before.

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const id = str(body.id, 80)
  const subjectId = str(body.subject_id, 80)
  const objectId = str(body.object_id, 80)
  const subjectType = str(body.subject_type, 16)
  const objectType = str(body.object_type, 16)
  const predicate = str(body.predicate, 32)

  if (!id || !subjectId || !objectId) {
    return NextResponse.json({ error: "id, subject_id, and object_id are required" }, { status: 400 })
  }
  if (!predicate || !PREDICATES.has(predicate)) {
    return NextResponse.json({ error: "Unknown predicate" }, { status: 400 })
  }
  if (!subjectType || !ENTITY_TYPES.has(subjectType) || !objectType || !ENTITY_TYPES.has(objectType)) {
    return NextResponse.json({ error: "Unknown subject_type or object_type" }, { status: 400 })
  }

  const confidence = optStr(body.confidence, 24) ?? "self-reported"
  const visibility = optStr(body.visibility, 16) ?? "public"
  if (!CONFIDENCE.has(confidence) || !VISIBILITY.has(visibility)) {
    return NextResponse.json({ error: "Unknown confidence or visibility" }, { status: 400 })
  }

  // Board claims carry a relationship (rode | own | both). NULL for other predicates.
  const boardRelationship = predicate === "owned_board" ? optStr(body.board_relationship, 8) : null
  if (boardRelationship !== null && !BOARD_RELATIONSHIPS.has(boardRelationship)) {
    return NextResponse.json({ error: "Unknown board_relationship" }, { status: 400 })
  }

  // Reporter-supplied timestamp is kept when it parses (it matches the
  // optimistic row already in the client store); otherwise stamp now.
  const rawCreatedAt = optStr(body.created_at, 40)
  const createdAt = rawCreatedAt && Number.isFinite(Date.parse(rawCreatedAt))
    ? rawCreatedAt
    : new Date().toISOString()

  // Every person named in the claim other than the asserter gets the PB-009
  // treatment: global-block precheck up front, tag_event pairing after.
  const personIds: string[] = []
  if (subjectType === "person" && subjectId !== user.id) personIds.push(subjectId)
  if (objectType === "person" && objectId !== user.id && !personIds.includes(objectId)) personIds.push(objectId)

  const db = getServiceClient()

  // Reject a claim whose object_id does not reference a real catalog row. This
  // is the single backstop against orphaned claims (PB-010 audit): a mock id
  // picked from an unloaded catalog, or an inline-created entity whose own DB
  // write failed. addClaim rolls back the optimistic row and toasts on a 400.
  if (!(await objectIdExists(db, objectType, objectId))) {
    return NextResponse.json(
      { error: "object_id does not reference a known entity", reason: "unknown_object" },
      { status: 400 },
    )
  }

  // Fail-closed and BEFORE the insert: the old client flow could only refuse
  // after the fact (insert, then /api/tag-event deleted the orphan row).
  if (personIds.length > 0 && await isAsserterGloballyBlocked(db, user.id)) {
    return NextResponse.json(
      { error: "You don't have permission to create tags right now.", reason: "globally_blocked" },
      { status: 403 },
    )
  }

  // Board claims are one row per (subject, board). Re-adding a board the rider
  // already has updates that row's relationship and optional year instead of
  // inserting a duplicate (brief Decision 1). The client usually catches this
  // and PATCHes the existing row; this server-side upsert is the backstop that
  // keeps the table to one row per board even when the client state is stale.
  if (predicate === "owned_board") {
    const { data: existingRows } = await db
      .from("claims")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("object_id", objectId)
      .eq("predicate", "owned_board")
      .order("created_at", { ascending: true })
      .limit(1)
    const existing = existingRows?.[0]
    if (existing) {
      const upd: Record<string, unknown> = {}
      if (boardRelationship) upd.board_relationship = boardRelationship
      const startDate = optStr(body.start_date, 32)
      if (startDate !== null) upd.start_date = startDate
      if (Object.keys(upd).length > 0) {
        const { error: updErr } = await db.from("claims").update(upd).eq("id", existing.id)
        if (updErr) {
          console.error("[api/claims] board upsert failed:", updErr)
          return NextResponse.json({ error: updErr.message }, { status: 400 })
        }
      }
      return NextResponse.json({ ok: true, paired: 0, updated: existing.id })
    }
  }

  // rode_with crew relationship dedup (BUG-066). A standalone / crew rode_with
  // (parent_claim_id NULL) is one row per (subject, object): re-adding a ride
  // with the same person widens that row's year range instead of inserting a
  // duplicate. Parented companion rows (parent_claim_id set, one per ride, the
  // place-card chip source) always insert and are excluded here. Mirrors the
  // owned_board upsert above; the client usually catches this and PATCHes the
  // existing crew row, so this is the stale-client-state backstop.
  const parentClaimId = optStr(body.parent_claim_id, 80)
  if (predicate === "rode_with" && parentClaimId === null) {
    const { data: existingRows } = await db
      .from("claims")
      .select("id, start_date, end_date")
      .eq("subject_id", subjectId)
      .eq("object_id", objectId)
      .eq("predicate", "rode_with")
      .is("parent_claim_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
    const existing = existingRows?.[0]
    if (existing) {
      const newStart = optStr(body.start_date, 32)
      const newEnd = optStr(body.end_date, 32) ?? newStart
      // start_date / end_date are ISO-ish "YYYY-..." so a lexical min/max is a
      // year min/max. Widen [start, end] to span the existing row and the new ride.
      const starts = [existing.start_date as string | null, newStart].filter((d): d is string => !!d)
      const ends = [(existing.end_date ?? existing.start_date) as string | null, newEnd].filter((d): d is string => !!d)
      const upd: Record<string, unknown> = {}
      if (starts.length > 0) upd.start_date = starts.reduce((a, b) => (a < b ? a : b))
      if (ends.length > 0) upd.end_date = ends.reduce((a, b) => (a > b ? a : b))
      if (Object.keys(upd).length > 0) {
        const { error: updErr } = await db.from("claims").update(upd).eq("id", existing.id)
        if (updErr) {
          console.error("[api/claims] rode_with crew upsert failed:", updErr)
          return NextResponse.json({ error: updErr.message }, { status: 400 })
        }
      }
      return NextResponse.json({ ok: true, paired: 0, updated: existing.id })
    }
  }

  const { error: insertError } = await db.from("claims").insert({
    id,
    subject_id: subjectId,
    subject_type: subjectType,
    predicate,
    object_id: objectId,
    object_type: objectType,
    start_date: optStr(body.start_date, 32),
    end_date: optStr(body.end_date, 32),
    confidence,
    visibility,
    asserted_by: user.id,
    created_at: createdAt,
    note: optStr(body.note, 2000),
    approximate: body.approximate === true,
    sources: Array.isArray(body.sources) ? body.sources : null,
    division: optStr(body.division, 120),
    result: optStr(body.result, 120),
    board_relationship: boardRelationship,
    parent_claim_id: parentClaimId,
    community_id: optStr(body.community_id, 40),
  })
  if (insertError) {
    console.error("[api/claims] insert failed:", insertError)
    const status = insertError.code === "23505" ? 409 : 400
    return NextResponse.json({ error: insertError.message }, { status })
  }

  // PB-008 ambient-growth fan-out + PB-009 pairing, both formerly reached via
  // POST /api/tag-event after the client-side insert. Pairing failures are
  // non-fatal: the claim stays with tag_event_id=NULL, which claims_public
  // treats as approved (same as grandfathered rows). Same trade-off as before.
  let paired = 0
  if (personIds.length > 0) {
    await fireTagEvents(personIds, user.id)
    const pairResult = await pairClaimTagEvents(db, {
      claimId: id,
      asserterId: user.id,
      personIds,
      predicate,
      communityId: optStr(body.community_id, 40),
    })
    paired = pairResult.paired
    if (pairResult.failed > 0) {
      console.error(`[api/claims] claim ${id}: ${paired} paired, ${pairResult.failed} failed`)
    }
  }

  // Token earning (brief §5.1): a new timeline entry is +1, a claim carrying
  // an authoritative source link is +2 on top. Board re-adds return earlier
  // from the upsert path above and never award. Best-effort, never blocks.
  // source_ref ties both awards to this claim so deleting it reverses exactly
  // what it earned (BUG-103 claw-back; see DELETE /api/claims/[id]).
  const claimRef = `claim:${id}`
  let tokensAwarded = await awardContributionTokens(db, user.id, 1, "contribution_entry", claimRef)
  if (Array.isArray(body.sources) && body.sources.length > 0) {
    tokensAwarded += await awardContributionTokens(db, user.id, 2, "contribution_source", claimRef)
  }

  // tokens_awarded is the amount the ledger actually recorded (0 when the daily
  // content cap is exhausted). The client surfaces it as a reward toast at the
  // point of action (token-game-feel brief D1).
  return NextResponse.json({ ok: true, paired, tokens_awarded: tokensAwarded })
}
