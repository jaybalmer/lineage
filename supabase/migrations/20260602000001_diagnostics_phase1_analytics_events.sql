-- ============================================================================
-- Diagnostics Phase 1: analytics_events (durable in-app event log)
-- ============================================================================
--
-- The dual-sink companion to PostHog/Sentry. Every product event and error is
-- forwarded to its external sink AND written here as a row, so the in-app
-- /admin/activity feed has a fast, queryable source that does not depend on
-- PostHog uptime. See src/lib/analytics-server.ts (the single writer) and the
-- brief at Operations/diagnostics-phase1-brief.md (D2).
--
-- Columns:
--   category  one of auth | ftue | content | invite | redirect | moderation |
--             error. CHECK-enforced; adding a category needs a migration.
--   event     the event name (e.g. ftue_step_completed, story_created).
--   actor_id  the auth user id when known; NULL for anonymous / pre-auth
--             events. Deliberately NOT a foreign key: it may reference a user
--             with no profiles row yet, and fire-and-forget inserts must never
--             fail. The /admin/activity actor link resolves it to a profile
--             only when one exists (brief PC4).
--   severity  error rows only (warning | error); NULL otherwise.
--   props     structural props only. No PII: no story bodies, claim notes,
--             emails, or display names (brief D-LOCKED-3).
--
-- Reads and writes both go through the service-role client (getServiceClient),
-- which bypasses RLS. RLS is enabled with zero policies so the anon and
-- authenticated keys cannot read or write the table at all.
--
-- Idempotent: safe to re-run.

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  category    text not null check (category in (
                'auth', 'ftue', 'content', 'invite', 'redirect', 'moderation', 'error'
              )),
  event       text not null,
  actor_id    uuid,
  severity    text check (severity in ('warning', 'error')),
  props       jsonb not null default '{}'::jsonb
);

-- Newest-first feed scan.
create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

-- Category filter chips + per-category 24h counts.
create index if not exists analytics_events_category_created_at_idx
  on public.analytics_events (category, created_at desc);

alter table public.analytics_events enable row level security;
