# Bug-fix brief: board "Add to timeline" creates duplicate owned_board claims

**Date:** September 9, 2026
**BUG ids in scope:** BUG-190 (P1)
**One-line goal:** Tapping "Add to timeline" on a board must create (or update) exactly one owned_board claim, no matter how fast or how many times the button is tapped.

---

## DECISIONS (review before building)

1. **Primary fix = client-side in-flight guard (recommended default).** Add a submitting guard so a single open of the board popover fires at most one write, and short-circuit when the member already has an owned_board claim for that board (route the re-add through the existing server upsert rather than a fresh insert). Client only, no migration, pipeline-safe.
   - Alternative: skip the client guard and rely only on a new DB unique constraint. Rejected as the primary because the constraint cannot be added until the existing duplicate rows are removed (see Decision 3), and the client guard is what the reporter actually hit.

2. **Keep the toast, do not add a blocking confirmation dialog (recommended default).** The reporter asked for "confirmation" on add. There is already a success toast ("Added to your timeline." / "Added to your collection."). A modal confirm on every add would slow the core loop. The real defect is the duplicates, not the lack of a dialog. Keep the toast; the guard makes the single add reliable.
   - Alternative: add a confirm step. Not recommended; adds friction to the primary contribution action.

3. **DB unique index + dedupe of existing rows = GATED follow-up, NOT in this PR's auto-merge path.** A partial unique index on claims (subject_id, object_id) WHERE predicate = 'owned_board' AND parent_claim_id IS NULL would make the server insert atomic and end the race for good. It cannot be created while duplicate rows exist, so it requires a dedupe DELETE first (destructive, touches existing rows = GATED). Recommended default: ship the client guard now (closes the reported path), and leave the unique index + dedupe as a separate gated step for Jay (SQL provided in section 6). Do not block this PR on it.

---

## Background and verified root cause

Report (BUG-190): "Somehow posted 10 times the same board." From R6, on `https://linestry.com/snowboarding/boards?brand=Winterstick`, viewport 375x348 (mobile Safari/CriOS on iPhone). Expected a confirmation when "add board" is clicked. Session replay: PostHog `S-59` (Sep 8, 13:42 UTC). No screenshot attached (text-only report).

Cause is verified end to end:

- The add action lives in `BoardActionsMenu.handleAdd()` at `src/app/(community)/[community]/boards/board-parts.tsx` (handleAdd starts ~line 244). It calls `addClaim({ id: generateClaimId(), ... predicate: "owned_board" ... })`, sets `justAdded`, fires a toast, and closes the popover after a 600ms `setTimeout`.
- There is **no in-flight guard**: the "Add to timeline" button (board-parts.tsx ~line 303, `onClick={handleAdd}`) is only `disabled={!rode && !own}`. Nothing disables it after the first tap, and nothing in `handleAdd` blocks re-entry. On a phone, rapid taps each fire a fresh `addClaim`, each with a new `generateClaimId()`.
- Each `addClaim` (store `src/store/lineage-store.ts:415`) issues its own `POST /api/claims` (lineage-store.ts ~line 468).
- The server route `src/app/api/claims/route.ts` DOES have an owned_board upsert backstop (route.ts:136-158): before inserting it looks for an existing owned_board row for that subject+object and UPDATEs it instead. **But it is a check-then-update, not atomic.** When N requests arrive concurrently (before any has committed its insert), each sees zero existing rows and each inserts. There is no DB unique constraint on (subject_id, object_id, predicate='owned_board') to stop it. Result: 10 taps during the race window = 10 rows.

So two gaps: the client lets many concurrent writes fire, and the server dedupe is not race-safe. The client guard closes the reported path; the DB constraint (Decision 3) closes the race permanently.

## Severity

P1. It is a core contribution flow (adding a board) producing duplicate public catalog claims, i.e. bad data, not just a cosmetic glitch. A workaround exists only in the sense that a human can delete the extras, so it is not P0, but it corrupts the catalog on a primary action and a real early user hit it.

---

## Suspected files / components / routes (verified against tip f0cc660)

