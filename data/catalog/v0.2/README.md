# Linestry Snowboard Catalog, v0.2

Research date: 2 September 2026 (v0.2, second pass). Pre-population data for the boards people can browse and mark as "rode" or "own". Every row is traceable to a source URL. Nothing was entered from memory.

## Files

| File | What it is |
| --- | --- |
| brands.csv | 216 brands (91 active, 98 defunct, 6 revived, 21 status unconfirmed) |
| models.csv | 1,842 board models across 77 brands |
| snowboards.json | Same data, one JSON object with `brands` and `models` arrays (sources as arrays) |
| schema.sql | Postgres/Supabase tables plus a suggested member_boards table |
| RESEARCH_BRIEF.md | The rules the research agents followed |

## Data dictionary (models.csv)

| Column | Meaning |
| --- | --- |
| model_id | `brand-slug--model-slug`. Stable, use as the foreign key from member collections. |
| brand_id | Slug matching brands.csv |
| model_name | Model name as printed by the brand. One row per name, not per year or size. Construction variants (Flying V, BTX, Wide, etc.) are folded into the parent row. |
| first_year | Model year. A board sold for the 1995/96 winter is 1996. Null when no source gave a year. |
| year_basis | The most important column for the UI. `introduced` = a source states this is the launch year. `earliest_sourced` = this is only the earliest year we found evidence for; the board is probably older. `unknown` = no year. |
| last_year | Last model year seen. Null means still in production or unknown; year_note says which. |
| category | freestyle, freeride, all-mountain, alpine, powder, splitboard, kids, swallowtail, other, unknown |
| pro_rider | Set when it is a pro model and the source names the rider |
| series_or_family | e.g. Family Tree, Air, Spring Break |
| confidence | `verified` = primary source (brand archive, catalog scan) or two independent sources. `likely` = one secondary source. |
| sources | URLs, separated by ` \| ` in the CSV |

## What changed in v0.2

The second pass targeted the 1994 to 2007 gap using two sources that were unreachable from the cloud sandbox in v0.1 and are now reached through Jay's Chrome: the Wayback Machine (brand websites 1997 to 2008, read via the CDX index and page text) and Board Vault (a collector database of every Burton model year 1977 to 2013). 610 rows now cite Wayback snapshots of the brand's own site and 188 cite Board Vault. Rows for the 1994 to 2007 model years went from 144 to 642. Brands that gained the most: Nitro (+58 rows, full 2002/2003/2004/2006 lineups from page text), K2 (1998 to 2007 lineups), Morrow (1998 to 2009), Ride (2000 to 2008), Forum (2004 to 2005), Option (1999 to 2001, pro models for Nelson, Sansalone, Chatfield, Makinen), Sims (1998 to 2000 page text), GNU and Lib Tech (1998 to 2008), Salomon (2005 to 2008), Never Summer (2005 to 2008), Santa Cruz (2007), Elan, Nidecker (2006), Atomic (2004), Palmer, Arbor, Joyride, F2, Völkl, Rome, CAPiTA, Stepchild, Unity, Flow, Division 23. Burton gained 73 new names and 36 earlier first years.

A 24-row automated re-check of Wayback-sourced rows (does the cited snapshot or its CDX index actually contain the model name in that month) passed 22 of 24; the two misses were fetch quirks, not missing boards.

## How to read the year honestly

About two thirds of the rows (1,210) are `earliest_sourced`. That is by design: when the only evidence for a long-running board was a 2008-2012 catalog archive or a current retailer page, we recorded that year rather than guessing the real launch. In the product, show `first_year` with a qualifier for those rows (for example "seen from 2008" instead of "2008"), or let members correct it. Do not present `earliest_sourced` years as release dates.

## Coverage, by era

| First year | Rows |
| --- | --- |
| 1970s | 4 |
| 1980s | 59 |
| 1990s | 242 |
| 2000s | 780 |
| 2010s | 365 |
| 2020s | 330 |
| no year | 62 |

Strong: Burton 1977 to present (281 rows, Board Vault year index, catalog scans for 1988 and 1993), Bataleon (official archive, 2005 onward), every major brand 2008 to 2012 (SnowDB catalog archive), current lineups for the big brands, and the late-80s/early-90s buyer's guides (TransWorld 1989-1993, ISM 1987-1991) for Sims, Kemper, Morrow, K2, Lamar, Avalanche, Barfoot, Mistral, Hooger Booger and others.

Thin, and where the next pass should go:

1. **1994 to 1997 is still the thinnest stretch** (49 rows). Brand websites only start in the Wayback Machine around 1997, and no scanned buyer's guides for 1994 to 1997 were found on the Internet Archive (the TransWorld/Snowboarder/ISM scans stop at 1993; Board Vault has 1994 guide scans as images only). Candidates: the Board Vault 1994 buyer's guide scans (image OCR), Retro Snow, and the Snowboarder Magazine 89-93 buyer's guide item on archive.org (not yet mined).
2. **1998 to 2007 is now decent for the big brands but slug-based.** Many rows in this era rest on the model name appearing as a page path on the brand's site in a dated snapshot. That proves the board existed that season; it does not give the launch year, hence `earliest_sourced`. Snowboardcollector.com is dead (DNS), so a second collector source would help.
3. **139 brands with no models yet**, including Duotone, Kessler, Niche, Technine, Smokin, Special Blend, Liquid, 5150, Lamar (1998 site names only its series), Heelside, Wild Duck, Killer Loop. Brand rows exist; models need research.
4. **Canadian brands** matter for the launch community: Option (30), Prior (11), Endeavor (8) are in; Kingpin has neither a sourced brand row nor models yet (kingpinsnowboards.com/.ca have no Wayback captures).
5. **Japanese snowsurf brands** (Gentemstick, Moss, Ogasaka, Yonex, BC Stream) have current catalogs only, mostly without years.
6. **Custom shapers** (Donek, Coiler, Oxess, Franco) have no fixed catalog years by nature; consider a "custom shaper" flag rather than model rows.

## Known dating conventions and caveats

- Buyer's guide years were converted from issue date: an October 1991 guide covers model year 1992.
- Where two sources disagreed on a year, the earlier primary source was used and the disagreement is in year_note.
- A 40-row QA sample was re-checked against cited sources: 30 fully supported, 9 dating corrections (all applied, flagged "QA-corrected" in notes), 0 fabricated boards, 1 uncheckable (Morrow Longboard 1994, single scan source). The correction pattern was current-catalog boards being given a 2026/2027 first year; the `year_basis` column was added in response.
- `confidence` is about sourcing, not about the year being the true launch year. Use `year_basis` for that.
- Wayback rows: snapshot month 08 to 12 was mapped to the following model year, 01 to 07 to the same year (brand sites launch the new line in late summer). Where the page itself printed the season, that was used instead.
- Name reuse: a few names were used for unrelated boards decades apart (Ride Zero 2000 and 2022, Burton Air 1987 and the 2005 retro, Burton Elite 1987 and 2007, Nitro Future Team 2002 and 2026, Lib Tech Emma Peel 1993 and the 2004 revival). They are single rows with a note; split them if the UI needs it.

## Suggested import into Supabase

1. Run schema.sql.
2. Import brands.csv, then models.csv (Table Editor CSV import, or `\copy`). Convert the `sources` text column to `text[]` with `string_to_array(sources, ' | ')` if you want arrays.
3. Add a "suggest a board" path in the UI so members can add missing models; route those through the same no-guess rule (ask for a photo or catalog reference).
