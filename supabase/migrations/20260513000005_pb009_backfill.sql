-- ============================================================================
-- PB-009 Phase 1 (Migration E) — backfill existing rows
-- ============================================================================
--
-- Every existing story_riders row and every person-implicating claims row
-- gets a paired tag_event with source='system', status='approved'. After this
-- runs, the count check in §5 of the brief holds:
--
--   SELECT count(*) FROM story_riders WHERE tag_event_id IS NULL  -- → 0
--   SELECT count(*) FROM claims       WHERE tag_event_id IS NULL  --
--      AND ((subject_type='person' AND subject_id <> asserted_by::text)
--           OR (object_type='person' AND object_id  <> asserted_by::text))
--      -- → 0 (self-claims and entity-only claims stay NULL by design)
--
-- ── Ordering note ──────────────────────────────────────────────────────────
-- Run AFTER application code is deployed (write paths pair new rows, reads
-- go through _public views). The window between code deploy and this
-- backfill is safe because the views fall back to "treat NULL tag_event_id
-- as approved", so existing rows remain visible throughout.
--
-- ── Idempotency ────────────────────────────────────────────────────────────
-- The WHERE tag_event_id IS NULL clause makes the migration safely re-runnable
-- — already-paired rows are skipped. If you ABORT mid-way and re-run, only
-- the unpaired tail is processed.
--
-- ── Size considerations ────────────────────────────────────────────────────
-- For Lineage's current scale (low thousands of rows across both tables) the
-- single-statement CTEs run in seconds. If story_riders or claims ever grow
-- into the millions, split this DO block into batched CALLs of a procedure
-- with explicit COMMIT between iterations (see brief §3.1 Migration D notes).
--
-- ── moment_ref shape ───────────────────────────────────────────────────────
-- We embed the composite-key identifiers in moment_ref so we can JOIN back
-- to UPDATE the source row. story_riders has no surrogate `id` column — its
-- PK is (story_id, rider_id) — so both go in. Claims have an `id` UUID.

-- ── story_riders ────────────────────────────────────────────────────────────

DO $$
DECLARE
  pre_unbacked   bigint;
  post_unbacked  bigint;
BEGIN
  SELECT count(*) INTO pre_unbacked
    FROM public.story_riders WHERE tag_event_id IS NULL;
  RAISE NOTICE 'story_riders backfill: % rows to process', pre_unbacked;

  WITH unbacked AS (
    SELECT story_id, rider_id
      FROM public.story_riders
     WHERE tag_event_id IS NULL
  ),
  inserted AS (
    INSERT INTO public.tag_events (
      source, asserter_id, subject_id, subject_tier_at_assert,
      predicate, moment_ref, status, decision_at, display_state
    )
    SELECT 'system'::tag_event_source,
           NULL,
           u.rider_id::text,
           'standard'::tag_event_subject_tier,
           'story_tag',
           jsonb_build_object('story_id', u.story_id, 'rider_id', u.rider_id),
           'approved'::tag_event_status,
           now(),
           'attributed'::tag_event_display_state
      FROM unbacked u
    RETURNING id, moment_ref
  )
  UPDATE public.story_riders sr
     SET tag_event_id = i.id
    FROM inserted i
   WHERE sr.story_id = (i.moment_ref->>'story_id')::uuid
     AND sr.rider_id = (i.moment_ref->>'rider_id')::uuid
     AND sr.tag_event_id IS NULL;

  SELECT count(*) INTO post_unbacked
    FROM public.story_riders WHERE tag_event_id IS NULL;
  RAISE NOTICE 'story_riders backfill: % rows remain unpaired (expected 0)', post_unbacked;

  IF post_unbacked <> 0 THEN
    RAISE WARNING 'story_riders backfill left % rows unpaired — investigate before running enforcement', post_unbacked;
  END IF;
END $$;

-- ── claims (person-implicating, non-self) ──────────────────────────────────
-- A claim is "person-implicating" when subject OR object is a person OTHER
-- than the asserter. Self-claims (subject = asserter or object = asserter
-- with the other side being a place/board/event) keep tag_event_id = NULL —
-- they're not really tags, just first-person history records.
--
-- When BOTH sides are non-asserter persons (rare: a third-party rode_with
-- assertion) we pick the subject side. The other side stays unpaired in
-- Phase 1; Phase 2's editor queue can split or escalate as needed.

DO $$
DECLARE
  pre_unbacked   bigint;
  post_unbacked  bigint;
BEGIN
  SELECT count(*) INTO pre_unbacked
    FROM public.claims c
   WHERE c.tag_event_id IS NULL
     AND c.asserted_by IS NOT NULL
     AND (
       (c.subject_type = 'person' AND c.subject_id IS NOT NULL AND c.subject_id <> c.asserted_by::text)
       OR
       (c.object_type  = 'person' AND c.object_id  IS NOT NULL AND c.object_id  <> c.asserted_by::text)
     );
  RAISE NOTICE 'claims backfill: % rows to process', pre_unbacked;

  WITH unbacked AS (
    SELECT id, subject_id, object_id, subject_type, object_type, predicate, asserted_by
      FROM public.claims
     WHERE tag_event_id IS NULL
       AND asserted_by IS NOT NULL
       AND (
         (subject_type = 'person' AND subject_id IS NOT NULL AND subject_id <> asserted_by::text)
         OR
         (object_type  = 'person' AND object_id  IS NOT NULL AND object_id  <> asserted_by::text)
       )
  ),
  targets AS (
    SELECT id AS claim_id,
           CASE
             WHEN subject_type = 'person' AND subject_id IS NOT NULL AND subject_id <> asserted_by::text
               THEN subject_id
             ELSE object_id
           END AS tagged_person_id,
           predicate,
           asserted_by
      FROM unbacked
  ),
  inserted AS (
    INSERT INTO public.tag_events (
      source, asserter_id, subject_id, subject_tier_at_assert,
      predicate, moment_ref, status, decision_at, display_state
    )
    SELECT 'system'::tag_event_source,
           t.asserted_by,
           t.tagged_person_id,
           'standard'::tag_event_subject_tier,
           t.predicate,
           jsonb_build_object('claim_id', t.claim_id),
           'approved'::tag_event_status,
           now(),
           'attributed'::tag_event_display_state
      FROM targets t
    RETURNING id, (moment_ref->>'claim_id') AS cid
  )
  UPDATE public.claims c
     SET tag_event_id = i.id
    FROM inserted i
   WHERE c.id::text = i.cid
     AND c.tag_event_id IS NULL;

  SELECT count(*) INTO post_unbacked
    FROM public.claims c
   WHERE c.tag_event_id IS NULL
     AND c.asserted_by IS NOT NULL
     AND (
       (c.subject_type = 'person' AND c.subject_id IS NOT NULL AND c.subject_id <> c.asserted_by::text)
       OR
       (c.object_type  = 'person' AND c.object_id  IS NOT NULL AND c.object_id  <> c.asserted_by::text)
     );
  RAISE NOTICE 'claims backfill: % person-implicating rows remain unpaired (expected 0)', post_unbacked;

  IF post_unbacked <> 0 THEN
    RAISE WARNING 'claims backfill left % person-implicating rows unpaired — investigate before running enforcement', post_unbacked;
  END IF;
END $$;
