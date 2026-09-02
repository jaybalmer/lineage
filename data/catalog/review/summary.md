# Snowboard catalog reconciliation, summary

Catalog: `data/catalog/v0.2/` (brands.csv, models.csv).
Existing: a real board export.

> Reconciled against a real board export. CATALOG_ONLY rows are genuine
> candidate additions; EXISTING_ONLY rows are boards you hold that the catalog
> lacks. This is a review pass only. Nothing was written to the database.

## Counts per bucket

| Bucket | Rows |
| --- | --- |
| MATCH | 74 |
| FUZZY | 12 |
| EXISTING_ONLY | 11 |
| CATALOG_ONLY | 1757 |
| **Total** | 1854 |

## Brand-level overlap

- Brands on BOTH sides: 22
- Brands in CATALOG only: 194
- Brands in EXISTING only: 0

<details><summary>Brands in catalog only (expected: catalog is far larger) - 194</summary>

5150, A-Team, Academy, Aggression, Airwalk, Alpha, Amplid, Apocalypse / A Snowboards / APO, Arnell, Artec, Asmo, Atlantis, Atomic, Avalanche, Ayack / Johly, B.O.N.E., Bamboo Curtain, BC Stream, Bird Surf, Black Fire, Black Pearl, Black Snow, Bohème, Bradar, Brandy, BuddyBuddy, Canadian Flyer, Cardiff, Cardiff Snowcraft, Chaix Vanom, Checker Pig, Choc, Circle One, Coiler, Contract, DC, Device, Dinosaurs Will Die, Division 23, Donek, Duotone, Dupraz, Duret, Dynastar, Elan, Endeavor, Energy, Eskimo, Exegi, Extrem, F2, Fanatic, Field Earth, Fjell, Flite, Flow, Forum, Foursquare, Franco Snowshapes, Freeway, Frople, Funky, Glissade, Goltes, Gordon & Smith, Gray, Green Lab, Gromel, Hackboards, Hammarplast Ski-Board, Hammer, Hayes Brothers, Head, Heavy Tools, Heelside, HF, Hiper, Hooger Booger, HOT, Icon, Imperium, Inferno, Jacks, Jasey-Jay Anderson, Joint, Joyride, Kemper, Kessler, Kneissl, LaCroix, Lamar, Limited, Liquid, Lobster, Local Motion, Look, Mambo, Meatfly, Mistral, Mosirita, Moss Snowstick, Naked Boards, Nash Skifer, Nectar, Niche, Nobile, O-Matic, OES, Ogasaka, Omni, Option, Original Sin, Oxess, Oxygen, Palmer, Pogo, Powder Stick, Prana Punks, Prior, Prop, Public, Pureboarding, Rabanser, Rabbit, Rad Air, Rebel Skate & Snow, Rice28, Ripcurl Snowsurf Co., Rossignol, Roxy, Santa Cruz, Saunzee, Season Eqpt, Sense, Sentury, SG Snowboards, Shady Sharks, Signal, Silence, Ska Board, Skosh, Skriss, Skyrider, Slash, Smokin, Snow Surf / Lusti, Snowtech, Snurf, Snurfer, Solid, Solo Ski, Sonic, Special Blend, Sporten, Static, Stepchild, Storm, Stranda, Summit, Surfavo, Surfneige, Swell Panik, Swift, Swoard, Technine, Telos, Thirst, ThirtyTwo, Transition, Type A, Ultimate Control Boards, United Shapes, Unity, Variflex, Vector Glide, Venture, Vimana, Virus, Vision, Voile, Völkl, Vortex / Techtonic, Wave, Weekend, WEST, Westige, Weston, White Bear, Whitegold, Wild Duck, Winter Surf, Winterstick, Wired, Yonex

</details>

## CATALOG_ONLY count per brand (candidate additions)

| Brand | Rows |
| --- | --- |
| Burton | 264 |
| Nitro | 106 |
| K2 | 86 |
| Salomon | 79 |
| Ride | 65 |
| GNU | 62 |
| Rossignol | 58 |
| Nidecker | 55 |
| Morrow | 52 |
| Forum | 51 |
| Elan | 49 |
| Lib Tech | 47 |
| Santa Cruz | 45 |
| Arbor | 41 |
| Rome | 39 |
| Never Summer | 35 |
| Bataleon | 33 |
| Option | 30 |
| Sims | 30 |
| Palmer | 29 |
| Völkl | 28 |
| CAPiTA | 27 |
| Flow | 24 |
| Atomic | 23 |
| F2 | 23 |
| Head | 19 |
| YES. | 18 |
| Stepchild | 15 |
| Kemper | 14 |
| Joyride | 13 |
| DC | 12 |
| Gentemstick | 12 |
| Jones | 12 |
| Lamar | 11 |
| Prior | 11 |
| Mistral | 10 |
| Ogasaka | 10 |
| Avalanche | 9 |
| Division 23 | 9 |
| Donek | 9 |
| SG Snowboards | 9 |
| Yonex | 9 |
| Coiler | 8 |
| Crazy Banana | 8 |
| Endeavor | 8 |
| Moss Snowstick | 8 |
| Roxy | 8 |
| Slash | 8 |
| Amplid | 7 |
| Hooger Booger | 7 |
| Korua Shapes | 7 |
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
| Barfoot | 5 |
| Look | 5 |
| Season Eqpt | 5 |
| United Shapes | 4 |
| Winterstick | 4 |
| Aggression | 3 |
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
| Lib Tech | 5 |
| Barfoot | 2 |
| Burton | 1 |
| Gentemstick | 1 |
| Gnu | 1 |
| Korua | 1 |

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

