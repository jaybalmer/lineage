import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { disableClaimTagEventsForDeletion } from "@/lib/tag-events"
import { reverseContributionTokens } from "@/lib/tokens"
import { ENTITY_TYPES, CONFIDENCE, VISIBILITY, BOARD_RELATIONSHIPS, str } from "../validation"

// PATCH  /api/claims/[id]  edit a claim you asserted
// DELETE /api/claims/[id]  delete a claim you asserted
//
// June 10 session follow-up to BUG-022. The store's updateClaim built a
// client-side claims.update() that was never awaited, so the request never
// fired and claim edits silently never persisted; even awaited, the claims
// RLS (subject must be self) would block updates of claims about others.
// removeClaim posted to /api/admin, which is requireEditor-gated, so plain
// members got a 403 deleting claims they asserted. Both writes now run
// server-side with the service client after an ownership check, matching
// the POST /api/claims direction.
//
// Authorization: the caller must be the claim's asserter (asserted_by).
// Editors (is_editor or founding tier, the requireEditor rule) may also
// edit or delete claims they did not assert: the events page attendee list
// exposes delete to editors for moderation, and that UI path now lands here
// instead of /api/admin.
//
// PATCH accepts only fields the product actually edits (edit-claim-modal,
// start-card): dates, note, confidence, visibility, approximate, sources,
// division, result, and a non-person object swap. Subject, predicate, and
// person objects are immutable here because the PB-009 tag_event pairing
// hangs off the person linkage; changing those means delete and re-create.
//
// DELETE runs the same PB-009 lifecycle cascade as the /api/admin claims
// path (disable paired tag_events, close open reports, log), attributed to
// the asserter or acting editor instead of system.

async function loadClaim(db: SupabaseClient, id: string) {
  const { data } = await db
    .from("claims")
    .select("id, asserted_by, object_type")
    .eq("id", id)
    .maybeSingle()
  return data as { id: string; asserted_by: string | null; object_type: string | null } | null
}

// Same authority rule as requireEditor(): is_editor flag OR founding tier.
async function callerIsEditor(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await db
    .from("profiles")
    .select("is_editor, membership_tier")
    .eq("id", userId)
    .single()
  return !!(profile?.is_editor || profile?.membership_tier === "founding")
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth()
  if (response) return response
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const db = getServiceClient()
  const claim = await loadClaim(db, id)
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }
  if (claim.asserted_by !== user.id && !(await callerIsEditor(db, user.id))) {
    return NextResponse.json({ error: "You can only edit claims you added." }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}

  // Nullable text fields: an explicit null clears the column, a string is
  // validated against the same length caps as POST /api/claims. The store
  // converts undefined values to null before sending, so "field present"
  // always means the caller intends to write it.
  const nullableText: [key: string, max: number][] = [
    ["start_date", 32], ["end_date", 32], ["note", 2000], ["division", 120], ["result", 120],
  ]
  for (const [key, max] of nullableText) {
    if (!(key in body)) continue
    const v = body[key]
    if (v === null) { updates[key] = null; continue }
    const parsed = str(v, max)
    if (parsed === null) {
      return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 })
    }
    updates[key] = parsed
  }

  if ("confidence" in body) {
    const confidence = str(body.confidence, 24)
    if (!confidence || !CONFIDENCE.has(confidence)) {
      return NextResponse.json({ error: "Unknown confidence" }, { status: 400 })
    }
    updates.confidence = confidence
  }
  if ("visibility" in body) {
    const visibility = str(body.visibility, 16)
    if (!visibility || !VISIBILITY.has(visibility)) {
      return NextResponse.json({ error: "Unknown visibility" }, { status: 400 })
    }
    updates.visibility = visibility
  }
  if ("approximate" in body) {
    if (typeof body.approximate !== "boolean") {
      return NextResponse.json({ error: "approximate must be a boolean" }, { status: 400 })
    }
    updates.approximate = body.approximate
  }
  if ("sources" in body) {
    if (body.sources !== null && !Array.isArray(body.sources)) {
      return NextResponse.json({ error: "sources must be an array" }, { status: 400 })
    }
    updates.sources = body.sources
  }
  // Board claims: relationship (rode | own | both), or null to clear.
  if ("board_relationship" in body) {
    if (body.board_relationship === null) {
      updates.board_relationship = null
    } else {
      const rel = str(body.board_relationship, 8)
      if (!rel || !BOARD_RELATIONSHIPS.has(rel)) {
        return NextResponse.json({ error: "Unknown board_relationship" }, { status: 400 })
      }
      updates.board_relationship = rel
    }
  }

  // Object swap (start-card lets a member repoint their first-board and
  // first-resort claims). Person objects are excluded in both directions:
  // their tag_events would need a disable plus re-pair cycle this route
  // does not perform.
  if ("object_id" in body || "object_type" in body) {
    const objectId = str(body.object_id, 80)
    const objectType = str(body.object_type, 16)
    if (!objectId || !objectType || !ENTITY_TYPES.has(objectType)) {
      return NextResponse.json({ error: "object_id and object_type are required together" }, { status: 400 })
    }
    if (claim.object_type === "person" || objectType === "person") {
      return NextResponse.json(
        { error: "Claims involving people cannot be repointed. Delete and re-add instead." },
        { status: 400 },
      )
    }
    updates.object_id = objectId
    updates.object_type = objectType
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields in request" }, { status: 400 })
  }

  const { error } = await db.from("claims").update(updates).eq("id", id)
  if (error) {
    console.error("[api/claims/[id]] update failed:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth()
  if (response) return response
  const { id } = await params

  const db = getServiceClient()
  const claim = await loadClaim(db, id)
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }

  const isOwner = claim.asserted_by === user.id
  if (!isOwner && !(await callerIsEditor(db, user.id))) {
    return NextResponse.json({ error: "You can only delete claims you added." }, { status: 403 })
  }

  await disableClaimTagEventsForDeletion(db, id, {
    actorId: user.id,
    actorRole: isOwner ? "asserter" : "editor",
  })

  const { error } = await db.from("claims").delete().eq("id", id)
  if (error) {
    console.error("[api/claims/[id]] delete failed:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // BUG-103: claw back any contribution tokens this claim earned so add /
  // delete / re-add nets to zero. The award went to the asserter, not the
  // acting editor; reverse against asserted_by. Best-effort, never blocks.
  if (claim.asserted_by) {
    await reverseContributionTokens(db, claim.asserted_by, `claim:${id}`)
  }
  return NextResponse.json({ ok: true })
}
