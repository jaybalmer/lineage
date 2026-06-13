import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { maybeGrantFoundingMemberTokens, FOUNDING_ANNUAL_MEMBER_TOKENS } from "@/lib/tokens"

// ── GET /api/me ───────────────────────────────────────────────────────────────
// Returns the current user's profile + membership data.
// requireAuth() identifies the caller and idempotently bootstraps a profile row
// if one is missing (defends against the orphan-auth-user case). The read uses
// the service role client to bypass RLS.
//
// Side effects on load (token-system brief, June 12 2026):
//   1. Daily-visit reward: +1 contribution token once per UTC day via the
//      atomic award_daily_visit RPC (migration-013). Runs BEFORE the profile
//      read so today's token is already in this response. Two near-
//      simultaneous loads cannot double-award: the RPC's guarded UPDATE
//      serialises on the row lock.
//   2. Founding member-token accrual (+10/yr, D8): checked only on the load
//      that won today's daily-visit award, so it runs at most once per day
//      per user and the read-modify-write inside is single-flight.
// Both are best-effort; failures log and never block the profile response.
export async function GET() {
  try {
    const { user, response } = await requireAuth()
    if (response) {
      // Preserve the original error shape for existing clients (catalog-loader, etc.)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const db = getServiceClient()

    let dailyVisitAwarded = false
    try {
      const { data: awarded, error: visitError } = await db.rpc("award_daily_visit", {
        p_user: user.id,
      })
      if (visitError) {
        console.error("[api/me] award_daily_visit failed:", visitError.message)
      } else {
        dailyVisitAwarded = awarded === true
      }
    } catch (err) {
      console.error("[api/me] award_daily_visit threw:", err)
    }

    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select(`
        display_name, birth_year, riding_since, privacy_level,
        bio, links, home_resort_id, city, region, country, avatar_url, card_bg_url,
        membership_tier, membership_status, founding_badge, founding_member_number,
        token_founder, token_member, token_contribution,
        stripe_customer_id, stripe_subscription_id, membership_expires_at, pending_credit,
        is_editor
      `)
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (dailyVisitAwarded && profile.membership_tier === "founding") {
      const granted = await maybeGrantFoundingMemberTokens(db, user.id)
      if (granted) {
        // Keep this response fresh; the DB row was updated after the read.
        profile.token_member = (profile.token_member ?? 0) + FOUNDING_ANNUAL_MEMBER_TOKENS
      }
    }

    return NextResponse.json({ uid: user.id, profile })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
