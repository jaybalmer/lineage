# Brief: import the snowboard events catalog

Size: medium. One migration, one import script, one reconciliation pass, no UI work. Written against
the 24-check playbook; the relevant subset is Group A (1, 2, 3, 4), Group B (7, 9, 11), Group F (23).
Checks 5, 6, 8, 10, 12 to 22 and 24 do not apply and were not run, for the reasons in "Checks skipped".

## What this is

`data/events/v0.3/` holds a researched catalog of snowboard contests: 121 series, 615 editions and
3,915 podium results covering 1,623 riders, from the 1968 Snurfer contests to the 2026 Olympics. Every
row cites a source a research agent opened. It was built over three passes in one Cowork session, with
three adversarial QA passes. `data/events/v0.3/README.md` has the full provenance.

The point of it is member tagging. A member marks an edition they competed in, attended, worked,
filmed or watched, and their timeline gets a real date to sort on, without anyone typing an event name.

## Verified facts, with provenance

Read from the repo, not assumed:

1. `public.events` already exists and is central. `src/types/index.ts:403` defines `Event` with
   `id, name, start_date, end_date, event_type, place_id, series_id, year, external_ref, description,
   community_status, added_by, website_url`.
2. `public.event_series` already exists. `src/types/index.ts:391` defines `EventSeries` with
   `id, name, place_id, frequency, start_year, end_year, description, brand_ids`.
   `frequency` is the enum `"annual" | "tour" | "irregular"`.
3. `events.series_id` is already the FK to it (`src/types/index.ts:410`, comment `FK -> EventSeries`).
4. `event_type` is `"contest" | "film-shoot" | "trip" | "camp" | "gathering" | "episode"`
   (`src/types/index.ts:222`). Everything in this catalog is `contest`.
5. `community_status` is `"verified" | "unverified"` (`src/types/index.ts:5`).
6. A large ecosystem hangs off `events.id`: `story_events`, `tag_events`, `event_people`,
   `event_places`, `event_boards`, `event_orgs`, `event_guests`, `event_events`, `event_image_votes`,
   `place_event_images` (`supabase/migrations/20260319000004_place_event_images.sql:37`),
   `stories.linked_event_id` (`20260323000001_stories.sql:10`),
   `mentions.episode_event_id` (`20260731000001_mentions.sql:22`).
7. Partial dates are an existing pattern. `src/lib/utils.ts` `formatPartialDate` accepts `"YYYY"`,
   `"YYYY-MM"` and `"YYYY-MM-DD"` and renders `1986`, `Mar 1992`, `15 Mar 1992`;
   `formatEventDateRange` builds on it and is what the event page uses
   (`src/app/(community)/[community]/events/[id]/page.tsx:187`).
8. No `_public` view exists over events. `grep "create or replace view" supabase/migrations` returns
   nothing, so playbook check 24 does not apply.
9. There are no root-level migrations after `migration-013-token-earning.sql`, and the live migration
   folder is `supabase/migrations/` with dated filenames, most recent `20260906000001_merge_person_into.sql`.

**The events table predates `supabase/migrations/`**, so its DDL is not in the repo and the column list
above comes from the TypeScript type, not from the database. That is the one place this brief is
standing on a secondary source. Step 0 closes it.

## Step 0: close the schema gap. Nothing else runs first.

```
node scripts/export-events-tables.mjs
```

New, read-only, modelled on `scripts/export-catalog-tables.mjs` and using the same `.env.local`
fallback and service-role key. It writes `data/events/existing-event-series-export.csv`,
`data/events/existing-events-export.csv` and `data/events/schema-probe.json` (live column lists, row
counts and two sample rows per table).

I could not run it. The Cowork session that wrote this brief had no network route to Supabase, exactly
as `scripts/export-catalog-tables.mjs` describes for the catalog sessions. So:

- **Playbook check 9 (assertion precheck) is NOT satisfied.** No "expect 0" assertion in this brief has
  been run against prod. Run them after Step 0 and before the migration, and report anything non-zero
  instead of proceeding.
- **Playbook check 3 (data-quality question) is open.** After Step 0, answer these from the exports
  and tell Jay: how many `events` rows exist today; what shape `events.id` actually takes (slug, uuid
  or something else); whether `start_date` is `text` or `date`; how many existing events are
  `event_type='contest'`; and whether any existing event is already one of the 615 in the catalog.

`scripts/build-events-import.py` reads `schema-probe.json` and fails loudly if it would emit a column
the live table does not have. It prints a warning if the probe is missing. Do not import on a warning.

