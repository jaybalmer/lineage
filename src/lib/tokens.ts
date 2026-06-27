import type { SupabaseClient } from "@supabase/supabase-js"
import { CONTRIBUTOR_COMP_THRESHOLD } from "@/lib/equity-offer"

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
export const CAPPED_SOURCES = [
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
 *
 * sourceRef ties the award to the entity that earned it (claim / story /
 * connection / catalog entity) so the award can be reversed when that entity is
 * deleted (BUG-103 claw-back). Use a stable, prefixed key:
 * `claim:<id>`, `story:<id>`, `entity:<id>`, `conn:<story>:<type>:<entity>`.
 */
export async function awardContributionTokens(
  db: SupabaseClient,
  userId: string,
  amount: number,
  source: ContributionSource,
  sourceRef: string | null = null,
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
      source_ref: sourceRef,
    })
    if (ledgerError) {
      // Balance moved but the ledger row failed; log loudly so the audit
      // trail gap is visible.
      console.error(`[tokens] token_events insert failed (${source}):`, ledgerError.message)
    }

    // A free user who just crossed the contribution-comp threshold earns a
    // 12-month membership (brief §5.4). Best-effort and one-time-latched; never
    // blocks the award that triggered it. Only after a real grant moved the
    // balance, so a no-op award never triggers an extra profile read.
    if (grant > 0) await maybeGrantContributorComp(db, userId)

    return grant
  } catch (err) {
    console.error(`[tokens] award threw (${source}):`, err)
    return 0
  }
}

/**
 * Reverse every contribution award tied to one source entity when that entity
 * is deleted, so add / delete / re-add cannot farm tokens (BUG-103). Returns
 * the amount actually clawed back (0 when there is nothing to reverse).
 *
 * Idempotent: it nets the ledger per source for (user_id, source_ref), so any
 * source already at net <= 0 (a prior reversal wrote the negative mirror rows)
 * is skipped and a second call is a no-op. Best-effort, mirroring
 * awardContributionTokens: every failure logs and returns 0, never throwing
 * into the delete path that triggered it.
 *
 * Ordering: the negative mirror rows are written BEFORE the balance decrement.
 * If the process dies between the two, the ledger already nets to zero so a
 * retry will not double-charge; the cost is a balance left slightly high (under-
 * penalised), which is the safe direction (it never over-claws a real earner).
 */
export async function reverseContributionTokens(
  db: SupabaseClient,
  userId: string,
  sourceRef: string,
): Promise<number> {
  try {
    const { data, error } = await db
      .from("token_events")
      .select("amount, source")
      .eq("user_id", userId)
      .eq("source_ref", sourceRef)
    if (error) {
      console.error("[tokens] reverse lookup failed:", error.message)
      return 0
    }
    const rows = (data ?? []) as { amount?: number; source?: string }[]
    if (rows.length === 0) return 0

    // Net per source: a source whose awards and prior reversals already cancel
    // out is skipped, which is what makes this safe to call more than once.
    const netBySource = new Map<string, number>()
    for (const r of rows) {
      const src = r.source ?? "contribution_entry"
      netBySource.set(src, (netBySource.get(src) ?? 0) + (r.amount ?? 0))
    }

    let total = 0
    const reversalRows: Record<string, unknown>[] = []
    for (const [source, net] of netBySource) {
      if (net <= 0) continue
      total += net
      reversalRows.push({
        user_id: userId,
        token_type: "contribution",
        amount: -net,
        source,
        source_ref: sourceRef,
      })
    }
    if (total === 0) return 0

    const { error: ledgerError } = await db.from("token_events").insert(reversalRows)
    if (ledgerError) {
      // No reversal rows landed: do NOT touch the balance, or a retry (still
      // seeing positive net) would decrement twice. Leave it for the audit.
      console.error("[tokens] reversal ledger insert failed:", ledgerError.message)
      return 0
    }

    const { error: rpcError } = await db.rpc("decrement_contribution_tokens", {
      p_user: userId,
      p_amount: total,
    })
    if (rpcError) {
      console.error("[tokens] decrement_contribution_tokens failed:", rpcError.message)
    }
    return total
  } catch (err) {
    console.error("[tokens] reverse threw:", err)
    return 0
  }
}

// ── Contributor comp (equity-offer-membership-gate brief §5.4) ────────────────

/**
 * Grant a free user a 12-month membership comp once they reach
 * CONTRIBUTOR_COMP_THRESHOLD contribution tokens. Called from inside
 * awardContributionTokens after a successful grant; best-effort, never throws.
 *
 * The comp is just an active Annual with membership_source='comp', so it passes
 * isEquityEligible with no special case. It does NOT mint the 20 member tokens a
 * paid Annual gets (D-Q2): the comp grants eligibility + benefits only.
 *
 * One-time, race-safe: comp_earned_at is a latch that is never cleared (D-Q3).
 * Token claw-back (BUG-103) can pull token_contribution back below the threshold
 * after a grant, so the trigger must be this one-way latch, not a re-evaluated
 * balance. The guarded UPDATE (`comp_earned_at is null`) makes two concurrent
 * crossings grant exactly one comp.
 */
export async function maybeGrantContributorComp(
  db: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data: profile, error } = await db
      .from("profiles")
      .select("token_contribution, membership_tier, comp_earned_at")
      .eq("id", userId)
      .single()
    if (error || !profile) return false
    if (profile.comp_earned_at != null) return false          // one-time latch (D-Q3)
    if (profile.membership_tier !== "free") return false       // already a member
    if ((profile.token_contribution ?? 0) < CONTRIBUTOR_COMP_THRESHOLD) return false

    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + YEAR_MS).toISOString()

    // Guarded on comp_earned_at IS NULL: a concurrent crossing that already
    // latched the comp matches zero rows here, so exactly one comp is granted.
    const { data: updated, error: updateError } = await db
      .from("profiles")
      .update({
        membership_tier:       "annual",
        membership_status:     "active",
        membership_expires_at: expiresAt,
        membership_source:     "comp",
        comp_earned_at:        nowIso,
        // D-Q2: deliberately NOT touching token_member.
      })
      .eq("id", userId)
      .is("comp_earned_at", null)
      .select("id")
    if (updateError) {
      console.error("[tokens] contributor comp update failed:", updateError.message)
      return false
    }
    if (!updated || updated.length === 0) return false          // lost the race

    // Audit marker (amount 0 — eligibility/benefit grant, no token minted).
    await db.from("token_events").insert({
      user_id:    userId,
      token_type: "member",
      amount:     0,
      source:     "contributor_comp_grant",
    }).then(() => {/* best-effort */})

    return true
  } catch (err) {
    console.error("[tokens] contributor comp threw:", err)
    return false
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
