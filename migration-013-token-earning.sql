-- Migration 013: token earning foundation (June 12, 2026)
-- Run in the Supabase SQL editor BEFORE merging the token-earning PR.
-- The award hooks call these RPCs on every contribution; without them the
-- hooks log errors and award nothing (content writes are unaffected).
--
-- Pre-flight checks (run these first, confirm before proceeding):
--
--   -- 1. token_events shape: source must be free text, created_at must exist
--   select column_name, data_type, udt_name
--   from information_schema.columns
--   where table_name = 'token_events';
--
--   -- 2. Existing sources in use (sanity, no conflicts expected)
--   select source, token_type, count(*), sum(amount)
--   from token_events group by 1, 2 order by 1;
--
--   -- 3. claims.sources column type (drives one backfill statement,
--   --    see docs/backfill-token-earning.sql)
--   select data_type, udt_name from information_schema.columns
--   where table_name = 'claims' and column_name = 'sources';

-- ── 1. Daily-visit bookkeeping column ─────────────────────────────────────────

alter table public.profiles
  add column if not exists last_visit_award_date date;

-- ── 2. Atomic contribution-token increment ────────────────────────────────────
-- Single-statement increment so concurrent awards never lose an update
-- (read-modify-write through the API client would race).

create or replace function public.increment_contribution_tokens(p_user uuid, p_amount int)
returns void
language sql
as $$
  update public.profiles
  set token_contribution = coalesce(token_contribution, 0) + p_amount
  where id = p_user;
$$;

-- ── 3. Atomic once-per-UTC-day visit award ────────────────────────────────────
-- The WHERE clause makes the update a no-op for the second concurrent caller:
-- under READ COMMITTED the loser blocks on the row lock, re-evaluates the
-- predicate after the winner commits, and updates zero rows. Only the winner
-- inserts the ledger row and returns true.

create or replace function public.award_daily_visit(p_user uuid)
returns boolean
language plpgsql
as $$
declare
  updated_count int;
begin
  update public.profiles
  set last_visit_award_date = current_date,
      token_contribution = coalesce(token_contribution, 0) + 1
  where id = p_user
    and (last_visit_award_date is null or last_visit_award_date <> current_date);

  get diagnostics updated_count = row_count;

  if updated_count > 0 then
    insert into public.token_events (user_id, token_type, amount, source)
    values (p_user, 'contribution', 1, 'daily_visit');
    return true;
  end if;

  return false;
end;
$$;

-- ── 4. Verify ─────────────────────────────────────────────────────────────────

-- select award_daily_visit('<your-uuid>');           -- expect: true
-- select award_daily_visit('<your-uuid>');           -- expect: false (same day)
-- select token_contribution, last_visit_award_date
--   from profiles where id = '<your-uuid>';          -- expect: +1, today
-- select * from token_events where source = 'daily_visit' order by created_at desc limit 5;
--
-- To undo the test award:
-- update profiles set token_contribution = token_contribution - 1,
--   last_visit_award_date = null where id = '<your-uuid>';
-- delete from token_events where user_id = '<your-uuid>' and source = 'daily_visit';
