-- Events catalog import: additive columns on the existing events tables, plus event_results.
--
-- Context: Linestry already has public.events and public.event_series, and events.series_id already
-- points at the series table. The researched catalog (data/events/v0.3/) maps INTO those; it does not
-- create a parallel model. The only genuinely new table here is event_results, which nothing in the
-- schema covers today.
--
-- Every column added below is additive and nullable, so this migration is safe to apply before the
-- import and before any code change. See features/events-catalog-import-brief.md.
--
-- PRE-FLIGHT, per features/brief-playbook.md check 1: the column lists for events and event_series
-- were read from src/types/index.ts (Event at line 403, EventSeries at line 391), NOT from live DDL,
-- because the events table predates supabase/migrations/. Run `node scripts/export-events-tables.mjs`
-- and confirm data/events/schema-probe.json before applying. Every `add column if not exists` below
-- is a no-op if the column is already there, so a surprise is a mismatch to investigate, not a break.

begin;

-- ------------------------------------------------------------- event_series
alter table public.event_series
  add column if not exists catalog_category text,
  add column if not exists catalog_status   text,
  add column if not exists governing_body   text,
  add column if not exists region           text,
  add column if not exists home_venue       text,
  add column if not exists country          text,
  add column if not exists former_names     text[],
  add column if not exists disciplines      text[],
  add column if not exists sources          text[],
  add column if not exists confidence       text;

-- ------------------------------------------------------------------- events
-- date_precision is load-bearing: 181 imported editions are known only to the year and 26 only to the
-- month. Their start_date is widened to the first of the month or year so the existing non-null
-- column is satisfied. Any surface that renders start_date MUST branch on date_precision, or it will
-- state a day that no source supports.
alter table public.events
  add column if not exists date_precision      text,
  add column if not exists catalog_status      text,
  add column if not exists catalog_status_note text,
  add column if not exists venue_name          text,
  add column if not exists city                text,
  add column if not exists country             text,
  add column if not exists disciplines         text[],
  add column if not exists sources             text[],
  add column if not exists confidence          text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_date_precision_chk') then
    alter table public.events add constraint events_date_precision_chk
      check (date_precision is null or date_precision in ('day','month','year'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_catalog_status_chk') then
    alter table public.events add constraint events_catalog_status_chk
      check (catalog_status is null or catalog_status in ('held','cancelled','postponed','unconfirmed'));
  end if;
end $$;

-- ------------------------------------------------------------ event_results
-- New. Podium placings, keyed to an event. Division is stored three ways on purpose: division_label is
-- the source's exact wording and is what a rider recognises ("GRAND MASTERS - ages 50-59"), while
-- division_gender and division_class are the normalised pair to filter and group on.
create table if not exists public.event_results (
  id                 bigserial primary key,
  event_id           text not null references public.events(id) on delete cascade,
  discipline         text not null,
  division_label     text,
  division_gender    text check (division_gender in ('men','women','mixed','unspecified')),
  division_class     text check (division_class in
                       ('pro','amateur','masters','junior','grom','legends','para','open')),
  division_age_band  text,
  event_name         text,
  place              int not null check (place > 0),
  rider_name         text not null,
  -- person_id stays null until a rider is matched to a person node. Deliberately not a hard FK
  -- decision in this migration: see the brief's DECISIONS block.
  person_id          text,
  nationality        text,
  score_or_time      text,
  notes              text,
  sources            text[] not null default '{}',
  confidence         text not null default 'likely' check (confidence in ('verified','likely')),
  -- about the LINK, not the value: 'pending-recheck' rows had their value verified against an
  -- archived page but their snapshot URL has not been confirmed to resolve. Render without a link.
  citation_status    text check (citation_status in ('live-source','repaired-verified','pending-recheck')),
  created_at         timestamptz not null default now(),
  -- A slot can legitimately hold two riders when the source records a tie, so the rider is part of
  -- the key. NULLS NOT DISTINCT (Postgres 15+) is load-bearing: division_label and event_name are
  -- null on most rows, and without it every re-import inserts duplicates instead of updating.
  constraint event_results_slot_uniq
    unique nulls not distinct (event_id, discipline, division_label, event_name, place, rider_name)
);
create index if not exists event_results_event_idx on public.event_results (event_id);
create index if not exists event_results_rider_idx on public.event_results (lower(rider_name));

alter table public.event_results enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='event_results' and policyname='event_results_read') then
    create policy event_results_read on public.event_results for select using (true);
  end if;
end $$;

commit;
