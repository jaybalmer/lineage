-- One-time backfill: historical contribution tokens + founding member-token grant
-- (token-system-equity-offer brief §10 step 8, June 12 2026)
--
-- Run AFTER migration-013 is applied AND the token-earning PR is deployed,
-- so the live award rules match what this script replays.
--
-- Rules mirrored from src/lib/tokens.ts award map:
--   +1 per claim (timeline entry)            -> claims joined to a real profile
--   +2 per claim with a non-empty sources[]  -> authoritative source link
--   +1 per story
--   +1 per story with at least one photo     -> media artifact (capped 1/story)
--   +2 per story with youtube_url or url     -> authoritative source link
--   +1 per community connection added        -> story_places / story_events rows
--                                               with added_by (rider connections
--                                               are skipped: the adder lives on
--                                               tag_events, tiny N at launch)
--   +10 member tokens per founding member    -> D8 retroactive annual-equivalent
--
-- The daily 20-content-token cap is NOT applied to the backfill: this is
-- organic history, not farming, and Jay reviews the preview totals first.
--
-- ── STEP 0: pick the claims-sources expression ────────────────────────────────
-- Run:  select udt_name from information_schema.columns
--       where table_name = 'claims' and column_name = 'sources';
--   '_text' (text[])  -> keep SOURCES_NONEMPTY as cardinality(c.sources) > 0
--   'jsonb'           -> swap in jsonb_array_length(c.sources) > 0
-- The script below uses the text[] form.

-- ── STEP 1: preview (run alone, sanity-check the numbers) ─────────────────────

with claim_counts as (
  select p.id as user_id,
         count(*) as n_claims,
         count(*) filter (where c.sources is not null and cardinality(c.sources) > 0) as n_sourced
  from public.claims c
  join public.profiles p on p.id::text = c.asserted_by
  group by p.id
),
story_counts as (
  select s.author_id as user_id,
         count(*) as n_stories,
         count(*) filter (where s.youtube_url is not null or s.url is not null) as n_sourced,
         count(*) filter (where exists (
           select 1 from public.story_photos sp where sp.story_id = s.id)) as n_with_photos
  from public.stories s
  join public.profiles p on p.id = s.author_id
  group by s.author_id
),
connection_counts as (
  select added_by as user_id, count(*) as n_connections
  from (
    select added_by from public.story_places where added_by is not null
    union all
    select added_by from public.story_events where added_by is not null
  ) conn
  join public.profiles p on p.id = conn.added_by
  group by added_by
)
select
  pr.id,
  pr.display_name,
  pr.membership_tier,
  coalesce(cc.n_claims, 0)                          as claims,
  coalesce(cc.n_sourced, 0)                         as sourced_claims,
  coalesce(sc.n_stories, 0)                         as stories,
  coalesce(sc.n_with_photos, 0)                     as stories_with_photos,
  coalesce(sc.n_sourced, 0)                         as sourced_stories,
  coalesce(nc.n_connections, 0)                     as connections,
  coalesce(cc.n_claims, 0) + coalesce(cc.n_sourced, 0) * 2
    + coalesce(sc.n_stories, 0) + coalesce(sc.n_with_photos, 0)
    + coalesce(sc.n_sourced, 0) * 2 + coalesce(nc.n_connections, 0)
                                                    as contribution_total,
  pr.token_contribution                             as current_contribution
from public.profiles pr
left join claim_counts cc on cc.user_id = pr.id
left join story_counts sc on sc.user_id = pr.id
left join connection_counts nc on nc.user_id = pr.id
order by contribution_total desc;

-- ── STEP 2: apply (single transaction, guarded against double-run) ────────────

begin;

do $$
begin
  if exists (select 1 from public.token_events where source = 'backfill') then
    raise exception 'Backfill already ran (token_events has source=backfill rows). Aborting.';
  end if;
end $$;

-- 2a. Contribution backfill: ledger rows + balance update
with claim_counts as (
  select p.id as user_id,
         count(*) as n_claims,
         count(*) filter (where c.sources is not null and cardinality(c.sources) > 0) as n_sourced
  from public.claims c
  join public.profiles p on p.id::text = c.asserted_by
  group by p.id
),
story_counts as (
  select s.author_id as user_id,
         count(*) as n_stories,
         count(*) filter (where s.youtube_url is not null or s.url is not null) as n_sourced,
         count(*) filter (where exists (
           select 1 from public.story_photos sp where sp.story_id = s.id)) as n_with_photos
  from public.stories s
  join public.profiles p on p.id = s.author_id
  group by s.author_id
),
connection_counts as (
  select added_by as user_id, count(*) as n_connections
  from (
    select added_by from public.story_places where added_by is not null
    union all
    select added_by from public.story_events where added_by is not null
  ) conn
  join public.profiles p on p.id = conn.added_by
  group by added_by
),
totals as (
  select
    pr.id as user_id,
    coalesce(cc.n_claims, 0) + coalesce(cc.n_sourced, 0) * 2
      + coalesce(sc.n_stories, 0) + coalesce(sc.n_with_photos, 0)
      + coalesce(sc.n_sourced, 0) * 2 + coalesce(nc.n_connections, 0) as amount
  from public.profiles pr
  left join claim_counts cc on cc.user_id = pr.id
  left join story_counts sc on sc.user_id = pr.id
  left join connection_counts nc on nc.user_id = pr.id
),
ledger as (
  insert into public.token_events (user_id, token_type, amount, source)
  select user_id, 'contribution', amount, 'backfill'
  from totals where amount > 0
  returning user_id, amount
)
update public.profiles p
set token_contribution = coalesce(p.token_contribution, 0) + l.amount
from ledger l
where p.id = l.user_id;

-- 2b. Founding retroactive member tokens (+10 each, D8).
-- Per-user idempotent rather than globally guarded: the deployed /api/me
-- anniversary path writes the same source, so any founding member it already
-- granted is skipped here regardless of run order.
with founding as (
  select id from public.profiles pr
  where membership_tier = 'founding'
    and not exists (
      select 1 from public.token_events te
      where te.user_id = pr.id and te.source = 'founding_member_grant')
),
ledger as (
  insert into public.token_events (user_id, token_type, amount, source)
  select id, 'member', 10, 'founding_member_grant'
  from founding
  returning user_id
)
update public.profiles p
set token_member = coalesce(p.token_member, 0) + 10
from ledger l
where p.id = l.user_id;

commit;

-- ── STEP 3: verify ────────────────────────────────────────────────────────────

-- select source, token_type, count(*), sum(amount)
-- from token_events where source in ('backfill', 'founding_member_grant')
-- group by 1, 2;
--
-- select id, display_name, membership_tier,
--        token_founder, token_member, token_contribution
-- from profiles order by token_contribution desc;
