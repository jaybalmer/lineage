-- FNRad Archive Retold view: stories told more than once.
--
-- Pass B (podcast_archive/retellings/full/entries.json) grouped tellings of the
-- same event, or the same teller repeating a story, across episodes. Only the
-- groupings go public (Jay, 2026-11-18): each entry's title, years and kind,
-- and each telling's episode, timestamp and role. The model-written
-- differences and notes stay out (77 entries flag speaker attribution issues).
-- A telling joins its published story on (episode event, timestamp).
-- Loaded by scripts/import-fnrad-retellings.mjs. Read by the server only
-- (service role), so RLS is on with no public policies.

create table if not exists public.fnrad_retellings (
  id text primary key,                 -- Pass B entry id, e.g. r0001
  title text not null,
  years text,                          -- as written, e.g. "1987 to 1990"
  start_year integer,
  end_year integer,
  kind text not null check (kind in ('same_event', 'same_teller')),
  created_at timestamptz not null default now()
);

create table if not exists public.fnrad_retelling_tellings (
  retelling_id text not null references public.fnrad_retellings(id) on delete cascade,
  episode_event_id text not null,
  timestamp_seconds integer not null,
  role text,                           -- did_it | was_there | heard_about | other
  position integer not null default 0,
  primary key (retelling_id, episode_event_id, timestamp_seconds)
);

create index if not exists fnrad_retelling_tellings_story_idx
  on public.fnrad_retelling_tellings (episode_event_id, timestamp_seconds);

alter table public.fnrad_retellings enable row level security;
alter table public.fnrad_retelling_tellings enable row level security;
