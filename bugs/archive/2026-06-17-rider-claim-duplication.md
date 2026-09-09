# Bug-fix brief: rode_with relationship model + write dedup + companion fold fix (BUG-066)

> Auto-drafted June 17 PM, then firmed up June 17 in a Cowork working session with Jay (full code trace + three design decisions). Reports: Cory (in6thgear, iPad, `/snowboarding/profile`, 04:37 UTC) and Jay (desktop, `/people/cy_2`, 04:38 UTC). Screenshot reviewed.
> HUMAN-RUN. Touches `claims` data, a migration, and a small backfill, so NOT auto-merge. One PR (plus the prod SQL run by Jay). Name BUG-066 in the PR title. NOTE: BUG-067 (compare "Unknown") is a SEPARATE rendering fix, not caused by this; do not conflate them.

## Decisions locked with Jay (June 17)
1. **Relationship model + write dedup** for `rode_with` (not display-only). One canonical "crew" relationship row per (subject, object), re-adding updates it (widen the year range) instead of inserting a duplicate. Mirrors the boards redesign (`owned_board` upsert).
2. **Keep both roles (place companions survive).** The per-place "rode with X" companion chips on place cards stay. To make that coexist with the deduped relationship row, companion edges become explicitly parented to their `rode_at` (see design), so they fold reliably and are excluded from the relationship dedup.

> **NO node merge (the original premise was wrong, confirmed June 17).** There is exactly one Cory (the profile `Cory Yip`, `499deddd-...`). `cy_2` is a SEPARATE real user account (profile `3a467197-...`, display_name "Cy 2", the in6thgear test account), not a duplicate Cory, so it must NOT be merged. BUG-067's compare "Unknown" is the genuine name-resolver gap and stays its own fix; it is not a node-duplication symptom.

## Why this is happening (root cause, traced June 17)
- The personal timeline folds companion `rode_with` rows into their `rode_at` place card via `groupRodeAtCompanions` (`src/lib/companion-grouping.ts`), keyed by `subject_id | start_date | end_date`. It only folds when EXACTLY ONE `rode_at` matches that key (line 47), and refuses to guess otherwise.
- Dates are **year-only** (`2026`). So every 2026 place visit collapses to the same key `Jay|2026|`. With 2+ `rode_at` in 2026, `matches.length > 1`, the fold gives up, and each companion `rode_with` Cory row leaks through as a bare standalone "Cory Yip / RODE WITH 2026" card. Five 2026 visits with Cory tagged => five duplicate Cory cards. `FeedView` renders survivors 1:1 with no collapse (`feed-view.tsx` line 163).
- **No write dedup:** `/api/claims` only upserts `owned_board` (lines 136-160). Every other predicate, including `rode_with`, plain-inserts, so genuine repeat tags also pile up.
## Confirmed against prod (June 17 working session)
Both failure modes are real, and the entire affected dataset is just two duplicate clusters:
- **Companion-edge leak (year collision):** Jay (`0394914d`) -> Sean Balmer (`06fc2b45`), `1986-01-01`: 3 `rode_at` that year + 3 `rode_with` Sean, all same year-only date. The fold sees 3 matching `rode_at`, refuses to guess, and leaks all 3 `rode_with` as standalone cards. Fixed by fold-by-parent.
- **Standalone duplicate adds:** "Cy 2" (`3a467197`) -> Cory Yip (`499deddd`), `2026-01-01`: 5 `rode_with`, ZERO `rode_at` that year. Pure standalone duplicates (the screenshot). Fixed by write-dedup.
- Everything else is `n=1` (fine). `cy_2` is the separate "Cy 2" account, not a Cory node (no merge).
- Schema facts learned: `claims.id` / `subject_id` / `object_id` are TEXT; `people.id` is TEXT (slugs); `profiles.id` / `auth.users.id` are UUID. Cast accordingly in any backfill SQL.

## Design (decided: relationship + parented companions)

