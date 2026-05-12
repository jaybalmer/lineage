-- ============================================================================
-- PB-008 Phase 2: merge_person Path B repoint cleanup
-- ============================================================================
--
-- Brief: Operations/pb008-merge-person-path-b-fix-brief.md
--
-- Test E (Path B merge end-to-end) failed on admin-approve with:
--   ERROR 42804: column "created_by" is of type uuid but expression is of type text
--   CONTEXT: PL/pgSQL function merge_person(uuid,uuid) line 170 at SQL statement
--
-- Root cause: the riding_days.created_by repoint block in 20260512000002 set a
-- uuid column from a text variable (v_canonical_id). Postgres parses the SET
-- clause at run time regardless of whether the WHERE matches, so every Path B
-- approval aborted with SQLSTATE 42804. The block was also semantically wrong:
-- riding_days.created_by is the auth user who logged the day, not a person
-- reference, so the WHERE clause could never match a real row.
--
-- Audit of the rest of the Path B section surfaced the same auth-user-vs-person
-- confusion in nine other UPDATE blocks. Those compiled cleanly (their type
-- casts matched) but could never match a real row, since the columns hold auth
-- user uuids rather than person ids. They are removed here as well to prevent
-- a future contributor from copying the pattern into a column where it would
-- silently corrupt data.
--
-- Kept (correct person-reference repoints):
--   claims.subject_id, claims.object_id, invites.person_id,
--   community_people.person_id, story_riders.rider_id,
--   riding_days.rider_ids (legacy array, array_replace pattern),
--   claim_requests.node_id, person_slug_aliases.person_id
--
-- Removed (buggy or dead-code auth-user columns):
--   riding_days.created_by  (the bug: type mismatch)
--   claims.asserted_by, people.added_by, people.invited_by,
--   places.added_by, orgs.added_by, boards.added_by, events.added_by,
--   invites.invited_by, stories.author_id
--
-- Idempotent: CREATE OR REPLACE FUNCTION replaces the body atomically. Path A
-- branch is byte-for-byte identical to 20260512000002. Path B body is shorter
-- but functionally equivalent for every column that ever actually matched.

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
  v_claim_req       claim_requests%ROWTYPE;
  v_ghost_id        text;
  v_claimant_id     uuid;

  v_canonical_id    text;
  v_canonical_count int;
  v_path            text;

  v_ghost_snapshot  jsonb;
  v_ghost_name      text;
  v_ghost_slug      text;

  v_refs_repointed     jsonb := '{}'::jsonb;
  v_refs_deduplicated  jsonb := '{}'::jsonb;
  v_alias_rewrites     jsonb := '[]'::jsonb;
  v_auto_denied        int;

  v_ids_a jsonb;
  v_ids_b jsonb;

  c_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  -- 1. Lock the claim_request row
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

  -- 2. Idempotency check (re-click + concurrent loser)
  IF v_claim_req.status = 'approved' THEN
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

  -- 3. Validate ghost row exists
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = v_ghost_id) THEN
    RAISE EXCEPTION 'ghost_row_missing: people.id=% does not exist', v_ghost_id
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM people WHERE id = v_ghost_id FOR UPDATE;

  -- 4. Canonical lookup
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
    v_canonical_id := v_ghost_id;
  ELSIF v_canonical_count = 1 THEN
    v_path := 'merge';
    SELECT id INTO v_canonical_id
      FROM people
     WHERE claimed_by = v_claimant_id
       AND id <> v_ghost_id
       AND merged_from_id IS NULL;

    PERFORM 1 FROM people WHERE id = v_canonical_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'canonical_row_lookup_ambiguous: claimant % has % candidate canonical rows', v_claimant_id, v_canonical_count
      USING ERRCODE = 'P0001';
  END IF;

  -- 4a. UUID-format guard (Path B only)
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

  -- 5. Snapshot the ghost
  SELECT row_to_json(p)::jsonb, p.display_name
    INTO v_ghost_snapshot, v_ghost_name
    FROM people p
   WHERE p.id = v_ghost_id;

  -- 6. Status flip on the current claim_request
  UPDATE claim_requests
     SET status        = 'approved',
         status_reason = 'admin_approved',
         resolved_at   = now(),
         resolved_by   = p_admin_id,
         updated_at    = now()
   WHERE id = p_claim_request_id;

  -- 7. Auto-deny competing pending/vouched claims on this node
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

  -- 8. Branch
  IF v_path = 'claim_in_place' THEN
    -- Path A: ghost row stays, becomes claimed.
    UPDATE people
       SET node_status = 'claimed',
           claimed_by  = v_claimant_id,
           claimed_at  = now()
     WHERE id = v_ghost_id;

    -- Status-change reset: clear any pending invite-threshold notifications now
    -- that this row is claimed. Future un-claim then re-tag scenarios start
    -- with a clean dedup ledger. Path B handles the same via ON DELETE CASCADE
    -- on person_invite_notifications.person_id.
    DELETE FROM person_invite_notifications WHERE person_id = v_ghost_id;

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
  -- Path B (merge). Only person-reference columns are repointed below.
  -- Auth-user columns (added_by, asserted_by, invited_by, author_id,
  -- riding_days.created_by) are not touched: ghosts are unclaimed people
  -- rows, never auth users, so those columns never reference a ghost id.
  -- ────────────────────────────────────────────────────────────────────────

  WITH r AS (
    UPDATE claims SET subject_id = v_canonical_id
     WHERE subject_id = v_ghost_id AND subject_type = 'person'
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_subject_id', v_ids_a);

  WITH r AS (
    UPDATE claims SET object_id = v_canonical_id
     WHERE object_id = v_ghost_id AND object_type = 'person'
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_object_id', v_ids_a);

  WITH r AS (
    UPDATE invites SET person_id = v_canonical_id
     WHERE person_id = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('invites_person_id', v_ids_a);

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

  -- Legacy riding_days.rider_ids array. Kept because pre-deprecation rows may
  -- still have a ghost id in the array. array_replace handles non-dedup case;
  -- array_remove handles the dedup case (canonical already present).
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

  WITH r AS (
    UPDATE claim_requests SET node_id = v_canonical_id
     WHERE node_id = v_ghost_id
     RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
  v_refs_repointed := v_refs_repointed || jsonb_build_object('claim_requests_node_id', v_ids_a);

  WITH r AS (
    UPDATE person_slug_aliases SET person_id = v_canonical_id::uuid
     WHERE person_id = v_ghost_id::uuid
     RETURNING alias
  )
  SELECT coalesce(jsonb_agg(alias), '[]'::jsonb) INTO v_alias_rewrites FROM r;

  INSERT INTO person_slug_aliases (alias, person_id, reason)
  VALUES (v_ghost_id, v_canonical_id::uuid, 'merged')
  ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;

  v_ghost_slug := public.name_to_slug(coalesce(v_ghost_name, ''));
  IF v_ghost_slug <> '' AND v_ghost_slug <> v_ghost_id THEN
    INSERT INTO person_slug_aliases (alias, person_id, reason)
    VALUES (v_ghost_slug, v_canonical_id::uuid, 'merged')
    ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;
  END IF;

  UPDATE people
     SET merged_from_id = v_ghost_id,
         merged_at      = now()
   WHERE id = v_canonical_id;

  INSERT INTO merge_log (
    path, ghost_id, ghost_snapshot, canonical_id,
    references_repointed, references_deduplicated, alias_rewrites,
    claim_request_id, merged_by
  ) VALUES (
    'merge', v_ghost_id, v_ghost_snapshot, v_canonical_id,
    v_refs_repointed, v_refs_deduplicated, v_alias_rewrites,
    p_claim_request_id, p_admin_id
  );

  -- Hard-delete the ghost row. Cascades to person_invite_notifications
  -- via the FK ON DELETE CASCADE.
  DELETE FROM people WHERE id = v_ghost_id;

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

REVOKE ALL ON FUNCTION public.merge_person(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_person(uuid, uuid) FROM anon, authenticated;

COMMENT ON FUNCTION public.merge_person IS
  'PB-008 Phase 2: Path B repoint cleanup. Removes the buggy riding_days.created_by repoint (text/uuid mismatch, SQLSTATE 42804) that blocked every Path B approval, plus nine other auth-user-vs-person dead-code repoint blocks. Path A behaviour identical to 20260512000002. See Operations/pb008-merge-person-path-b-fix-brief.md.';
