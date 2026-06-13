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
 * GET /api/equity/pool; the max() guard keeps a fresh balance that has not
 * landed in the aggregate yet from estimating above 100%.
 */
export function estimateShares(
  myWeighted: number,
  totalWeighted: number,
): ShareEstimate | null {
  if (myWeighted <= 0 || totalWeighted <= 0) return null
  const fraction = myWeighted / Math.max(totalWeighted, myWeighted)
  return {
    shares: Math.round(fraction * EQUITY_POOL_SHARES),
    pct: fraction * 100,
  }
}
