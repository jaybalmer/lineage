# Bug-fix brief: "Entry #N on your timeline" celebration count does not reflect deletes

**Drafted:** June 24, 2026 (daily triage). **Scope:** BUG-104. **Priority:** P2.
**Run mode:** client-only, no migration; auto-merge eligible once the diagnosis below is confirmed.

---

## Goal

Make the post-add celebration card's "Entry #N on your timeline" count match the number of entries the timeline "All" filter shows for the owner, so deleting a claim is reflected and the celebration does not overstate the count.

---

## Symptom (reported + image-verified)

Cory (June 24, 02:13 UTC, `/people/cory_yip`, iPhone 414x376) reported that deleting a claim in his timeline is not reflected in the claim count shown in the add-claim popup. Screenshot `19ef767baf96263b__0__bug-screenshot.jpg`: the celebration card reads "RODE AT Mt. Washing... Resort ... Entry #8 on your timeline" while the timeline filter pills above read "All 6 / Places 4 / Riders 1". The celebration says #8; the timeline shows 6.

## DECISIONS (review before building)

- **D1. Which count is the source of truth?** Recommended default: the celebration "Entry #N" should match the **timeline "All" pill** count (the entries actually shown on the owner's timeline). Reconcile the celebration count to that same set rather than to raw `personClaims.length`.

## Verified facts (code-checked June 24)

- The stat string `Entry #${claimCount} on your timeline` is built in `src/components/profile/owner-timeline-panel.tsx` at lines 47, 62, 76 (the `getCelebrationForNewClaim` builder branches per predicate).
- `claimCount` is the `count` argument passed at line 468: `queueCelebration(getCelebrationForNewClaim(newClaim, count, catalog))`, where `count = personClaims.length` (line 436).
- `personClaims = allClaims.filter((c) => c.subject_id === activePersonId)` (line 413), and `allClaims = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)` (line 412). `getAllClaims` already excludes `deletedClaimIds`, so a delete should reduce `personClaims.length`.
- The likely mismatch is therefore NOT a stale delete but a **set mismatch**: `personClaims.length` counts every claim where the owner is the subject (including `rode_with` companion claims and any predicate the timeline "All" filter does not surface as a distinct entry), whereas the "All N" pill counts only the distinct visible timeline entries. After adds/deletes the two diverge (here 8 vs 6).

## Diagnosis-first step

Before editing, confirm the gap is a set mismatch, not a stale-after-delete bug:

1. Find where the timeline "All / Places / Boards / Riders" pill counts are computed (same panel or the `FeedView` it renders; grep `owner-timeline-panel.tsx` and `src/components/feed/feed-view.tsx` for the filter-count logic and the "All" label).
2. Compare that set to `personClaims` used for `count`. Identify what "All" excludes (companion `rode_with` claims, disabled/pending tags, non-timeline predicates) that `personClaims.length` includes.
3. Reconcile: pass the celebration the same count the "All" pill shows (e.g. the length of the filtered, deduped timeline-entry list), not raw `personClaims.length`.

## Acceptance criteria (BUG-104)

- After adding a claim, the celebration "Entry #N on your timeline" equals the timeline "All" filter count for the owner.
- Deleting a claim and adding another shows the corrected (not inflated) entry number.
- No off-by-companion-claim inflation (a single `rode_at ... with X` does not count as two timeline entries in the celebration if it counts as one in the "All" pill).
- Client-only; `npx tsc --noEmit` clean; no migration.

## Ship reminders

- Name BUG-104 in the PR title.
- Run the full Ship sequence; "No migration this session" stated explicitly.
- Append the SHIP-LOG entry (`type: bugfix`, `ids: BUG-104`, real PR number, `migration: none`, `status: merged` once Jay merges in-session).
- No em dashes anywhere.
