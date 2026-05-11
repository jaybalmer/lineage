-- ============================================================================
-- PB-008 Phase 2 Session 3 — Merge execution
-- ============================================================================
--
-- Adds the public.merge_person() RPC that the /admin/claims approve button
-- calls to atomically resolve a claim_request via one of two paths:
--
--   Path A — claim in place. The ghost row stays; node_status flips to
--            'claimed' and claimed_by / claimed_at are set on the ghost.
--
--   Path B — merge ghost into canonical. Every people-referencing FK is
--            repointed from ghost.id to canonical.id, person_slug_aliases is
--            populated, the canonical row carries merged_from_id back to the
--            ghost, merge_log captures the full pre-delete snapshot, and the
--            ghost row is hard-deleted. All inside one transaction.
--
-- Idempotent: re-clicking approve on an already-resolved claim returns a
-- noop=true response. Two simultaneous approve calls race on the
-- claim_requests row's FOR UPDATE lock; the loser falls through the
-- idempotency check and also returns noop=true.
--
-- ----------------------------------------------------------------------------
-- PRE-DEPLOY MANUAL CHECKS (run these against prod before applying)
-- ----------------------------------------------------------------------------
--
-- (1) Enumerate every text/uuid/array column on a public table whose name
--     looks like a person FK. Diff against the column list inside
--     merge_person() below. A column in prod but missing here is silent
--     data leak on merge.
--
--   SELECT table_name, column_name, data_type
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND (
--            (data_type IN ('text', 'uuid')
--              AND (column_name LIKE '%_id' OR column_name LIKE '%_by'))
--         OR column_name = 'rider_ids'
--          )
--    ORDER BY table_name, column_name;
--
-- (2) UUID-format audit. Path B refuses to merge people rows whose id is
--     not a valid UUID string (uuid-typed FK columns can't accept arbitrary
--     text). Path A is unaffected — the UUID guard is deferred to step 4a
--     inside merge_person() and only fires when v_path = 'merge'. The RPC
--     raises path_b_unavailable_non_uuid_{ghost,canonical}_id when it sees
--     one, transaction rolls back cleanly. Production audit on 2026-05-11
--     returned 29 rows. Those rows can still be claimed in place (Path A);
--     they just can't be Path-B-merged until their ids are migrated.
--
--   SELECT count(*)
--     FROM people
--    WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--
-- (3) name_to_slug() parity check. The function below mirrors
--     src/lib/utils.ts nameToSlug exactly: trim, lowercase, collapse
--     whitespace runs to a single underscore, strip every remaining
--     non-alphanumeric/underscore character. Verify with:
--
--   SELECT public.name_to_slug('Jay Balmer');           -- jay_balmer
--   SELECT public.name_to_slug('Devun Walsh-Jones');    -- devun_walshjones
--   SELECT public.name_to_slug('Anna   Karenina');      -- anna_karenina
--   SELECT public.name_to_slug('Sébastien Toutant');    -- sbastien_toutant
--   SELECT public.name_to_slug('  spaced  ');           -- spaced
--
--     NOTE: TS nameToSlug strips hyphens rather than mapping them to
--     underscores. "Devun Walsh-Jones" -> "devun_walshjones", not
--     "devun_walsh_jones". The SQL function matches that behaviour so the
--     alias we INSERT here resolves the same URL segments the client has
--     been generating.

-- ============================================================================
-- 1. merge_log (audit trail)
-- ============================================================================
-- Append-only. Service-role only (no policies under RLS).
-- Captures the full pre-delete ghost row, per-table repointed/deduped row id
-- arrays, alias rewrites, and metadata.

