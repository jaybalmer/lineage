-- Linestry events catalog: schema migration
-- Creates the three catalog tables plus the two member-attachment tables.
-- Safe to run on a database that already has other tables; creates nothing that exists.
-- Adjust the schema qualifier and the RLS policy names to match the repo's conventions before running.

begin;

-- ---------------------------------------------------------------- series
create table if not exists public.event_series (
  series_id       text primary key,               -- slug, e.g. 'mt-baker-legendary-banked-slalom'
  series_name     text not null,
  former_names    text[],
  category        text not null check (category in
                    ('major-contest','legacy-contest','grassroots-contest',
                     'national-championship','tour-stop','tour-series')),
  governing_body  text,
  first_year      int,
  last_year       int,                            -- null = ongoing or unknown
  status          text not null check (status in
                    ('active','defunct','dormant','revived','unconfirmed')),
  home_venue      text,
  country         text,
  region          text check (region in
                    ('north-america','europe','japan','oceania','south-america','global')),
  disciplines     text[],
  significance    text,
  sources         text[] not null,
  confidence      text not null check (confidence in ('verified','likely')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------- editions
create table if not exists public.event_editions (
  edition_id      text primary key,               -- '<series_id>--YYYY', suffix -a/-b if two in one year
  series_id       text not null references public.event_series(series_id) on delete cascade,
  year            int not null,                   -- CALENDAR year held, never the season
  edition_label   text,
  start_date      date,
  end_date        date,
  date_precision  text check (date_precision in ('day','month','year')),  -- how exact start_date/end_date are
  venue           text,
  city            text,
  country         text,
  disciplines     text[],
  status          text not null check (status in ('held','cancelled','postponed','unconfirmed')),
  status_note     text,
  notes           text,
  sources         text[] not null,
  confidence      text not null check (confidence in ('verified','likely')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists event_editions_series_idx on public.event_editions (series_id, year);
create index if not exists event_editions_year_idx   on public.event_editions (year);
create index if not exists event_editions_date_idx   on public.event_editions (start_date);

-- --------------------------------------------------------------- results
create table if not exists public.event_results (
  result_id          bigserial primary key,
  edition_id         text not null references public.event_editions(edition_id) on delete cascade,
  discipline         text not null,
  -- division is recorded three ways on purpose: the source's own wording is preserved verbatim,
  -- and the normalised gender/class pair is what the UI should filter and group on.
  division           text,                        -- legacy single field, kept for traceability
  division_label     text,                        -- the source's exact wording, e.g. 'GRAND MASTERS - ages 50-59'
  division_gender    text check (division_gender in ('men','women','mixed','unspecified')),
  division_class     text check (division_class in
                       ('pro','amateur','masters','junior','grom','legends','para','open')),
  division_age_band  text,                        -- 'ages 50 - 59', when the source states one
  event_name         text,                        -- when one discipline hosts two events at an edition
  place              int not null check (place > 0),
  rider_name         text not null,
  nationality        text,
  score_or_time      text,
  notes              text,
  sources            text[] not null,
  confidence         text not null check (confidence in ('verified','likely')),
  citation_status    text check (citation_status in ('live-source','repaired-verified','pending-recheck')),
  created_at         timestamptz not null default now(),
  -- A slot can legitimately hold two riders when the source records a tie, so the rider is part of the key.
  -- NULLS NOT DISTINCT (Postgres 15+) matters here: division_label and event_name are null on most rows,
  -- and without it every re-seed would insert duplicates instead of updating.
  constraint event_results_slot_uniq
    unique nulls not distinct (edition_id, discipline, division_label, event_name, place, rider_name)
);
create index if not exists event_results_edition_idx on public.event_results (edition_id);
create index if not exists event_results_rider_idx   on public.event_results (lower(rider_name));

-- ------------------------------------------------- member attachment
-- The reason the catalog exists. A member marks an EDITION, so the timeline gets a real date to sort on.
create table if not exists public.member_events (
  member_id   uuid not null,
  edition_id  text not null references public.event_editions(edition_id) on delete cascade,
  role        text not null check (role in ('competed','attended','worked','volunteered','filmed','watched')),
  finish_place int,                               -- their own result, if they competed ("placing" is a reserved word in Postgres)
  note        text,
  created_at  timestamptz not null default now(),
  primary key (member_id, edition_id, role)
);
create index if not exists member_events_member_idx on public.member_events (member_id);

-- The escape hatch for "I did Baker most years through the 90s".
create table if not exists public.member_series (
  member_id   uuid not null,
  series_id   text not null references public.event_series(series_id) on delete cascade,
  role        text not null,
  years_note  text,
  created_at  timestamptz not null default now(),
  primary key (member_id, series_id, role)
);
create index if not exists member_series_member_idx on public.member_series (member_id);

-- ------------------------------------------------------------------- RLS
-- The catalog is public reference data: readable by everyone, writable only by the service role.
-- Member attachments are private to the member.
alter table public.event_series   enable row level security;
alter table public.event_editions enable row level security;
alter table public.event_results  enable row level security;
alter table public.member_events  enable row level security;
alter table public.member_series  enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='event_series' and policyname='event_series_read') then
    create policy event_series_read   on public.event_series   for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='event_editions' and policyname='event_editions_read') then
    create policy event_editions_read on public.event_editions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='event_results' and policyname='event_results_read') then
    create policy event_results_read  on public.event_results  for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='member_events' and policyname='member_events_own') then
    create policy member_events_own  on public.member_events for all
      using (member_id = auth.uid()) with check (member_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='member_series' and policyname='member_series_own') then
    create policy member_series_own  on public.member_series for all
      using (member_id = auth.uid()) with check (member_id = auth.uid());
  end if;
end $$;

commit;
