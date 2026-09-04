# Snowboard catalog v0.3

Supersedes `v0.2/`. Same file shape: `brands.csv`, `models.csv`, `snowboards.json`,
plus the unchanged `RESEARCH_BRIEF.md` rules that govern every row.

## What changed from v0.2

v0.3 folds in the **Send It DB** crawl (senditdb.com) and a first slice of primary-source
brand catalogs, completed 2026-09-03. The v0.2 session captured one of three crawl chunks
before the browser bridge was blocked; this pass captured all three.

| | v0.2 | v0.3 |
|---|---|---|
| Brands | 216 | 246 |
| Models | 1,842 | 3,156 |
| Verified | 831 | 1,061 |

### The crawl

2,441 raw brand/model/season rows across 104 brands (42 of Send It's 146 brand pages
legitimately hold no boards). Raw capture is committed at `data/catalog/raw/senditdb/`
as `chunk1.txt`, `chunk2.txt`, `chunk3.txt`, format `brand|model|years|styles|target`.

Verification: per-brand row counts were compared against the live page's own counts for
all 104 brands. Exact match on every brand and on the 2,441 total.

Send It splits one model into many rows by construction, size and audience (Arbor
"Coda Camber", "Coda Rocker", "Coda Split Camber"; Bataleon "Stereo", "Men's Stereo",
"Women's Stereo"). Those fold into the parent model with the variants recorded in `notes`,
the same rule v0.2 used for Burton Flying V and Lib Tech BTX. 2,441 raw rows folded to
1,961 distinct models.

### How those 1,961 landed

| Bucket | Rows | What happened |
|---|---|---|
| MATCH | 437 | Already in v0.2. Send It added as a second source. |
| SENDIT_ONLY | 1,011 | New model in a brand we already hold. 901 imported, 110 held. |
| BRAND_NEW | 492 | Brand not in v0.2 at all. **None imported.** |
| FUZZY | 21 | Near-miss on the name. **None imported.** |

**Imported into v0.3: the 901 clean SENDIT_ONLY rows only.** Every one carries
`confidence: likely`, `year_basis: earliest_sourced`, and its
`https://www.senditdb.com/brands/<slug>` source, so the whole import is filterable and
reversible in one pass.

### Year handling

Send It years are MODEL years already (second year of the season, so 2026/2027 = 2027).

For the 437 MATCH rows, Send It sometimes shows a model running earlier than we had it.
93 such cases, split by what our year actually rests on:

- **76 widened.** Our `year_basis` was `earliest_sourced`, meaning our year was only the
  earliest we had happened to find. Send It finding an earlier one is new evidence, so
  `first_year` moved back and the change is recorded in `notes`.
- **17 not widened.** Our `year_basis` was `introduced` — a catalog said the model was new
  that year. A secondary source showing it earlier is a *conflict*, not an improvement, so
  the year was left alone and the disagreement written into `year_note` for a human.

All 93 are listed in `review/sendit-year-conflicts.csv`.

`last_year` was extended where Send It showed the model still running, but never set to a
year earlier than our `first_year`: an empty `last_year` means ongoing or unknown, not
ended.

### What was deliberately held back

**492 BRAND_NEW rows across 38 brands** (Gilson 90, Raven 33, LTB 30, Sandy Shapes 30,
Fiveforty 22, Blackhole 19, Allian 18, November 17, AMICSS 16, Drake 16 and 28 more).
These need a `brands.csv` row with founding facts researched first — the golden rule says
no guessing, and a model row with no brand behind it is exactly that. Candidates are in
`review/sendit-brand-new-candidates.csv`, one line per brand with model count, year span,
and source URL.

