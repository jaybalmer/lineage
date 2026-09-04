# Refreshing the live catalog export

A research session (Cowork, or anything driving the browser) has **no network route
to Supabase**. It reads whatever CSV is sitting in `data/catalog/`. If that file is
stale, every reconciliation number computed from it is wrong and nothing complains.

That already bit us once: a Sep 2 export showing 97 boards was read as the live state
after the v0.2 research had been merged and the table actually held ~1,870. The
reconcile reported 3,071 rows as new additions when the true delta was closer to 1,286.

So: **refresh the export before any reconcile, and check the date stamp.**

## The one command

From the repo root, in a session that has network (Claude Code on the laptop, or you
in a terminal):

```
node scripts/export-catalog-tables.mjs
```

That writes four files into `data/catalog/`:

| File | What it is |
|---|---|
| `existing-boards-export.csv` | every row of `boards`, full columns |
| `existing-brands-export.csv` | every `orgs` row where `org_type = 'brand'` |
| `existing-export-supabase.csv` | the flat `brand,model,first_year,source` shape the reconcile script reads |
| `existing-export.EXPORTED-AT` | ISO timestamp plus row counts |

Then reconcile:

```
python3 scripts/reconcile-catalog.py --existing data/catalog/existing-export-supabase.csv
```

The script is read-only. It issues SELECTs and nothing else. It reads
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment,
falling back to `.env.local`, the same way `import-mentions.mjs` and
`backfill-public-slug.mjs` do.

It pages in blocks of 1,000. That matters: a plain `select("*")` is capped and will
quietly hand back a truncated table as though it were complete, which is one way an
export goes stale-looking without anyone touching it.

## Doing it by hand instead

Supabase dashboard, SQL editor, run each and use "Download CSV":

```sql
select id, brand, model, model_year, shape, image_url,
       external_ref, community_status, added_by, created_at
from boards
order by brand, model, model_year;
```

```sql
select id, name, org_type, brand_category, founded_year, country,
       website, community_status, added_by, created_at
from orgs
where org_type = 'brand'
order by name;
```

Save them as `data/catalog/existing-boards-export.csv` and
`data/catalog/existing-brands-export.csv`, then run the export script with no network
needed, or rebuild the flat file yourself. The dashboard route is the fallback; it is
easy to forget a step and it leaves no timestamp.

## Sanity check before trusting an export

- `existing-export.EXPORTED-AT` is from today, or from after the last merge.
- Board count is in the ballpark you expect. If it reads a few dozen when you expect
  thousands, you are looking at a truncated or ancient file.
- `data/catalog/existing-export.csv` is a **different thing**: the small demo baseline
  derived from `src/lib/mock-data.ts`. Do not reconcile against it by accident. Pass
  `--existing` explicitly and point it at the supabase file.

## Standing access, so this stops being manual

Three ways, best first.

**1. Keep using this script.** It already works, costs one command, adds no new trust
surface, and the service-role key never leaves the laptop. A Claude Code session can
run it at the top of any catalog job. This is the recommended default.

**2. Connect the Supabase MCP connector on claude.ai.** It exists in the connector
directory and is not currently installed. That would let a Cowork session query the
live database directly, no export step at all. Two cautions before connecting it: its
tool list is management-scoped (creating and pausing projects, not just reading rows),
so check whether you can scope it to read-only or to a single project, and understand
that connecting it grants that access to every chat, not just catalog work.

**3. A read-only Postgres role plus a connection string.** Narrower than the MCP
connector, but it still needs a network path from wherever the session runs, which the
Cowork container does not have today. Not worth it unless option 1 stops fitting.

## Why the flat file has one row per brand+model

The live `boards` table is model-level: the v0.2 merge went in as one row per model,
not expanded per season. 1,870 boards against v0.2's 1,842 models is the evidence.
The flat export dedupes on `brand + model` and keeps the first `model_year` seen, which
is what the reconcile matches on. If boards ever moves to a row per board-year, this
file and `reconcile-catalog.py` both need revisiting.
