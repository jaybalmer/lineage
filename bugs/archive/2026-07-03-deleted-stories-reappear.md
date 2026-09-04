# Bug-fix session brief: deleted stories reappear on the author's timeline (BUG-122)

> Drafted by the July 3, 2026 daily triage. Self-contained.
> **P1. HUMAN-RUN, diagnosis-first. Data integrity.** Do NOT hand this to the autonomous
> auto-merge pipeline: the fix may involve deleting rows in prod and touches the read
> path PR #136 changed. Run it as an attended Claude Code session with Jay.
> Name the BUG id (BUG-122) in the PR title or commit message. Append a
> `status: pending` SHIP-LOG entry before wrapping (schema at the top of bugs/SHIP-LOG.md).

## Scope

- **BUG-122: Old stories the author deleted weeks ago have reappeared on their timeline.** [P1] [reproducible on Cory's account]

One-line goal: find out why stories Cory deleted in June are visible again on `/people/cory_yip`, remove them again (with his confirmation), and fix the path that resurrected them so a delete stays deleted.

## DECISIONS (review before building)

No product decisions. One operational decision inside the session: once the resurfaced stories are identified, confirm with Jay/Cory WHICH stories should be gone before deleting anything in prod. Do not bulk-delete on a guess.

## The report

- July 3, 2026 02:40 UTC, Cory (R1), iPhone Safari 414x750, from `https://linestry.com/people/cory_yip`.
- "I am not sure what I did but my old stories I deleted a few weeks ago have reappeared in my timeline again."
- Screenshot `19f25d9402dea127__0__bug-screenshot.jpg` (Linestry Bug Attachments, reviewed): Cory's own timeline, 1960s decade group, story "Life in the 60's" (STORY, Jan 31, 1960, "Cold and foggy but we ride on!") with linked entities Panorama Mountain Resort, Mt. Seymour Banked Slalom 2008, Salomon Snowboards, Cy 2, Nitro Fusion '89, and an Edit story affordance (so he is viewing as owner). This looks like one of his early test stories.
- Session replay: PostHog session `S-25`, offset 3617 seconds.

## Verified facts (checked against the live repo July 3)

1. `GET /api/stories` list branch, `src/app/api/stories/route.ts` (~lines 74-91): when an author requests their own authored list (`?author_id` == viewer), the query becomes `query.or("visibility.eq.public,author_id.eq.<viewer>")`, i.e. it returns EVERY story row with that author_id regardless of visibility. This own-author branch was added June 29 by **PR #136** (the BUG-106 fix that keeps an author's "Only Me" story on their own timeline).
2. Timing fits: Cory deleted the stories "a few weeks ago" (mid June); PR #136 merged June 29; he noticed the reappearance July 2/3. If his June "delete" ever left rows in the DB in a non-public state instead of removing them, PR #136 is exactly the change that would resurface them to him (and only to him, as owner).
3. The story delete path lives under `src/app/api/stories/[id]/` (owner delete from the StoryCard "..." menu). PB-009 adds a pre-delete lifecycle flip on story DELETE (tag_events to `disabled`, PR #9, May 13). Cory also reported through June that the report/action popups sometimes did not register taps on mobile (BUG-071), so a silently failed delete is plausible.
4. Cory's session in June included the moderator-delete feature window (PR #129) and the June 25 story surfaces work; any of these could have changed what his timeline fetch includes.

## Diagnosis plan (do this before touching code)

1. Pre-flight SQL against prod (read-only) to establish ground truth:

```sql
-- All of Cory's authored stories with lifecycle fields
select id, title, story_date, visibility, on_timeline, created_at
from stories
where author_id = (select id from profiles where display_name = 'Cory Yip')
order by created_at;
```

Look at the rows he says he deleted (the 1960s test stories):
   - If the rows are PRESENT: the June delete never removed them server-side. Determine what state they are in (`visibility`, `on_timeline`) and why the pre-PR-#136 read hid them. Root cause is then a silently failing delete path (client or API), and PR #136 merely exposed the latent rows.
   - If the rows are ABSENT but he still sees them: the resurrection is client-side (stale Zustand `lineage-store-v2` localStorage or a cache); reproduce on his account/device profile and fix the merge in `getAllClaims`/story state.
2. Check the DELETE handler in `src/app/api/stories/[id]/route.ts`: confirm it hard-deletes, verify auth guard, and verify the client actually calls it (grep the StoryCard delete flow for the endpoint and error handling; a swallowed non-2xx that still removes the card from local state would look exactly like this).
3. Watch the PostHog replay for the June delete if findable, and the July 3 session (offset 3617s) to see what he saw.

## Fix shape (after diagnosis)

- If the delete path can fail silently: surface the failure (toast on non-2xx, keep the card until the server confirms) and fix the failure itself.
- If rows are latent DB leftovers: delete the confirmed rows (with Jay/Cory sign-off, listing ids first), and decide whether the own-author `.or()` branch needs a guard. Do NOT revert PR #136; the BUG-106 behavior (own private stories visible to the owner) is intended.
- No migration expected. If any data cleanup SQL is run, print it in the session per the Ship sequence.

## Acceptance

- The specific resurfaced stories Cory named are gone from his timeline (and stay gone after reload and re-login).
- Deleting a story as its author removes the DB row (or verifiably errors to the user); it does not just hide the card locally.
- An author's intentional "Only Me" stories still show on their own timeline (BUG-106 stays fixed; re-run its acceptance: private story visible to owner on `/people/<own-slug>`, hidden from others).
- `npx tsc --noEmit` clean.

## Standing rules

One PR, BUG-122 in the title. No em dashes anywhere. Run the full Ship sequence (surface any cleanup SQL, wait for apply, prompt the merge) before wrapping. Append the SHIP-LOG entry.
