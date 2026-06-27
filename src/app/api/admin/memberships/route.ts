import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { nextFoundingMemberNumber } from "@/lib/memberships"

// ─── Tier constants ───────────────────────────────────────────────────────────

const TIER_TOKENS: Record<string, { founder: number; member: number }> = {
  free:     { founder: 0, member: 0 },
  annual:   { founder: 0, member: 20 },
  lifetime: { founder: 0, member: 70 },
  founding: { founder: 100, member: 0 },
}

const VALID_TIERS = new Set(["free", "annual", "lifetime", "founding"])

// A repeat admin token grant for the same (user, token_type, amount) inside
// this window is treated as a double-submit and not re-logged. The profile
// balance write is already idempotent (it overwrites to the tier default), but
// the token_events insert is append-only, so a double-click logged two
// identical ledger rows while the balance stayed correct. The observed prod
// duplicate was ~30s apart, so this window covers a slow double-click without
// suppressing a genuinely distinct grant.
const GRANT_DEDUP_WINDOW_MS = 2 * 60 * 1000

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
    display_name?: string
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
    updates.membership_status = rest.membership_status ?? "active"

    // An editor-set membership is a manual grant, not a comp: mark non-free as
    // 'paid' so the comp revert never touches it, and clear the source on a
    // downgrade to free so no stale 'comp' latch lingers (comp_earned_at, the
    // one-time latch, is intentionally left alone).
    updates.membership_source = tier === "free" ? null : "paid"

    if (tier === "founding") {
      updates.founding_badge = true
      // Respect an explicit number (admin manually setting one); otherwise
      // assign the next number as max+1, never count+1 (see
      // nextFoundingMemberNumber for why count-based numbering collided).
      updates.founding_member_number =
        rest.founding_member_number != null
          ? rest.founding_member_number
          : await nextFoundingMemberNumber(client)
    } else {
      // Moving off founding releases the founder identity, so a stale member
      // number can't linger on the profile and collide with a future grant.
      // Authoritative here: a stale number echoed back by the edit form (the
      // observed Cory case) is overridden below by skipping the explicit
      // founding override whenever a tier change is in play.
      updates.founding_badge = false
      updates.founding_member_number = null
    }

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
  if (rest.membership_status !== undefined) updates.membership_status = rest.membership_status
  if (rest.is_editor !== undefined) updates.is_editor = rest.is_editor

  // Let an editor correct a member's display name independently of any
  // membership change. Non-empty only — we never blank a name to empty.
  if (typeof rest.display_name === "string") {
    const name = rest.display_name.trim()
    if (name) updates.display_name = name
  }

  // Founding number / badge are owned by the tier block above during any tier
  // change (grant assigns max+1, downgrade clears). Only honor explicit values
  // when no tier is supplied, e.g. an admin correcting the number on an
  // existing founding member without changing their tier.
  if (!tier) {
    if (rest.founding_member_number !== undefined) updates.founding_member_number = rest.founding_member_number
    if (rest.founding_badge !== undefined) updates.founding_badge = rest.founding_badge
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates specified" }, { status: 400 })
  }

  const { error } = await client.from("profiles").update(updates).eq("id", user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log if tokens were granted. Skip the insert when an identical recent
  // admin_grant row already exists so a double-submit cannot append a phantom
  // ledger entry (see GRANT_DEDUP_WINDOW_MS above).
  if (updates.token_founder || updates.token_member) {
    const tokenType = updates.token_founder ? "founder" : "member"
    const amount = (updates.token_founder as number) || (updates.token_member as number)

    const since = new Date(Date.now() - GRANT_DEDUP_WINDOW_MS).toISOString()
    const { data: recent } = await client
      .from("token_events")
      .select("created_at")
      .eq("user_id", user_id)
      .eq("token_type", tokenType)
      .eq("amount", amount)
      .eq("source", "admin_grant")
      .gte("created_at", since)
      .limit(1)

    if (!recent || recent.length === 0) {
      await client.from("token_events").insert({
        user_id,
        token_type: tokenType,
        amount,
        source: "admin_grant",
      }).then(() => {/* best-effort */})
    }
  }

  return NextResponse.json({ ok: true })
}
