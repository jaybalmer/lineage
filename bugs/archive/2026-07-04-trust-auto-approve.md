# Bug-fix session brief: Trust does not auto-approve a trusted asserter's future tags (BUG-138)

> Drafted by the July 4, 2026 daily triage. Self-contained. Diagnosis-first.
> **P1, HUMAN-RUN.** Touches the PB-009 moderation pipeline and subject-scoped
> `tag_events` status writes. NOT auto-merge. No migration expected (tables + columns
> already exist), but confirm before wrapping.
> Name the BUG id (BUG-138) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-138: Adding an asserter as "Trusted" does not auto-approve their tags going forward; a trusted user's new tag still lands `pending` in the owner inbox.** [P1] [reproducible] [diagnosis-first]

One-line goal: make "trust" mean what the UI promises. A tag asserted by a trusted asserter against a subject who trusts them should not sit in the subject's approval inbox.

## DECISION (review before building)

1. Behavior of trust on FUTURE tags. Recommended: at tag-event insert time, if the subject trusts the asserter (`tag_trust` row with `subject_id = <tag subject>`, `trusted_asserter_id = <asserter>`), write the tag `status = 'approved'` (with `decision_by = subject_id`, `decision_at = now`) instead of `'pending'`. Alternative: leave the insert as pending and add a post-insert sweep; more code, same effect, so not preferred.
2. Retroactive flip on trust toggle. The trust POST already auto-approves EXISTING pending tags from the asserter (`/api/me/trust` lines 75-85), so no change needed there IF diagnosis confirms it is firing. Recommended: keep it; just add the forward-looking insert-time check so newly arriving tags also skip the inbox.

## Report (July 4, screenshot in Linestry Bug Attachments, not opened this run)

- BUG-138: 04:07 UTC, Cory as CY 2 (R2), iPad Safari 820x769, `https://linestry.com/me/settings/trust`. "I have added Cory Yip as trusted but I still got a pending tag from Cory in my inbox and it was not skipped to be auto approved." Screenshot `19f2b4f9d7587557__0__bug-screenshot.jpg`. Replay session `S-29`, offset 1994s.

## Verified facts (checked against the live repo July 4)

1. `tag_trust` exists (migration `20260513000002_pb009_blocklist_trust_throttle.sql`), keyed `(subject_id, trusted_asserter_id)` with a UNIQUE constraint and a `(subject_id, trusted_asserter_id)` lookup index. Managed by `src/app/api/me/trust/route.ts` (POST trust, GET list) and `src/app/api/me/trust/[asserterId]/route.ts` (DELETE).
2. **The trust POST auto-approves EXISTING pending tags** from the asserter: `src/app/api/me/trust/route.ts:75-85` runs `update tag_events set status='approved', decision_by=user.id, decision_at=now where subject_id=user.id and asserter_id=asserterId and status='pending'`. So trust is retroactive only.
3. **The tag-event INSERT path never consults `tag_trust`.** `defaultStatusForSource(source)` in `src/lib/tag-events.ts:100-107` keys ONLY on `source` and always returns `'pending'` for `source='member'`. `insertTagEvent()` (`src/lib/tag-events.ts:168+`) calls it and writes that status with no subject/asserter trust lookup. The pair helpers `pairStoryRiderTagEvents()` (~line 251) and `pairClaimTagEvents()` (~line 312) run the same path. So a NEW member tag from a trusted asserter lands `pending` again, which is exactly Cory's report (he trusted Cory, then a subsequent tag arrived pending).
4. Visibility vs inbox: per codebase `CLAUDE.md` gotcha #10, member tags are `pending` at insert and the `_public` views show them anyway unless the subject set `profiles.require_tag_approval = true`. CY 2 evidently has approval on (that is why the tag reached the inbox). Trust is the mechanism to let specific asserters skip that inbox; today it only does so retroactively.
5. **Diagnosis to confirm before coding (two candidate causes, both plausible, fix both if present):**
   - (a) Forward gap (primary): the insert path does not check trust, so new tags land pending. Fix in the insert path.
   - (b) Asserter-id mismatch: two Cory person nodes exist (`cory_yip`, `cy_2`). The retroactive approve and any insert-time check match on `asserter_id`. If the incoming tag's `asserter_id` is a different node than the trusted id, the check misses. Verify the trusted `trusted_asserter_id` equals the `asserter_id` stamped on the pending tag (SQL below). If they differ, that is a node-identity issue, not just the forward gap.

## Suggested implementation (after diagnosis)

1. Add a trust lookup to the insert path. Give `insertTagEvent` (and therefore the pair helpers, which already pass subject + asserter) a check: before setting status, if `source === 'member'` and a `tag_trust` row exists for `(subject_id = input.subjectId, trusted_asserter_id = input.asserterId)`, set `status = 'approved'`, `decision_by = subjectId`, `decision_at = now`, `expires_at = null` (mirror the approved-row shape already at lines 173-190). Keep the source-keyed default for everyone else.
   - Note the extra read per insert. It is subject+asserter-scoped and indexed (`tag_trust_lookup`), so cheap. If you prefer to avoid a read on every insert, gate it behind `source === 'member'` only (editor/system/public already resolve without it).
2. Leave the retroactive approve in the trust POST as is (it is the correct behavior for tags that predate the trust).
3. If diagnosis (b) shows an asserter-node mismatch, capture it as a separate follow-up (do not expand this PR into node-merge work); note it for Jay.

## Pre-flight SQL (run in Supabase to ground the diagnosis before coding)

```sql
-- Is the trust row present, and does its asserter id match the pending tag's asserter?
-- Replace the subject/asserter display names as needed.
select tt.subject_id, tt.trusted_asserter_id, p.display_name as trusted_name
from tag_trust tt
left join profiles p on p.id = tt.trusted_asserter_id
where tt.subject_id = (select id from profiles where display_name ilike '%CY 2%' or display_name ilike '%cy_2%' limit 1);

-- Pending tags currently in CY 2's inbox and who asserted them
select te.id, te.subject_id, te.asserter_id, pa.display_name as asserter_name, te.status, te.source, te.created_at
from tag_events te
left join profiles pa on pa.id = te.asserter_id
where te.subject_id = (select id from profiles where display_name ilike '%CY 2%' or display_name ilike '%cy_2%' limit 1)
  and te.status = 'pending'
order by te.created_at desc;
```

If a pending row's `asserter_id` matches a `trusted_asserter_id` in the first query, cause (a) is confirmed (forward gap). If it does not match but is clearly the same human (a second Cory node), cause (b) is also in play.

## Acceptance

- BUG-138: with subject S trusting asserter A, a NEW member tag asserted by A against S is created `status='approved'` and does NOT appear in S's `/me/tags` pending inbox. Untrusted asserters still land `pending`. Existing retroactive-approve-on-trust behavior still works. Owners can still decline any tag. No regression to the permissive `_public` visibility rule (grandfathered / non-approval-gated behavior unchanged).
- If a node-identity mismatch is found, it is documented as a follow-up, not silently left.
- `npx tsc --noEmit` clean. Confirm no migration is needed (expected: none); if diagnosis forces a schema touch, surface it as copy-paste SQL in the Ship sequence.

## Standing rules

One PR, the BUG id in the title. HUMAN-RUN: do not auto-merge. No em dashes anywhere. Run the full Ship sequence before wrapping (state "No migration this session" if none). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
