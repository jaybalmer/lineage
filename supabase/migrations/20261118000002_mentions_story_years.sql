-- FNRad Archive Path view: story years on the public side.
--
-- The archive reads public tables only, and story years live in staging
-- (podcast_staging_stories.start_year / end_year, Pass A). Copy them onto the
-- published mentions so the Path view can draw a rider year by year.
-- Additive: two nullable columns, and a backfill that writes only those columns.
-- A staging story maps to its mentions on (episode event, timestamp), a unique
-- key in staging (checked 2026-11-18: 11,876 keys, no duplicates).
-- The staging publish step writes both columns for every new mention.

alter table public.mentions
  add column if not exists story_start_year integer,
  add column if not exists story_end_year integer;

update public.mentions m
set story_start_year = s.start_year,
    story_end_year = coalesce(s.end_year, s.start_year)
from public.podcast_staging_stories s
join public.podcast_staging_episodes e on e.id = s.episode_id
where e.episode_event_id = m.episode_event_id
  and s.timestamp_seconds = m.timestamp_seconds
  and s.start_year is not null;
