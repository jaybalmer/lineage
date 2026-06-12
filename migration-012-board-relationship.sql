-- Migration 012: board_relationship on claims
-- Part of the "Boards in My Timeline" redesign (June 11, 2026).
-- Additive + backfill, no destructive schema. Idempotent: safe to re-run.
-- Run this in the Supabase dashboard SQL editor BEFORE deploying the PR.

-- 0. Pre-deploy sanity (optional, run on its own to see the current shape):
--   select count(*) as board_claims,
--          count(*) filter (where end_date is not null) as with_end_date
--   from claims where predicate = 'owned_board';

-- 1. The relationship column: 'rode' | 'own' | 'both'. NULL for non-board claims.
alter table claims add column if not exists board_relationship text;

-- 2. Boards now carry an OPTIONAL year (stored in start_date as YYYY-01-01), so a
--    board can be saved with no date. Allow NULL start_date. This is a no-op if the
--    column is already nullable. Non-board predicates still require a date in the UI
--    and from the event record, so in practice this only loosens board claims.
alter table claims alter column start_date drop not null;

-- 3. Backfill existing board claims to 'rode' (owned_board is labelled "Rode" in the UI).
update claims set board_relationship = 'rode'
where predicate = 'owned_board' and board_relationship is null;

-- 4. Post-deploy verify (run on its own; expect every row in 'rode' right after backfill,
--    with 'own' / 'both' appearing as members add boards):
--   select board_relationship, count(*) from claims
--   where predicate = 'owned_board' group by board_relationship;

-- Rollback (only if needed; column is additive and nullable):
--   alter table claims drop column board_relationship;
