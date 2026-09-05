# Catalog provenance layer - spec

## Decisions (locked by Jay, 2026-09-05)

1. **Grain: the live `boards` row.** Citations hang off the member-facing board, so the chip
   renders on the page people visit. Importer resolves each CSV sighting to a `boards.id`
   using the catalog-refresh reconciler.
2. **Unresolved sightings: hold.** A confirmed sighting that doesn't match a live board is NOT
   auto-created; it goes to the unresolved log and feeds the normal catalog-merge review.
3. **Show all sightings, as DISCRETE documented years - never invent the gaps between them.**
   Collectors care about the exact year/graphic they rode, so every documented sighting is
   its own citation. Critical rule: our sightings are *sparse* (we scanned some catalogs, not
   every year of every publisher), so the UI must render discrete evidence points
   ("Documented in 2006, 2007, 2010") and must NEVER draw a continuous range ("2006-2010")
   across them - that would imply years we have no evidence for. This is deliberately
   different from the model's `first_year`/`last_year`, which is a range built from other
   sourcing; the "Documented in" list is evidence, not a span.

---


Turn the Issuu extraction into a **"Documented in" source layer** on board pages: cite the
primary catalog each model appears in and deep-link to it. Treats Linestry as an *index* of
the sport's history, which is exactly its brand. Zero image re-hosting.

## Two things that must stay separate

1. **Existence provenance** - attribution for the *fact* that a model existed, citing the
   catalog page. Pure text + a link. No image. **No copyright exposure at all.** This is the
   whole value and the safe 90%.
2. **Image provenance** - when an image is *shown*, record where it came from and attribute
   it. This rides on the image system the app already has (see below); it does not require
   re-hosting anything.

Build #1 first and completely. Treat #2 as a follow-on that only ever *links/points* at
images, never copies them.

## What the app already does with images (important context)

`board-parts.tsx` resolves a board cover in this order:
1. `board.image_url` (manual) →
2. community-suggested URL (`board_image_votes.suggested_image_url`, via `/api/board-image`) →
3. Serper/Google Image Search result (a **remote** URL) →
4. brand logo fallback.

Every non-fallback tier renders `<img src>` pointed at a **remote** URL. The app stores a
URL, never a copied file. So Linestry is already in the safer "hotlink, don't re-host"
posture. The provenance layer should follow that same rule: **link to the Issuu-hosted page
/ image, never copy the JPG into Supabase.**

## What senditdb most likely did (your question)

Best read: they took on the risk. Enthusiast catalog sites almost always either re-host
small thumbnails scraped from old guides or lean on community uploads, and operate on an
archival / low-commercial-profile / takedown-on-request basis - i.e. betting no brand sends
a DMCA. That is a *risk posture*, not a legal safe harbour, and it is a worse posture than
Linestry's current hotlink approach. Copying their model would mean copying their risk. We
don't have to: we can index and cite (fully safe) and keep images on the hotlink path the
app already uses. If we ever want catalog imagery specifically, license it (brand press
kits) or take user uploads - don't re-host catalog scans.

## Data model

New additive table (member-facing catalog is the live `boards` table - uuid ids):

```sql
create table board_sources (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references boards(id) on delete cascade,
  kind         text not null default 'existence'   -- 'existence' | 'image'
                 check (kind in ('existence','image')),
  publisher    text not null,        -- 'Blue Tomato', 'Method Snowboard Magazine', 'Nitro'
  doc_title    text,                 -- '2006/07 Snowboard Katalog', 'Method Vol 23'
  doc_id       text,                 -- issuu docId
  source_url   text not null,        -- deep link to the issuu doc (+ #page when known)
  page         int,                  -- printed/image page, nullable
  model_year   int,                  -- the catalog's model year for this sighting
  match_type   text,                 -- 'EXACT' | 'QUALIFIED' (from the reconcile)
  image_url    text,                 -- only kind='image': the specific remote image (hotlink), nullable
  added_by     uuid,                 -- null = system import
  created_at   timestamptz not null default now()
);
create index board_sources_board_idx on board_sources(board_id);
create unique index board_sources_dedup
  on board_sources(board_id, coalesce(doc_id,''), coalesce(page,0), kind);
```

Risk-gate classification: **SAFE** (CREATE TABLE + indexes; new RLS policy on a table created
this session; read-through view if wanted). No touch to `profiles`/Stripe/existing rows.

RLS: public read; writes via service role from the importer (like other catalog mutations).

Note the alternative: the v0.3 research schema already has `snowboard_models.sources text[]`,
but that is the *research* import, not the member-facing `boards` table, and a flat URL array
can't hold publisher/page/year. A structured `board_sources` row per sighting is the right
grain and is exactly what the extraction CSVs already contain.

## Ingestion

A one-off script (data-only, re-runnable, idempotent on the dedup index):

1. Read every `data/catalog/review/issuu-*-confirmations.csv` (the 1,095 confirmed rows).
2. For each row, resolve `(brand, model_ocr / catalog_model_name)` to a `boards.id`. Reuse
   the reconciler the **catalog-refresh skill** already uses for brand+model matching - do
   not write a new fuzzy matcher.
3. Upsert one `board_sources` row per (board, doc, page), `kind='existence'`, carrying
   publisher / doc_title / doc_id / source_url / page / model_year / match_type.
4. Log unresolved rows to a review CSV (a board sighting with no live catalog match =
   probably a model we haven't imported yet; feeds the candidate list).

Source-URL shape: `https://issuu.com/<user>/docs/<docId>` (add the page anchor Issuu supports
when we have a page number). All of `<user>`, `<docId>`, `page`, `model_year` are already in
the CSVs and the inventory.

Roughly: 15 documents, 1,095 confirmed sightings, ~7 zero-model brands and ~14 new brands
whose sightings won't resolve until those models/brands are imported (that's fine - they land
in the unresolved log as a to-do).

## UI

**Board detail page** (`boards/[id]/page.tsx`) - a small **"Documented in"** section:

> **Documented in**
> · Blue Tomato 2006/07 catalogue - p137 ↗
> · Blue Tomato 2007/08 catalogue - p8 ↗
> · Method Vol 23 buyer's guide (2022) ↗

Each row links to the Issuu page in a new tab. Tone: factual, archival, understated. This is
the differentiator - primary-source provenance no competitor has, and it reinforces the
"living history graph" positioning.

**Board image caption** (Phase 2, optional) - when a shown image has a known source, a tiny
"photo: <publisher> ↗" caption under it. If we ever surface the catalog page image itself,
it is an `<img src>` pointed at the Issuu-hosted file (hotlink) or, better, a "view in the
original catalogue" link - never a Supabase copy.

## Phasing

- **Phase 1 (do this):** `board_sources` table + importer + "Documented in" chip. Existence
  only. Fully safe, high archival value, small surface.
- **Phase 2 (later):** image-source attribution on the existing hotlink tiers; optional
  "view page in catalogue" deep link. Still no re-hosting.
- **Not now:** hosting any catalog image file in our own storage. If we want owned imagery,
  that's a licensing / user-upload workstream, not a scraping one.

## Open decisions - RESOLVED (see "Decisions (locked)" at top)

All three settled: boards grain; hold unresolved; show all sightings as discrete years with
no gap-filling. The earliest documented year is still worth visually emphasising (it's the
"first documented" data point), but every sighting renders and no range is drawn across them.

## Legal caveat (not advice)

Existence citation + deep-link is safe. Anything that *displays* a third-party image - even
the hotlink the app already does - carries some residual risk and should get a real
once-over from someone who does IP for a living before it scales. The spec above keeps
Phase 1 clear of it entirely.
