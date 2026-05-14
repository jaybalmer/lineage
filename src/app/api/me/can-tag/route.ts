import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { isAsserterGloballyBlocked } from "@/lib/tag-events"

// GET /api/me/can-tag
//
// PB-009 Phase 3 client-side precheck. Returns whether the caller is allowed
// to create new tag_events. Phase 3 only blocks globally-restricted asserters
// (editor-issued scope='global' user blocks); future phases may extend with
// throttle / saturation reasons.
//
// Response shape designed to grow:
//   { ok: true, reason: "globally_blocked" } when blocked
//   { ok: true } when not blocked
//
// The caller (store addClaim + AddStoryModal) checks ok && !reason and
// proceeds with the underlying write. UI displays a generic refusal — do
// NOT expose the specific block reason to the user.
export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const blocked = await isAsserterGloballyBlocked(db, user.id)

  if (blocked) {
    return NextResponse.json({ ok: true, can_tag: false, reason: "globally_blocked" })
  }
  return NextResponse.json({ ok: true, can_tag: true })
}
