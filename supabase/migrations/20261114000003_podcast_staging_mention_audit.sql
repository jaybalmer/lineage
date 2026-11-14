-- Podcast archive staging, Phase 2 (T12 audit): every decision stamps who and when.
-- Stories and nodes already carry decided_by / decided_at; mention-level overrides
-- (drop a subject, repoint to another node) need the same. Additive only.

alter table public.podcast_staging_mentions
  add column if not exists decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists decided_at timestamptz;
