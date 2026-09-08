# Linestry Snowboard Events Catalog (v0.3)

Research date: 7 September 2026. Three waves in one session: v0.1 built the events, v0.2 mined the
podiums off the live web, v0.3 went into the Internet Archive for the dead sites. Same rule
throughout: every row is traceable to a source an agent actually opened.

## What changed

| | v0.1 | v0.2 | v0.3 |
| --- | --- | --- | --- |
| series | 122 | 121 | 121 |
| editions | 596 | 608 | 615 |
| results | 26 | 3,150 | 3,917 |
| editions with a podium | 8 | 285 | 311 |
| distinct riders | ~20 | 1,410 | 1,623 |
| 1980s result rows | 34 | 35 | 116 |
| 1990s result rows | 2 | 308 | 524 |

The archive wave was aimed at the founding record, and that is where it landed. The 1980s and 90s
row counts more than doubled.

## What the archive gave up

**The US Open, 1982 to 2001, complete.** `usopen-snowboarding.com/history.asp?yearNum=YYYY` was
archived for every year with full podiums *and* nationalities. Combined with the 2004-2006 results
pages, the US Open now has podiums for every edition it ran except 1983 and 2009. That is the deepest
lineage in the sport, and it was three weeks from being unrecoverable by ordinary means.

**Mt Baker's real podiums.** The Honor Roll gives winners only. The archived per-division finals pages
give places 1 to 3, times, and the exact division wording, for 2008, 2011, 2012, 2013, 2014, 2016 and
2018. Those 290 rows replaced 98 winners-only rows.

**Twelve Mt Baker editions got their dates** (2006, 2008-2014, 2017-2020). 1985-2005 are genuinely not
in the archive: lbs.mtbaker.us captures start in 2008 and the Honor Roll carries no dates at all.

**Six missing TTR seasons** (2002/03, 2003/04, 2005/06, 2007/08, 2011/12, 2014/15) recovered from the
tour's own history page, with 41 champion rows.

**Burton European Open 2007** created, 2003-2006 dated, and 24 podium rows for 2006. And the BEO 2000
question is closed rather than open: the event's own history page says it started in Innsbruck in 1999
and that "after a year's break" it moved to Fieberbrunn in 2001. No 2000 edition should exist.

## Two corrections that matter

**Mt Baker 2024 and 2026 did not happen.** Both were recorded as held. The archive shows the 36th was
scheduled for 9-11 February 2024 and rescheduled into 2025, and the 37th was scheduled for 6-8
February 2026 and postponed to 19-21 February 2027. Both are now `cancelled`.

**The Mt Baker Honor Roll has a column-alignment defect** and the catalog had inherited it. Its masters
table declares eight columns but 18 of its 28 year rows contain only seven cells, which shifts the
final column. The effect is that the Super Masters 60+ winner is rendered as the Grand Masters Women
winner, which is how Larry Freeman and Bob Satushek came to be recorded as women's champions.
Corrected, with the reasoning in `review/v0.3-honor-roll-alignment.md`. Worth telling the organisers:
it is their page and it is wrong.

## QA, and one honest caveat

A 35-row sample of the archive wave plus 12 recovered edition rows was re-checked against the archived
pages: **not one sampled row states a wrong rider, place, division or discipline.** The three hazards
that were specifically hunted did not occur — no qualifier page recorded as a podium, no column
misalignment in the archived pages, no year-attribution slip on the US Open pages.

The damage was all in the citations. Many recorded snapshot URLs do not resolve, even though the
values they carry were verified. A repair pass fixed the largest systematic case: 18 of 19 US Open
citations had been written with a single timestamp that is the capture of `yearNum=1986` only, and
each year now points at its own verified snapshot.

**The repair is unfinished.** The browser the archive is reached through stopped responding partway,
so a `citation_status` column was added and is honest about the state:

| citation_status | rows | meaning |
| --- | --- | --- |
| live-source | 3,051 | cited on the live web, checkable by anyone |
| repaired-verified | 364 | archive citation confirmed to resolve to the right page |
| pending-recheck | 502 | value verified by QA, snapshot URL not yet confirmed to resolve |

The `pending-recheck` rows are not suspect data. They are rows whose footnote may 404. For a dataset
recovered from dead sites that distinction matters, because a citation that looks solid and is not is
worse than an honest gap. Finishing the repass needs the browser back, and the known work is: about 21
hard 404s among the Mt Baker 2014/2016/2018 division pages, and the Dew Tour citations, which are all
missing an `/actionsports` path segment (the event and discipline ids in them are correct).

## Still open

- **US Open 1983 and 2009** are the only gaps left in that series. The organiser's own 1983 page has an
  empty results block.
- **Mt Baker dates 1985-2005**, not in the archive at all. This is a community question now.
- **Dew Tour 2008-2010 and 2016-2017**, and **TTR 2015/16**.
- **The division model.** `division` still mixes gender and class, and `division_label` is doing the
  real work. Splitting it into gender plus class remains the highest-value schema change before this
  goes into Supabase, and roughly 60 already-sourced Canadian placings are waiting on it.
- **The five TTR rows are season titles stored as `place: 1`**, correctly sourced and annotated, but a
  rider page will render them as contest wins. Decide how to display a tour title.
- **The largest untouched seam:** worldsnowboardtour.com and worldsnowboarding.org each hold roughly
  3,700 archived `/events/<slug>-<year>/` pages spanning 2007-2021. Most are regional events below this
  catalog's bar, but it is a real corpus if you ever want tour-stop depth.

## Import

Use `db/`, not `schema.sql`. The `db/` folder is the tested import package: migration, seed generator,
generated seed and verification queries, all dry-run twice against a real Postgres 16 to prove they are
idempotent. `db/README.md` has the run order and the three bugs that dry run caught. `schema.sql` is
kept only as the readable summary of the shape.

The division decision is made and applied. `division_label` keeps the source's exact wording, and
`division_gender` plus `division_class` are the normalised pair to filter on, added without destroying
anything. `division_gender = 'unspecified'` is a real value for categories a source runs ungendered,
not a gap.

Consider rendering `pending-recheck` citations without a hyperlink until the repair pass finishes.