- Barfoot Freestyle: YEAR CONFLICT: existing 1981 vs catalog introduced 1986
- Bataleon Disaster: YEAR CONFLICT: existing 2021 vs catalog introduced 2012
- Bataleon Evil Twin: YEAR CONFLICT: existing 2007 vs catalog introduced 2006
- Bataleon Goliath: YEAR CONFLICT: existing 2010 vs catalog introduced 2005
- Burton Cruzer: YEAR CONFLICT: existing 1980 vs catalog introduced 1985
- Burton Flight Attendant: YEAR CONFLICT: existing 2019 vs catalog introduced 2015
- Burton Hometown Hero: YEAR CONFLICT: existing 2018 vs catalog introduced 2020
- Burton Kilroy: YEAR CONFLICT: existing 2010 vs catalog introduced 2018
- Burton Name Dropper: YEAR CONFLICT: existing 2014 vs catalog introduced 2017
- Burton Talent Scout: YEAR CONFLICT: existing 2010 vs catalog introduced 2017
- CAPiTA Mega Mercury: YEAR CONFLICT: existing 2010 vs catalog introduced 2023
- CAPiTA Mercury: YEAR CONFLICT: existing 2019 vs catalog introduced 2016
- CAPiTA Ultrafear: YEAR CONFLICT: existing 2022 vs catalog introduced 2011
- Gentemstick Stingray: YEAR CONFLICT: existing 2000 vs catalog introduced 2015
- GNU BAS: YEAR CONFLICT: existing 1994 vs catalog introduced 1995
- Jones Explorer: YEAR CONFLICT: existing 2021 vs catalog introduced 2016
- Jones Flagship: YEAR CONFLICT: existing 2020 vs catalog introduced 2011
- Jones Frontier: YEAR CONFLICT: existing 2010 vs catalog introduced 2020
- Jones Hovercraft: YEAR CONFLICT: existing 2010 vs catalog introduced 2011
- Jones Mountain Twin: YEAR CONFLICT: existing 2013 vs catalog introduced 2011
- Jones Stratos: YEAR CONFLICT: existing 2010 vs catalog introduced 2020
- K2 Antidote: YEAR CONFLICT: existing 2010 vs catalog introduced 2024
- K2 Broadcast: YEAR CONFLICT: existing 2010 vs catalog introduced 2019
- K2 Manifest: YEAR CONFLICT: existing 2010 vs catalog introduced 2019
- K2 Party Platter: YEAR CONFLICT: existing 2020 vs catalog introduced 2017
- K2 Raygun: YEAR CONFLICT: existing 2018 vs catalog introduced 2010
- Korua Shapes Café Racer: YEAR CONFLICT: existing 2010 vs catalog introduced 2020
- Korua Shapes Otto: YEAR CONFLICT: existing 2010 vs catalog introduced 2018
- Korua Shapes Pencil: YEAR CONFLICT: existing 2010 vs catalog introduced 2018
- Lib Tech Orca: YEAR CONFLICT: existing 2021 vs catalog introduced 2019
- Never Summer Harpoon: YEAR CONFLICT: existing 2010 vs catalog introduced 2021
- Never Summer Proto FR: YEAR CONFLICT: existing 2014 vs catalog introduced 2026
- Never Summer Proto Type Two: YEAR CONFLICT: existing 2020 vs catalog introduced 2016
- Never Summer West: YEAR CONFLICT: existing 2010 vs catalog introduced 2016
- Nitro Fusion: YEAR CONFLICT: existing 1989 vs catalog introduced 1990

## Data quality notes

- Catalog: 111 model(s) carry a first_year of 2027 (a year ahead of the Sept 2026 research date). 109 are `earliest_sourced` (current retailer listings = the 2026/27 model year, defensible) and 2 are `introduced` (worth a spot-check). This is the pattern the catalog README flags.
- Catalog: no model names contain obvious non-board terms (binding/boot/glove/etc.).
- Existing data: 3 duplicate brand+model row(s) that should be merged: Barfoot Freestyle, Burton Performer Elite, Lib Tech Emma Peele.
- Existing data: 33 of 97 dated boards carry the same year (2010) - likely a placeholder/default `model_year`, not a real first year. Many of the year conflicts above stem from this. Worth a data cleanup pass.
- Linestry's `orgs` also carries non-board brands (outerwear, bindings, boots,
  media). Those are out of scope for a board catalog and are not counted as
  existing board brands here.

## Decisions that need a human

1. Which CATALOG_ONLY rows to import as new boards (these are the genuine additions).
2. Which EXISTING_ONLY rows to keep vs. retire (rows with no source are flagged `needs_source`).
3. Which FUZZY pairs are the same board and should merge (none are auto-merged).
4. Whether to adopt the catalog's `model_id` slug (`brand-slug--model-slug`) as the
   canonical board key going forward.
