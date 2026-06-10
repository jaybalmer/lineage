import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { fireTagEvents } from "@/lib/invite-tracking-server"
import { pairClaimTagEvents, isAsserterGloballyBlocked } from "@/lib/tag-events"
import { PREDICATES, ENTITY_TYPES, CONFIDENCE, VISIBILITY, str, optStr } from "./validation"

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

  // Fail-closed and BEFORE the insert: the old client flow could only refuse
  // after the fact (insert, then /api/tag-event deleted the orphan row).
  if (personIds.length > 0 && await isAsserterGloballyBlocked(db, user.id)) {
    return NextResponse.json(
      { error: "You don't have permission to create tags right now.", reason: "globally_blocked" },
      { status: 403 },
    )
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

  return NextResponse.json({ ok: true, paired })
}