- `src/app/(community)/[community]/boards/board-parts.tsx`: `BoardActionsMenu` component; `handleAdd` (~line 244) and the "Add to timeline" button (~line 303). PRIMARY fix surface.
- `src/store/lineage-store.ts:415`: `addClaim`, which POSTs to `/api/claims`. No change required if the guard is at the button, but confirm `addClaim` returns/await semantics if you choose to guard on resolution.
- `src/app/api/claims/route.ts:136-158`: existing owned_board check-then-update backstop. Relevant to Decision 3 (make it an upsert on the unique index) if the gated follow-up is taken; no required change for the primary PR.
- `src/components/ui/quick-claim-popover.tsx`: the other surface that writes claims from a popover (predicate list at line 11 includes owned_board). Check whether the same rapid-tap gap exists here (its Add button is `disabled={!canAdd}` at line 209). If it has no in-flight guard either, apply the same guard for consistency; note it in the PR but it is not the reported surface.

---

## Acceptance criteria (BUG-190)

1. On `/snowboarding/boards` (any brand filter), tapping "Add to timeline" many times in rapid succession on a mobile viewport results in exactly ONE owned_board claim for that member+board, verified in the DB.
2. If the member already has an owned_board claim for that board, re-adding updates that single claim (widens relationship rode/own) rather than creating a second row. The button should already reflect the claimed state (the `claimed` check at board-parts.tsx:229), but the guard must hold even if state has not yet re-rendered.
3. The success toast still fires once. No blocking dialog added.
4. `npx tsc --noEmit` clean.
5. No regression to the normal single-tap add on desktop or the BoardShelf relationship badges.

---

## Suggested implementation order

1. In `BoardActionsMenu`, add a `submittingRef` (useRef) or `submitting` state. At the top of `handleAdd`, return early if `submittingRef.current` is true or if `existing` is already set. Set it true before `addClaim`, and clear it after the popover closes (or leave it set, since the popover closes and the component reflects `claimed`).
2. Also set the button `disabled` to include the submitting state so it visually locks after the first tap.
3. If `addClaim` can be awaited, prefer awaiting the POST before clearing the guard; if it is fire-and-forget, the ref guard plus the `existing` short-circuit is sufficient for the reported path.
4. Check `quick-claim-popover.tsx` for the same gap and apply the same guard if present.
5. `npx tsc --noEmit`, smoke on a narrow viewport (repeatedly click the add button fast) and confirm one row is written.

---

## Section 6: GATED follow-up (do NOT bundle into the auto-merge PR)

These steps touch existing rows and are destructive, so they wait for Jay.

**a. Clean up the existing duplicate Winterstick rows** (and any other owned_board duplicates). First inspect:

```sql
-- Find duplicate owned_board claims (same member + board), newest-first
select subject_id, object_id, count(*) as n, array_agg(id order by created_at desc) as ids
from claims
where predicate = 'owned_board' and parent_claim_id is null
group by subject_id, object_id
having count(*) > 1
order by n desc;
```

Then, after Jay confirms, keep the newest per group and delete the rest (GATED, deletes existing rows):

```sql
-- GATED: keep the newest owned_board claim per (subject, board), delete older dupes
delete from claims c
using (
  select id,
         row_number() over (partition by subject_id, object_id order by created_at desc) as rn
  from claims
  where predicate = 'owned_board' and parent_claim_id is null
) d
where c.id = d.id and d.rn > 1;
```

Note: paired tag_events and any `claims_public` read path follow the underlying `claims` rows; confirm no orphaned tag_events remain after the delete (the DELETE /api/claims path normally handles tag_event cleanup, but a raw SQL delete does not, so check `tag_events` for rows whose claim is gone).

**b. Atomic constraint (optional, after dedupe):**

```sql
-- Additive, but FAILS if duplicates still exist, so run AFTER step a
create unique index concurrently if not exists claims_owned_board_uniq
  on claims (subject_id, object_id)
  where predicate = 'owned_board' and parent_claim_id is null;
```

If the index is added, change the server insert in `route.ts` to an upsert `onConflict` so the race resolves in the database rather than in application code.

---

## Wrap reminders

- Name BUG-190 in the PR title / commit message so the daily triage reconcile can close it.
- Append a `bugs/SHIP-LOG.md` entry: `type: bugfix`, `ids: BUG-190`, the PR number, `migration: none` (the client-guard PR carries no migration; the gated dedupe + index is a separate step, record it as DEFERRED if not done), `status:` per what actually shipped.
- No em dashes anywhere.
- The client-guard PR is PIPELINE-SAFE (client only, no migration, no auth, no payments) and auto-merge eligible. The section 6 work is GATED and waits for Jay.
