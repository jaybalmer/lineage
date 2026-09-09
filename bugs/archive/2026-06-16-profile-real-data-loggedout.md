# Bug-fix brief: public profile shows real data logged-out (BUG-046)

> Drafted from the June 16 Cowork decision session. Build-ready on the decision below.
> One PR. Name BUG-046 in the PR title. Read-path / data-source fix, no migration.

## Goal
The public rider timeline must show the SAME real data whether the viewer is logged out or logged in. A logged-out visitor at the profile route should see the real public profile (the same content as `/people/jay_balmer`), not the seeded mock/demo set.

## Scope
- **BUG-046**: logged out, `/snowboarding/profile` rendered a demo/mock profile ("3 snowboards and 12 events"); after signing in the same user saw their real counts ("10 boards and 15 events"). The two numbers come from two different data sets (mock vs Supabase) per the dual-catalog design, which reads as a bug. The expectation is one timeline, identical in both states.

## DECISION (made by Jay, June 16)
Show the real public profile data logged-out, matching `/people/jay_balmer`. Do NOT keep the mock/demo profile at this route and do NOT gate behind a sign-in wall. The rider timeline is the same artifact regardless of auth state; private/pending claims stay hidden for non-owners exactly as they already are on `/people/[id]`.

## Verified suspected files (from CLAUDE.md + session log)
- `src/store/lineage-store.ts` (dual catalog: anonymous users get `mock-data.ts`, authed users get Supabase via `<CatalogLoader />`). The mock fallback is what surfaces the demo counts for a logged-out viewer.
- `src/lib/mock-data.ts` (the seeded demo profile / counts).
- The `/[community]/profile` route vs the public `/people/[id]` route. `/people/[id]` already renders real public data for any viewer (BUG-035 made the summary card public). The fix is to make the logged-out profile surface read the same real public source rather than mock.
- Cross-check the stat-tile counts (Boards / Places / Events) so logged-out and owner views agree except for legitimately private/pending claims.

## Acceptance
- A logged-out visitor sees the real public profile and timeline (same counts and entries as the signed-in/public `/people/[id]` view), not the mock demo set.
- Private and pending claims remain hidden for non-owners (no regression to the BUG-035 / PB-009 visibility rules).
- No mock counts are shown to a logged-out visitor at the profile route.

## Suggested order
1. Reproduce logged-out vs logged-in counts at the profile route.
2. Trace where the logged-out path falls back to `mock-data.ts` and repoint it at the real public read used by `/people/[id]`.
3. Verify counts match across auth states on a profile with private + pending claims (visibility preserved).

## Notes
No migration. Confirm there is no `_public` view change needed (read-path only). `npx tsc --noEmit` clean. One PR, BUG-046 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
