import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { maybeGrantFoundingMemberTokens, FOUNDING_ANNUAL_MEMBER_TOKENS } from "@/lib/tokens"
import { captureServerEvent } from "@/lib/analytics-server"
import { maybeMarkActivated } from "@/lib/activation"

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
//   2. Founding member-token accrual (annual-equivalent /yr, D8): checked only on the load
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
        stripe_customer_id, stripe_subscription_id, membership_expires_at, membership_source, pending_credit,
        is_editor, created_at, last_visit_award_date
      `)
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Lazy comp revert (brief §5.5): a contributor comp past its term has no
    // Stripe event to lapse it, so revert it to free here. Guarded on
    // source='comp' so a paid or gifted membership is never touched;
    // comp_earned_at is left set so the comp can never be re-earned (D-Q3).
    // isEquityEligible already treats past-expiry as ineligible, so the estimate
    // is correct even before this fires; this keeps the stored row honest too.
    if (
      profile.membership_source === "comp" &&
      profile.membership_tier !== "free" &&
      profile.membership_expires_at &&
      Date.parse(profile.membership_expires_at as string) < Date.now()
    ) {
      const { error: revertErr } = await db
        .from("profiles")
        .update({ membership_tier: "free", membership_status: "expired" })
        .eq("id", user.id)
        .eq("membership_source", "comp")
      if (revertErr) {
        console.error("[api/me] comp revert failed:", revertErr.message)
      } else {
        profile.membership_tier = "free"
        profile.membership_status = "expired"
      }
    }

    if (dailyVisitAwarded && profile.membership_tier === "founding") {
      const granted = await maybeGrantFoundingMemberTokens(db, user.id)
      if (granted) {
        // Keep this response fresh; the DB row was updated after the read.
        profile.token_member = (profile.token_member ?? 0) + FOUNDING_ANNUAL_MEMBER_TOKENS
      }
    }

    // Return signal + activation (activation-retention-scoreboard brief, T2).
    // Both hang off the daily-visit winner branch, so they inherit the RPC's
    // once-per-UTC-day guarantee and add no second dedupe. The profile read
    // above (line ~45) runs AFTER award_daily_visit (line ~33), so
    // last_visit_award_date already reflects today's write; that ordering is
    // load-bearing (if a refactor inverts it, the return arm silently stops
    // activating). Best-effort: a failure here never changes the response.
    if (dailyVisitAwarded) {
      try {
        const createdAt = profile.created_at as string | null
        if (createdAt) {
          const createdDay = new Date(createdAt).toISOString().slice(0, 10)
          const todayDay = new Date().toISOString().slice(0, 10)
          const dayIndex = Math.round(
            (Date.parse(todayDay) - Date.parse(createdDay)) / 86_400_000,
          )
          // Never on signup day (day_index 0). day_index 1 = came back next day.
          if (dayIndex >= 1) {
            await captureServerEvent({
              category: "auth",
              event: "member_returned",
              actorId: user.id,
              props: { day_index: dayIndex },
            })
          }
        }
        await maybeMarkActivated(db, user.id, "return")
      } catch (err) {
        console.error("[api/me] return/activation capture threw:", err)
      }
    }

    // daily_visit_awarded is true only on the load that won today's daily-visit
    // reward, so the client can give a one-per-day "showing up" feedback toast
    // (token-game-feel follow-up: visiting was silent before).
    return NextResponse.json({ uid: user.id, profile, daily_visit_awarded: dailyVisitAwarded })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
