# Bug-fix brief: stale removed riders persist on Connections (BUG-038)

> Auto-drafted by the daily triage on 2026-06-14. Build-ready on the recommended default below.
> One PR. Name BUG-038 in the PR title. Data-consistency fix on the Connections surface.

## Goal
A catalog rider removed from the People list should stop appearing on `/me/connections`; the connections set should match the live people directory.

## Scope
- **BUG-038** on `/me/connections`, riders removed from the People list still appear as connections. The removal updated the people list but not the connection-feeding rows the scorer reads.

## DECISIONS (review before building)
1. **Filter at read time vs cascade the removal.** Recommended default: filter the connection sources to live (non-removed) people at read time, so the connections surface never plots a rider absent from the directory (robust to any past removals already in the data). Alternative: cascade the People-list removal to the underlying claims / `story_riders` rows at write time (cleaner data, but does not retroactively fix rows removed before the fix and needs care with the moderation pipeline).
   - First confirm HOW a rider is removed from the People list: hard delete vs a `node_status` flip vs a soft-hide flag. The right filter key depends on this. Resolve this during the session by grepping the removal path; the recommended default (read-time filter) works for either mechanism.

## Verified suspected files (from the BUG-038 entry + codebase CLAUDE.md)
- `/me/connections` page (community connections route, e.g. `src/app/(community)/[community]/connections/page.tsx`).
- `src/lib/connection-summary.ts` (claim-based overlap scoring; reads claims subject OR object per BUG-014).
- `src/lib/connection-derived.ts` (story-tag-derived overlap via the `_public` views: `story_riders_public`, story `linked_place_id` / `linked_event_id`, `story_places` / `story_events`).
- The scorer reads claims and `story_riders` through the `_public` views. A People-list removal likely deletes/hides the person from the directory without removing or disabling the underlying claims / `story_riders` rows, so the removed rider keeps surfacing. Fix by filtering the connection sources to people still present (and visible) in the directory.
- Read through `*_public` views, never the raw tables (codebase CLAUDE.md gotcha 9/10). If the removal mechanism is a `node_status` flip, the filter should drop those statuses from the connection node set.
- Distinct from BUG-024 (compare avatars black) and BUG-019 (`/people` count mismatch).
- Session replay: in-app PostHog `S-03` (offset 428s); no image (Screenshot not provided).

## Acceptance
- A catalog rider removed from the People list no longer appears on `/me/connections`.
- The connections set matches the live people directory.
- No legitimate connection (a person still in the directory) is dropped.

## Suggested order
1. Grep the People-list removal path; confirm hard delete vs `node_status`/soft-hide.
2. Add the live-people filter to `connection-summary` / `connection-derived` reads (or the page that composes them).
3. Verify a removed rider drops off connections and a live rider with real overlap still scores.

## Notes
Likely no migration (read-time filter). If you choose the cascade alternative, treat any `_public`-read column change per the view-freeze rule and gate a migration before merge. `npx tsc --noEmit` clean. One PR, BUG-038 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
