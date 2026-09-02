# Snowboard catalog reconciliation, summary

Catalog: `data/catalog/v0.2/` (brands.csv, models.csv).
Existing: the demo baseline

> DEMO BASELINE. The existing side here is Linestry's demo/seed data
> (`src/lib/mock-data.ts`), NOT the production Supabase catalog. It holds only
> a small hand-picked board set, so almost every catalog model reads as
> CATALOG_ONLY. Re-run against a real Supabase export before treating any
> CATALOG_ONLY row as a genuine addition. Nothing here was written to the database.

## Counts per bucket

| Bucket | Rows |
| --- | --- |
| MATCH | 24 |
| FUZZY | 3 |
| EXISTING_ONLY | 5 |
| CATALOG_ONLY | 1815 |
| **Total** | 1847 |

## Brand-level overlap

- Brands on BOTH sides: 31
- Brands in CATALOG only: 185
- Brands in EXISTING only: 1

**Existing brands not found in the catalog** (each explains a cluster of misses; scrutinise):

- Mervin Manufacturing

<details><summary>Brands in catalog only (expected: catalog is far larger) - 185</summary>

5150, A-Team, Academy, Aggression, Airwalk, Alpha, Amplid, Apocalypse / A Snowboards / APO, Arnell, Artec, Asmo, Atlantis, Atomic, Avalanche, Ayack / Johly, B.O.N.E., Bamboo Curtain, BC Stream, Bird Surf, Black Fire, Black Pearl, Black Snow, Bohème, Bradar, Brandy, BuddyBuddy, Canadian Flyer, Cardiff, Cardiff Snowcraft, Chaix Vanom, Checker Pig, Choc, Circle One, Coiler, Contract, Crazy Banana, DC, Device, Dinosaurs Will Die, Division 23, Donek, Duotone, Dupraz, Duret, Dynastar, Elan, Energy, Eskimo, Exegi, Extrem, F2, Fanatic, Field Earth, Fjell, Flite, Flow, Foursquare, Franco Snowshapes, Freeway, Frople, Funky, Glissade, Goltes, Gordon & Smith, Gray, Green Lab, Gromel, Hackboards, Hammarplast Ski-Board, Hammer, Hayes Brothers, Head, Heavy Tools, Heelside, HF, Hiper, HOT, Icon, Imperium, Inferno, Jacks, Jasey-Jay Anderson, Joint, Joyride, Kessler, Kneissl, LaCroix, Lamar, Limited, Liquid, Lobster, Local Motion, Look, Mambo, Meatfly, Mistral, Mosirita, Moss Snowstick, Naked Boards, Nash Skifer, Nectar, Niche, Nobile, O-Matic, OES, Ogasaka, Omni, Original Sin, Outland, Oxess, Oxygen, Pogo, Powder Stick, Prana Punks, Prop, Public, Pureboarding, Rabanser, Rabbit, Rad Air, Rebel Skate & Snow, Rice28, Ripcurl Snowsurf Co., Roxy, Santa Cruz, Saunzee, Season Eqpt, Sense, Sentury, SG Snowboards, Shady Sharks, Silence, Ska Board, Skosh, Skriss, Skyrider, Smokin, Snow Surf / Lusti, Snowtech, Snurf, Snurfer, Solid, Solo Ski, Sonic, Special Blend, Sporten, Static, Stepchild, Storm, Stranda, Summit, Surfavo, Surfneige, Swell Panik, Swift, Swoard, Technine, Telos, Thirst, ThirtyTwo, Transition, Type A, Ultimate Control Boards, United Shapes, Unity, Variflex, Vector Glide, Venture, Vimana, Virus, Vision, Voile, Völkl, Vortex / Techtonic, Wave, Weekend, WEST, Westige, Weston, White Bear, Whitegold, Wild Duck, Winter Surf, Wired, Yonex

</details>

## CATALOG_ONLY count per brand (candidate additions)

| Brand | Rows |
| --- | --- |
| Burton | 276 |
| Nitro | 108 |
| K2 | 90 |
| Salomon | 77 |
| GNU | 68 |
| Ride | 64 |
| Nidecker | 60 |
| Rossignol | 58 |
| Lib Tech | 55 |
| Morrow | 53 |
| Forum | 51 |
| Elan | 49 |
| Arbor | 45 |
| Santa Cruz | 45 |
| Never Summer | 39 |
| Rome | 37 |
| Bataleon | 36 |
| CAPiTA | 32 |
| Option | 30 |
| Palmer | 29 |
| Sims | 28 |
| Völkl | 28 |
| Flow | 24 |
| Atomic | 23 |
| F2 | 23 |
| Head | 19 |
| YES. | 18 |
| Jones | 17 |
| Gentemstick | 15 |
| Stepchild | 15 |
| Kemper | 14 |
| Joyride | 13 |
| DC | 12 |
| Korua Shapes | 11 |
| Lamar | 11 |
| Prior | 11 |
| Mistral | 10 |
| Ogasaka | 10 |
| Avalanche | 9 |
| Crazy Banana | 9 |
| Division 23 | 9 |
| Donek | 9 |
| SG Snowboards | 9 |
| Yonex | 9 |
| Coiler | 8 |
| Endeavor | 8 |
| Moss Snowstick | 8 |
| Roxy | 8 |
| Slash | 8 |
| Amplid | 7 |
| Hooger Booger | 7 |
| Lobster | 7 |
| Signal | 7 |
| Weston | 7 |
| Cardiff | 6 |
| Checker Pig | 6 |
| Flite | 6 |
| HOT | 6 |
| Oxess | 6 |
| Public | 6 |
| Unity | 6 |
| Look | 5 |
| Season Eqpt | 5 |
| United Shapes | 4 |
| Winterstick | 4 |
| Aggression | 3 |
| Barfoot | 3 |
| Fanatic | 3 |
| Dupraz | 2 |
| Nobile | 2 |
| Oxygen | 2 |
| Telos | 2 |
| Airwalk | 1 |
| BC Stream | 1 |
| Original Sin | 1 |
| Rad Air | 1 |
| Vision | 1 |

