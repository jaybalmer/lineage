# Bug-fix brief: scrub stale token-UI remnants (BUG-020)

> Drafted from the June 16 Cowork decision session. Build-ready on the decision below.
> One PR. Name BUG-020 in the PR title. Client/copy cleanup, auto-merge eligible.

## Goal
Remove the leftover non-functional token copy ("200 tokens", "Revenue share active") from the profile / My Timeline surface while KEEPING the now-functional equity-offer surface, which is the contribution hook.

## Scope
- **BUG-020** (premise changed): the original ask was to hide non-functional token UI. PR #61 made the token system functional and shipped the equity offer, so the surface is now a deliberate feature. What remains is stale copy from the old static model.

## DECISION (made by Jay, June 16)
Keep the equity-offer surface visible. Scrub only the stale remnants: any hardcoded "200 tokens" balance and the "Revenue share active" status string from the profile / My Timeline header. Do not gate or hide the live equity/contribution surface. Leave no layout gap where removed elements were.

## Verified suspected files (from CLAUDE.md + session log)
- `/[community]/profile` (My Timeline) profile header / membership block; the membership slice in `src/store/lineage-store.ts`.
- Grep for the literal strings "200 tokens" and "Revenue share active" (and any static `200` token balance) and remove/replace them. The functional balance and equity-offer elements (PR #61 / PR #75) stay.
- Verify against the BUG-020 screenshot context: the stale copy rendered under the profile actions on My Timeline.

## Acceptance
- The static "200 tokens" and "Revenue share active" copy no longer renders on the profile / My Timeline surface.
- The live equity-offer / contribution surface (real balance, "Your share so far") is unchanged and still visible.
- No empty layout gap left behind.

## Suggested order
1. Grep the stale strings; confirm which are static remnants vs the live equity surface.
2. Remove the remnants; keep the functional equity elements.
3. Verify no layout gap and the equity offer still renders.

## Notes
No migration. `npx tsc --noEmit` clean. One PR, BUG-020 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
