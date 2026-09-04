---
name: catalog-refresh
description: Refresh the live snowboard catalog export from Supabase and reconcile a researched catalog version against it. Requires a LOCAL session, because the export needs credentials from .env.local that cloud sandboxes cannot see. Use when asked to refresh the catalog export, reconcile the catalog, check what boards are already live, work out which researched models are new, or before any catalog merge. Also use whenever a session is about to quote numbers from data/catalog/review/.
---

# Catalog refresh: live export, then reconcile

The snowboard catalog is researched offline (Cowork and browser sessions) and merged
into production separately. The two halves talk to each other through one CSV sitting
in `data/catalog/`. This skill keeps that CSV honest.

## Why this exists

Research sessions have **no network route to Supabase**. They read whatever export is
on disk and cannot tell whether it is current. A stale file does not error, it just
produces confident nonsense.

That happened on 3 September 2026. The export on disk was dated the previous day and
listed 97 boards. The v0.2 research had since been merged and `boards` actually held
about 1,870. The reconcile reported 3,071 rows as candidate additions when the real
delta was closer to 1,286, and a whole recommendation was built on it before a human
caught it.

So the rule is: **refresh first, then reconcile. Never reconcile against a file you
did not just write.**

## Step 0: confirm this is a local session

The export needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
`.env.local`. That file is gitignored, so it exists only on the machine that owns the
repo. A cloud session clones from GitHub and will not have it, so the export simply
cannot run there.

Check this before anything else:

    pwd
    test -f .env.local && echo "local: credentials present" || echo "NO CREDENTIALS"

A path under `/home/user/` or a missing `.env.local` means this is a cloud sandbox.

**If you cannot refresh, do not fall back to the committed CSV as though it were
current.** That substitution is the exact failure this skill exists to prevent. It has
already happened once: a stale export was read as live and produced a candidate-additions
count wrong by roughly a factor of two. Instead:

1. Say plainly that this session cannot refresh the export.
2. Read `data/catalog/existing-export.EXPORTED-AT` and report its date.
3. Attach that date to every number you quote. For example: "1,368 candidate additions,
   measured against an export dated 4 September 2026."
4. Recommend rerunning in a local session (`cd ~/lineage && claude`) for current figures.

Never present a number from an undated or unrefreshed export as the current state.

## Step 1: refresh the export

From the repo root:

```
node scripts/export-catalog-tables.mjs
```

Read-only. It issues SELECTs and nothing else, and never writes to the database. It
reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment,
falling back to `.env.local`, the same as `import-mentions.mjs` and
`backfill-public-slug.mjs`. The service-role key means it bypasses RLS and sees
unpublished rows, which is what you want for a true picture.

It writes into `data/catalog/`:

| File | What it is |
|---|---|
| `existing-boards-export.csv` | every row of `boards`, full columns |
| `existing-brands-export.csv` | every `orgs` row where `org_type = 'brand'` |
| `existing-export-supabase.csv` | flat `brand,model,first_year,source`, the reconcile input |
| `existing-export.EXPORTED-AT` | ISO timestamp plus row counts |

It pages in blocks of 1,000. This matters: a plain `select("*")` is capped and returns
a truncated table as though it were the whole thing, which is one way a small export
appears without anyone doing anything wrong.

If the command fails on missing env vars, the key is absent from `.env.local`. Do not
work around it by falling back to the stale file. Stop and say so.

## Step 2: reconcile

```
python3 scripts/reconcile-catalog.py --existing data/catalog/existing-export-supabase.csv
```

`CATALOG_DIR` near the top of that script selects which researched version is being
compared. It currently points at `data/catalog/v0.3`. Repoint it when a new version
lands.

Outputs `data/catalog/review/reconciliation.csv` and `review/summary.md` with buckets
MATCH, FUZZY, EXISTING_ONLY and CATALOG_ONLY.

**Always pass `--existing` explicitly.** The default is
`data/catalog/existing-export.csv`, which is a different thing: a small demo baseline
derived from `src/lib/mock-data.ts`. Reconciling against it by accident is the second
way to get confident nonsense.

## Step 3: sanity-check before quoting any number

- `data/catalog/existing-export.EXPORTED-AT` is from this run, not an old one.
- Board count is in the ballpark you expect. A few dozen when you expect thousands
  means a truncated or ancient file, not a real finding.
- MATCH should be large if the last research version was merged. A tiny MATCH against
  a big CATALOG_ONLY usually means the export is stale, not that thousands of boards
  are missing.
- `CATALOG_ONLY` is the candidate-additions number. Say what it is measured against
  and the export date, every time you report it.

## What this skill does not do

It does not write to the database. Merging researched rows into `boards` is a separate,
reviewed operation. This skill only produces the picture you would need in order to
decide what to merge.

## Schema notes

`boards` is model-level: one row per model, not expanded per season. The v0.2 merge
went in that way, 1,870 board rows against 1,842 researched models. Columns are
`id, brand, model, model_year, shape, image_url, external_ref, community_status,
added_by, created_at`.

Brands are not their own table. They are rows in `orgs` with `org_type = 'brand'`.

Matching is on brand plus model name, never on ids, because the researched side has no
database ids. Alias tables live inside `reconcile-catalog.py`.

If `boards` ever moves to a row per board-year, both the flat export in
`export-catalog-tables.mjs` and the matching in `reconcile-catalog.py` need revisiting.

## Related

- `docs/catalog-export-runbook.md`: the same procedure for a human, plus the manual
  dashboard SQL fallback and the standing-access options.
- `data/catalog/v0.3/README.md`: what the current researched version contains and how
  it was built.
- `data/catalog/v0.3/RESEARCH_BRIEF.md`: the sourcing rules every catalog row obeys.