## Step 1: the shape of the import

`python3 scripts/build-events-import.py` maps the catalog onto the live schema and writes
`data/events/v0.3/import/`:

| Catalog | Live table | Count |
| --- | --- | --- |
| series.csv | `public.event_series` | 121 |
| editions.csv | `public.events`, `event_type='contest'` | 615 |
| results.csv | `public.event_results` (new) | 3,915 |

Mapping decisions already encoded in the script:

- `event_series.frequency`: catalog `tour-series` becomes `tour`, everything else `annual`. Nothing
  maps to `irregular`.
- `events.name` comes from the catalog's `edition_label` ("2003 US Open"), `events.year` from the
  calendar year, `events.description` from the catalog notes.
- `events.community_status`: `verified` where the catalog confidence is `verified`, else `unverified`.
  This reuses the existing enum rather than inventing a second trust signal.
- **Dates are written through as partial strings** (`1988`, `1990-02`, `2025-01-23`), because fact 7
  says the repo already renders those correctly with no UI change. 408 rows are day-precision, 26
  month, 181 year-only. If Step 0 shows `start_date` is a real `date` column, that is wrong: re-run
  with `--widen`, which widens to the first of the month or year and fills `date_precision`, and then
  every surface rendering `start_date` must branch on `date_precision` or it will state a day no
  source supports. Prefer the default.
- `external_ref` carries the catalog slug (`us-open-snowboarding--2003`) so a re-import is idempotent
  and traceable back to the research files.

## Step 2: reconcile before writing anything

**Do not run the import until this exists.** Linestry already has event records. The landing page
timeline uses 1986 Banff, the 2019 Baker Banked Slalom and 2021 CMH Heliskiing, and those rows may
carry stories, tags or claims. An import that duplicates them is worse than one that waits.

Match on series name plus year, never on ids. Normalise both sides the same way: lowercase, strip
punctuation, drop "snowboard", "snowboarding", "championships", "the", and expand the short forms
LBS = Legendary Banked Slalom, USO = US Open, WSSF = World Ski and Snowboard Festival,
X Games = Winter X Games, Worlds = World Championships.

Four buckets:

1. **MATCH**: an existing event corresponds to a catalog edition. Record the catalog slug against it.
   This mapping is what lets existing stories point at the catalog instead of a duplicate.
2. **CATALOG_ONLY**: the import. Most of the 615.
3. **EXISTING_ONLY**: scrutinise hardest. Either the research missed a real event, or the existing row
   was never verified. Flag `needs_source` where it carries none. A personal entry such as a heliski
   trip is `event_type='trip'`, not a contest, and correctly has no catalog match: mark it
   `not_a_contest` rather than treating it as a gap.
4. **FUZZY**: difflib ratio above 0.88, or one name contains the other. Show both. Never auto-merge.

Write `data/events/review/reconciliation.csv` (bucket, existing_id, existing_name, existing_year,
existing_source, catalog_slug, catalog_series, catalog_year, catalog_venue, catalog_confidence, note,
reviewer_decision blank) and `data/events/review/summary.md`. Put the logic in
`scripts/reconcile-events.py`, mirroring `scripts/reconcile-catalog.py`, so v0.4 can rerun it.

## Step 3: migrate, then import

`supabase/migrations/20260907000001_events_catalog.sql` is written and ready. It is entirely additive:
nullable columns on `event_series` and `events`, plus the new `event_results` table with a read-only
RLS policy. Nothing in it drops, renames or backfills.

Per playbook check 23, this migration must be applied to prod before any write path sends the new
columns. Nothing in this brief changes a write path, so ordinary sequencing is fine: apply, import,
then build UI in a later session.

Order:

1. Apply the migration.
2. Re-run `python3 scripts/build-events-import.py` and confirm the shape check now prints
   "every emitted column exists live".
3. Import `event_series`, then `events`, then `event_results`, in that order for the FKs. Upsert on
   `external_ref` for events and on the `event_results_slot_uniq` constraint for results, so a re-run
   updates instead of duplicating.
4. Run the assertions below.

## Assertions

**Pseudocode, verify before running.** These were written against the schema in this brief, not run
against prod (check 9). Each states its expected answer.

