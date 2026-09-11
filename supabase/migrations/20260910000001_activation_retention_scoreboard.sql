-- ============================================================================
-- Activation, retention, and the funnel scoreboard
-- ============================================================================
-- Additive only. No DROP, no UPDATE, no DELETE, nothing against profiles.
-- Idempotent: safe to re-run.
--
-- 1. distinct_id lets the durable log count PEOPLE, not page loads, for the
--    pre-auth funnel steps where actor_id is always null.
-- 2. The partial unique index is the idempotency guarantee for member_activated.
--    captureServerEvent swallows insert errors, so a duplicate attempt fails at
--    the constraint and disappears. Exactly one row per member, no locks.
-- 3. Two read-only aggregate functions. Called only by the service-role client
--    from /api/admin/funnel, so EXECUTE is revoked from public / anon /
--    authenticated (the default grant is to PUBLIC, so revoking only anon +
--    authenticated leaves the hole open; revoke PUBLIC too).

-- ── 1. Identity for anonymous events ────────────────────────────────────────

alter table public.analytics_events
  add column if not exists distinct_id text;

-- ── 2. Exactly-once activation ──────────────────────────────────────────────

create unique index if not exists analytics_events_one_activation_per_actor
  on public.analytics_events (actor_id)
  where event = 'member_activated' and actor_id is not null;

-- ── 3. Funnel summary ───────────────────────────────────────────────────────

create or replace function public.analytics_funnel_summary(
  p_since   timestamptz,
  p_until   timestamptz,
  p_exclude uuid[] default '{}'
)
returns jsonb
language sql
stable
as $$
with ev as (
  select e.created_at, e.event, e.actor_id, e.distinct_id
  from public.analytics_events e
  where e.created_at >= p_since
    and e.created_at <  p_until
    and coalesce((e.props->>'bot')::boolean, false) = false
    and (e.actor_id is null or not (e.actor_id = any(p_exclude)))
),
steps as (
  select
    count(distinct distinct_id) filter (where event = 'ftue_landed')      as landed,
    count(distinct distinct_id) filter (where event = 'ftue_aha_shown')   as aha,
    count(distinct distinct_id) filter (where event = 'ftue_save_shown')  as save_shown,
    count(distinct actor_id)    filter (where event = 'signup_succeeded') as signed_up,
    count(distinct actor_id)    filter (where event = 'ftue_completed')   as onboarded,
    count(distinct actor_id)    filter (where event = 'story_created')    as posted_story,
    count(distinct actor_id)    filter (where event = 'member_returned')  as returned,
    count(distinct actor_id)    filter (where event = 'member_activated') as activated
  from ev
),
daily as (
  select
    (created_at at time zone 'UTC')::date                              as day,
    count(distinct actor_id) filter (where event = 'signup_succeeded') as signups,
    count(distinct actor_id) filter (where event = 'member_activated') as activations
  from ev
  where event in ('signup_succeeded', 'member_activated')
  group by 1
),
content as (
  select
    count(*) filter (where event = 'story_created')          as stories,
    count(*) filter (where event = 'claim_created')          as claims,
    count(*) filter (where event = 'riding_day_created')     as riding_days,
    count(*) filter (where event = 'story_comment_added')    as comments,
    count(*) filter (where event = 'story_reaction_set')     as reactions,
    count(*) filter (where event = 'story_connection_added') as connections
  from ev
)
select jsonb_build_object(
  'since',   p_since,
  'until',   p_until,
  'steps',   (select to_jsonb(s) from steps s),
  'daily',   coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily d), '[]'::jsonb),
  'content', (select to_jsonb(c) from content c)
);
$$;

-- ── 4. Weekly cohort retention ──────────────────────────────────────────────
-- Built entirely from durable state (profiles + token_events), so it works
-- retroactively over the whole history of the product, including the period
-- before analytics_events existed.
--
-- Deviation from the drafted brief: this returns the last p_weeks cohorts THAT
-- HAVE MEMBERS (most recent signup weeks), not a rolling p_weeks-calendar-week
-- window off now(). At current volume a calendar window from "now" would only
-- reach the last few weeks, show a near-empty table, and never include a
-- pre-June-2026 cohort (acceptance A12). Cohort-based selection keeps D11's
-- "last 8 cohorts" while staying provably retroactive over the whole history.

create or replace function public.analytics_cohort_retention(
  p_weeks   int default 8,
  p_exclude uuid[] default '{}'
)
returns jsonb
language sql
stable
as $$
with cohort as (
  select
    p.id,
    date_trunc('week', p.created_at at time zone 'UTC')::date as cohort_week,
    (p.created_at at time zone 'UTC')::date                   as signup_day
  from public.profiles p
  where coalesce(p.is_archived, false) = false
    and not (p.id = any(p_exclude))
),
visits as (
  select
    c.id,
    c.cohort_week,
    (((t.created_at at time zone 'UTC')::date - c.signup_day) / 7)::int as week_offset
  from cohort c
  join public.token_events t
    on t.user_id = c.id
   and t.source  = 'daily_visit'
),
agg as (
  select
    c.cohort_week,
    count(distinct c.id)                                        as size,
    count(distinct v.id) filter (where v.week_offset = 1)       as w1,
    count(distinct v.id) filter (where v.week_offset = 2)       as w2,
    count(distinct v.id) filter (where v.week_offset = 3)       as w3
  from cohort c
  left join visits v on v.id = c.id
  group by c.cohort_week
  order by c.cohort_week desc
  limit greatest(p_weeks, 0)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'cohort_week', cohort_week,
      'size',        size,
      'w1',          w1,
      'w2',          w2,
      'w3',          w3
    )
    order by cohort_week desc
  ),
  '[]'::jsonb
)
from agg;
$$;

-- ── 5. Service-role only ────────────────────────────────────────────────────
-- The default EXECUTE grant on a new function is to PUBLIC, so revoke PUBLIC as
-- well as the two named roles or the lock does nothing.

revoke execute on function public.analytics_funnel_summary(timestamptz, timestamptz, uuid[])
  from public, anon, authenticated;
revoke execute on function public.analytics_cohort_retention(int, uuid[])
  from public, anon, authenticated;