**110 SENDIT_ONLY rows flagged as not-really-models.** RESEARCH_BRIEF is explicit that
sizes and graphics variants are not separate models. Send It lists them anyway, so each
row was checked for: quoted graphic titles (Dinosaurs Will Die's `Darrah, "Waves"`),
limited runs (`1 of 75`), collabs, prototypes, demos, B-grades, packages, and colorways.
Flagged rows stay in `review/sendit-reconciliation.csv` with the reason in `variant_flags`.

This is why Gilson contributes 90 BRAND_NEW rows on paper but is almost entirely one-off
Peanuts and Sesame Street graphics on one chassis. It should not become 90 models.

**21 FUZZY rows.** Near-misses that could be a rename, a typo, or a genuinely different
board. Cheap for a human to settle, expensive to get wrong.

## Primary sources: archived brand catalogs

A Wayback CDX sweep of 20 brand domains turned up 369 archived PDFs, 20 of them
catalog-shaped. Five had a usable text layer and were harvested:

| Brand | Season | Models confirmed |
|---|---|---|
| Ride | 2005/06 | 6 |
| Ride | 2006/07 | 8 |
| Ride | 2008/09 | 6 |
| Ride | 2009/10 | 6 |
| Arbor | 2014 | 15 |

41 model rows now carry a primary catalog as a source. 9 moved `likely` to `verified`,
2 had `first_year` widened, 10 had `last_year` extended. Every change is in
`review/catalog-confirmations.csv`; the full sweep and the targets still open (the Arbor
Issuu archive above all) are in `data/catalog/raw/catalog-pdf-manifest.md`.

Confirming our own model names against catalog text is safe. Reading model names *out* of
catalog text automatically is not, and was deliberately not attempted: the Ride catalogs
each list roughly 25 boards against the 6 to 8 we matched, so the gap is real, but closing
it by regex would manufacture boards that never existed.

## Confidence and provenance

Send It DB publishes no citations, so under RESEARCH_BRIEF it is a **secondary source**:
its rows are `likely`, never `verified` on their own. Where Send It agrees with a row we
already held from another source, that row moved `likely` to `verified` — two independent
sources is the bar. Catalog PDFs are primary and confer `verified` on their own.

Bulk catalog and Issuu harvesting is still the v0.4 job, and it is what will upgrade
`earliest_sourced` rows to `introduced` at any scale.

## Verification run on these files

- No v0.2 model dropped — **pass**
- No duplicate brand+model — **pass**
- `model_id` unique — **pass**
- Year sanity, 1963 to 2028 and `first_year` <= `last_year` — **pass**
- Every model points at a real brand row — **pass**
- `category` and `confidence` vocabularies controlled — **pass**
- Every model carries at least one source — **pass**
- `snowboards.json` agrees with the CSVs — **pass**

Two bugs this check caught, both now fixed: the suffix stripper was reducing the real Arbor
model "Heritage" to an empty string and duplicating it, and an empty `last_year` was being
overwritten with a Send It year earlier than our own `first_year`.

## Reviewer pass (applied)

The review files below were returned with decisions and those decisions are applied here.

### Year conflicts, all 93 resolved

- **76** where our basis was already `earliest_sourced`: accepted, and they were applied in
  the first build.
- **15** of the 17 `introduced` rows: accepted. On inspection the `introduced` label was a
  v0.1 default rather than a catalog claim, with the cited source being a review page or
  showroom article that only proves the board existed that season. These now carry the
  Send It year with `year_basis: earliest_sourced`, and `year_note` records that the
  earlier label was a default. They are Amplid Singular, Snommelier, Souly Grail and
  Surfari; Jones Airheart and Explorer; Nobile Race SBX; and Prior Brandywine, Fissile,
  Khyber, Legacy, MFR, Slasher, Slaylok and Spearhead.
- **2** kept as-is: Prior Wildcard and Prior Thruster. The Snowboarder 2019 showroom
  article calls Wildcard "brand new for 2018/19" and Thruster "the newest addition to the
  Prior fleet". Those are real launch claims, so Send It's 2017 is recorded in `year_note`
  as a conflict and the 2019 `introduced` date stands.

### Brands, all 38 resolved

**30 kept**, each with a brand row carrying country, founding year where Send It DB gives
one, `status: active`, `confidence: likely`, and its Send It brand page as the initial
source. Javatron Dream Machines is flagged a custom shaper, the same classification Donek
and Coiler carry, so its rows are shapes rather than catalogue seasons.

**413 models imported** from those brands, all `likely` / `earliest_sourced`.

**7 held** pending origin and active-status checks: Stone, Gara, The Boards Company,
Dreamscape, NTTB, The Bakery, Monument. **1 skipped**: Line, a ski brand whose single
Send It entry is almost certainly misfiled.

**33 rows held back as variants.** The same graphics, colorway, prototype and package
filter used on the SENDIT_ONLY import was applied to these brands, so Gilson came in at 80
rather than 90 and Thrive at 5 rather than 10. The held rows keep their reason in
`variant_flags` in `review/sendit-reconciliation.csv`.

### Country disagreements to settle

Seven kept brands have a country in the reviewer notes that differs from the Send It brand
page. The Send It value is recorded because it is the cited source, with the disagreement
written into the brand's `notes`. None is resolved:

| Brand | Send It DB | Reviewer |
|---|---|---|
| Blackhole Snowboards | Italy | Poland |
| Allian | USA | Sweden |
| Moonchild | Spain | Japan |
| Nobaday | USA | China |
| Furlan Snowboards | France | Italy |
| D.O.P.E. | Canada | USA |
| Verdad | France | Spain |

High Society Freeride has no country on Send It DB; USA and Aspen came from the reviewer.

## Review files

In `data/catalog/review/`:

- `sendit-reconciliation.csv` — all 1,961 folded models with bucket, both names, years,
  `variant_flags`, `import_candidate`, and an empty `reviewer_decision` column.
- `sendit-brand-new-candidates.csv` — the 38 brands, each with its reviewer decision.
- `sendit-year-conflicts.csv` — the 93 earlier-year cases, each with its reviewer decision.
- `catalog-confirmations.csv` — the 41 rows confirmed against an archived brand catalog.
- `reconciliation.csv` + `summary.md` — v0.3 against Linestry's live board records,
  regenerated by `scripts/reconcile-catalog.py`.
- `catalog-gaps-existing-only.csv` — the 41 boards that are live but missing from the
  research. These are gaps in the catalog, not candidates for import.

### Reconciliation against production, 4 September 2026

Export taken that morning: 1,871 board rows, 84 brand orgs, 1,856 distinct brand+model.

| Bucket | Rows | Meaning |
|---|---|---|
| MATCH | 1,813 | already live |
| CATALOG_ONLY | 1,368 | candidate additions |
| EXISTING_ONLY | 41 | live but missing from the research |
| FUZZY | 2 | CAPiTA Spring Break, Morrow Lunchtray/Tray |

82 brands appear on both sides, 164 in the catalog only, 8 live only (Oakley,
Quiksilver / Roxy, Linestry.com, RDS, Retro Snow, Shorty's, Volcom, Westbeach; mostly
apparel, which is why the catalog lacks them).

The 1,368 candidate additions concentrate in Burton 106, Gilson 80, Gentemstick 57,
Moss 51, Arbor 49, Jones 48, Amplid 44.

Refresh the export with `node scripts/export-catalog-tables.mjs` before rerunning this.
An earlier pass in this session reconciled against a stale 97-row file and reported
3,071 candidate additions, which was wrong by a factor of two. See
`docs/catalog-export-runbook.md`.

### One correction to the model-level claim

`boards` is *mostly* one row per model, but not strictly: 12 brand+model pairs carry
more than one row where a name was reissued across eras. Sims ATV has four (1993, 1995,
1998, 2019), Winterstick Swallowtail two (1970, 1981). Any import needs to tolerate that
rather than assume brand+model is unique.

Nothing here has been written to the database.
