# Snowboard Database Research Brief (v0.1)

Purpose: pre-populate a database of snowboard brands and board models (with model year) for the Linestry platform, where members browse the list and mark boards they rode or own.

## Golden rule

DO NOT GUESS. Every row must be traceable to a source you actually opened. If you cannot confirm a model existed under that name from that brand in that year, leave it out. An omission is fine. A fabricated or misattributed board is not. Never invent a year to fill a blank; use null.

## Accepted sources (in order of preference)

1. Brand's own archive / catalog pages (e.g. burton.com archive, lib-tech / gnu history pages, nitro, ride, k2, sims)
2. Scanned catalogs or brochures (catalog archive sites, collector sites, Internet Archive)
3. Museum or collector databases (e.g. snowboard museums, vintage snowboard collector sites, Snowboard Archive style sites)
4. Magazine buyer's guides (TransWorld Snowboarding, Snowboarder Mag, Snowboard Life, ISM) and their online archives
5. Reputable retailer catalogs for current-era models (evo, The-House, Blue Tomato, Tactics) - fine for 2010+ models
6. Wikipedia only for brand-level facts, not for individual model years unless it cites a primary source

NOT accepted as sole source: forum posts without images or catalog references, eBay listings with no model year evidence, AI-generated listicles, aggregator content farms.

## Year convention

- `model_year` is the MODEL year as printed in the catalog. A board sold for the 1995/96 winter season is model year 1996.
- If a source only says "mid 90s", set model_year null and put the era in `year_note`.
- `first_year` = first model year the model name appears. `last_year` = last model year it appears, null if still in production or unknown.

## Confidence tiers

- `verified`: two independent sources, or one primary source (brand archive or catalog scan) that shows the model name and year.
- `likely`: one secondary source (collector site, magazine guide, retailer) stating the model name and year.
- Anything weaker: do not include.

## Output format for agents

Return a single JSON object with two arrays. Use these exact keys.

```json
{
  "brands": [
    {
      "brand_name": "Burton",
      "founded_year": 1977,
      "founder": "Jake Burton Carpenter",
      "country": "USA",
      "hq_city": "Burlington, Vermont",
      "status": "active",            // active | defunct | revived | dormant
      "end_year": null,
      "parent_company": null,
      "notes": "",
      "sources": ["https://..."],
      "confidence": "verified"
    }
  ],
  "models": [
    {
      "brand_name": "Burton",
      "model_name": "Custom",
      "first_year": 1996,
      "last_year": null,
      "year_note": "",
      "category": "freestyle",   // freestyle | freeride | all-mountain | alpine | powder | splitboard | kids | swallowtail | other | unknown
      "pro_rider": null,         // name if it is a pro model
      "series_or_family": null,  // e.g. "Craig Kelly Air" belongs to "Air" family
      "notes": "",
      "sources": ["https://..."],
      "confidence": "verified"
    }
  ]
}
```

One row per model NAME per brand, not per year. If a model ran 1996 to 2010, that is one row with first_year 1996 and last_year 2010. Sizes and graphics variants are not separate models. A materially renamed board (e.g. "Air" vs "Craig Kelly Air") is a separate row.

## What to record in notes

Anything that helps a collector recognise the board: shape, construction milestone (first cap, first sidewall, first twin), famous graphic, rider association.
