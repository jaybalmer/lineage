# Bug-fix session brief: feed claim delete fails and bounces back (BUG-153)

Date drafted: July 31, 2026
Scope: **BUG-153** (P1): a member cannot delete their claim from the Feed; the delete fails server-side and the claim is restored with the toast "Failed to delete claim. It has been restored."
Run mode: **HUMAN-RUN, diagnosis-first** (delete/write path plus a likely prod data read; NOT for the autonomous pipeline).
Estimated size: ~1.5 to 2.5 hr including the prod diagnosis.

---

## DECISIONS (review before building)

1. **UI gate alignment (recommended default: gate on asserter).** The feed shows the Delete menu when `claim.subject_id === activePersonId`, but `DELETE /api/claims/[id]` only admits `claim.asserted_by === user.id` (or an editor). Recommended: change the feed gate to asserter-or-editor so Delete only appears when it will succeed. For claims ABOUT you asserted by someone else, the correct removal path already exists (decline the tag at `/me/tags`, PB-009); optionally render a "Manage in your tags" hint instead of Delete on those cards. Alternative (NOT recommended without Jay): extend the DELETE route to admit the subject, which is a moderation-policy change (subject removal is supposed to flow through the tag decline cascade, not a hard row delete of someone else's assertion).
2. **Data repair for the stuck claim (recommended default: repair if it is a legacy-id mismatch).** If the prod read shows the claim's `asserted_by` holds a legacy person id (for example `cy_2` or a `person_*` id) or an orphan uuid for what is clearly the reporter's own self-reported claim, repoint `asserted_by` to the reporter's auth uuid with a one-off SQL (surface it in-session for Jay to run) so the owner can delete it. Alternative: delete the row directly as admin and skip the repair.

---

## The report

- Reported: July 31, 2026 03:00 UTC by R2 (the CY 2 test account; Cory), iPad Safari (viewport 1180x266), on `https://linestry.com/snowboarding/feed`.
- Words: "Cannot delete my claim that is stuck at the top of the Feed section."
- Screenshot (reviewed, Drive `19fb61e053cc9f18__0__bug-screenshot.jpg`): the feed shows a claim card "Cy 2 hit a place, Whistler Blackcomb, BC Canada, RODE AT, Self-reported" and the exact failure toast **"Failed to delete claim. It has been restored."** So the optimistic delete fired, the server rejected it, and the store rolled the claim back.
- Session replay: PostHog `S-37`, offset 259 seconds.
- "Stuck at the top": the feed defaults to the Recently added sort, so an undeletable claim pins there.
- Possible relative: BUG-148 (cy_3 could not delete events from the timeline, also reported from `/snowboarding/feed`). Same family of symptom; if the diagnosis here generalizes, note it on BUG-148 rather than expanding this session's scope.

## Verified facts (grepped against the live repo this run)

- `src/store/lineage-store.ts:461`: the rollback toast string. `removeClaim` (~line 438) optimistically removes, then calls `DELETE /api/claims/[id]`; on `!r.ok` or network error it restores the claim and shows the toast. The server's error body is logged to console as `[removeClaim] delete failed: <status>` but NOT surfaced in the toast, so the visible symptom is status-blind.
- `src/app/api/claims/[id]/route.ts` DELETE: `requireAuth()`, loads the claim, then `claim.asserted_by !== user.id` and not editor returns **403** "You can only delete claims you added." Missing row returns **404**. A DB error on the actual delete returns **400** with the Postgres message. On success it runs `disableClaimTagEventsForDeletion` and the BUG-103 token reversal.
- `src/app/(community)/[community]/feed/page.tsx:340`: `isOwn={entry.claim.subject_id === activePersonId}`, the subject-based gate.
- `src/components/feed/post-card.tsx:~779` (Delete button) and `:796` (`removeClaim(claim.id)` on confirm): the whole delete affordance hangs on `isOwn`.
- `POST /api/claims` (route.ts:213) stamps `asserted_by: user.id` (the session auth uuid) server-side since BUG-022, so RECENT self-created claims cannot mismatch. A mismatch means the row predates that path or came through FTUE/session-claim migration or a legacy backfill; `claims.asserted_by` is TEXT (not uuid), and legacy person ids plus orphan asserter uuids are a known prod pattern (PB-009 Phase 1 and Phase 3 feedback).
- The client HAS the data to gate correctly: the store reads `claims_public` with `select("*")` (lineage-store.ts:194), the view is `SELECT c.*` so it carries `asserted_by`, and the `Claim` type includes `asserted_by` (src/types/index.ts:507).

## Leading hypothesis

The DELETE returned 403: the claim's `asserted_by` does not equal CY 2's auth uuid even though the claim is about CY 2 (subject-based gate showed the menu; asserter-based route refused). Second candidates, in order: 404 (claim id not in `claims`, for example a mock/session id that never persisted) and 400 (Postgres error in the delete or the tag-event cascade).

## Pre-flight diagnosis (do FIRST, read-only prod SQL)

```sql
-- 1. Find the stuck claim (subject = the CY 2 person/profile id, object = Whistler Blackcomb)
select c.id, c.subject_id, c.asserted_by, c.predicate, c.object_id, c.object_type,
       c.confidence, c.visibility, c.tag_event_id, c.created_at
from claims c
where c.predicate = 'rode_at'
  and c.subject_id in (select id from profiles where email = 'R2'
                       union select id from people where display_name ilike 'Cy%2%')
order by c.created_at desc;

-- 2. The reporter's auth uuid, to compare against asserted_by
select id, email, display_name from profiles where email = 'R2';

-- 3. If asserted_by is a uuid but not the reporter: does it exist at all?
--    (orphan asserter check; substitute the value from query 1)
select id, email from profiles where id = '<asserted_by value>';
```

Decide the branch from what the row shows:
- `asserted_by` = legacy person id or orphan uuid on a self-reported claim: this is the 403 path. Fix the UI gate (below) AND surface the one-off repair SQL (`update claims set asserted_by = '<reporter auth uuid>' where id = '<claim id>';`) for Jay per Decision 2.
- `asserted_by` = a DIFFERENT real member: the gate mismatch is still the bug (Delete should never have been offered); fix the gate; the subject's removal path is `/me/tags` decline.
- No row found: 404 path; diagnose where the feed entry comes from (stale client cache is unlikely post PR #165 on stories, but claims have no no-store header; check `GET /api/claims` caching if the row truly does not exist).
- Row deletes fine as admin in SQL but the route 400s: read the Vercel log for the `[api/claims/[id]] delete failed:` message and follow the Postgres error (cascade or FK).

## The fix (on the recommended defaults)

1. `src/app/(community)/[community]/feed/page.tsx:340`: gate on asserter-or-editor, for example `isOwn={entry.claim.asserted_by === activePersonId}` (plus the existing editor affordances if any; check whether the feed passes `readOnly` for editors). Audit the OTHER `PostCard`/`ClaimCard` call sites listed by `grep -rn 'isOwn={' src/` for the same subject-vs-asserter confusion on claim cards (stories gate on `author_id`, which is correct and out of scope).
2. Optional per Decision 1: on feed claim cards where the viewer is the subject but not the asserter, replace the Delete menu item with a non-destructive "Manage in your tags" link to `/me/tags`.
3. Improve the failure toast in `removeClaim` (lineage-store.ts ~461) to distinguish 403 ("This claim was added by someone else. Manage it from your tags.") from generic failure, so the next report self-describes. Keep copy free of em dashes.
4. One-off data repair SQL surfaced in-session if the diagnosis says so (Decision 2). This is a data patch, not a migration file; no `_public` view change; no schema change.

## Acceptance criteria

- On the reporter's account, the stuck Whistler Blackcomb rode_at claim can be deleted from the feed (or, if the diagnosis shows it was never theirs, the Delete affordance no longer appears on it) and the feed stays clean on refresh.
- A self-created claim (created fresh via POST /api/claims) still shows Delete on the feed and deletes successfully, verified end-to-end.
- A claim about you asserted by another member no longer offers a Delete that bounces; on defaults it offers the tags path instead.
- No 403 rollback toast reproducible on any feed claim card for a normal member.
- `npx tsc --noEmit` clean.

## Session mechanics

- Name **BUG-153** in the PR title or commit message (the daily reconcile depends on it).
- One PR. Run the full Ship sequence (surface any one-off SQL in a fenced block, wait for Jay to run it, prompt the merge) before wrapping.
- Append a `status: pending` (or `merged` if Jay merges in-session) entry to `bugs/SHIP-LOG.md`.
- No migration expected. No em dashes anywhere.
