-- Podcast archive staging, Phase 3 (T15 / T17): remember what a publish created.
--
-- Publishing an episode can create its episode event and new catalog nodes.
-- Unpublish deletes only the mentions a batch inserted; it does NOT delete
-- created nodes or the episode event (other things may reference them by
-- then), it LISTS them. These flags are how it knows which ones to list.
-- Additive only.

alter table public.podcast_staging_episodes
  add column if not exists published_created boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

alter table public.podcast_staging_nodes
  add column if not exists published_created boolean not null default false;
