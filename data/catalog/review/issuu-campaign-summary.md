# Issuu extraction campaign - master summary

Boards only. Every model traced to a page opened; brand attribution is reliable throughout
because each source captions or headers its products by brand. No database writes: every
row is either a confirmation against the live v0.3 catalog or a sourced candidate for a
human. These are primary, traceable, photo-mineable sources, preferred over senditdb
(which appears to derive from the same catalogs).

## Grand totals

- **15 documents extracted end to end.**
- **1,095 confirmed** board appearances (brand+model matched the live catalog).
- **541 review candidates** (new models / new brands / flagged), for a human.
- **1,636 total board rows.**

## Documents (all reader3-verified)

| Tier | Document | Model yr | Boards | Confirmed | Review |
|---|---|---|---|---|---|
| proof | Blue Tomato 05/06 | 2006 | 139 | 85 | 54 |
| proof | Blue Tomato 04/05 | 2005 (+2004) | 146 | 86 | 60 |
| 1 | Blue Tomato 06/07 | 2007 | 147 | 96 | 51 |
| 1 | Blue Tomato 07/08 | 2008 | 146 | 106 | 40 |
| 1 | Blue Tomato 08/09 | 2009 | 143 | 105 | 38 |
| 1 | Blue Tomato 09/10 | 2010 | 169 | 121 | 48 |
| 4 | Nitro 96/97 | 1997 | 12 | 4 | 8 |
| 3 | Method Vol 23 | 2023 | 91 | 64 | 27 |
| 3 | Method 24/25 | 2025 | 72 | 58 | 14 |
| 3 | Method 18.1 | 2018 | 30 | 14 | 16 |
| 3 | Method 17.1 | 2017 | 27 | 13 | 14 |
| 4 | Nitro 03/04 | 2004 | 21 | 21 | 0 |
| 2 | Blue Tomato 2015/16 | 2016 | 216 | 130 | 86 |
| 2 | Blue Tomato 2016/17 | 2017 | 148 | 99 | 49 |
| 2 | Blue Tomato 2018 | 2019 | 129 | 93 | 36 |

Full inventory with docIds and page ranges: `issuu-next-guides-worklist.md` (targets) and
`issuu-inventory.csv` (status). Per-document CSVs: `issuu-bluetomato-*` and `issuu-method-*`
and `issuu-nitro-*` `-confirmations.csv` / `-review-candidates.csv`.

## Highest-value results

### Zero-model brands filled (brands the catalog holds with no models until now)
Each is a sourced candidate list for a human, 40 distinct models across 7 brands:
- **Hammer** (France): 11 - Twenty One, Contact, PSM 2, Twilight, Private, Condense, Broadline, Logo, Premium, Seymour, Hyleyn (identity confirmed by Jay)
- **Vimana** (Norway): 9 - The Werni Stock, The Continental Directional, The Vufo, The Ennitime, The Meta, The Motherbrain, B-Rage, The Clone, ...
- **Icon** (Finland): 8 - Heppu Pentti, Asgard, Revival, DS, Wallpaper, Danny, Gummi
- **O-Matic**: 6 - Sweet Hampus Mosesson, Awesome Todd Richards, Boron, Extr-emo, Celebrity Louie Vito, Extr-Eco
- **Duotone**: 2 (Street, RPM); **Smokin**: 2 (Pillow Monster, Jetson); **Dinosaurs Will Die**: 2 (Brewster, Perry)

### Brand-new labels (not in catalog; each needs a brand row before its models)
~77 distinct models across 14 brands. Biggest:
- **FTWO / F.TWO** (18) - a *separate* German brand carrying F2's former freestyle line;
  by 09/10 co-branded "F2 - FTWO". Do NOT merge into F2 without a human decision.
- **Apo Snowboards** (France, 15), **Trans Snowsports** (Germany, 9), **Light Board Corp** (6),
  **Korua Shapes** (5), **Jeenyus** (5), **Chamonix** (4), **Evol** (4), **Tur** (4, Sweden),
  plus Alibi, Aesthetiker, Love, The Degenerati, The Interior Plain Project.

### Brand-identity flag (do NOT auto-attach)
- **Artec** appears as a US brand (Phenom, Nima Jalali, Cipher, Gabe Taylor, Figment) in the
  08/09 and 09/10 Blue Tomato catalogs. The catalog's `Artec` is *Slovenia/dormant* - most
  likely a different company. Flagged in those review files.

### Year evidence
Many models were sighted in multiple catalogs across consecutive years, giving sourced
first/last-year evidence a human can use to tighten the catalog. Nitro 03/04 in particular
confirmed all 21 of its models to MY2004 with zero new candidates.

## Attribution reliability (held on every document)

Per-product brand prefixes (Blue Tomato), per-spread brand headers (Method, Nitro) and
brand-logo banners kept attribution correct through every hard case: mixed-brand pages,
model names colliding with other brand names (F2 "Sonic"/"Summit", Elan "Sense"/"Artec"),
and the same model name on two brands (Burton vs Rossignol "Jeremy Jones"). Legibility was
high on every source (native 969-2995 px). Nothing was pattern-matched or guessed; anything
unreadable or unconfirmable was left out rather than risk a wrong attribution.

## Not reachable via Issuu

The genuinely pre-2004 multi-brand buyer's guides (TransWorld / ISM / Snowboarder
1989-1993, 200+ brands) live on **archive.org**, not Issuu, and need a different pipeline.
Whitelines guides are on their own site. Blue Tomato's Issuu run starts at 04/05.
