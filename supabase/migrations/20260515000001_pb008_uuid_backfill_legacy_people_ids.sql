-- ============================================================================
-- PB-008 UUID backfill — replace legacy `person_*` ids in `people` with UUIDs
-- ============================================================================
--
-- Background: pre-PB-008 catalog ghosts were created with text ids of the form
-- `person_${ms-since-epoch}_${random5}`. PB-008 Phase 2 Session 4 dropped the
-- story_riders.rider_id FK to profiles so ghosts could be tagged, but the
-- column stayed `uuid NOT NULL`. Every legacy `person_*` id is therefore
-- untaggable in stories (the rider_id::uuid cast fails on insert). Auth-user
-- profiles (whose ids are always UUIDs) and the two PB-008 test ghosts that
-- were created with UUID ids work; everything else is broken.
--
-- Fix: issue a fresh UUID to each surviving legacy `people` row and repoint
-- every text-typed referencing column from the old id to the new one. The
-- column type stays text — we only normalise the values. uuid-typed columns
-- (story_riders.rider_id, person_slug_aliases.person_id, people.invited_by)
-- can never have held a legacy id (the cast would have failed at insert), so
-- there is nothing to repoint there — see assertions at the end.
--
-- ── Reference inventory ────────────────────────────────────────────────────
-- text-typed columns that may hold a legacy people.id (verified against the
-- merge_person Path B repoint list in 20260512000004 plus the PB-009 Phase 1
-- additive surfaces):
--   claims.subject_id            (only where subject_type='person')
--   claims.object_id             (only where object_type='person')
--   invites.person_id
--   community_people.person_id   (composite PK with community_id)
--   riding_days.rider_ids        (text[] array)
--   claim_requests.node_id
--   tag_events.subject_id        (PB-009 Phase 1)
--   tag_events.moment_ref->>'rider_id'  (jsonb; only ever uuid-format today)
--   person_invite_notifications.person_id  (FK ON DELETE CASCADE)
--   people.merged_from_id        (text; usually points to deleted ghosts)
--   people.id                    (rename last)
--
-- Auth-user columns are NOT touched (verified dead-code in 20260512000004):
--   claims.asserted_by, people.added_by/invited_by, stories.author_id,
--   riding_days.created_by, places/orgs/boards/events.added_by,
--   invites.invited_by.
--
-- ── FK handling ────────────────────────────────────────────────────────────
-- person_invite_notifications.person_id REFERENCES people(id) ON DELETE
-- CASCADE — the only real FK to people(id). Postgres checks FK constraints at
-- end-of-statement and the constraint is NOT DEFERRABLE, so renaming people.id
-- with the FK live would orphan notification rows. The migration drops the FK,
-- repoints both columns, and re-adds the FK at the end.
--
-- ── Orphan cleanup ─────────────────────────────────────────────────────────
-- Pre-deploy probe surfaced 14 rows referencing legacy people ids that don't
-- exist in `people` (12 claims pointing at mock id `u1`, plus 1 invite + 1
-- community_people pointing at a deleted legacy ghost). These are dead
-- pointers — nothing renders them and merge_person can't recover them. Step
-- 2.5 below hard-deletes orphan rows generically (any non-UUID id whose
-- target isn't in `people`) before the repoint step, so the surviving
-- population can be cleanly UUID-normalised.
--
-- ── Idempotency ────────────────────────────────────────────────────────────
-- Re-running on a clean prod is a no-op: the legacy_people_id_remap TEMP table
-- is filtered by the not-uuid regex, so it's empty after the first run and
-- every UPDATE matches zero rows. The FK drop uses IF EXISTS; the re-add is
-- wrapped in a DO block that checks pg_constraint first.

BEGIN;

-- 1. Build the mapping table for surviving legacy ids
CREATE TEMP TABLE legacy_people_id_remap (
  old_id text PRIMARY KEY,
  new_id text NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO legacy_people_id_remap (old_id, new_id)
SELECT id, gen_random_uuid()::text
  FROM public.people
 WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Telemetry: how many rows are we touching?
DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM legacy_people_id_remap;
  RAISE NOTICE 'pb008_uuid_backfill: % legacy people rows to renumber', v_count;
END $$;

-- 2. Drop the only real FK on people(id) so we can rename without orphaning.
-- Look up the constraint name dynamically (same pattern as 20260512000003) in
-- case it was renamed manually outside this migration's lifecycle.
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
     AND tc.table_name      = 'person_invite_notifications'
     AND kcu.column_name    = 'person_id'
     AND ccu.table_name     = 'people'
     AND ccu.column_name    = 'id'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.person_invite_notifications DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END $$;

-- 2.5. Hard-delete orphan references to non-existent legacy people
-- Pre-deploy census on 2026-05-15 surfaced 14 orphan rows across three
-- surfaces: 12 claims.subject_id=u1, 1 community_people, 1 invites — all
-- pointing at mock-data ids (`u1`) or a deleted legacy ghost
-- (`person_1774937327540_63pe1`). These rows have been dead pointers since
-- insertion; nothing renders them and no merge path can recover them. We
-- delete them now so the repoint step can leave the surviving population
-- fully UUID-format.
--
-- The DELETEs are generic ("non-UUID id AND not in people") so they handle
-- any equivalent orphans that crop up before this migration runs. Idempotent:
-- subsequent runs find zero orphans and DELETE matches zero rows.

DO $$
DECLARE
  c_uuid_re constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_deleted bigint;
BEGIN
  WITH d AS (
    DELETE FROM public.claims c
     WHERE c.subject_type = 'person'
       AND c.subject_id IS NOT NULL
       AND c.subject_id !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = c.subject_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RAISE NOTICE 'pb008_uuid_backfill: deleted % orphan claims (subject_id)', v_deleted;

  WITH d AS (
    DELETE FROM public.claims c
     WHERE c.object_type = 'person'
       AND c.object_id IS NOT NULL
       AND c.object_id !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = c.object_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RAISE NOTICE 'pb008_uuid_backfill: deleted % orphan claims (object_id)', v_deleted;

  WITH d AS (
    DELETE FROM public.invites i
     WHERE i.person_id IS NOT NULL
       AND i.person_id !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = i.person_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RAISE NOTICE 'pb008_uuid_backfill: deleted % orphan invites', v_deleted;

  WITH d AS (
    DELETE FROM public.community_people cp
     WHERE cp.person_id IS NOT NULL
       AND cp.person_id !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = cp.person_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RAISE NOTICE 'pb008_uuid_backfill: deleted % orphan community_people rows', v_deleted;

  WITH d AS (
    DELETE FROM public.claim_requests cr
     WHERE cr.node_id IS NOT NULL
       AND cr.node_id !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = cr.node_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RAISE NOTICE 'pb008_uuid_backfill: deleted % orphan claim_requests', v_deleted;

  WITH d AS (
    DELETE FROM public.tag_events te
     WHERE te.subject_id IS NOT NULL
       AND te.subject_id !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = te.subject_id)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RAISE NOTICE 'pb008_uuid_backfill: deleted % orphan tag_events', v_deleted;

  -- riding_days.rider_ids: array_remove orphan legacy ids from each array.
  -- This walks every legacy id in every array, but the row count is tiny.
  WITH orphan_ids AS (
    SELECT DISTINCT rid AS bad_id
      FROM public.riding_days rd, unnest(rd.rider_ids) AS rid
     WHERE rid !~ c_uuid_re
       AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = rid)
  ),
  u AS (
    UPDATE public.riding_days rd
       SET rider_ids = array_remove(rd.rider_ids, o.bad_id)
      FROM orphan_ids o
     WHERE o.bad_id = ANY(rd.rider_ids)
     RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM u;
  RAISE NOTICE 'pb008_uuid_backfill: scrubbed orphan ids from % riding_days arrays', v_deleted;
END $$;

-- 3. Repoint text-typed referencing columns

UPDATE public.claims c
   SET subject_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE c.subject_id = m.old_id
   AND c.subject_type = 'person';

UPDATE public.claims c
   SET object_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE c.object_id = m.old_id
   AND c.object_type = 'person';

UPDATE public.invites i
   SET person_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE i.person_id = m.old_id;

UPDATE public.community_people cp
   SET person_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE cp.person_id = m.old_id;

-- riding_days.rider_ids is text[]; array_replace handles the simple case and
-- legacy ids cannot already be canonicalised within the array.
UPDATE public.riding_days rd
   SET rider_ids = array_replace(rd.rider_ids, m.old_id, m.new_id)
  FROM legacy_people_id_remap m
 WHERE m.old_id = ANY(rd.rider_ids);

UPDATE public.claim_requests cr
   SET node_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE cr.node_id = m.old_id;

UPDATE public.tag_events te
   SET subject_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE te.subject_id = m.old_id;

-- tag_events.moment_ref->>'rider_id' is only ever uuid-format today (the
-- backfill that populates it reads from story_riders.rider_id which is
-- uuid-typed). The UPDATE below is defensive: zero rows expected.
UPDATE public.tag_events te
   SET moment_ref = jsonb_set(te.moment_ref, '{rider_id}', to_jsonb(m.new_id))
  FROM legacy_people_id_remap m
 WHERE te.moment_ref ? 'rider_id'
   AND te.moment_ref->>'rider_id' = m.old_id;

UPDATE public.person_invite_notifications pin
   SET person_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE pin.person_id = m.old_id;

-- people.merged_from_id usually points to a deleted ghost (and so does not
-- match any row in the mapping). When it happens to point to a SURVIVING
-- legacy row — possible under manual data fixes — we repoint it here.
UPDATE public.people p
   SET merged_from_id = m.new_id
  FROM legacy_people_id_remap m
 WHERE p.merged_from_id = m.old_id;

-- 4. Rename people.id itself (last, after every referencing column is updated)
UPDATE public.people p
   SET id = m.new_id
  FROM legacy_people_id_remap m
 WHERE p.id = m.old_id;

-- 5. Restore the FK on person_invite_notifications.person_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.person_invite_notifications'::regclass
       AND conname  = 'person_invite_notifications_person_id_fkey'
  ) THEN
    ALTER TABLE public.person_invite_notifications
      ADD CONSTRAINT person_invite_notifications_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Post-migration assertions

DO $$
DECLARE
  v_count bigint;
BEGIN
  -- A1: no surviving legacy ids in people
  SELECT count(*) INTO v_count
    FROM public.people
   WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A1: % legacy person_* ids still in people', v_count;
  END IF;

  -- A2: no legacy ids in claims.subject_id where subject is a person
  SELECT count(*) INTO v_count
    FROM public.claims
   WHERE subject_type = 'person'
     AND subject_id IS NOT NULL
     AND subject_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A2: % legacy ids still in claims.subject_id (person)', v_count;
  END IF;

  -- A3: no legacy ids in claims.object_id where object is a person
  SELECT count(*) INTO v_count
    FROM public.claims
   WHERE object_type = 'person'
     AND object_id IS NOT NULL
     AND object_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A3: % legacy ids still in claims.object_id (person)', v_count;
  END IF;

  -- A4: no legacy ids in invites.person_id
  SELECT count(*) INTO v_count
    FROM public.invites
   WHERE person_id IS NOT NULL
     AND person_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A4: % legacy ids still in invites.person_id', v_count;
  END IF;

  -- A5: no legacy ids in community_people.person_id
  SELECT count(*) INTO v_count
    FROM public.community_people
   WHERE person_id IS NOT NULL
     AND person_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A5: % legacy ids still in community_people.person_id', v_count;
  END IF;

  -- A6: no legacy ids in tag_events.subject_id
  SELECT count(*) INTO v_count
    FROM public.tag_events
   WHERE subject_id IS NOT NULL
     AND subject_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A6: % legacy ids still in tag_events.subject_id', v_count;
  END IF;

  -- A7: no legacy ids in claim_requests.node_id
  SELECT count(*) INTO v_count
    FROM public.claim_requests
   WHERE node_id IS NOT NULL
     AND node_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A7: % legacy ids still in claim_requests.node_id', v_count;
  END IF;

  -- A8: no legacy ids in person_invite_notifications.person_id
  SELECT count(*) INTO v_count
    FROM public.person_invite_notifications
   WHERE person_id IS NOT NULL
     AND person_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A8: % legacy ids still in person_invite_notifications.person_id', v_count;
  END IF;

  -- A9: no legacy ids in riding_days.rider_ids array
  SELECT count(*) INTO v_count
    FROM public.riding_days rd, unnest(rd.rider_ids) AS rid
   WHERE rid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'pb008_uuid_backfill A9: % legacy ids still in riding_days.rider_ids', v_count;
  END IF;

  RAISE NOTICE 'pb008_uuid_backfill: all assertions passed';
END $$;

COMMIT;
