# Bug-fix brief: Public personal story missing from the community landing (BUG-043)

> Build-ready (diagnosis-first). Self-contained. Drafted June 15, 2026 by the daily triage. Name **BUG-043** in the PR title or commit message.

## Goal
A public story created on a member's personal timeline must appear in the `/snowboarding` community timeline (in the correct decade group). Private stories stay hidden. No post-launch member story is silently dropped.

## DECISIONS (review before building)
- **If the cause is the `community_id` filter:** recommended default is to NOT filter the community timeline by `community_id` for now (since `POST /api/stories` never stamps it, filtering would hide every member story). Show all public stories on `/snowboarding`, as Phase 1 intended. Alternative (later, Phase 2): stamp `community_id` on story create, then filter. Do not adopt the filter until create stamps it.
- **If the cause is a visibility-value mismatch:** fix is data/logic, no decision needed.

## Context (what the reporter saw)
Cory created a story "Winter arrives! / Snowy stroll" dated Dec 1, 2025, set to public, on `/snowboarding/profile`. It shows on their My Timeline (confirmed in screenshot `19ec7a011067cccc__0__bug-screenshot.jpg`) but not on `/snowboarding`. iPhone Safari, 414x750. Replay `S-04` offset 5384s.

## Diagnosis first (do this before changing code)
The Phase 1 community timeline (PR #66) renders public stories grouped by decade. Three candidate causes, in priority order:

1. **`community_id` filter silently hides it.** Phase 1 left a `// Phase 2:` breadcrumb where a `community_id` story filter was deliberately NOT added, because `POST /api/stories` never stamps `community_id` (nullable, no default). Check whether any later change added such a filter to the `/snowboarding` story read. If a `community_id = ...` (or non-null) condition is present, member stories with `community_id IS NULL` are excluded. This is the most likely cause.
2. **Visibility-value mismatch.** The author believes the story is public, but the row's `visibility` may be something else. Note the adjacent BUG-050 screenshot shows a claim card reading "linestry.com - Private", so visibility-state confusion is live on this account. Confirm the actual `visibility` value of the story row.
3. **Cache / revalidation gap.** The community page may serve a cached story set that does not include a just-created story.

Run this first:
```
select id, title, visibility, community_id, story_date, author_id, created_at
from stories where title ilike 'Winter arrives%';
```
Then read the exact query behind the `/snowboarding` timeline (see suspected files) and compare its WHERE clause to that row.

## Suspected files (verified present)
- `src/components/feed/community-timeline.tsx`: the community landing timeline component.
- `src/lib/timeline-grouping.ts`: `dateToSortNum` / `itemDecade` / `groupByDecade` (shared with FeedView; a partial/blank `story_date` could mis-group, BUG-010 territory).
- `src/app/api/stories/route.ts`: the GET that feeds the community timeline; check its filter (visibility, community_id, pagination `.range`).
- The `/snowboarding` page that calls the timeline (`src/app/(community)/[community]/page.tsx` or the landing route) for any server-side story fetch / revalidate.

## Implementation (branch on the diagnosis)
- If cause 1: remove or neutralize the `community_id` filter on the community story read so public stories with null `community_id` are included; leave a `// Phase 2:` note that this re-enables once create stamps `community_id`.
- If cause 2: the story is genuinely not public; this is then a visibility-UI bug (the create/edit modal not persisting `visibility='public'`, or the label being wrong). Trace `visibility` through `AddStoryModal` -> `POST /api/stories` -> row. Fix the write path so a story marked public is stored public.
- If cause 3: add/adjust revalidation on the community landing after a story create (or confirm the client refetches).

## Acceptance criteria
- A public member story created on `/snowboarding/profile` appears in the `/snowboarding` community timeline in the right decade group, after a normal navigation / refresh.
- A private story does NOT appear on `/snowboarding`.
- No `community_id`-based filter silently drops member stories that have `community_id IS NULL`.
- `npx tsc --noEmit` clean.

## Notes
- Likely no migration. If the real fix is to start stamping `community_id` on create, that is a larger Phase 2 change; for this bug, prefer the no-filter path and keep create unchanged.
- If you touch a publicly-read column on `stories`, remember the `_public` view freeze rule (rebuild the matching `*_public` view). Diagnosis will tell you if that is in scope; it should not be for this bug.
- No em dashes. Append a `status: pending` SHIP-LOG entry naming BUG-043 before closing.
