# Issuu extraction proof: Blue Tomato Snowboard Katalog 2005/06

Phase 2 of the Issuu survey. One document extracted end to end to test whether the
reader3 + vision-OCR pipeline yields **reliable brand attribution on a multi-brand
spread**. No database writes. Every model traced to a page I actually opened.

## Document

| | |
|---|---|
| Publisher | Blue Tomato (Schladming, Austria) |
| Issuu | https://issuu.com/blue-tomato/docs/blue-tomato-snowboard-katalog0506 |
| user / docId | `blue-tomato` / `blue-tomato-snowboard-katalog0506` |
| reader3 JSON | `https://reader3.isu.pub/blue-tomato/blue-tomato-snowboard-katalog0506/reader3_4.json` (gzip) |
| Pages | 125 total; **men's SNOWBOARDS section = printed pages 004-023 (image pages 4-23)** |
| Native image | 1072 x 1499 px (`image.isu.pub/<id>/jpg/page_N.jpg`); `?width=` ignored, `/original/` 403, so this is the ceiling |
| Season | 2005/06 buying season = **model year 2006** per RESEARCH_BRIEF year convention |

Section map from the catalog's own contents note (p3): Snowboards 4-23, Boots & Bindings
24-38, Girls 40-64, Mens Wear 66-102, Accessories 104-118. I extracted the men's
snowboard section only. A women's-board pass lives in Girls (40-64), not yet done.

## Mechanism confirmed

`reader3_4.json` returns the pages array with `imageUri` per page. The text layer
(`layers.isu.pub/.../page_N.bin`) is a binary blob, so I did not use it. OCR was done by
reading the page JPGs directly with vision, which is more reliable than tesseract on the
stylised catalog type and needed no local OCR install (there is no tesseract/PIL on this box).

## Legibility: honest assessment

Legibility is **high**. At 1072 px wide the product captions, spec tables and prices are
cleanly readable. Body marketing prose is fully readable too. The few OCR hazards are
graphic-display type, not the captions:

- Header display type on a couple of boards is stylised (e.g. p4 spread header printed
  "WASETLAND" as a graphic while the caption read the real name). The **caption strip
  under each board is plain type and is the source of truth**, so this did not affect data.
- Sizes with a European decimal comma read correctly (e.g. Nitro Misfit "158,6").
- Umlaut brand "Völkl" reads correctly and matches the catalog's umlaut spelling (not "Volkl").

## Attribution reliability: the key finding

**Brand attribution on this catalog is reliable, and the reason is structural.** Blue
Tomato prints the **full brand name inside every product caption**, in the fixed format:

```
[item#] [BRAND] [model...] [size] 05/06 [+ binding]
e.g.  01 Santa Cruz TT Fusion 154 05/06
      06 Rome Flag 163 05/06
      02 Atomic Discharger 158 05/06 + Zombi
```

So attribution never depends on "which section am I in" inference. This survived the two
hard cases in the section:

1. **Mixed-brand pages.** p19 is Jeenyus (top) + Rome (bottom); p20 is Salomon (top) +
   Apo (bottom); p22 is a package-deal page mixing F2/Atomic/Santa Cruz/Völkl/Rossignol.
   Each product still names its own brand, so the split is unambiguous.
2. **Model names that collide with real brand names.** F2 sells models named **"Sonic"**
   and **"Summit"**; Elan sells an **"Artec"** line. All three ("Sonic", "Summit", "Artec")
   are *standalone brands* in our zero-model list. The brand-prefixed caption attributes
   them correctly to F2 / Elan, defeating exactly the misattribution the brief warns about.
   Two different brands even ship a **"Jeremy Jones"** board here (Burton's jib pro vs
   Rossignol's freeride pro) and the prefix keeps them apart.

Secondary confirmation exists but is weaker: each spread has a brand banner/logo at the
top, and board deck graphics usually carry the logo. Those corroborate but the caption is
the reliable signal.

## What came out

117 board products transcribed from pages 6-23 across **15 brands**. Bindings (p23 F2
plate bindings) and the bundled binding names after "+" on p22 were excluded as non-boards.

| Bucket | Distinct | Meaning |
|---|---|---|
| **Confirmed** | **70** | brand + model verified against the live v0.3 catalog (59 exact, 11 qualified) |
| Review: new-model candidate | 35 | brand is in catalog, this model is not. Sourced appearance, needs a human before add |
| Review: brand-new | 6 | brand absent from catalog (Jeenyus: Eddie, Rental; Apo Snowboards: Amanite, MTD, Line, Selekta) |
| Review: brand-identity flag | 4 | Hammer (see below) |

Artifacts:
- `issuu-bluetomato-0506-confirmations.csv` - the 70 confirmed appearances
- `issuu-bluetomato-0506-review-candidates.csv` - the 45 for a human
- raw transcription: scratchpad `bt0506_raw_extraction.json`

### The 15 brands (all attribution reliable)
Santa Cruz, F2, Burton, Atomic, Bataleon, Elan, Rossignol, Völkl, Nitro, Forum, Jeenyus,
Rome, Salomon, Apo Snowboards, Hammer. 13 are already in the catalog; Jeenyus and Apo are
new; Hammer is flagged.

## Flags for a human (do NOT auto-add)

- **Hammer identity mismatch.** Our catalog's `Hammer` is *France / defunct*. The Hammer on
  p21 is **hammersnowboards.com** (boards developed by Jon Cartwright), which is not
  obviously the same company. Attaching PSM 2 / Twenty One / Contact / Broadline to the
  French Hammer record could be a wrong-brand attribution. Left in the review file until the
  brand identity is resolved.
- **Rules-compliant omissions.** "New-model candidate" rows are deliberately NOT promoted.
  A 2006 retailer catalog is a good secondary source (`likely`), and combined with a brand
  archive would reach `verified`, but per the golden rule I did not pattern-match them into
  the catalog. They are a clean, sourced worklist.
- **Bataleon debut value.** Bataleon founded ~2005; this is a primary-source snapshot of its
  first lineup (SX Project, Undisputed, Enemy, Hero, Goliath, Evil Twin) with the Triple
  Base Technology explainer. High value if we want Bataleon's `first_year` nailed to 2006.

## Recommendation

The pipeline works and this publisher is a strong, low-risk multi-brand source because of
the per-product brand prefix. Sensible next steps, in order: (1) resolve the Hammer
identity and the 6 brand-new rows; (2) run the Girls section (pages 40-64) of this same
doc for women's boards; (3) extract the sister **Blue Tomato 2004/05** (`blue-tomato-snowboardkatalog0405`,
113 pp) for one-season-earlier `first_year` evidence. Vintage 1990s multi-brand guides
(TransWorld) are **not** on Issuu; they live on archive.org, so Issuu's best vintage
multi-brand value is this Blue Tomato pair.
