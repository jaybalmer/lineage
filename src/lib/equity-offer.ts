// Equity launch offer constants (token-system-equity-offer brief §5.4,
// decisions D1 to D7, June 12 2026). One fixed pool of 100,000 common shares
// of Lineage Community Technologies Inc., split across the launch cohort by
// weighted token balance at the snapshot. Share issuance itself is a
// corporate action handled off-platform; the app only explains the offer and
// shows each member a moving estimate.

export const EQUITY_POOL_SHARES = 100_000

/** Snapshot date for the first distribution (D3, Q1: quarter-end aligned). */
export const EQUITY_SNAPSHOT_DATE = "2026-09-30"
export const EQUITY_SNAPSHOT_LABEL = "September 30, 2026"

// Projected end-of-offer pool (BUG-061). The live aggregate from
// GET /api/equity/pool is tiny early in launch, so dividing by it makes an early
// member's estimate balloon toward the full pool. We floor the denominator at a
// projected snapshot total so the estimate reads as a realistic end-state slice
// and only shrinks toward reality as the real pool grows past the projection.
// These are tunable launch assumptions, not commitments: edit the two factors to
// retune the whole estimate.
export const PROJECTED_MEMBERS = 1_000
export const PROJECTED_AVG_WEIGHTED = 20
export const PROJECTED_TOTAL_WEIGHTED = PROJECTED_MEMBERS * PROJECTED_AVG_WEIGHTED

/** Short qualifier shown beside every share estimate so it reads as a
 *  projection, not a promise (BUG-061 D3). */
export const EQUITY_ESTIMATE_QUALIFIER = "Estimated at a projected end-of-offer pool."

/** Distribution weights (D2). Matches the existing totalTokens math. */
export const TOKEN_WEIGHTS = { founder: 2, member: 1, contribution: 1 } as const

export interface TokenCounts {
  founder: number
  member: number
  contribution: number
}

export function weightedTokens(b: TokenCounts): number {
  return (
    b.founder * TOKEN_WEIGHTS.founder +
    b.member * TOKEN_WEIGHTS.member +
    b.contribution * TOKEN_WEIGHTS.contribution
  )
}

export interface ShareEstimate {
  shares: number
  pct: number
}

/**
 * Estimate a member's slice of the pool. totalWeighted comes from
 * GET /api/equity/pool. The denominator is floored at PROJECTED_TOTAL_WEIGHTED
 * so an early-launch estimate reflects a realistic end-state pool rather than the
 * tiny live snapshot (BUG-061). The myWeighted term in the max() keeps the
 * existing self-cap, so a fresh balance never estimates above 100%, and once the
 * real pool grows past the projection the real total takes over.
 */
export function estimateShares(
  myWeighted: number,
  totalWeighted: number,
): ShareEstimate | null {
  if (myWeighted <= 0 || totalWeighted <= 0) return null
  const denominator = Math.max(totalWeighted, myWeighted, PROJECTED_TOTAL_WEIGHTED)
  const fraction = myWeighted / denominator
  return {
    shares: Math.round(fraction * EQUITY_POOL_SHARES),
    pct: fraction * 100,
  }
}
