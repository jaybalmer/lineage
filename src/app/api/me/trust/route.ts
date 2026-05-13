import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// GET  /api/me/trust              — list trusted asserters
// POST /api/me/trust              — trust an asserter (+auto-approve their pending tags, +clear any block)
//
// Trust + block are mutually exclusive per spec §6: trusting an asserter who
// is currently blocked drops the block row first. The cascade trigger on
// tag_blocklist insertion handles the inverse (block clears trust on the
// /api/me/blocks route).

interface AsserterSummary { id: string; display_name: string | null; avatar_url: string | null }

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { data: rows, error } = await db
    .from("tag_trust")
    .select("id, trusted_asserter_id, created_at")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (rows ?? []).map((r: { trusted_asserter_id: string }) => r.trusted_asserter_id)
  const asserters: Record<string, AsserterSummary> = {}
  if (ids.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids)
    for (const p of (profiles ?? []) as AsserterSummary[]) asserters[p.id] = p
  }

  return NextResponse.json({ trusts: rows ?? [], asserters })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const asserterId: unknown = body?.trusted_asserter_id
  if (typeof asserterId !== "string" || asserterId.length === 0) {
    return NextResponse.json({ error: "trusted_asserter_id required" }, { status: 400 })
  }
  if (asserterId === user.id) {
    return NextResponse.json({ error: "Cannot trust yourself" }, { status: 400 })
  }

  const db = getServiceClient()

  // Mutually exclusive with a 'user' block row from the same subject — drop
  // the block first so the user-intent ordering holds (trust wins).
  await db
    .from("tag_blocklist")
    .delete()
    .eq("subject_id", user.id)
    .eq("blocked_party", asserterId)
    .eq("block_kind", "user")

  // Idempotent insert via the UNIQUE (subject_id, trusted_asserter_id)
  // constraint — duplicate inserts return a constraint violation, which we
  // treat as success (the trust is already in place).
  const { error: insErr } = await db
    .from("tag_trust")
    .insert({ subject_id: user.id, trusted_asserter_id: asserterId })

  if (insErr && !insErr.message.includes("duplicate")) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Auto-approve this user's pending tags from this asserter.
  const now = new Date().toISOString()
  const { data: approved } = await db
    .from("tag_events")
    .update({ status: "approved", decision_by: user.id, decision_at: now })
    .eq("subject_id", user.id)
    .eq("asserter_id", asserterId)
    .eq("status", "pending")
    .select("id")

  return NextResponse.json({ ok: true, auto_approved: approved?.length ?? 0 })
}
