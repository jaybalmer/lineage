# Bug-fix brief: base the equity share estimate on a projected snapshot (BUG-061)

> Build-ready on the defaults below. Self-contained. Drafted by the daily triage (June 16, 2026).
> HUMAN-REVIEWED ONLY: this changes a launch-facing equity number that members see. Do NOT let the autonomous pipeline auto-merge it. Jay should eyeball the resulting numbers before merge.

## Goal
Make the "estimated shares" a member sees reflect a realistic end-state distribution (a projected September 30 pool), instead of dividing by the tiny live snapshot total, which makes early-launch estimates balloon.

## In scope
- **BUG-061** [P2]: the equity launch-offer share estimate is computed off the live aggregate, so with few members today one member's slice reads "way off."

## DECISIONS (review before building)
- **D1. Projection basis.** Recommended default (Jay's stated suggestion): about 1,000 members at an average of 20 weighted tokens each, so a projected total of about 20,000 weighted tokens. Encode as a single named constant `PROJECTED_TOTAL_WEIGHTED = 20_000` in `src/lib/equity-offer.ts` so Jay can tune one number. Alternative: derive it as `PROJECTED_MEMBERS (1000) * PROJECTED_AVG_WEIGHTED (20)` so the two assumptions are visible and tunable separately. Default is the explicit two-constant form for clarity.
- **D2. How to apply the floor.** Recommended default: floor the denominator, `denominator = Math.max(totalWeighted, myWeighted, PROJECTED_TOTAL_WEIGHTED)`. This keeps the existing self-cap (a fresh balance never estimates above 100%) and ensures the estimate only shrinks toward reality as the real pool grows past the projection. Alternative: always divide by the projection (ignore the live total). Default is the `max` floor so the number stays correct if the real pool ever exceeds the projection.
- **D3. Copy.** Recommended default: add a short qualifier near the estimate, for example "Estimated at a projected end-of-offer pool." so the number reads as a projection, not a promise. Confirm exact string with Jay; keep it short.

## Root cause (verified against current main)
`src/lib/equity-offer.ts`:
```
export function estimateShares(myWeighted, totalWeighted): ShareEstimate | null {
  if (myWeighted <= 0 || totalWeighted <= 0) return null
  const fraction = myWeighted / Math.max(totalWeighted, myWeighted)
  return { shares: Math.round(fraction * EQUITY_POOL_SHARES), pct: fraction * 100 }
}
```
`totalWeighted` comes from `GET /api/equity/pool` (the live aggregate of weighted tokens across the cohort). Early in launch that total is small, so `fraction` is large and `shares` approaches the full 100,000 pool. The reporter wants the denominator to reflect the projected Sept 30 snapshot instead.

Estimate call sites added in PR #75 (all read the same helper, so fixing the helper fixes all of them):
- My Timeline "Your share so far"
- `/account/membership`
- the community-landing equity teaser

`EQUITY_POOL_SHARES = 100_000`, `EQUITY_SNAPSHOT_DATE = "2026-09-30"`, and `TOKEN_WEIGHTS` already live in this file.

## Implementation (suggested order)
1. Add the projection constants to `src/lib/equity-offer.ts` (D1): `PROJECTED_MEMBERS = 1_000`, `PROJECTED_AVG_WEIGHTED = 20`, `PROJECTED_TOTAL_WEIGHTED = PROJECTED_MEMBERS * PROJECTED_AVG_WEIGHTED`, with a comment that these are tunable launch assumptions, not commitments.
2. Change the `estimateShares` denominator to `Math.max(totalWeighted, myWeighted, PROJECTED_TOTAL_WEIGHTED)` (D2). Leave the `myWeighted <= 0` early return and the `pct` math otherwise intact.
3. Add the short projection qualifier copy (D3) at the estimate surfaces, or a single shared spot if the helper return is rendered through one component. Keep it factual.
4. Sanity-check the numbers by hand: a member with 20 weighted tokens should now estimate about `20 / 20000 * 100000 = 100` shares (0.1%), not a large fraction of the pool.

## Acceptance
- A typical early member's estimated shares reflect the projected pool (on the order of tens to low hundreds of shares for a normal balance), not a large share of 100,000.
- If the real weighted total ever exceeds the projection, the estimate uses the real total (the `max` floor), so the number is never inflated.
- The projection is a single named constant (or two), easy for Jay to tune.
- Copy reads as a projection, not a guarantee.
- `npx tsc --noEmit` is clean.

## Standing rules
- Name **BUG-061** in the PR title or commit message.
- Append a `status: pending` entry to `bugs/SHIP-LOG.md`. Do not edit earlier entries.
- Do not edit the **Shipped** section of `bugs/bug-triage.md`.
- No em dashes anywhere (code, comments, UI copy). Use periods, commas, parentheses, colons, or semicolons.
- HUMAN-REVIEWED merge only; this is an equity number members see. Do not auto-merge unseen.
