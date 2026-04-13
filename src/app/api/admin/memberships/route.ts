import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// ─── Tier constants ───────────────────────────────────────────────────────────

const TIER_TOKENS: Record<string, { founder: number; member: number }> = {
  free:     { founder: 0, member: 0 },
  annual:   { founder: 0, member: 10 },
  lifetime: { founder: 0, member: 30 },
  founding: { founder: 100, member: 0 },
}

const VALID_TIERS = new Set(["free", "annual", "lifetime", "founding"])

// ─── GET /api/admin/memberships ── list all profiles with membership data ─────
export async function GET() {
  const { response } = await requireEditor()
  if (response) return response

  const client = getServiceClient()

  // Fetch profiles (no email column — that lives in auth.users)
  const { data: profiles, error } = await client
    .from("profiles")
    .select(`
      id, display_name,
      membership_tier, membership_status, founding_badge, founding_member_number,
      token_founder, token_member, token_contribution,
      stripe_customer_id, membership_expires_at, created_at, is_editor
    `)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch emails from auth.users via admin API
  const { data: { users }, error: authErr } = await client.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  const emailById = Object.fromEntries(users.map(u => [u.id, u.email ?? ""]))

  const members = (profiles ?? []).map(p => ({ ...p, email: emailById[p.id] ?? "" }))

  return NextResponse.json({ members })
}

// ─── POST /api/admin/memberships ── grant / edit membership ──────────────────
export async function POST(req: NextRequest) {
  const { response } = await requireEditor()
  if (response) return response

  const client = getServiceClient()

  const body = await req.json() as {
    user_id: string
    tier?: string
    token_founder?: number
    token_member?: number
    founding_member_number?: number | null
    founding_badge?: boolean
    membership_status?: string
    is_editor?: boolean
    // If true, auto-set tokens to tier defaults
    apply_tier_tokens?: boolean
  }

  const { user_id, tier, apply_tier_tokens, ...rest } = body

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 })
  }

  if (tier && !VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: `Invalid tier: ${tier}` }, { status: 400 })
  }

  // Build update payload
  const updates: Record<string, unknown> = {}

  if (tier) {
    updates.membership_tier = tier
    updates.founding_badge = tier === "founding" ? true : (rest.founding_badge ?? false)
    updates.membership_status = rest.membership_status ?? "active"

    if (apply_tier_tokens) {
      const tokens = TIER_TOKENS[tier] ?? { founder: 0, member: 0 }
      updates.token_founder = tokens.founder
      updates.token_member  = tokens.member
    }

    if (tier === "annual") {
      updates.membership_expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    } else if (tier !== "annual") {
      updates.membership_expires_at = null
    }
  }

  // Allow explicit overrides regardless of tier
  if (rest.token_founder !== undefined) updates.token_founder = rest.token_founder
  if (rest.token_member  !== undefined) updates.token_member  = rest.token_member
  if (rest.founding_member_number !== undefined) updates.founding_member_number = rest.founding_member_number
  if (rest.founding_badge !== undefined) updates.founding_badge = rest.founding_badge
  if (rest.membership_status !== undefined) updates.membership_status = rest.membership_status
  if (rest.is_editor !== undefined) updates.is_editor = rest.is_editor

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates specified" }, { status: 400 })
  }

  const { error } = await client.from("profiles").update(updates).eq("id", user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log if tokens were granted
  if (updates.token_founder || updates.token_member) {
    await client.from("token_events").insert({
      user_id,
      token_type: updates.token_founder ? "founder" : "member",
      amount:     (updates.token_founder as number) || (updates.token_member as number),
      source:     "admin_grant",
    }).then(() => {/* best-effort */})
  }

  return NextResponse.json({ ok: true })
}
