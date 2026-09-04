# Bug-fix session brief: account cannot delete events from its timeline (BUG-148)

> Drafted by the July 5, 2026 daily triage. Self-contained. Diagnosis-first.
> **P1, HUMAN-RUN.** Touches a delete/write path and possibly RLS on read-back;
> not for the unattended auto-merge pipeline. Reproduce before changing code.
> Name the BUG id (BUG-148) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-148: A member reports their account is "in a weird state" and they cannot delete events from their timeline.** [P1] [reproducible] [diagnosis-first]

One-line goal: an owner can delete an event entry from their own timeline and it stays gone on refresh.

## IMPORTANT caveat (read first)

The reporter is the **cy_3 test account** (`R3`). cy_3 was **archived via PR #157** (`feat(admin) user archive`) at ~17:58 UTC on July 5, which is AFTER this 04:22 UTC report. Archival soft-hides the account (adds `profiles.is_archived = true`, drops it from `catalog.people`), so the account's live state is now NON-representative. Do two things before concluding:

1. Reproduce the "cannot delete an event" flow on a **normal, non-archived** member account. If it does not reproduce, the "weird state" was likely pre-archival test-data corruption on cy_3 specifically, and the fix is data cleanup, not code.
2. If it DOES reproduce on a normal account, it is a real delete-path bug; fix per below.

## Report (July 5, screenshot in Linestry Bug Attachments, worked from report text this run)

- BUG-148: 04:22 UTC, cy_3 (`R3`), iPad Safari 820x1048, `https://linestry.com/snowboarding/feed`. "My account here got in a weird state. I cannot delete events in my timeline." Screenshot `19f30838ee286b10__0__bug-screenshot.jpg`. Replay session `S-33`, offset 72s. A screen recording may also be in the Drive folder for manual review.

## Diagnosis pointers (checked against the live repo July 5)

1. Timeline entries render through `src/components/timeline/claim-card.tsx`. The owner-only delete menu calls `removeClaim(claim.id)` from the Zustand store (`useLineageStore`) at ~line 173 (the confirm-delete branch). "Events" on a personal timeline are event-typed claims (`competed_at` / `spectated_at` / `organized_at` etc.) and/or `riding_days` entries, not the catalog `events` rows.
2. Trace what `removeClaim` does: does it call a server route (`DELETE /api/claims/[id]`) and await it, or only mutate local state? If it only mutates local state, a refetch of `dbClaims` will resurrect the entry (the same class of bug as BUG-122 deleted-stories-reappear). Confirm the server actually deletes the underlying `claims` row for the owner.
3. RLS / ownership: `claims` deletes must be authorised for the owner. Check whether the delete goes through the service-role path (`getServiceClient()` after `requireAuth`) or a client anon path subject to RLS. A silent RLS refusal would present exactly as "delete does nothing."
4. "Weird state" hint: if cy_3 had orphaned or mis-owned rows (asserter/owner id mismatch, a known Lineage quirk), the delete predicate may not match. Query the affected rows by owner id and inspect `subject_id` / `asserted_by` / `created_by` for the id-vs-authuser confusion documented in `project_lineage_codebase_quirks`.

## Suggested order

1. Reproduce on a normal account (create an event claim on a fresh member timeline, delete it, refresh). If not reproducible, pivot to data cleanup on cy_3 and document; do not ship a code change.
2. If reproducible: confirm whether the delete reaches the server and removes the row; fix the store/route so the delete persists and survives a refetch.
3. Add the same read-back guard the deleted-stories fix used (do not re-surface a deleted row).

## Acceptance

- On a normal (non-archived) member account, deleting an event entry from the personal timeline removes it and it stays gone after a full reload.
- No regression to deleting story-linked or claim entries.
- `npx tsc --noEmit` clean. If the fix is code-only with no schema change, state "No migration this session"; if it needs a data cleanup on cy_3, surface that SQL separately.

## Standing rules

One PR, BUG-148 in the title. No em dashes anywhere. HUMAN-RUN (delete/write path, possible RLS). Run the full Ship sequence before wrapping. Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.

---

## DIAGNOSIS UPDATE (2026-07-28, attended session) — NOT cy_3 corruption; fold into BUG-151

Reproduced from prod data, and the "IMPORTANT caveat" above (archived-test-account data corruption) is WRONG. This is a real, general cross-member bug.

Root cause confirmed: the four undeletable rows on Cy 3's timeline have `subject_id = Cy 3 (3f8ef433)` but `asserted_by = CY 1 (499deddd)`. They were created by CY 1 adding connections ABOUT Cy 3 through the add-person-connections popover on Cy 3's profile (the BUG-151 mechanism). `POST /api/claims` sets `asserted_by = actor`, `subject_id = the other member`, and pairs a `tag_event` (subject Cy 3, asserter CY 1, source=member -> status `pending`, shown on the timeline under the permissive PB-009 default).

The failure: `src/components/timeline/claim-card.tsx` shows a "Remove" button whenever `isOwn` (viewing your own timeline as SUBJECT). It calls `removeClaim` -> `DELETE /api/claims/[id]`, which authorizes only the ASSERTER or an editor (`claim.asserted_by === user.id`). A subject-not-asserter always gets 403 -> rollback -> "Failed to delete claim." Presents exactly as "I cannot delete events in my timeline." Reproduces between ANY two real members, not just test accounts. `promoteGhostToAccount` and `POST /api/claims` are both correct; there is no id-drift bug in the standard flows.

Immediate workaround (works today): the subject removes these by DECLINING them at `/me/tags` (the PB-009 owner inbox) — which is what the timeline "Remove" should do for a claim you did not assert.

DECISION (Jay, 2026-07-28): do NOT ship BUG-148 in isolation. Fold it into the BUG-151 connection-popover session (`bugs/2026-07-09-connection-popover-token-farm.md`) so the removal model matches whatever BUG-151 decides for creation. Recommended fix shape for that session: when the viewer is subject-not-asserter, route the timeline "Remove" to a tag_event DECLINE (hide from the subject's timeline, preserve the asserter's claim), not a hard DELETE. No code shipped this session.