## EXISTING_ONLY count per brand (needs the most scrutiny)

| Brand | Rows |
| --- | --- |
| Barfoot | 4 |
| Gnu | 1 |

## Brand alias table used

Canonical brand key <- variant spellings folded onto it (from the brief plus aliases discovered in the existing data):

| Canonical | Variants |
| --- | --- |
| arbor | arbor, arbor snowboards |
| bataleon | bataleon, bataleon snowboards |
| bonfire | bonfire, bonfire snowboarding |
| burton | burton, burton snowboards |
| capita | capita |
| dc | dc, dc shoes |
| endeavor | endeavor, endeavor snowboards |
| flow | flow, flow snowboarding |
| forum | forum, forum snowboards |
| gnu | gnu |
| jones | jones, jones snowboards |
| k2 | k2, k2 snowboarding |
| kemper | kemper, kemper snowboards |
| korua | korua, korua shapes |
| lib tech | lib tech, lib technologies, libtech |
| mervin | mervin, mervin manufacturing |
| morrow | morrow, morrow snowboards |
| moss | moss, moss snowstick |
| never summer | never summer, never summer industries |
| nitro | nitro, nitro snowboards |
| option | option, option snowboards |
| palmer | palmer, palmer snowboards |
| prior | prior, prior snowboards |
| ride | ride, ride snowboards |
| rome | rome, rome sds |
| rossignol | rossignol, rossignol snowboards |
| salomon | salomon, salomon snowboards |
| santa cruz | santa cruz |
| season | season, season eqpt |
| sg | sg, sg snowboards |
| signal | signal, signal snowboards |
| sims | sims, sims snowboards |
| slash | slash, slash snowboards |
| vans | vans, vans snowboarding |
| volkl | volkl, völkl |
| yes | yes, yes., yes snowboards |

Brand stopwords removed before alias lookup: inc, sds, snowboard, snowboarding, snowboards.

## Year conflicts among MATCH rows

Only `introduced` catalog years that disagree with the existing first year are
conflicts. An `earliest_sourced` catalog year later than the existing year is expected,
not a conflict, and is not listed here.

- Barfoot Freakstyle: YEAR CONFLICT: existing 1986 vs catalog introduced 1989
- Barfoot Freestyle: YEAR CONFLICT: existing 1981 vs catalog introduced 1986
- Barfoot Twin Tip: YEAR CONFLICT: existing 1985 vs catalog introduced 1987
- Burton Flight Attendant: YEAR CONFLICT: existing 2014 vs catalog introduced 2015
- CAPiTA Mercury: YEAR CONFLICT: existing 2015 vs catalog introduced 2016
- CAPiTA Ultrafear: YEAR CONFLICT: existing 2018 vs catalog introduced 2011
- Jones Explorer: YEAR CONFLICT: existing 2015 vs catalog introduced 2016
- Jones Flagship: YEAR CONFLICT: existing 2018 vs catalog introduced 2011
- K2 Party Platter: YEAR CONFLICT: existing 2011 vs catalog introduced 2017
- K2 Raygun: YEAR CONFLICT: existing 2004 vs catalog introduced 2010
- Lib Tech Orca: YEAR CONFLICT: existing 2016 vs catalog introduced 2019
- Never Summer Proto Type Two: YEAR CONFLICT: existing 2013 vs catalog introduced 2016
- Sims Half Pipe: YEAR CONFLICT: existing 1998 vs catalog introduced 1989
- Sims Switchblade: YEAR CONFLICT: existing 1996 vs catalog introduced 1988

## Data quality notes

- Catalog: 111 model(s) carry a first_year of 2027 (a year ahead of the Sept 2026 research date). 109 are `earliest_sourced` (current retailer listings = the 2026/27 model year, defensible) and 2 are `introduced` (worth a spot-check). This is the pattern the catalog README flags.
- Catalog: no model names contain obvious non-board terms (binding/boot/glove/etc.).
- The existing demo set includes yearly Barfoot entries (one row per production
  year); these are deduplicated to distinct brand+model before matching, so the
  first_year_existing shown is the earliest production year on record.
- Linestry's `ORGS` also carries non-board brands (outerwear, bindings, boots,
  media). Those are out of scope for a board catalog and are not counted as
  existing board brands here.

## Decisions that need a human

1. Replace the demo baseline with a real Supabase `boards`/`orgs` export and re-run,
   so CATALOG_ONLY reflects genuine gaps rather than the demo set's small size.
2. Which EXISTING_ONLY rows to keep vs. retire (rows with no source are flagged `needs_source`).
3. Which FUZZY pairs are the same board and should merge (none are auto-merged).
4. Whether to adopt the catalog's `model_id` slug (`brand-slug--model-slug`) as the
   canonical board key going forward.
