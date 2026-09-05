-- Catalog provenance layer, Phase 1: "Documented in" source citations for boards.
--
-- Each row is one documented SIGHTING of a board model in a primary-source
-- catalog (Blue Tomato / Method / Nitro, mined from Issuu). A board can have many
-- sightings across years; the UI lists them as DISCRETE documented years and never
-- draws a continuous range across them, because our sightings are sparse (we
-- scanned some catalogs, not every year of every publisher). This is deliberately
-- separate from boards' own model_year / the research first_year-last_year span:
-- board_sources is evidence, not a span. See data/catalog/review/provenance-layer-spec.md.
--
-- Additive only (CREATE TABLE + indexes + RLS-on with a public-read policy). Writes
-- come from scripts/import-board-sources.mjs via the service-role client, so no
-- insert/update/delete policy is defined; RLS denies those to anon/authenticated by
-- default. Reads are public (board pages are public), hence the select-using-true
-- policy, mirroring how the catalog itself is world-readable.
create table if not exists board_sources (
  id           uuid primary key default gen_random_uuid(),
  board_id     text not null references boards(id) on delete cascade,
  kind         text not null default 'existence'
                 check (kind in ('existence','image')),
  publisher    text not null,        -- 'Blue Tomato', 'Method Snowboard Magazine', 'Nitro'
  doc_title    text,                 -- '2006/07 Snowboard Katalog', 'Method Vol 23'
  doc_id       text,                 -- issuu docId
  source_url   text not null,        -- deep link to the issuu doc (+ page anchor when known)
  page         int,                  -- printed/image page, nullable
  model_year   int,                  -- the catalog's model year for this sighting
  match_type   text,                 -- 'EXACT' | 'QUALIFIED' (from the reconcile)
  image_url    text,                 -- kind='image' only: a remote (hotlinked) image; never a re-host
  added_by     uuid,                 -- null = system import
  created_at   timestamptz not null default now()
);

create index if not exists idx_board_sources_board
  on board_sources (board_id);

-- One citation per (board, doc, page, kind); COALESCE so null doc/page still dedups.
create unique index if not exists idx_board_sources_dedup
  on board_sources (board_id, coalesce(doc_id, ''), coalesce(page, 0), kind);

alter table board_sources enable row level security;

drop policy if exists board_sources_public_read on board_sources;
create policy board_sources_public_read
  on board_sources for select
  using (true);
