# Story Date Precision + Editor Date Fix (build brief)

> Staged July 30, 2026 (Cowork, Jay live). Quick-fix lead ahead of the larger
> "Suggest a correction" feature (not yet drafted; see §5).
> **Size: ~2 to 3 hr, single PR, one additive migration (HARD pre-merge gate, §6).**
> Pre-flight playbook applied (relevant subset of the 24 checks: schema introspection,
> code-path grep, component capability, surface-existence, lifecycle, terminology,
> migration-before-merge, view-rebuild check, dev-server source, copy prefs).

---

## 0. Origin and problem

Members are posting stories whose real date they do not know (example: Jay's brother
posted stories and asked in comments for help finding the dates). The Add Story modal
requires a full year + month + day, so these stories get saved with a placeholder or
today's date and render on the timeline as brand-new 2026 entries. Two fixes ship
together in this brief:

1. **Partial story dates.** A story can carry a year-only or year+month date, entered
   honestly, displayed honestly ("1998" or "Mar 1998"), and grouped in the right decade.
2. **Editor date fix.** An editor can repair the date on any story from the story card,
   without touching the author's words, photos, boards, or rider tags.

The fuller community mechanism (any member suggests a correction, owner approves,
tokens for accepted corrections) is a separate future brief and is out of scope here.

---

## 1. Prerequisites

- P1: pull latest `main`.
- P2: if building in a worktree, symlink `.env.local` from the parent repo.
- P3 (dev-server source): all smoke testing runs against the dev server started from
  the build directory (the worktree path if using one, otherwise `~/lineage`). Stop any
  pre-existing dev server first so port 3000 binds to the right instance.

---

## 2. DECISIONS (review before building; defaults are shippable)

- **D1. Data model: explicit `stories.date_precision` column** (`'day' | 'month' | 'year'`,
  default `'day'`), with `story_date` unchanged as `date NOT NULL` holding a padded
  anchor (year-only 1998 stores `1998-01-01`, month-only Mar 1998 stores `1998-03-01`).
  - Rejected alternative: no column, reusing the existing "day <= 1 displays as year"
    convention in `formatSmartDate`. Rejected because it cannot represent month
    precision, and a story genuinely dated Jan 1 or the 1st of a month would misrender.
- **D2. Editor affordance: a minimal "Fix date" menu item + small modal** (DateSelect +
  Save), not the full edit modal. Editors repair metadata; they do not edit testimony.
  Label: **"Fix date"** (editor repair verb; "Edit" stays the owner's verb, per the
  standing owner-vs-editor terminology rule).
- **D3. Owner UI: month and day become optional in the Add Story date picker.** Year
  stays required. Helper line under the picker: "Only the year is required. Add the
  month and day if you remember them." (No em dashes in any UI copy.)
- **D4. Display formats** (via `formatPartialDate` conventions): year → "1998",
  month → "Mar 1998", day → "15 Mar 1998".
- **D5. Full-date display style unifies on "15 Mar 1998"** (the events/claims style from
  `formatPartialDate`). Today's story cards render "Mar 15, 1998" via a local
  `toLocaleDateString` helper; this brief replaces that helper, so the day-precision
  format changes slightly. Accepted copy change; keeps one date style across the app.
