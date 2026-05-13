import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// GET  /api/me/blocks                  — list blocked parties (block_kind='user')
// POST /api/me/blocks                  — block a party (cascade trigger auto-declines existing pending)
//
// Block-time cascade is handled by apply_block_cascade() in Postgres. Trust is
// dropped in the same call so the user-intent ordering holds (block wins over
// any prior trust row).

interface AsserterSummary { id: string; display_name: string | null; avatar_url: string | null }

const ALLOWED_KINDS = new Set(["user", "email", "ip"])

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { data: rows, error } = await db
    .from("tag_blocklist")
    .select("id, blocked_party, block_kind, reason, created_at")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For block_kind='user', blocked_party is the asserter uuid — resolve profile.
  const ids = (rows ?? [])
    .filter((r: { block_kind: string }) => r.block_kind === "user")
    .map((r: { blocked_party: string }) => r.blocked_party)
  const asserters: Record<string, AsserterSummary> = {}
  if (ids.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids)
    for (const p of (profiles ?? []) as AsserterSummary[]) asserters[p.id] = p
  }

  return NextResponse.json({ blocks: rows ?? [], asserters })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const blockedParty: unknown = body?.blocked_party
  const blockKind: unknown    = body?.block_kind ?? "user"
  const reason: unknown       = body?.reason

  if (typeof blockedParty !== "string" || blockedParty.length === 0) {
    return NextResponse.json({ error: "blocked_party required" }, { status: 400 })
  }
  if (typeof blockKind !== "string" || !ALLOWED_KINDS.has(blockKind)) {
    return NextResponse.json({ error: "invalid block_kind" }, { status: 400 })
  }
  if (blockKind === "user" && blockedParty === user.id) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 })
  }

  const db = getServiceClient()

  // Mutually exclusive with trust — drop the matching trust row first when
  // blocking a user. The block insert below fires apply_block_cascade() which
  // auto-declines this asserter's pending tag_events against the subject.
  if (blockKind === "user") {
    await db
      .from("tag_trust")
      .delete()
      .eq("subject_id", user.id)
      .eq("trusted_asserter_id", blockedParty)
  }

  const { data: ins, error } = await db
    .from("tag_blocklist")
    .insert({
      subject_id: user.id,
      blocked_party: blockedParty,
      block_kind: blockKind,
      scope: "subject",
      created_by: user.id,
      reason: typeof reason === "string" ? reason : null,
    })
    .select("id")
    .single()

  // Duplicate insert (already blocked) is a no-op — surface as ok.
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: ins?.id ?? null })
}
