# Issuu board-guide worklist (next issues to scan)

Boards only. Mechanism proven on Blue Tomato 04/05 + 05/06: `reader3_4.json` for the page
list, vision-OCR the page JPGs, reconcile every model against the live catalog, brand
attribution is reliable because each caption is brand-prefixed. This ranks what to scan
next. All Tier-1/2 docIds are reader3-verified (page counts shown).

## Tier 1 - Blue Tomato continuous run, 2007-2010 (do these first)

Same publisher, same proven layout, same per-product brand prefix. These four fill the exact
gap between 05/06 (done) and the modern catalogs, i.e. **model years 2007-2010** - the era
least covered by the Send It import. Highest value, lowest risk.

| Season | Model yr | docId | Pages | Status |
|---|---|---|---|---|
| 2006/07 | 2007 | `blue-tomato-snowboardkatalog0607` | 139 | TODO |
| 2007/08 | 2008 | `blue-tomato-snowboardkatalog0708` | 180 | TODO |
| 2008/09 | 2009 | `blue-tomato-snowboardkatalog0809` | 179 | TODO |
| 2009/10 | 2010 | `blue-tomato-snowboardkatalog_0910` | 219 | TODO |

user slug `blue-tomato`. URL form: `https://issuu.com/blue-tomato/docs/<docId>`.
Each: find the SNOWBOARDS + GIRLS board pages from the contents/side-tabs, extract, reconcile.
There is a "Snowboard Kataloge" stack (`stacks/10ece4abcb254b1e8a74c93319ca0c93`) that lists
the full BT run in one place.

## Tier 2 - Blue Tomato modern (2015-2018)

Retailer is fine for 2010+ models per the brief. Big books, but most of this era is already
in the catalog via the Send It import, so marginal yield is lower. Easy cross-check.

| Season | docId | Pages |
|---|---|---|
| 2015/16 | `blue-tomato_snowboard_katalog_16` | 268 |
| 2016/17 | `blue-tomato_snowboard_katalog1617` | 266 |
| 2018 | `blue-tomato-snowboard-catalogue-201` | 252 |

## Tier 3 - Method Snowboard Magazine board buyer's guides (US, modern)

Magazine format, US-brand-heavy, so it catches brands a European retailer under-weights.
Modern only (2016+). Prioritise the board guides, skip the bindings/boots issues.

| Guide | docId | Pages |
|---|---|---|
| Vol 23 product guide (2022) | `methodmag_23-product_guide-lo` | 100 |
| 24/25 buyers guide (2024) | `method_vol_25-buyersguide-single_pages` | 96 |
| 18.1 boards guide (2017) | `181_boards_guide` | 19 |
| 17.1 gear guide (2016) | `buyers_guide_17.1_issuu` | 32 |

user slug `method_magazine`. (25/26 exists on the publisher page but its docId did not
resolve on the first try - grab the exact docId from the publisher page when needed.)

## Tier 4 - single-brand vintage catalogs (primary source, one brand each)

No multi-brand attribution risk; strong `first_year` evidence for that one brand. The Nitro
96-97 is the only confirmed **1990s** primary source found on Issuu so far.

| Brand | Season | docId (user) | Pages |
|---|---|---|---|
| Nitro | 1996/97 | `96-97-consumer-catalog-eng` (`nitrosnowboards`) | 44 |
| Nitro | 2003/04 | `03-04-consumer-catalog-eng` (`nitrosnowboards`) | 78 |
| Arbor | 2009/10 | `catalog_snow_09-10_issuu` (`arborcollective`) | DONE (prior session) |

## Not on Issuu - do not chase here

- **TransWorld / ISM / Snowboarder buyer's guides 1989-1993** (the real 1990s multi-brand
  gold, 200+ brands): these live on **archive.org**, not Issuu. Different pipeline (they are
  page-image scans, OCR-able, but not reader3). Worth a separate effort if pre-2000 coverage
  matters.
- **Whitelines buyer's guides**: on whitelines.com, not Issuu.
- Blue Tomato's own Issuu run **starts at 04/05** - there is no pre-2004 BT catalog on Issuu.

## Suggested order

1. Blue Tomato 06/07 -> 07/08 -> 08/09 -> 09/10 (Tier 1). This is the single most valuable
   block: proven pipeline, fills MY2007-2010, same brands we already trust.
2. Method Vol 23 + 24/25 (Tier 3) for modern US-brand cross-check.
3. Nitro 96-97 (Tier 4) if we want a 1990s primary source now.
4. Blue Tomato 2015-2018 (Tier 2) last - lowest marginal yield.