```sql
-- 121 / 615 / 3915
select (select count(*) from public.event_series where sources is not null) as catalog_series,
       (select count(*) from public.events where external_ref like '%--%' and event_type = 'contest') as catalog_events,
       (select count(*) from public.event_results) as results;

-- expect 0: every imported event points at a series that exists
select count(*) from public.events e
  left join public.event_series s on s.id = e.series_id
 where e.external_ref like '%--%' and s.id is null;

-- expect 0: every result points at an event that exists
select count(*) from public.event_results r
  left join public.events e on e.id = r.event_id where e.id is null;

-- expect 0: nothing imported without a source
select count(*) from public.event_results where coalesce(array_length(sources,1),0) = 0;

-- expect 0: an event that never happened should carry no podium
select count(*) from public.event_results r join public.events e on e.id = r.event_id
 where e.catalog_status in ('cancelled','postponed');

-- expect 0 NEW duplicates: re-run the whole import and diff these counts. They must not move.
```

`data/events/v0.3/db-standalone/verify.sql` has a fuller set that mostly ports over; it was dry-run
against a real Postgres 16, against the greenfield schema that folder documents.

## DECISIONS, with shippable defaults so this does not block on Jay

1. **`events.id` for imported rows.** Default: use the catalog slug as the id, since `events.id` is
   `text` and the slug is stable and human-readable. If Step 0 shows existing ids are uuids, switch to
   generating an id the same way the existing add-event path does and keep the slug in `external_ref`
   only. The import script writes both columns either way.
2. **Undated editions.** Default: import all 615 with partial dates. The alternative, holding back the
   181 year-only rows, would drop the US Open 1982 to 2001 and the older Mt Baker record, which is 949
   podium rows and the most valuable material in the catalog.
3. **Rider identity.** Default: `event_results.rider_name` is text and `person_id` stays null. Linking
   1,623 rider names to person nodes is its own session with its own disambiguation problem, and the
   column is there to receive it later. Do not attempt fuzzy person matching in this session.
4. **Tour-series season rows.** 34 editions are whole seasons keyed to the season-end year, so the 2001
   World Cup row starts in November 2000. Default: import them, but exclude `frequency='tour'` series
   from member tagging surfaces, because "I attended this" over a five-month multi-country row means
   little. Splitting them into stops is a v0.4 research question.
5. **Cancelled editions.** Default: import them. `catalog_status` carries `cancelled` and `postponed`
   with a sourced reason. "The year Baker got rained out" is itself a community memory and should
   render, not be filtered away.

## Out of scope, hard list

No UI work. No event page changes. No member_events or attendance-marking table: the tagging model
should reuse the existing claims and tag system rather than growing a parallel one, and deciding that
is a separate session. No rider-to-person linking. No touching existing event rows: the reconciliation
output is a review file, not a migration. No deleting anything.

## Rollback

The migration is additive, so rollback is a data question, not a schema one.

```sql
-- remove only what this import added; every row is identifiable by external_ref shape
delete from public.event_results
 where event_id in (select id from public.events where external_ref like '%--%');
delete from public.events where external_ref like '%--%' and event_type = 'contest';
delete from public.event_series where sources is not null;
```

Check the second and third statements against the reconciliation output first: if any MATCH row was
re-pointed at a catalog id, deleting it takes a real event with real stories attached. If the schema
itself needs to go: `drop table public.event_results;` and drop the added columns, which are all
nullable and unused by any code path until a later session builds one.

## Checks skipped, and why

5 (PostgREST views): no view is being repointed. 6 (forward-warning grep): no prior phase owns this
surface. 8 (lifecycle inventory): catalog reference data has no per-user lifecycle; the member-tagging
model that would is explicitly out of scope. 10, 12, 16, 18 (component, endpoint, status indicator,
helper output): no UI or endpoint in scope. 13 (orphan-auth): no cross-user feature. 14
(catalog-quality audit): the catalog's own QA is in `data/events/v0.3/README.md` and its three review
passes. 15 (terminology): no consent or moderation vocabulary involved. 17 (test scaffold): no prior
invariant collides. 19 (post-migration function check): no plpgsql function created. 20 (dev server):
no smoke test, nothing renders yet. 22 (premise verification): done, and it changed the brief. The
first version of this package created parallel `event_series` and `event_editions` tables. Reading
`src/types/index.ts` showed both already exist, which is why the import maps into them instead. That
superseded package is kept at `data/events/v0.3/db-standalone/` with a note explaining why.
21 (no em dashes): applied.

## What a v0.4 would bring

About 21 broken archive citations among the Mt Baker 2014, 2016 and 2018 division pages, plus the Dew
Tour citations, which are all missing an `/actionsports` path segment. US Open 1983 and 2009 podiums.
Mt Baker dates 1985 to 2005. Dew Tour 2008 to 2010 and 2016 to 2017. And 347 open questions across
`data/events/v0.3/review/`, several precise enough to put to the community directly.
