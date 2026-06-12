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

-- 4. Rebuild the claims_public view so it exposes the new column. Postgres freezes a
--    view's column list at creation time, so even though claims_public is defined as
--    `SELECT c.*`, it does NOT pick up board_relationship until the view is recreated.
--    Board claims are read through claims_public (profile, person pages, catalog), so
--    without this the relationship reads back NULL (rendered "Rode") and 'own' / 'both'
--    silently revert on reload. Re-run the exact existing definition (must run AFTER step 1).
CREATE OR REPLACE VIEW public.claims_public
  WITH (security_invoker = true) AS
  SELECT c.*
    FROM public.claims c
    LEFT JOIN public.tag_events te ON te.id = c.tag_event_id
    LEFT JOIN public.profiles    p  ON p.id::text = te.subject_id
   WHERE c.tag_event_id IS NULL
      OR te.status = 'approved'
      OR (te.status = 'pending' AND COALESCE(p.require_tag_approval, false) = false);

-- 5. Post-deploy verify (run each on its own):
--   -- every existing board claim is 'rode' right after backfill ('own' / 'both' appear as members add boards):
--   select board_relationship, count(*) from claims
--   where predicate = 'owned_board' group by board_relationship;
--   -- the view now exposes the column (returns a row, not a "column does not exist" error):
--   select board_relationship from claims_public limit 1;

-- Rollback (only if needed; column is additive and nullable):
--   alter table claims drop column board_relationship;
--   (the claims_public rebuild in step 4 is harmless to leave in place.)