### Schema
- Add `claims.parent_claim_id text null` (self-reference to a `rode_at` claim's id). NOTE the type is **text**, not uuid: `claims.id` is text (generated client-side as `claim_...`), `claims.subject_id`/`object_id` are text, and `people.id` is text (slugs like `cy_2`) while `profiles.id`/`auth.users.id` are uuid. Match `claims.id`'s type (text). A companion `rode_with` written from the Add-Claim "rode at <place> with <people>" flow sets `parent_claim_id` to its `rode_at` id. A standalone/crew `rode_with` has `parent_claim_id = NULL`.
  - This is the marker that splits the two roles cleanly and removes the year-only ambiguity from the fold (fold by the explicit parent link, not by date key).
- `rode_with` range: reuse existing `start_date` (earliest year together) and `end_date` (latest year). No new column needed for the range.
- Migration is PRE-MERGE-gated: the write path will send `parent_claim_id`, so the column must exist in prod before the PR merges (the Group F merge-before-migration lesson; same foot-gun as `board_relationship`).
- `claims_public` is defined `SELECT c.*` and Postgres FREEZES the column list at creation, so after adding `parent_claim_id` (a publicly-read column) rebuild it with `CREATE OR REPLACE VIEW` (the Group F `_public` view-freeze lesson). Same for any other `*_public` view over `claims`.

### Write path
- `src/components/ui/add-claim-modal.tsx` (~line 602, the `predicate === "rode_at"` companion branch): keep writing one `rode_with` per companion, but stamp `parent_claim_id = <the rode_at claim id>`. ALSO upsert the crew relationship row (see below) so the standalone "Rode with Cory" card and connection scoring stay correct.
- `/api/claims` (`src/app/api/claims/route.ts`): add an upsert block for `rode_with` **only when `parent_claim_id` is NULL** (the crew relationship). Mirror the `owned_board` block (lines 136-160): if a `rode_with` (subject, object, parent_claim_id IS NULL) exists, UPDATE it (widen `start_date`/`end_date` to span the new year) and return; else insert. Parented companion rows (`parent_claim_id` set) always insert (one per ride, they are the chip source).
- The standalone "Add Claim -> rode with <person>" path (the `people` predicate branch) writes a crew `rode_with` with `parent_claim_id = NULL`, which the upsert dedupes.

### Read / render path
- `src/lib/companion-grouping.ts`: fold companion `rode_with` into their `rode_at` by `parent_claim_id` (exact link) instead of the `subject|start|end` date key. This fixes the year-only collision: parented companions always fold, never leak as standalone cards. Keep a date-key fallback only for legacy rows whose `parent_claim_id` is NULL but that match a single rode_at (so un-backfilled rows still behave).
- `src/components/feed/feed-view.tsx`: the surviving standalone `rode_with` (crew rows, `parent_claim_id` NULL) render one card per person. Show the year range when `start_date != end_date` ("Rode with Cory, 2019 to 2026"); single year otherwise. Update the rode_with card copy and the `getCelebration` "rode_with" branch in `profile/page.tsx` (line ~79) if it shows a year.
- Connection scoring (`src/lib/connection-summary.ts`): direct `rode_with` is +8; counting one crew row per pair is correct. Confirm it dedupes object_ids (the connections page already does).

### Data migration / backfill (Jay runs in Supabase, in this order). NO merge step.
Only two clusters are affected (above), so this is small.
1. **Backfill `parent_claim_id`** on companion `rode_with`: where a `rode_with` matches exactly one `rode_at` on the date key, set its parent. For the Jay->Sean 1986 cluster the counts match (3 `rode_at`, 3 `rode_with`), so pair them one-to-one (each 1986 ride keeps Sean as a companion); when counts do not match and the year is ambiguous, DEFAULT = leave `parent_claim_id` NULL and let those collapse into the crew relationship row (acceptable: year-only data cannot attribute a companion to a single place). Cast ids to text in the SQL.
2. **Collapse standalone/crew duplicates:** for each (subject, object) with multiple `parent_claim_id IS NULL` `rode_with`, keep the earliest row, set `start_date = min`, `end_date = max`, delete the rest. This collapses the Cy 2 -> Cory 2026 cluster (5 -> 1). Delete or reconcile the paired `tag_events` for the removed rows first (they reference the claim; `claims_public` reads tag_event status, so do not leave a removed claim's tag_event flipping visibility).
3. **Rebuild `claims_public`** (and any other `claims` `_public` view) after the column add.

## Acceptance
- `/snowboarding/profile` and `/people/[id]` show ONE "Rode with Cory" entry (with a year range when spanning years), not five identical undated cards.
- Place cards still show their "with Cory" companion chips (parented companions fold reliably even with year-only dates).
- Re-adding a ride with Cory updates the crew relationship range, does not add a new standalone card.
- The two known clusters are resolved: Jay -> Sean 1986 folds into the place cards (companion chips), Cy 2 -> Cory 2026 collapses to one crew card with the year. No account merge happened ("Cy 2" stays a separate user).
- Connection scoring unchanged in spirit (one direct rode_with per pair). Desktop + mobile correct. `npx tsc --noEmit` clean.

## Suggested order
1. Confirm with the four SQL queries; share counts.
2. Migration: add `claims.parent_claim_id`, rebuild `claims_public`. Apply to prod BEFORE merge.
3. Write path: stamp `parent_claim_id` on companion rows; add the NULL-parent `rode_with` upsert in `/api/claims`.
4. Read path: fold by `parent_claim_id`; render the crew card with a range.
5. Data: backfill parents (Jay->Sean 1986), then collapse standalone dups (Cy 2 -> Cory 2026), then verify. No merge.
6. Re-test the screenshot scenario and a fresh "rode at 2 places in one year with the same person" case.

## Notes
HUMAN-RUN: migration + small backfill, not auto-merge. No account merge. Apply SQL yourself in the Supabase dashboard. Migration before PR merge; rebuild the `_public` view; handle paired `tag_events` on collapsed rows. One PR, BUG-066 in the title; append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
