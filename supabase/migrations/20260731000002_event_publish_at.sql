-- Podcast pass Session C: scheduled episode release.
-- Render-time gate only: an episode is live when
--   public_enabled = true AND (publish_at IS NULL OR publish_at <= now()).
-- No scheduler; the gate is evaluated on read (PB-010 announced-event pattern).
-- Additive, nullable. Existing episodes keep publish_at = NULL (manual behavior
-- unchanged).
--
-- HARD PRE-MERGE GATE: EVENT_STACK_COLS in src/lib/public-timeline-read.ts
-- selects an explicit column list including publish_at, and a missing column
-- 404s the entire public episode read. Apply this before the PR merges.

alter table public.events
  add column if not exists publish_at timestamptz;

comment on column public.events.publish_at is
  'Scheduled public release for episodes. NULL = manual. Live gate is public_enabled AND (publish_at IS NULL OR publish_at <= now()); evaluated at read time, editors bypass.';
