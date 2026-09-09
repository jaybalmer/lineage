# Bug-fix brief: feed "Recently added" sort as the default (BUG-055)

> Drafted from the June 16 Cowork decision session. Build-ready on the decision below.
> One PR. Name BUG-055 in the PR title. Client/sort behavior, auto-merge eligible (no migration).
> SESSION NOTE (June 16): the QoL cluster plan (`bugs/2026-06-16-qol-cluster-brief.md`) extends this to ALSO add the "Recently added" option on the `/snowboarding` community timeline (an extra sort tab, default unchanged), on top of the feed default below. If you are running the cluster session, follow that wider scope; this brief alone is the feed-only version.

## Goal
Let members see new feed content first by sorting `/snowboarding/feed` by when content was POSTED (activity), distinct from when the event happened.

## Scope
- **BUG-055**: the feed (and community timeline) order by event/story date (the timeline spine), so freshly posted content does not surface at the top. Jay wants a posted-order (activity) sort.

## DECISION (made by Jay, June 16)
Scope to the FEED only. Add a "Recently added" sort keyed on `created_at` (posted time) to `/snowboarding/feed`, AND make it the feed's default order. Leave the community timeline (`/snowboarding`) on its existing event-date sorts (Newest / Oldest / Most-connections); do NOT change the timeline. Keep the event-date sort available on the feed as a secondary option.

## Verified suspected files (from CLAUDE.md + session log)
- `src/components/feed/feed-view.tsx` (`order` prop; current ordering keys off `story_date` / event date).
- `src/lib/timeline-grouping.ts` (`dateToSortNum` / decade grouping helpers).
- The `/snowboarding/feed` route that mounts FeedView; confirm `created_at` (posted time) is available on the feed rows from `GET /api/stories` (stories carry created_at; claims/riding-days too). If a feed row type lacks a created_at, define the fallback explicitly rather than silently dropping it.
- Distinguish clearly in the UI between "happened" (event/story date) and "posted" (created_at) so the new option reads as activity order.

## Acceptance
- `/snowboarding/feed` defaults to "Recently added" (most recently posted, by `created_at`).
- An event-date sort remains available on the feed as a non-default option.
- The community timeline at `/snowboarding` is unchanged (still event-date Newest/Oldest/Most-connections).
- 0px horizontal overflow at 375px / 414px; no regression to decade grouping where it still applies.

## Suggested order
1. Confirm `created_at` is present on every feed row type FeedView renders.
2. Add the "Recently added" (created_at desc) sort and set it as the feed default.
3. Verify the community timeline sorts are untouched.

## Notes
No migration. `npx tsc --noEmit` clean. One PR, BUG-055 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
