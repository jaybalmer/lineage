-- ============================================================================
-- Podcast pass Session B: mentions foundation.
-- ============================================================================
--
-- A mention is an editor-curated pointer from an episode (an Event with
-- event_type='episode') to a subject entity, with an optional timestamp and
-- transcript excerpt. Draft rows are the landing state for the future
-- transcript-skill seed import (Session D); published rows are public.
--
-- Conventions follow event_guests (20260629000002): FK on the episode side,
-- NO FK on the subject side, because catalog subject ids are mixed-type and
-- people live across the people + profiles tables.
--
-- Additive only. No existing write path touches this table, so this is NOT a
-- hard pre-merge gate; default migrate-then-merge ordering applies.
--
-- Idempotent: every create is guarded, so the migration is safe to re-run.

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  -- text to match events.id (mixed-type catalog ids), FK like event_guests.
  episode_event_id text not null references public.events(id) on delete cascade,
  subject_type text not null
    check (subject_type in ('person','place','org','board','event')),
  -- no FK: person ids are mixed-type and live across people + profiles,
  -- matching event_guests.person_id and public_stack_entries.entry_ref_id.
  subject_id text not null,
  timestamp_seconds integer check (timestamp_seconds is null or timestamp_seconds >= 0),
  excerpt text,
  status text not null default 'published'
    check (status in ('draft','published')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- D6 dedupe: same subject at the same timestamp in the same episode is one row.
-- coalesce lets the "no timestamp" case dedupe too.
create unique index if not exists mentions_dedupe
  on public.mentions (episode_event_id, subject_type, subject_id,
                      coalesce(timestamp_seconds, -1));

-- Subject-side timeline reads (published only).
create index if not exists mentions_subject
  on public.mentions (subject_type, subject_id)
  where status = 'published';

-- Episode-page reads, timestamp order.
create index if not exists mentions_episode
  on public.mentions (episode_event_id, timestamp_seconds);

-- RLS is defense in depth here: every read and write goes through the service
-- client in the API routes, which bypasses RLS. The select policy mirrors the
-- public contract anyway (published rows only), so a direct anon client can
-- never see drafts.
alter table public.mentions enable row level security;

drop policy if exists "mentions_select_published" on public.mentions;
create policy "mentions_select_published" on public.mentions
  for select using (status = 'published');

comment on table public.mentions is
  'Editor-curated podcast mentions: an episode (events.id, event_type=episode) points at a subject entity with an optional timestamp + transcript excerpt. Draft rows are editor-only and are the landing state for the transcript-skill seed import.';
