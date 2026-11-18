-- FNRad Archive brief, Part C1: the show's own episode label, nullable.
-- Additive. Publish writes it from podcast_staging_episodes.archive_label;
-- display goes through episodeDisplayLabel() in src/lib/fnrad.ts. episode_number
-- stays as it is, internal, for ordering ties and existing code.
alter table public.events add column if not exists episode_label text;
comment on column public.events.episode_label is 'The show''s own episode label (e.g. S10E15, S9BONUS8, SPECIAL). Display via episodeDisplayLabel(); episode_number stays internal.';
