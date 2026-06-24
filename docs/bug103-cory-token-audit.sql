-- BUG-103 retroactive audit: reverse contribution tokens Cory farmed by
-- add / delete / re-add (Jay's Q2 call, June 24: "audit and reverse, focus on
-- Cory who was intentionally farming to find bugs").
--
-- Going forward the claw-back in the PR makes this farm impossible. This script
-- only reconciles the balance already inflated before the fix. It is targeted at
-- ONE person (Cory) on purpose: a blanket sweep risks zeroing legitimate earns.
--
-- Method: recompute Cory's legitimate contribution value from his CURRENTLY
-- SURVIVING content (farmed entries were deleted, so they no longer count), then
-- reverse the difference between his current balance and that value. The formula
-- mirrors src/lib/tokens.ts and docs/backfill-token-earning.sql so the baseline
-- matches how balances were originally computed.
--
-- SAFETY: read STEP 1 first and confirm it matched exactly ONE person who is
-- Cory. The recompute counts claims (+1, +2 sourced), stories (+1, +1 photo,
-- +2 sourced), and place/event connections (+1). It does NOT count member-created
-- catalog entities (+2 each) or rider connections (+1 each), matching the backfill
-- baseline. If Cory legitimately created catalog entities or added rider
-- connections, ADD those to the target in STEP 2 before running so the reversal
-- never claws back a real earn. Run STEP 2 only after eyeballing STEP 1.
--
-- Guided-apply: Jay runs this in the Supabase SQL editor. Not run by Claude.

-- ── STEP 1: READ-ONLY DIAGNOSIS (run alone, confirm the numbers) ──────────────

-- 1a. Identify Cory. Confirm this returns exactly one row and it is the right
--     person before going further. Note the id.
select id, display_name, membership_tier, token_contribution
from public.profiles
where display_name ilike '%cory%';

-- 1b. Cory's contribution ledger by source (gross awards + any prior reversals).
--     Swap in the confirmed id from 1a if the ilike matched more than one person.
select te.source,
       count(*)        as rows,
       sum(te.amount)  as net_amount
from public.token_events te
join public.profiles p on p.id = te.user_id
where p.display_name ilike '%cory%'
  and te.token_type = 'contribution'
group by te.source
order by te.source;

-- 1c. Recompute legitimate value from surviving content, show the delta vs the
--     current balance. delta_to_reverse > 0 is the farmed inflation.
with cory as (
  select id from public.profiles where display_name ilike '%cory%'
),
claim_counts as (
  select count(*) as n_claims,
         count(*) filter (where jsonb_typeof(c.sources) = 'array'
                            and jsonb_array_length(c.sources) > 0) as n_sourced
  from public.claims c
  join cory on cory.id::text = c.asserted_by
),
story_counts as (
  select count(*) as n_stories,
         count(*) filter (where s.youtube_url is not null or s.url is not null) as n_sourced,
         count(*) filter (where exists (
           select 1 from public.story_photos sp where sp.story_id = s.id)) as n_with_photos
  from public.stories s
  join cory on cory.id = s.author_id
),
connection_counts as (
  select count(*) as n_connections
  from (
    select added_by from public.story_places where added_by is not null
    union all
    select added_by from public.story_events where added_by is not null
  ) conn
  join cory on cory.id = conn.added_by
)
select
  pr.display_name,
  pr.token_contribution                                             as current_balance,
  coalesce(cc.n_claims,0)                                           as claims,
  coalesce(cc.n_sourced,0)                                          as sourced_claims,
  coalesce(sc.n_stories,0)                                          as stories,
  coalesce(sc.n_with_photos,0)                                      as stories_with_photos,
  coalesce(sc.n_sourced,0)                                          as sourced_stories,
  coalesce(nc.n_connections,0)                                      as place_event_connections,
  (coalesce(cc.n_claims,0) + coalesce(cc.n_sourced,0)*2
   + coalesce(sc.n_stories,0) + coalesce(sc.n_with_photos,0)
   + coalesce(sc.n_sourced,0)*2 + coalesce(nc.n_connections,0))     as legitimate_value,
  pr.token_contribution
   - (coalesce(cc.n_claims,0) + coalesce(cc.n_sourced,0)*2
      + coalesce(sc.n_stories,0) + coalesce(sc.n_with_photos,0)
      + coalesce(sc.n_sourced,0)*2 + coalesce(nc.n_connections,0))  as delta_to_reverse
from public.profiles pr
cross join claim_counts cc
cross join story_counts sc
cross join connection_counts nc
where pr.id = (select id from cory);

-- ── STEP 2: RECONCILE (single guarded transaction) ───────────────────────────
-- Run only after STEP 1 confirms the person and the delta. Idempotent: aborts if
-- a prior bug103-cory-reconcile row already exists.
--
-- If Cory has legitimate entity / rider-connection earns (see header), change the
-- "+ 0" below to their token value so the reversal stops at the real floor.

begin;

do $$
declare
  v_user        uuid;
  v_balance     integer;
  v_legit       integer;
  v_extra       integer := 0;   -- <- add legit entity (+2 each) / rider-conn (+1) value here, if any
  v_target      integer;
  v_reverse     integer;
begin
  select id, coalesce(token_contribution,0) into v_user, v_balance
  from public.profiles where display_name ilike '%cory%';

  if v_user is null then
    raise exception 'No Cory match. Set the predicate to the confirmed id.';
  end if;

  if exists (
    select 1 from public.token_events
    where user_id = v_user and source_ref = 'bug103-cory-reconcile'
  ) then
    raise exception 'Reconcile already ran for this user (bug103-cory-reconcile row exists). Aborting.';
  end if;

  select
    coalesce(cc.n_claims,0) + coalesce(cc.n_sourced,0)*2
    + coalesce(sc.n_stories,0) + coalesce(sc.n_with_photos,0)
    + coalesce(sc.n_sourced,0)*2 + coalesce(nc.n_connections,0)
  into v_legit
  from
    (select count(*) as n_claims,
            count(*) filter (where jsonb_typeof(c.sources)='array'
                             and jsonb_array_length(c.sources)>0) as n_sourced
       from public.claims c where c.asserted_by = v_user::text) cc,
    (select count(*) as n_stories,
            count(*) filter (where s.youtube_url is not null or s.url is not null) as n_sourced,
            count(*) filter (where exists (
              select 1 from public.story_photos sp where sp.story_id = s.id)) as n_with_photos
       from public.stories s where s.author_id = v_user) sc,
    (select count(*) as n_connections from (
        select added_by from public.story_places where added_by = v_user
        union all
        select added_by from public.story_events where added_by = v_user) x) nc;

  v_target  := v_legit + v_extra;
  v_reverse := v_balance - v_target;

  if v_reverse <= 0 then
    raise notice 'Nothing to reverse: balance % <= target % (legit % + extra %).',
      v_balance, v_target, v_legit, v_extra;
  else
    insert into public.token_events (user_id, token_type, amount, source, source_ref)
    values (v_user, 'contribution', -v_reverse, 'audit_bug103', 'bug103-cory-reconcile');

    update public.profiles
       set token_contribution = greatest(0, v_target)
     where id = v_user;

    raise notice 'Reversed % tokens for % (balance % -> target %).',
      v_reverse, v_user, v_balance, v_target;
  end if;
end $$;

commit;

-- ── STEP 3: VERIFY ───────────────────────────────────────────────────────────
-- select display_name, token_contribution from public.profiles where display_name ilike '%cory%';
-- select source, amount, source_ref, created_at from public.token_events
--   where source_ref = 'bug103-cory-reconcile';