CREATE TABLE IF NOT EXISTS public.merge_log (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  path                     text        NOT NULL CHECK (path IN ('claim_in_place', 'merge')),
  ghost_id                 text        NOT NULL,
  ghost_snapshot           jsonb       NOT NULL,
  canonical_id             text        NOT NULL,
  references_repointed     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  references_deduplicated  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  alias_rewrites           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  claim_request_id         uuid        NOT NULL,
  merged_by                uuid        NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_log_ghost     ON public.merge_log (ghost_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_canonical ON public.merge_log (canonical_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_claim_req ON public.merge_log (claim_request_id);

ALTER TABLE public.merge_log ENABLE ROW LEVEL SECURITY;
-- No policies. Service role bypasses RLS; anon/authenticated cannot read.

-- ============================================================================
-- 2. name_to_slug (parity with src/lib/utils.ts nameToSlug)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.name_to_slug(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    regexp_replace(lower(trim(name)), '\s+', '_', 'g'),
    '[^a-z0-9_]', '', 'g'
  )
$$;

-- ============================================================================
-- 3. merge_person — the RPC the admin claims approve button calls
-- ============================================================================
-- SECURITY DEFINER so the function runs with the owner's privileges, and we
-- enforce caller identity in the route handler via requireEditor() before
-- ever invoking it. The function is the ONLY writer to merge_log and the
-- ONLY DELETE-from-people path that takes the merge route.

CREATE OR REPLACE FUNCTION public.merge_person(
  p_claim_request_id uuid,
  p_admin_id         uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- Loaded from claim_requests
  v_claim_req       claim_requests%ROWTYPE;
  v_ghost_id        text;
  v_claimant_id     uuid;

  -- Path decision
  v_canonical_id    text;
  v_canonical_count int;
  v_path            text;

  -- Snapshot + alias
  v_ghost_snapshot  jsonb;
  v_ghost_name      text;
  v_ghost_slug      text;

  -- Accumulators
  v_refs_repointed     jsonb := '{}'::jsonb;
  v_refs_deduplicated  jsonb := '{}'::jsonb;
  v_alias_rewrites     jsonb := '[]'::jsonb;
  v_auto_denied        int;

  -- Per-table temporaries (reused)
  v_ids_a jsonb;
  v_ids_b jsonb;

  -- UUID-format guard
  c_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  -- ── 1. Lock the claim_request row ─────────────────────────────────────────
  -- FOR UPDATE serialises concurrent approve calls. The loser waits here,
  -- then falls through the idempotency check below and returns noop=true.

  SELECT * INTO v_claim_req
    FROM claim_requests
   WHERE id = p_claim_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_request_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  v_ghost_id    := v_claim_req.node_id;
  v_claimant_id := v_claim_req.claimant_id;

  -- ── 2. Idempotency check (re-click + concurrent loser) ───────────────────
  IF v_claim_req.status = 'approved' THEN
    -- Already resolved. Re-derive the outcome shape and return noop.
    IF EXISTS (
      SELECT 1 FROM people
       WHERE id = v_ghost_id
         AND claimed_by = v_claimant_id
    ) AND NOT EXISTS (
      SELECT 1 FROM people WHERE merged_from_id = v_ghost_id
    ) THEN
      RETURN jsonb_build_object(
        'path', 'claim_in_place',
        'noop', true,
        'ghost_id', v_ghost_id,
        'canonical_id', v_ghost_id,
        'references_repointed', '{}'::jsonb,
        'references_deduplicated', '{}'::jsonb,
        'alias_rewrites', 0,
        'claim_requests_auto_denied', 0
      );
    ELSIF NOT EXISTS (SELECT 1 FROM people WHERE id = v_ghost_id) THEN
      SELECT id INTO v_canonical_id FROM people WHERE merged_from_id = v_ghost_id LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'path', 'merge',
          'noop', true,
          'ghost_id', v_ghost_id,
          'canonical_id', v_canonical_id,
          'references_repointed', '{}'::jsonb,
          'references_deduplicated', '{}'::jsonb,
          'alias_rewrites', 0,
          'claim_requests_auto_denied', 0
        );
      ELSE
        RAISE EXCEPTION 'merge_idempotency_check_failed: ghost % gone but no canonical carries merged_from_id', v_ghost_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'merge_idempotency_check_failed: claim % is approved but ghost/canonical state is inconsistent', p_claim_request_id;
    END IF;
  END IF;

  IF v_claim_req.status NOT IN ('pending', 'vouched') THEN
    RAISE EXCEPTION 'claim_request_not_actionable: status=%', v_claim_req.status
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Validate ghost row exists ─────────────────────────────────────────
  -- UUID-format check is deferred to step 4a (Path-B-only) so Path A still
  -- works for legacy non-UUID ids. Path A doesn't touch any uuid-typed
  -- column, so a non-UUID ghost id is safe to claim in place.

  IF NOT EXISTS (SELECT 1 FROM people WHERE id = v_ghost_id) THEN
    RAISE EXCEPTION 'ghost_row_missing: people.id=% does not exist', v_ghost_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Lock the ghost row to serialise against concurrent writes.
  PERFORM 1 FROM people WHERE id = v_ghost_id FOR UPDATE;

  -- ── 4. Canonical lookup ─────────────────────────────────────────────────
  -- Conservative: claimed_by = claimant_id is the single source of truth.
  -- 2-row peek detects ambiguity.

  SELECT count(*) INTO v_canonical_count
    FROM (
      SELECT id
        FROM people
       WHERE claimed_by = v_claimant_id
         AND id <> v_ghost_id
         AND merged_from_id IS NULL
       LIMIT 2
    ) s;

  IF v_canonical_count = 0 THEN
    v_path := 'claim_in_place';
    v_canonical_id := v_ghost_id;  -- the ghost becomes the claimed row
  ELSIF v_canonical_count = 1 THEN
    v_path := 'merge';
    SELECT id INTO v_canonical_id
      FROM people
     WHERE claimed_by = v_claimant_id
       AND id <> v_ghost_id
       AND merged_from_id IS NULL;

    -- Lock the canonical row too.
    PERFORM 1 FROM people WHERE id = v_canonical_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'canonical_row_lookup_ambiguous: claimant % has % candidate canonical rows', v_claimant_id, v_canonical_count
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 4a. UUID-format guard (Path B only) ──────────────────────────────────
  -- Path B repoints uuid-typed columns (people.invited_by, story_riders.rider_id,
  -- stories.author_id, riding_days.created_by, person_slug_aliases.person_id),
  -- so both ghost and canonical ids must be valid UUID strings or the cast
  -- fails inside the FK UPDATEs.
  IF v_path = 'merge' THEN
    IF v_ghost_id !~ c_uuid_re THEN
      RAISE EXCEPTION 'path_b_unavailable_non_uuid_ghost_id: ghost % is not a valid uuid string', v_ghost_id
        USING ERRCODE = 'P0001';
    END IF;
    IF v_canonical_id !~ c_uuid_re THEN
      RAISE EXCEPTION 'path_b_unavailable_non_uuid_canonical_id: canonical % is not a valid uuid string', v_canonical_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── 5. Snapshot the ghost ───────────────────────────────────────────────
  SELECT row_to_json(p)::jsonb, p.display_name
    INTO v_ghost_snapshot, v_ghost_name
    FROM people p
   WHERE p.id = v_ghost_id;

  -- ── 6. Status flip on the current claim_request ─────────────────────────
  UPDATE claim_requests
     SET status        = 'approved',
         status_reason = 'admin_approved',
         resolved_at   = now(),
         resolved_by   = p_admin_id,
         updated_at    = now()
   WHERE id = p_claim_request_id;

  -- ── 7. Auto-deny competing pending/vouched claims on this node ──────────
  -- Same query in both paths. v_ghost_id is the node_id of the current claim.

  WITH ad AS (
    UPDATE claim_requests
       SET status        = 'denied',
           status_reason = 'target_already_claimed',
           resolved_at   = now(),
           resolved_by   = p_admin_id,
           updated_at    = now()
     WHERE node_id = v_ghost_id
       AND id <> p_claim_request_id
       AND status IN ('pending', 'vouched')
     RETURNING id
  )
  SELECT count(*) INTO v_auto_denied FROM ad;

  -- ── 8. Branch ───────────────────────────────────────────────────────────
  IF v_path = 'claim_in_place' THEN
    -- Path A: ghost row stays, becomes claimed.
    UPDATE people
       SET node_status = 'claimed',
           claimed_by  = v_claimant_id,
           claimed_at  = now()
     WHERE id = v_ghost_id;

    INSERT INTO merge_log (
      path, ghost_id, ghost_snapshot, canonical_id,
      references_repointed, references_deduplicated, alias_rewrites,
      claim_request_id, merged_by
    ) VALUES (
      'claim_in_place', v_ghost_id, v_ghost_snapshot, v_ghost_id,
      '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      p_claim_request_id, p_admin_id
    );

    RETURN jsonb_build_object(
      'path', 'claim_in_place',
      'noop', false,
      'ghost_id', v_ghost_id,
      'canonical_id', v_ghost_id,
      'references_repointed', '{}'::jsonb,
      'references_deduplicated', '{}'::jsonb,
      'alias_rewrites', 0,
      'claim_requests_auto_denied', v_auto_denied
    );
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- Path B (merge). Everything below runs only when v_path = 'merge'.
  -- ────────────────────────────────────────────────────────────────────────

  -- ── 9a. Repoint claims.subject_id (where subject_type = 'person') ───────
  WITH r AS (
    UPDATE claims SET subject_id = v_canonical_id
     WHERE subject_id = v_ghost_id AND subject_type = 'person'
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_subject_id', v_ids_a);

  -- ── 9b. Repoint claims.object_id (where object_type = 'person') ────────
  WITH r AS (
    UPDATE claims SET object_id = v_canonical_id
     WHERE object_id = v_ghost_id AND object_type = 'person'
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_object_id', v_ids_a);

  -- ── 9c. Repoint claims.asserted_by (user-id field) ─────────────────────
  WITH r AS (
    UPDATE claims SET asserted_by = v_canonical_id
     WHERE asserted_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_asserted_by', v_ids_a);

  -- ── 9d. people.added_by, people.invited_by ─────────────────────────────
  WITH r AS (
    UPDATE people SET added_by = v_canonical_id
     WHERE added_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('people_added_by', v_ids_a);

  -- people.invited_by is uuid-typed (verified via info_schema 2026-05-11),
  -- so cast both sides. UUID-format guard above ensures the casts succeed.
  WITH r AS (
    UPDATE people SET invited_by = v_canonical_id::uuid
     WHERE invited_by = v_ghost_id::uuid
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('people_invited_by', v_ids_a);

  -- ── 9e. Catalog added_by columns (places, orgs, boards, events) ────────
  WITH r AS (
    UPDATE places SET added_by = v_canonical_id
     WHERE added_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('places_added_by', v_ids_a);

  WITH r AS (
    UPDATE orgs SET added_by = v_canonical_id
     WHERE added_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('orgs_added_by', v_ids_a);

  WITH r AS (
    UPDATE boards SET added_by = v_canonical_id
     WHERE added_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('boards_added_by', v_ids_a);

  WITH r AS (
    UPDATE events SET added_by = v_canonical_id
     WHERE added_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('events_added_by', v_ids_a);

  -- ── 9f. invites.person_id + invites.invited_by ────────────────────────
  -- Both columns are text-typed (info_schema 2026-05-11). invited_by stores
  -- the inviter's auth uuid-as-text (see /api/invite/route.ts).
  WITH r AS (
    UPDATE invites SET person_id = v_canonical_id
     WHERE person_id = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('invites_person_id', v_ids_a);

  WITH r AS (
    UPDATE invites SET invited_by = v_canonical_id
     WHERE invited_by = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('invites_invited_by', v_ids_a);

  -- ── 9g. community_people (composite PK community_id, person_id) ────────
  -- Dedup first: delete ghost-side rows whose community_id already exists on canonical side.
  WITH d AS (
    DELETE FROM community_people
     WHERE person_id = v_ghost_id
       AND community_id IN (SELECT community_id FROM community_people WHERE person_id = v_canonical_id)
     RETURNING community_id
  )
  SELECT coalesce(jsonb_agg(community_id), '[]'::jsonb) INTO v_ids_b FROM d;
  v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('community_people', v_ids_b);

  WITH r AS (
    UPDATE community_people SET person_id = v_canonical_id
     WHERE person_id = v_ghost_id
     RETURNING community_id
  )
  SELECT coalesce(jsonb_agg(community_id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('community_people', v_ids_a);

  -- ── 9h. story_riders (composite PK story_id, rider_id) ────────────────
  -- rider_id is uuid; v_canonical_id is text. Both must be UUID-format
  -- (validated above). The implicit cast happens at the value comparison.
  WITH d AS (
    DELETE FROM story_riders
     WHERE rider_id = v_ghost_id::uuid
       AND story_id IN (SELECT story_id FROM story_riders WHERE rider_id = v_canonical_id::uuid)
     RETURNING story_id
  )
  SELECT coalesce(jsonb_agg(story_id), '[]'::jsonb) INTO v_ids_b FROM d;
  v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('story_riders', v_ids_b);

  WITH r AS (
    UPDATE story_riders SET rider_id = v_canonical_id::uuid
     WHERE rider_id = v_ghost_id::uuid
     RETURNING story_id
  )
  SELECT coalesce(jsonb_agg(story_id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('story_riders', v_ids_a);

  -- ── 9i. stories.author_id (defensive — author should be auth user) ─────
  WITH r AS (
    UPDATE stories SET author_id = v_canonical_id::uuid
     WHERE author_id = v_ghost_id::uuid
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('stories_author_id', v_ids_a);

  -- ── 9j. riding_days.created_by ────────────────────────────────────────
  -- created_by is typed text or uuid in different schemas; we treat it as
  -- the same domain as people.id. Cast both sides through text to be safe.
  WITH r AS (
    UPDATE riding_days SET created_by = v_canonical_id
     WHERE created_by::text = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('riding_days_created_by', v_ids_a);

  -- ── 9k. riding_days.rider_ids (ARRAY) ─────────────────────────────────
  -- For each affected row: if canonical is already in the array → array_remove(ghost)
  -- (collapse / dedup). Otherwise array_replace(ghost, canonical) (simple repoint).
  WITH affected AS (
    SELECT id, rider_ids,
           (v_canonical_id = ANY(rider_ids)) AS would_dedup
      FROM riding_days
     WHERE v_ghost_id = ANY(rider_ids)
     FOR UPDATE
  ),
  updated AS (
    UPDATE riding_days rd
       SET rider_ids = CASE
         WHEN a.would_dedup
           THEN array_remove(rd.rider_ids, v_ghost_id)
         ELSE array_replace(rd.rider_ids, v_ghost_id, v_canonical_id)
       END
      FROM affected a
     WHERE rd.id = a.id
     RETURNING rd.id, a.would_dedup
  )
  SELECT
    coalesce(jsonb_agg(id) FILTER (WHERE NOT would_dedup), '[]'::jsonb),
    coalesce(jsonb_agg(id) FILTER (WHERE would_dedup),     '[]'::jsonb)
    INTO v_ids_a, v_ids_b
    FROM updated;
  v_refs_repointed    := v_refs_repointed    || jsonb_build_object('riding_days_rider_ids', v_ids_a);
  v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('riding_days_rider_ids', v_ids_b);

  -- ── 9l. claim_requests.node_id (historical + the current one) ─────────
  -- At this point: current row is 'approved', competing pending/vouched
  -- have been auto-denied. Repoint every node_id = ghost to canonical so
  -- audit lookups against canonical are complete.
  WITH r AS (
    UPDATE claim_requests SET node_id = v_canonical_id
     WHERE node_id = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claim_requests_node_id', v_ids_a);

  -- ── 10. person_slug_aliases: retarget existing rows + insert new aliases ─
  -- Capture alias rewrites first (existing rows where person_id = ghost.id).
  WITH r AS (
    UPDATE person_slug_aliases SET person_id = v_canonical_id::uuid
     WHERE person_id = v_ghost_id::uuid
     RETURNING alias
  )
  SELECT coalesce(jsonb_agg(alias), '[]'::jsonb) INTO v_alias_rewrites FROM r;

  -- Insert: ghost.id as alias (defensive; people.merged_from_id also yields this redirect).
  INSERT INTO person_slug_aliases (alias, person_id, reason)
  VALUES (v_ghost_id, v_canonical_id::uuid, 'merged')
  ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;

  -- Insert: name_to_slug(ghost.display_name) as alias (handles old-slug bookmarks).
  v_ghost_slug := public.name_to_slug(coalesce(v_ghost_name, ''));
  IF v_ghost_slug <> '' AND v_ghost_slug <> v_ghost_id THEN
    INSERT INTO person_slug_aliases (alias, person_id, reason)
    VALUES (v_ghost_slug, v_canonical_id::uuid, 'merged')
    ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;
  END IF;

  -- ── 11. Mark canonical as having absorbed the ghost ───────────────────
  UPDATE people
     SET merged_from_id = v_ghost_id,
         merged_at      = now()
   WHERE id = v_canonical_id;

  -- ── 12. Write the merge_log row BEFORE deleting the ghost ────────────
  -- This must succeed (and be transactional with the DELETE) for the
  -- acceptance criteria to hold. The snapshot captures the ghost as it
  -- existed pre-delete.
  INSERT INTO merge_log (
    path, ghost_id, ghost_snapshot, canonical_id,
    references_repointed, references_deduplicated, alias_rewrites,
    claim_request_id, merged_by
  ) VALUES (
    'merge', v_ghost_id, v_ghost_snapshot, v_canonical_id,
    v_refs_repointed, v_refs_deduplicated, v_alias_rewrites,
    p_claim_request_id, p_admin_id
  );

  -- ── 13. Hard-delete the ghost row ────────────────────────────────────
  DELETE FROM people WHERE id = v_ghost_id;

  -- Sanity: if any FK references survived (shouldn't happen — none of the
  -- people-referencing columns have a real FK constraint, but the column
  -- list might be incomplete), the DELETE could leave orphans behind. Log
  -- a marker so call sites can grep for fk_repoint_orphan in case the
  -- post-delete state seems off. We can't enforce this without a real FK,
  -- but we capture intent.
  -- (Currently a no-op; future: SELECT 1 FROM information_schema where FK matches ghost_id.)

  -- ── 14. Return summary ───────────────────────────────────────────────
  RETURN jsonb_build_object(
    'path', 'merge',
    'noop', false,
    'ghost_id', v_ghost_id,
    'canonical_id', v_canonical_id,
    'references_repointed', v_refs_repointed,
    'references_deduplicated', v_refs_deduplicated,
    'alias_rewrites', jsonb_array_length(v_alias_rewrites),
    'claim_requests_auto_denied', v_auto_denied
  );
END;
$function$;

-- Service role only.
REVOKE ALL ON FUNCTION public.merge_person(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_person(uuid, uuid) FROM anon, authenticated;
-- Service role bypasses these grants anyway, but explicit is safer.

COMMENT ON FUNCTION public.merge_person IS
  'PB-008 Phase 2 Session 3. Resolves an approved claim_request by either claiming the ghost in place (Path A) or merging the ghost into the claimant''s existing canonical row (Path B). See migration header for FK enumeration and pre-deploy checks.';

COMMENT ON TABLE public.merge_log IS
  'Append-only audit log of every merge_person() invocation. Service-role read only (RLS on, no policies). ghost_snapshot is the full pre-delete people row captured via row_to_json. references_repointed and references_deduplicated are { table_column: [row_id, ...] } jsonb. alias_rewrites is a jsonb array of person_slug_aliases.alias values that were retargeted.';
