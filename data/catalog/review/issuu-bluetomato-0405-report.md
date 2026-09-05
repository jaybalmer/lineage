# Issuu extraction: Blue Tomato Snowboard Katalog 2004/05 (sister catalog) + 05/06 Girls

Follow-up to the 05/06 proof. Two things done here:
1. The **05/06 Girls section** (women's boards, pages 40-43) folded into the 05/06 files.
2. The **sister 2004/05 catalog** extracted end to end (men's boards + girls).

No database writes. Every model traced to a page opened. Same rule set: brand-prefixed
captions give reliable attribution; unrecognised names go to a human, never auto-added.

## 2004/05 document

| | |
|---|---|
| Issuu | https://issuu.com/blue-tomato/docs/blue-tomato-snowboardkatalog0405 |
| user / docId | `blue-tomato` / `blue-tomato-snowboardkatalog0405` |
| Language | German (captions abbreviate Santa Cruz as "SC") |
| Native image | 1070 x 1493 px |
| Board sections | men's freestyle/freeride img p8-23, Sets p24-25, Alpin p26-27, **Last-Season 03/04** p28-29, Girls img p72-74 |

**Year handling.** Main sections are the 2004/05 season = **model year 2005**. The
"Last Season" clearance pages (28-29) are 2003/04 stock = **model year 2004**, recorded
as such so the two years are not conflated.

## Attribution held again

Same structural guarantee: every caption carries the brand ("SC Duo GLX LTD 163",
"Hammer PSM 2 157", "Rossignol Travis Rice Pro 157"). Multi-brand pages (Salomon+Jeenyus
p21, Apo+Palmer p22, Rad-Air+Head p23, and the Sets/Last-Season/Girls pages) all resolve
per product. The German edition abbreviating Santa Cruz to "SC" was the only wrinkle, and
the brand logo banner on each spread confirmed it.

## Results

| Catalog | Boards | Confirmed | For review |
|---|---|---|---|
| 04/05 (this doc) | 146 | 86 (76 distinct) | 60 (59 distinct) |
| 05/06 incl. Girls | 139 | 85 | 54 |

Artifacts: `issuu-bluetomato-0405-confirmations.csv`, `issuu-bluetomato-0405-review-candidates.csv`,
and the updated `issuu-bluetomato-0506-*.csv` (now carrying a `section` column with the
girls rows). Raw transcription in scratchpad `bt0405_raw_extraction.json` / `bt0506_girls_raw.json`.

**18 brands** across the 04/05 board section. 16 are in the catalog; only **Jeenyus** and
**Apo Snowboards** are new. Notably present and already in-catalog: Duotone, Hammer, Head,
Hot, Palmer, Rad-Air.

## High-value finds

- **Hammer (a zero-model brand, identity now confirmed by Jay).** The two catalogs
  together source a real Hammer lineup: Twenty One, Contact (Heppu Pentti), PSM 2, Twilight,
  Private, Condense, Broadline, Logo, Premium, Seymour, Hyleyn. ~11 distinct models for a
  brand that currently holds zero.
- **Duotone (also zero-model).** Two models surfaced on the Last-Season 03/04 pages:
  Street and RPM (both MY2004).
- **Early pro models worth noting:** Rossignol **Travis Rice Pro** and **Todd Richards Pro**
  (04/05), plus Burton Un Inc Solberg. All land in review as new-model candidates
  (brand confirmed, model not yet in catalog).
- **Cross-year year evidence.** Many models appear in both catalogs (Burton Custom/T6,
  F2 Sonic/Eliminator, Nitro Shadow/Magnum, Völkl Selecta/Sting), giving MY2005 + MY2006
  sourced sightings that could tighten `first_year`/`last_year` for a human.

## New brands to add before their models (both catalogs)

- **Jeenyus** (USA): Eddie (Eddie Wall pro), Rental, The Woods, The Broads
- **Apo Snowboards** (France): Amanite, MTD, Line, Selekta, Isis, Friedl Kolar Signature

## Handling notes / honest caveats

- Santa Cruz "Duo Shield" and "Duo GLX LTD" both mapped to catalog "Duo"; "Shield"/"GLX LTD"
  may be distinct enough to warrant their own rows. Left as qualified confirmations with a
  note, flagged here for a human eye.
- Head "Team i. CT" mapped to the terse catalog model "i.CT" (same Head Intelligence board).
  Plausible but the catalog naming is thin; verify.
- Völkl Squad Flex 3 / Flex 4 are Squad-family variants; catalog holds only "Squad", so they
  sit in review as new-model candidates, not auto-confirmed.
- Nitro "Misfits" (plural) confirmed against catalog "Misfit" (singular) as a spelling variant.

## Recommendation

The Blue Tomato pair is now fully mined for men's + women's boards. Best next value from
this publisher would be resolving the two new brands and the zero-model Hammer/Duotone
candidate lists with a second source, then (optionally) the boots/bindings sections if the
catalog ever grows beyond boards. For a genuinely pre-2004 multi-brand source, Issuu does
not have one; that evidence lives on archive.org (TransWorld/ISM guides).
