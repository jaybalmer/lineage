-- ============================================================================
-- Pin search_path on the two analytics scoreboard functions
-- ============================================================================
-- Closes the function_search_path_mutable security advisor for the two functions
-- introduced in 20260910000001. Both are security invoker + stable and read-only,
-- and every table they touch is already schema-qualified (public.*), so a fixed
-- empty search_path is safe: built-ins still resolve via pg_catalog, and nothing
-- can be shadowed by an object created in another schema on the caller's path.
--
-- CREATE OR REPLACE preserves the existing EXECUTE grants (revoked from
-- public/anon/authenticated in 20260910000001), but the revokes are re-run here
-- idempotently so the lock is unambiguous in one place. Bodies are identical to
-- 20260910000001; only `set search_path = ''` is added. SAFE, additive, no data.

create or replace function public.analytics_funnel_summary(
  p_since   timestamptz,
  p_until   timestamptz,
  p_exclude uuid[] default '{}'
)
returns jsonb
language sql
stable
set search_path = ''
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

create or replace function public.analytics_cohort_retention(
  p_weeks   int default 8,
  p_exclude uuid[] default '{}'
)
returns jsonb
language sql
stable
set search_path = ''
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

revoke execute on function public.analytics_funnel_summary(timestamptz, timestamptz, uuid[])
  from public, anon, authenticated;
revoke execute on function public.analytics_cohort_retention(int, uuid[])
  from public, anon, authenticated;
