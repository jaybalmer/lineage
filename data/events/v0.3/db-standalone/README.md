# Import package for the Linestry events catalog

Everything Claude Code needs to put the catalog into Supabase. All of it was dry-run against a real
Postgres 16 instance before shipping, twice, to prove it is idempotent.

| File | What it is |
| --- | --- |
| `0001_events_catalog.sql` | The migration. Creates five tables, indexes and RLS policies. Safe to re-run. |
| `build_seed.py` | Regenerates `events_seed.sql` from the CSVs. Run it after any catalog change. |
| `events_seed.sql` | 4.5 MB of `insert ... on conflict do update`. Safe to re-run; never deletes. |
| `verify.sql` | Post-import checks, each with its expected answer written next to it. |

## Run order

```
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 0001_events_catalog.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f events_seed.sql
psql "$DATABASE_URL" -f verify.sql
```

Expected after seeding: 121 series, 615 editions, 3,915 results, 434 dated editions, 311 editions
with a podium, zero orphans, zero rows without a source.

## Three things that were fixed by dry-running this

They are recorded here because each would have failed in production, and each is a trap the next
schema in this repo could hit too.

1. **`placing` is a reserved word in Postgres.** The member attachment column is `finish_place`.
2. **`NULLS NOT DISTINCT` is load-bearing on the results uniqueness constraint.** `division_label` and
   `event_name` are null on most rows, and under default SQL null semantics every re-seed inserted a
   full duplicate set rather than updating. The first idempotency test produced 7,009 rows from 3,915.
   This needs Postgres 15 or later, which Supabase is.
3. **Partial dates were being silently dropped.** 26 editions are known only to the month or the year.
   Those now widen to the first of the month or year and record `date_precision`, so the UI can render
   "February 1996" instead of either a false exact date or nothing.

## Conventions the UI needs to respect

- **`year` is the calendar year the event was held, never the season.** Tour series are the exception
  and are modelled one row per season keyed to the season-end year, so the 2001 World Cup row starts
  in November 2000. `verify.sql` excludes them from its date check for that reason.
- **`date_precision`** says how much of `start_date` to show. Rendering a `month`-precision row as an
  exact day is a fabrication.
- **`confidence`** is about sourcing, not certainty of the fact. `likely` means one secondary source.
- **`citation_status`** is about the link, not the value. `pending-recheck` rows had their value
  verified against the archived page but their snapshot URL has not been confirmed to resolve.
  Consider rendering those without a hyperlink until the repair pass finishes.
- **Division is stored three ways on purpose.** `division_label` is the source's exact wording and is
  what a rider will recognise ("GRAND MASTERS - ages 50-59"). `division_gender` and `division_class`
  are the normalised pair to filter and group on. `division_gender = 'unspecified'` is a real value,
  used where the source runs one ungendered field, not a gap to fill in.
