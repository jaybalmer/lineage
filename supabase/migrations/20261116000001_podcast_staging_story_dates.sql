-- Podcast archive staging: story dates and replays (brief podcast-staging-sort-and-sketches v1, Part C, C3 + C4).
-- Additive only: nullable columns on podcast_staging_stories. Filled by
-- scripts/load-podcast-staging.mjs --dates (Pass A output) and --replays (replays.json).

alter table public.podcast_staging_stories
  add column if not exists start_year int,
  add column if not exists end_year int,
  add column if not exists date_basis text,
  add column if not exists date_confidence text,
  add column if not exists date_evidence text,
  add column if not exists date_undatable_reason text,
  -- Set on a replayed copy of an earlier episode's story; points at the original.
  add column if not exists replay_of uuid references public.podcast_staging_stories(id) on delete set null;

create index if not exists podcast_staging_stories_replay_of_idx
  on public.podcast_staging_stories (replay_of) where replay_of is not null;
