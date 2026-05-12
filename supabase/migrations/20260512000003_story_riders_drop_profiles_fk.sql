-- ============================================================================
-- PB-008 Phase 2 Silent-Failures Brief — Finding #2
-- ============================================================================
--
-- story_riders.rider_id was defined `uuid NOT NULL references profiles(id)
-- ON DELETE CASCADE`. Ghosts live in `people`, not `profiles`, so any insert
-- naming an unclaimed ghost violates the FK. The API at /api/stories swallows
-- the error (no error check on the junction insert), producing the silent
-- drop reported in the brief.
--
-- Fix: drop the FK. The column stays `uuid` so existing data and the casts in
-- merge_person / distinct_tagger_summary keep working. Application code is
-- the integrity boundary; merge_person already repoints story_riders on Path
-- B, and ghost deletes happen via merge_person (which cleans up junction rows
-- explicitly) or via direct people deletes (covered by the catalog-refresh
-- finding #4 plus the existing redirect proxy).
--
-- Idempotent: the FK is dropped only if it exists, by introspecting
-- pg_constraint for any FK on story_riders.rider_id that references
-- profiles.id, regardless of constraint name.

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema    = tc.table_schema
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema    = 'public'
     AND tc.table_name      = 'story_riders'
     AND kcu.column_name    = 'rider_id'
     AND ccu.table_name     = 'profiles'
     AND ccu.column_name    = 'id'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.story_riders DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END $$;

COMMENT ON COLUMN public.story_riders.rider_id IS
  'PB-008 Phase 2 Silent-Failures Finding #2: FK to profiles(id) dropped to permit ghost-rider tagging. Column remains uuid; references either profiles.id (claimed users) or people.id (UUID-format ghosts). Integrity is enforced at the application layer.';
