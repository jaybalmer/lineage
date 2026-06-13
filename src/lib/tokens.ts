import type { SupabaseClient } from "@supabase/supabase-js"

// Contribution-token awards (token-system-equity-offer brief, June 12 2026).
//
// Every award is best-effort: a failure logs and returns 0, it never blocks
// the contribution that triggered it (matching the existing token_events
// pattern in the stripe webhook and gift redemption routes). Balances live on
// profiles.token_contribution; the increment goes through the
// increment_contribution_tokens RPC (migration-013) so concurrent awards
// never lose an update. token_events is the ledger for every grant.

export type ContributionSource =
  | "contribution_entry"           // new claim or story
  | "contribution_media"           // story with at least one photo (1 per story)
  | "contribution_source"          // claim sources[] / story youtube_url or url
  | "contribution_connection"      // community connection on a story
  | "contribution_entity"          // member-created place / board / event
  | "contribution_verify"          // verifying another rider's entry (unwired:
  | "contribution_verified_bonus"  //   no entry-verification feature yet; these
                                   //   sources are reserved for when it ships)
  | "contribution_onboard"         // invite that converted to a claimed profile

/**
 * Content actions sit under a soft daily cap so equity cannot be farmed with
 * bulk low-value inserts (brief Q2). Verify, verified-bonus, onboard, and the
 * daily-visit reward sit outside the cap. Soft: two concurrent awards can
 * race past the line by a token or two, which is acceptable.
 */
const CAPPED_SOURCES = [
  "contribution_entry",
  "contribution_media",
  "contribution_source",
  "contribution_connection",
  "contribution_entity",
] as const

export const DAILY_CONTENT_TOKEN_CAP = 20

const CAPPED_SET: ReadonlySet<string> = new Set(CAPPED_SOURCES)

/**
 * Award contribution tokens to a user. Returns the amount actually granted
 * (0 on failure or when the daily content cap is exhausted). Callers pass the
 * service-role client they already hold; this never throws.
 */
export async function awardContributionTokens(
  db: SupabaseClient,
  userId: string,
  amount: number,
  source: ContributionSource,
): Promise<number> {
  try {
    let grant = amount

    if (CAPPED_SET.has(source)) {
      const todayUtc = new Date().toISOString().slice(0, 10)
      const { data, error } = await db
        .from("token_events")
        .select("amount")
        .eq("user_id", userId)
        .in("source", [...CAPPED_SOURCES])
        .gte("created_at", `${todayUtc}T00:00:00Z`)
      if (error) {
        // Fail open: a broken cap query should not zero out legitimate
        // earning. The ledger still records whatever is granted.
        console.error("[tokens] daily-cap query failed:", error.message)
      } else {
        const spentToday = (data ?? []).reduce(
          (sum, row) => sum + ((row as { amount?: number }).amount ?? 0), 0)
        grant = Math.max(0, Math.min(amount, DAILY_CONTENT_TOKEN_CAP - spentToday))
      }
      if (grant === 0) return 0
    }

    const { error: rpcError } = await db.rpc("increment_contribution_tokens", {
      p_user: userId,
      p_amount: grant,
    })
    if (rpcError) {
      console.error(`[tokens] increment_contribution_tokens failed (${source}):`, rpcError.message)
      return 0
    }

    const { error: ledgerError } = await db.from("token_events").insert({
      user_id: userId,
      token_type: "contribution",
      amount: grant,
      source,
    })
    if (ledgerError) {
      // Balance moved but the ledger row failed; log loudly so the audit
      // trail gap is visible.
      console.error(`[tokens] token_events insert failed (${source}):`, ledgerError.message)
    }

    return grant
  } catch (err) {
    console.error(`[tokens] award threw (${source}):`, err)
    return 0
  }
}

// ── Founding member-token accrual (brief §5.6, D8) ────────────────────────────

export const FOUNDING_ANNUAL_MEMBER_TOKENS = 20
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Founding tier accrues the annual-equivalent member tokens per membership
 * year on top of its founder tokens (tracks the annual rate, D8). Founding has no Stripe
 * renewal event, so the grant anchors to the most recent
 * 'founding_member_grant' ledger row: none yet means grant now (the backfill
 * normally seeds the first one), otherwise grant when the last one is a year
 * old. Called from /api/me at most once per day (gated on the daily-visit
 * award), so the read-modify-write on token_member is single-flight.
 */
export async function maybeGrantFoundingMemberTokens(
  db: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("token_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("source", "founding_member_grant")
      .order("created_at", { ascending: false })
      .limit(1)
    if (error) {
      console.error("[tokens] founding-grant lookup failed:", error.message)
      return false
    }

    const lastGrantAt = (data?.[0] as { created_at?: string } | undefined)?.created_at
    if (lastGrantAt && Date.now() - Date.parse(lastGrantAt) < YEAR_MS) return false

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("token_member")
      .eq("id", userId)
      .single()
    if (profileError || !profile) return false

    const { error: updateError } = await db
      .from("profiles")
      .update({ token_member: (profile.token_member ?? 0) + FOUNDING_ANNUAL_MEMBER_TOKENS })
      .eq("id", userId)
    if (updateError) {
      console.error("[tokens] founding member-token update failed:", updateError.message)
      return false
    }

    const { error: ledgerError } = await db.from("token_events").insert({
      user_id: userId,
      token_type: "member",
      amount: FOUNDING_ANNUAL_MEMBER_TOKENS,
      source: "founding_member_grant",
    })
    if (ledgerError) {
      console.error("[tokens] founding-grant ledger insert failed:", ledgerError.message)
    }
    return true
  } catch (err) {
    console.error("[tokens] founding grant threw:", err)
    return false
  }
}
