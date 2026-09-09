# Bug-fix brief: private story vanishes from the author's own timeline and its edit page is blank

Date drafted: 2026-08-03 (daily triage)
Scope: **BUG-157** (P1, reproducible-ish, diagnosis-first, HUMAN-RUN, NOT for the autonomous pipeline)
Goal: an author who creates a private ("Only Me") story can still see it on their own timeline / stories after a refresh, and can open its edit form pre-populated (not blank).

## DECISIONS (review before building)

1. **Fix scope after diagnosis.** Recommended default: treat this as a read-path / owner-visibility bug first (confirm the row persisted, then make sure every owner surface that lists the author's own stories includes their non-public rows, and that the edit entry passes a fully-resolved story object). Only widen scope if the pre-flight SQL shows the row did not persist (then it becomes a write-path bug). Alternative: if SQL shows `author_id` does not equal the reporter's `profiles.id` (a person-node vs auth-user mismatch), the fix is the id resolution on the owner surface, not the visibility filter.
2. **The "showed up in Stories then gone" half.** Recommended default: this is partly expected. A private story is correctly absent from the PUBLIC `/stories` and `/snowboarding/feed` lists for everyone including, on those public-scoped fetches, the author. The bug to fix is that it is missing from the author's OWN timeline (`/people/[id]` owner view and `/me/*`), where `ownAuthorList` is supposed to include it. Do not make private stories public on the community feed.

## Report

- Reported: 2026-08-01 15:47 UTC by R1 (iPhone, iOS 18.7 Safari, viewport 414x750), from `https://linestry.com/snowboarding/feed`, 1 report.
- What they said: "Added a story. Set it to private. Once I saved it. It showed up in Stories area but when I leave stories and return, my story is not there. When I go to my timeline and try to edit that story, the edit story page is all blank." They expected the story to go to their timeline after saving (not appear in the Stories area first) and to be editable.
- Session replay: PostHog session `S-38`, offset 884s. Screenshot in Drive: `19fbe021d8d245f6__0__bug-screenshot.jpg` (JPG did not yield extractable text this triage run; open it manually for the exact blank-edit screen).
- Reporter note: `R1` is likely the same tester family as CY 2 (`R2`, BUG-153); confirm which `profiles.id` this address maps to before trusting any id-scoped conclusion.

## Two symptoms, one likely root

1. **Private story missing from the author's own timeline after refresh.** The GET `/api/stories` list path already has a BUG-106 branch that includes an author's non-public stories, but ONLY when `ownAuthorList` is true:
   - `src/app/api/stories/route.ts` computes `ownAuthorList = !storyId && !!viewerId && authorId === viewerId` and, when true, applies `query.or("visibility.eq.public,author_id.eq.${viewerId}")`. Otherwise the list stays `visibility = public` only.
   - The owner timeline fetch is `src/app/people/[id]/page.tsx:161`: `fetch(\`/api/stories?author_id=${resolvedId}&on_timeline=true&limit=100\`)`. For `ownAuthorList` to hold on this call, TWO things must be true: (a) `viewerId` resolves server-side from the request session, and (b) `resolvedId === viewerId`.
   - Failure modes to check: (a) mobile Safari session not sent / not resolved so `viewerId` is null (then private stories are filtered out for the owner too); (b) `resolvedId` (the person node the profile page resolved) is not equal to the reporter's auth `profiles.id` (PB-008 person-node vs auth-user), so `authorId !== viewerId` and the BUG-106 branch never fires; (c) the story was saved `on_timeline = false` (started-from-entity default) so it is excluded by the `on_timeline=true` filter and only reachable via the off-timeline / Contributions fetch at `page.tsx:174`.
2. **Blank edit form.** The only edit entry is `src/components/feed/story-card.tsx:288` (`editStory={displayStory}`). `AddStoryModal` populates its fields from `editStory?.title` / `?.body` / etc (`add-story-modal.tsx:58-108`). A fully blank edit form means the `editStory` object handed in had empty/undefined `title`/`body`, i.e. the surface opened edit on a partial or stale story record (plausible if the private story was dropped from the loaded set and only a skeleton remained). Confirm from the replay which surface the edit was opened from and what story object it held.

## Pre-flight prod SQL (run READ-ONLY first; do not mutate)

Resolve the reporter and inspect the story rows before deciding the fix. Replace the email if the mapping differs.

```sql
-- 1. Who is the reporter?
select id, display_name, node_status, created_at
from profiles
where lower(email) = 'R1';

-- 2. Their recent stories: visibility, on_timeline, author_id, body presence.
select id, title, (body is null or length(trim(body)) = 0) as body_empty,
       visibility, on_timeline, story_date, created_at, author_id
from stories
where author_id = (select id from profiles where lower(email) = 'R1')
order by created_at desc
limit 20;

-- 3. Any private stories where the author is NOT the row's author_id
--    (would indicate a person-node vs auth-user mismatch feeding the owner page).
--    Cross-check resolvedId used by /people/[id] against this id.
```

Interpretation:
- If row exists with `visibility='private'`, `on_timeline=true`, `body_empty=false`, `author_id = reporter id`: the write is fine; the bug is a read-path / `viewerId` or `resolvedId` mismatch on the owner surface (fix that, symptom 1), and the blank edit is downstream (fix the edit entry to only open on a resolved story).
- If `on_timeline=false`: partly working-as-designed (started-from-entity default); the story lives under Contributions, not the main timeline. Then the fix is UX (make it discoverable) plus the blank-edit guard, not a visibility change.
- If no row: the save failed; pivot to the POST path in `src/app/api/stories/route.ts:299+`.

## Suspected files

- `src/app/api/stories/route.ts` -- GET list `ownAuthorList` branch (lines ~82-96, 112-114); POST (~299-346); PATCH (~446-541). Stories has NO `_public` view; visibility is enforced in this route, so all reads must carry the session for `viewerId` to resolve.
- `src/app/people/[id]/page.tsx` -- owner timeline fetches (`:161` on-timeline, `:174` off-timeline); `resolvedId` vs `activePersonId`.
- `src/components/feed/story-card.tsx:288` -- the edit entry (`editStory={displayStory}`); guard against opening edit on a partial story.
- `src/components/ui/add-story-modal.tsx:58-108` -- edit-mode field population.

## Acceptance criteria (BUG-157)

- An author who creates a private, on-timeline story sees it on their OWN `/people/[id]` (and `/me/*`) timeline after a full refresh, while it stays hidden from other viewers and from the public feed / stories index.
- Opening edit on that story pre-populates title, body, date, visibility, photos and links (no blank form).
- If the story was on_timeline=false by design, it is discoverable on the Contributions section and still editable (no blank form).
- No regression to public-story visibility or to another member's inability to see private stories.

## DB / migration

Likely none (read-path / id-resolution / client-guard fix). If diagnosis points at a data repair (for example an `author_id` repoint or a `viewerId` RLS change), that is GATED: print the SQL, state the risk, and wait for Jay before applying. Stories has no `_public` view to rebuild.

## Ship reminders

- HUMAN-RUN, attended. NOT for the autonomous pipeline (read-path visibility + possible data touch).
- Name **BUG-157** in the PR title.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-157`, `migration: none` unless a GATED repair is applied).
- No em dashes anywhere.