- **D6. No backfill.** Existing rows grandfather as `'day'`, which is what they meant
  when saved. Mis-dated stories (the brother's) get repaired by hand post-ship using the
  new editor Fix date affordance; §9 includes a worklist query to find candidates.

---

## 3. Verified facts (provenance checked against the repo, July 30, 2026)

1. `stories.story_date` is `date NOT NULL` (`supabase/migrations/20260323000001_stories.sql:8`).
   Partial dates cannot be stored as text; hence the anchor + precision design.
2. `PATCH /api/stories` is **owner-only**: it 403s any non-author
   (`src/app/api/stories/route.ts:464`). Editors currently cannot fix anything.
3. `DELETE /api/stories` already has the moderator pattern to mirror: owner OR
   `profiles.is_editor` (NOT founding tier), with an audit prop `moderated: true`
   (`src/app/api/stories/route.ts:660` onward). Reuse this exact boundary.
4. `StoryCard` already computes `canModerate = !isOwn && !!membership?.is_editor` and
   shows the ⋯ menu for moderators (delete-only today)
   (`src/components/feed/story-card.tsx:54-60`). The Fix date item slots in there.
5. `DateSelect` (`src/components/ui/date-select.tsx`) is three native selects
   (Year / Month / Day) that emit `""` until all three parts are chosen. It has exactly
   ONE caller: `add-story-modal.tsx` (grep verified). Changing its contract is low-risk,
   but make partial emission opt-in via a prop so the contract change is explicit.
6. Two local copies of `formatStoryDate` exist and both use `toLocaleDateString`:
   `story-card.tsx:26` and `public-timeline.tsx:67`. Both would render a padded
   year-only anchor as "Jan 1, 1998" (wrong). Replace both with one shared
   precision-aware helper.
7. `formatPartialDate` in `src/lib/utils.ts:53` already formats "YYYY", "YYYY-MM",
   "YYYY-MM-DD" correctly. The new helper is a thin wrapper: trim the anchor string to
   the precision, then delegate.
8. Timeline grouping already pads partial dates (`dateToSortNum`,
   `src/lib/timeline-grouping.ts`, BUG-010), so padded anchors group and sort correctly
   with no changes. A year-only story sorts at Jan 1 of its year: accepted.
9. `GET /api/stories` selects `*` and `public-timeline-read.ts` `STORY_JOIN` selects `*`,
   so `date_precision` flows to every read surface with no select-list edits.
10. **There is NO `stories_public` view** (grep verified; also stated in
    `20260618000002_story_on_timeline.sql`). The view-rebuild rule (playbook check 24)
    does not apply. It DOES mean the migration gate below is the only deploy risk.
11. Surfaces that consume `story_date` but need NO change (audited): `feed-view.tsx` and
    `community-timeline.tsx` (sort only), `me/public-view` + `connection-derived.ts` +
    `brands/[slug]` (year extraction, padded anchors are fine), `api/me/tags/route.ts`
    (renders via `formatSmartDate`, which already collapses day 1 to year display).
12. Precedent for this exact shape of change: `20260618000002_story_on_timeline.sql`
    (additive stories column + modal control + API pass-through), shipped as PR #100.

---

## 4. Scope (three tasks)

### Task 1: schema, types, API pass-through

- New migration `supabase/migrations/20260730000001_story_date_precision.sql`:

  ```sql
  alter table stories
    add column date_precision text not null default 'day'
    check (date_precision in ('day','month','year'));
  ```

- `src/types/index.ts`: add `date_precision?: "day" | "month" | "year"` to `Story`
  (optional so pre-refresh clients and cached payloads stay valid).
- `POST /api/stories` + owner branch of `PATCH`: accept `date_precision` from the body,
  whitelist it to the three values, default `'day'`. Defensive normalization: when
  precision is `'year'` force the stored anchor to `YYYY-01-01`, when `'month'` to
  `YYYY-MM-01`, so display can trust the pair. `story_date` stays required (400 as today).
- Add `date_precision` to the `story_created` `captureServerEvent` props.

### Task 2: partial date entry (owner path)

- `DateSelect`: add an opt-in partial mode (e.g. `partial` prop + an
  `onPartialChange(value, precision)` callback, or equivalent; implementation latitude).
  Behavior in partial mode: emit as soon as a year is chosen; month and day optional;
  month without year still emits nothing. Emitted value is the padded anchor plus the
  derived precision (`year` / `month` / `day`).
- `add-story-modal.tsx`: use partial mode; hold `datePrecision` state; init from
  `editStory.date_precision` in edit mode. **Gotcha:** when editing a year-only story,
  the month/day selects must initialize EMPTY, not to the stored Jan 1 anchor. Trim the
  incoming value by precision before handing it to DateSelect (its `parse()` regex only
  matches full `YYYY-MM-DD`, so a trimmed "1998" naturally yields empty parts; verify).
- Validation copy: replace "Please set the story date: year, month, and day." with
  "Please set at least the year." Helper line per D3.
- Send `date_precision` in `commonFields` for both POST and PATCH.

### Task 3: precision-aware display + editor Fix date

- New shared helper in `src/lib/utils.ts`:

  ```ts
  export function formatStoryDate(dateStr: string, precision?: "day" | "month" | "year"): string {
    const trimmed = precision === "year" ? dateStr.slice(0, 4)
                  : precision === "month" ? dateStr.slice(0, 7)
                  : dateStr
    return formatPartialDate(trimmed)
  }
  ```

  Replace the local `formatStoryDate` copies in `story-card.tsx` and
  `public-timeline.tsx` with this helper, passing `story.date_precision`.
- `StoryCard` moderator menu: add **"Fix date"** above the existing delete item when
  `canModerate`. Opens a small modal: DateSelect in partial mode pre-filled from the
  story, Save + Cancel. On save, PATCH with `{ id, story_date, date_precision, moderator_fix: true }`
  (flag name is latitude), update `displayStory` locally, toast "Date updated."
- `PATCH /api/stories` moderator branch. After the ownership fetch: if the caller is not
  the author, check `profiles.is_editor` (mirror DELETE exactly; founding tier does NOT
  qualify). If editor: update ONLY `story_date`, `date_precision`, `updated_at`, fire a
  `captureServerEvent` (`story_date_fixed`, props `{ story_id, author_id, moderated: true }`),
  and **return immediately**. If not editor: 403 as today.

  > **CRITICAL:** the moderator branch must short-circuit BEFORE the photo delete,
  > `story_boards` wipe-and-rebuild, and the rider-diff block. The existing PATCH
  > defaults `board_ids = []` and `rider_ids = []` when absent from the body; letting a
  > date-only moderator payload fall through would DELETE every board link and flip
  > every rider tag_event to `disabled` (the PR #9 lifecycle machinery firing on a
  > payload that never contained riders). This is the one place this brief can corrupt
  > data. Place the early return right after the editor check.

---

## 5. Out of scope (hard line)

- The community "Suggest a correction" mechanism (any member proposes date/link/name
  fixes, owner approves via a PB-009-style pending flow, tokens on acceptance). Future
  brief; this quick fix must not grow into it.
- A "date unknown / help me date this" state with no year at all (would need the
  `NOT NULL` drop and an Unknown timeline bucket). A year is still required.
- Precision on claims (`approximate` already exists there) and riding days.
- Any backfill (D6). Event dates (already partial-capable via `formatPartialDate`).
- Comment-to-correction linking, edit history, revision diffs.

---

## 6. Migration and deploy order (HARD PRE-MERGE GATE)

The write path sends `date_precision` unconditionally once this code deploys, so per
the standing Group F rule: **apply the migration in Supabase BEFORE merging the PR.**
Merging first breaks EVERY story insert (PGRST204) until the column exists, exactly the
PR #58 incident. Surface the SQL in chat as a fenced block at ship time, wait for Jay
to confirm it ran, then merge. No `_public` view rebuild is needed (verified fact 10).

Rollback recipe: revert the PR; the column is additive and inert, safe to leave.

---

## 7. Suggested order

1. Migration file + types + API whitelist (Task 1). `tsc` clean checkpoint.
2. Shared `formatStoryDate` helper + swap both display call sites (Task 3a). Legacy
   stories still render correctly (precision undefined → full-date path).
3. DateSelect partial mode + modal wiring (Task 2).
4. PATCH moderator branch + StoryCard Fix date modal (Task 3b), last, since it depends
   on 1 and 3.
5. Smoke per §8, ship sequence per repo CLAUDE.md.

---

## 8. Acceptance criteria

1. `npx tsc --noEmit` clean.
2. New story with year only (e.g. 1998): saves; card shows "1998" on the profile
   timeline, community feed, stories index, and the public `/t/[slug]` timeline; groups
   under 1990s; sorts within the decade at Jan 1 1998.
3. New story with year + month: shows "Mar 1998". Full date: shows "15 Mar 1998" (D5).
4. Editing an existing full-date story without touching the date leaves `story_date`
   and `date_precision` unchanged. Editing a year-only story shows Year filled,
   Month/Day empty.
5. Editor viewing someone else's story: ⋯ menu shows "Fix date" and "Delete story".
   Fixing the date to 1997 (year precision) updates the card in place, and the story's
   photos, boards, rider tags, reactions, and comments are all intact afterward.
   **Test this on a story that HAS riders and boards.**
6. Owner's own menu is unchanged (Edit + Delete; no Fix date item).
7. Signed-in non-editor sends a moderator-shaped PATCH for someone else's story: 403.
8. POST with no `story_date`: 400, as today. POST with `date_precision: 'banana'`:
   rejected or coerced to `'day'`, never stored.
9. Pre-migration stories (all current prod rows) render exactly as before except the
   D5 style change ("Mar 15, 1998" becomes "15 Mar 1998").

---

## 9. SQL assertions and the repair worklist

Pre-deploy (run today; verified expectations against current prod schema):

```sql
select count(*) from information_schema.columns
where table_name = 'stories' and column_name = 'date_precision';
-- expect 0 before the migration, 1 after
```

Post-deploy:

```sql
select count(*) from stories
where date_precision not in ('day','month','year');
-- expect 0

select count(*) from stories where date_precision is null;
-- expect 0 (NOT NULL default backfills existing rows to 'day')
```

Repair worklist for Jay after ship (not an assertion; candidates whose date equals the
posting date, the "dated at post time" smell that started this brief):

```sql
select id, title, author_id, story_date, created_at::date as posted
from stories
where story_date = created_at::date
order by created_at desc;
```

Walk the list with the author (or fix as editor via the new affordance) and set real
years with year precision.

---

## 10. Gotchas recap

1. The PATCH moderator short-circuit (§4 Task 3) is the data-integrity risk. Early
   return before junction logic, no exceptions.
2. Migration before merge (§6). Hard gate.
3. DateSelect init-on-edit must respect precision or year-only stories will silently
   re-save as Jan 1 day-precision after an unrelated edit (lifecycle rule: state must
   survive edits it wasn't part of).
4. `formatSmartDate` (claims) and the new `formatStoryDate` coexist; do not merge them
   in this PR. `me/tags` keeps using `formatSmartDate` untouched.
5. No em dashes in any UI copy, code comments, or SHIP-LOG entry.
6. Ship sequence per repo CLAUDE.md: surface the migration SQL in chat, wait for
   apply confirmation, prompt for merge, then log `bugs/SHIP-LOG.md` with
   `type: feature`, `ids: none`, `scope: story-date-precision`, `migration:
   20260730000001_story_date_precision.sql`, `status: merged` once Jay confirms.
