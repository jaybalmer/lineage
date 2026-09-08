-- Linestry events catalog v0.1
-- Three tables: a recurring event series, the editions it ran, and podium results.
-- Mirrors the conventions of the snowboard board catalog: slug primary keys, text[] sources,
-- and an explicit confidence column so the UI can be honest about what is verified.

create table if not exists event_series (
  series_id       text primary key,              -- slug, e.g. 'mt-baker-legendary-banked-slalom'
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
  created_at      timestamptz default now()
);

create table if not exists event_editions (
  edition_id      text primary key,               -- '<series_id>--YYYY', suffix -a/-b if two in one year
  series_id       text not null references event_series(series_id) on delete cascade,
  year            int not null,                   -- calendar year held, not season
  edition_label   text,
  start_date      date,
  end_date        date,
  date_precision  text check (date_precision in ('day','month','year')),
  venue           text,
  city            text,
  country         text,
  disciplines     text[],
  status          text not null check (status in ('held','cancelled','postponed','unconfirmed')),
  status_note     text,
  notes           text,
  sources         text[] not null,
  confidence      text not null check (confidence in ('verified','likely')),
  created_at      timestamptz default now()
);
create index if not exists event_editions_series_idx on event_editions (series_id, year);
create index if not exists event_editions_year_idx   on event_editions (year);

create table if not exists event_results (
  result_id       bigserial primary key,
  edition_id      text not null references event_editions(edition_id) on delete cascade,
  discipline      text not null,               -- v0.2 adds knuckle-huck, street-style, best-trick
  division        text,                        -- mens, womens, open, masters, juniors, groms, pro, am
  division_label  text,                        -- the source's own wording, e.g. 'Grand Masters Women', 'U15 Boys'
  event_name      text,                        -- when one discipline hosts two events (parallel team vs SBX team)
  place           int not null,
  rider_name      text not null,
  nationality     text,
  score_or_time   text,
  notes           text,
  sources         text[] not null,
  confidence      text not null check (confidence in ('verified','likely')),
  citation_status text check (citation_status in ('live-source','repaired-verified','pending-recheck')),
  -- a slot can legitimately hold two riders when the source records a tie, so the rider is part of the key
  unique (edition_id, discipline, division, division_label, event_name, place, rider_name)
);
create index if not exists event_results_rider_idx on event_results (lower(rider_name));

-- Member attendance: the reason this catalog exists.
-- A member marks an edition, not a series, so the timeline gets a real date to sort on.
create table if not exists member_events (
  member_id       uuid not null,
  edition_id      text not null references event_editions(edition_id) on delete cascade,
  role            text check (role in ('competed','attended','worked','volunteered','filmed','watched')),
  finish_place    int,                            -- their own result, if they competed ("placing" is reserved in Postgres)
  note            text,
  created_at      timestamptz default now(),
  primary key (member_id, edition_id, role)
);

-- A member can also claim a whole series without pinning a year ("I did Baker for years").
create table if not exists member_series (
  member_id       uuid not null,
  series_id       text not null references event_series(series_id) on delete cascade,
  role            text,
  years_note      text,                           -- free text, e.g. 'most years through the 90s'
  created_at      timestamptz default now(),
  primary key (member_id, series_id, role)
);
