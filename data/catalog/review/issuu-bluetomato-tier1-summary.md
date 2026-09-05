# Blue Tomato Tier 1 extraction summary (model years 2007-2010)

Boards only. The four Blue Tomato catalogs that fill the gap between the already-done
05/06 and the modern era, all extracted end to end with the proven reader3 + vision-OCR
pipeline. No database writes. Every model traced to a page opened; per-product brand
prefix makes attribution reliable throughout.

## Per-catalog

| Catalog | Model yr | Pages | Board sections | Boards | Confirmed | Review |
|---|---|---|---|---|---|---|
| 06/07 | 2007 | 139 | mens p4-23, girls p84-87 | 147 | 96 | 51 |
| 07/08 | 2008 | 180 | mens p4-21, girls p98-101 | 146 | 106 | 40 |
| 08/09 | 2009 | 179 | mens p108-127, girls p147-152 | 143 | 105 | 38 |
| 09/10 | 2010 | 219 | mens p121-144, girls p163-167 | 169 | 121 | 48 |
| **Tier 1 total** | | | | **605** | **428** | **177** |

Files: `issuu-bluetomato-{0607,0708,0809,0910}-{confirmations,review-candidates}.csv`.
Each confirmation is a board whose brand+model matched the live v0.3 catalog (exact, or a
qualified match where the printed name adds a construction/edition/graphic word to a
catalog base model). Each review row is a sourced candidate for a human, never auto-added.

## Highest-value results

**Zero-model brands filled** (brands the catalog holds with no models until now, each a
sourced candidate list for a human):
- **Icon** (Finland): 8 distinct models (Heppu Pentti, Asgard, Revival, DS, Wallpaper, Danny, Gummi, ...)
- **O-Matic**: 6 (Sweet Hampus Mosesson, Awesome Todd Richards, Boron, Extr-emo, Celebrity Louie Vito, Extr-Eco)
- **Hammer** (France, identity confirmed by Jay earlier): 4 more from 06/07

**Brand-new labels** (not in the catalog at all; each needs a brand row before its models):
- **FTWO** (F.TWO): 13 models. IMPORTANT: FTWO is a *separate* German brand that took F2's
  former freestyle line (Real, Respect, Random, Summit, TNT, Alien). By 09/10 the catalog
  prints it co-branded as "F2 - FTWO". Do not merge these into F2's record without a human
  decision on how F2 vs FTWO should be represented.
- **Apo Snowboards** (France): 11 models
- **Light** (Light Board Corp): 2; **Love**: 1; **Aesthetiker**: 1; **Jeenyus**: 1

**Brand-identity flag (do NOT auto-attach):**
- **Artec** appears as a standalone US snowboard brand (Phenom, Nima Jalali, Cipher, Gabe
  Taylor, Figment) in 08/09 and 09/10. The catalog's `Artec` is *Slovenia/dormant* and is
  most likely a different company. Flagged in the review files; a human should decide
  whether to add a separate US-Artec brand row.

**New brands that ARE already in the catalog** (so their models reconciled cleanly): Capita
(from 06/07), GNU + Lib Tech (from 07/08), YES + Amplid + DC (from 09/10), plus Roxy, Flow,
Ride throughout.

## Attribution reliability

Unchanged from the proof: every product caption carries its brand, so mixed-brand pages,
model names that collide with other brand names (F2 "Sonic"/"Summit", Elan "Sense"/"Artec"),
and same-name-different-brand boards ("Jeremy Jones" on both Burton and Rossignol) all
resolve correctly. Legibility was high on every catalog (native ~1071x1500).

## What is NOT in these files (deliberate omissions)

- Boots and bindings (out of scope by request).
- Alpine/raceboards: present only in 06/07 and 07/08 (F2 Speedster line); 08/09 and 09/10
  men's sections are freestyle/freeride only.
- Any model I could not read cleanly or confirm was left out rather than guessed.

## Suggested next (Tiers 2-4, not yet done)

Per `issuu-next-guides-worklist.md`: Method Vol 23 + 24/25 (US modern cross-check), Nitro
96/97 (1990s single-brand primary source), then Blue Tomato 2015-2018 (lowest marginal
yield). The genuinely pre-2004 multi-brand guides remain archive.org-only, not Issuu.
