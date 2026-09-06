-- ============================================================================
-- Duplicate-person prevention Phase 3 — generalized merge tool
-- ============================================================================
--
-- Adds public.merge_person_into(), an admin-initiated "fold this ghost into that
-- person" operation that works whether the canonical is a people row OR a
-- profiles row (a member). It is the generalized core extracted from
-- merge_person()'s Path B, brought up to date with the schema (six person-id
-- columns added since the original was written on 2026-05-11 are now repointed),
-- and given a dry-run mode.
--
-- merge_person() is refactored to delegate its Path B to this function, so there
-- is ONE repoint list for every fold-in path in the app and it cannot drift
-- again. Its signature, Path A behaviour, idempotency, status flip, and
-- auto-deny are unchanged; the approve button behaves exactly as before.
--
-- Why a new entry point: merge_person() is claim-request-driven and assumes the
-- canonical is a people row (its canonical lookup counts people.claimed_by).
-- Members have zero people rows, so it can only take Path A for them. This
-- function takes the ghost id, the canonical id, and which table the canonical
-- lives in, so a ghost can be folded into a member's profiles row.
--
-- Verified against prod schema 2026-09-06 (Supabase MCP):
--   people.id text, profiles.id uuid (both cast to text for comparison).
--   profiles has merged_from_id but NOT merged_at; people has both.
--   person_slug_aliases.person_id (uuid) has no FK to people, so aliasing to a
--     profiles uuid is allowed.
--   person_invite_notifications.person_id FK -> people(id) CASCADE, so it cannot
--     be repointed to a profiles id; for a profiles canonical those rows are
--     deleted (they would cascade-delete with the ghost anyway).
--   event_people / event_guests: composite PK (event_id, person_id), person_id
--     no FK -> dedup-then-repoint.
--   mentions: unique index mentions_dedupe (episode_event_id, subject_type,
--     subject_id, coalesce(timestamp_seconds,-1)) -> dedup-then-repoint.
--   public_stack_entries: person rows are entry_type='rider'.
--   tag_events.subject_id text, no FK -> plain repoint.

-- ============================================================================
-- 1. merge_log: allow admin merges (no claim_request) + carry a note
-- ============================================================================
-- Relax claim_request_id so an admin-initiated merge (no originating request)
-- can be logged, and add a free-text note. Both changes are additive on a
-- service-role-only audit table; existing writers always pass claim_request_id.
ALTER TABLE public.merge_log ALTER COLUMN claim_request_id DROP NOT NULL;
ALTER TABLE public.merge_log ADD COLUMN IF NOT EXISTS note text;

-- ============================================================================
-- 2. merge_person_into — the generalized fold-in
-- ============================================================================
CREATE OR REPLACE FUNCTION public.merge_person_into(
  p_ghost_id         text,
  p_canonical_id     text,
  p_canonical_kind   text,
  p_admin_id         uuid,
  p_dry_run          boolean DEFAULT true,
  p_note             text    DEFAULT NULL,
  p_claim_request_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ghost_snapshot     jsonb;
  v_ghost_name         text;
  v_ghost_slug         text;
  v_ghost_claimed_by   uuid;

  v_refs_repointed     jsonb := '{}'::jsonb;
  v_refs_deduplicated  jsonb := '{}'::jsonb;
  v_alias_rewrites     jsonb := '[]'::jsonb;

  v_ids_a jsonb;
  v_ids_b jsonb;

  c_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  -- ── Guards ────────────────────────────────────────────────────────────────
  IF p_canonical_kind NOT IN ('people', 'profiles') THEN
    RAISE EXCEPTION 'bad_canonical_kind: % (expected people|profiles)', p_canonical_kind
      USING ERRCODE = 'P0001';
  END IF;

  IF p_ghost_id = p_canonical_id THEN
    RAISE EXCEPTION 'ghost_equals_canonical: %', p_ghost_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Both ids repoint uuid-typed columns (people.invited_by, story_riders.rider_id,
  -- stories.author_id, riding_days.created_by, person_slug_aliases.person_id), so
  -- both must be valid UUID strings.
  IF p_ghost_id !~ c_uuid_re THEN
    RAISE EXCEPTION 'non_uuid_ghost_id: %', p_ghost_id USING ERRCODE = 'P0001';
  END IF;
  IF p_canonical_id !~ c_uuid_re THEN
    RAISE EXCEPTION 'non_uuid_canonical_id: %', p_canonical_id USING ERRCODE = 'P0001';
  END IF;

  -- Ghost must exist as a people row and must be a genuine ghost (not a claimed
  -- account). Lock it.
  SELECT p.display_name, p.claimed_by
    INTO v_ghost_name, v_ghost_claimed_by
    FROM people p
   WHERE p.id = p_ghost_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ghost_row_missing: people.id=% does not exist', p_ghost_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_ghost_claimed_by IS NOT NULL THEN
    RAISE EXCEPTION 'ghost_is_claimed_account: people.id=% is claimed_by=%', p_ghost_id, v_ghost_claimed_by
      USING ERRCODE = 'P0001';
  END IF;

  -- Canonical must exist in the named table. Lock it.
  IF p_canonical_kind = 'people' THEN
    PERFORM 1 FROM people WHERE id = p_canonical_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'canonical_row_missing: people.id=% does not exist', p_canonical_id
        USING ERRCODE = 'P0002';
    END IF;
  ELSE
    PERFORM 1 FROM profiles WHERE id = p_canonical_id::uuid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'canonical_row_missing: profiles.id=% does not exist', p_canonical_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- ── Snapshot the ghost (read) ─────────────────────────────────────────────
  SELECT row_to_json(p)::jsonb INTO v_ghost_snapshot FROM people p WHERE p.id = p_ghost_id;

  -- ── Mutations ─────────────────────────────────────────────────────────────
  -- Everything that writes runs inside this block. On dry run we RAISE the
  -- DRYRN marker at the end; the handler catches it and the implicit savepoint
  -- rolls every write back, while the plpgsql accumulator variables (which are
  -- not transactional) keep the counts. So a dry run exercises the real write
  -- path and returns accurate numbers without committing anything.
  BEGIN
    -- claims.subject_id (person subjects)
    WITH r AS (
      UPDATE claims SET subject_id = p_canonical_id
       WHERE subject_id = p_ghost_id AND subject_type = 'person'
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_subject_id', v_ids_a);

    -- claims.object_id (person objects)
    WITH r AS (
      UPDATE claims SET object_id = p_canonical_id
       WHERE object_id = p_ghost_id AND object_type = 'person'
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_object_id', v_ids_a);

    -- claims.asserted_by
    WITH r AS (
      UPDATE claims SET asserted_by = p_canonical_id
       WHERE asserted_by = p_ghost_id
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('claims_asserted_by', v_ids_a);

    -- tag_events.subject_id (drifted since 2026-05-11: PB-009)
    WITH r AS (
      UPDATE tag_events SET subject_id = p_canonical_id
       WHERE subject_id = p_ghost_id
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('tag_events_subject_id', v_ids_a);

    -- people.added_by (text) + people.invited_by (uuid)
    WITH r AS (
      UPDATE people SET added_by = p_canonical_id
       WHERE added_by = p_ghost_id
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('people_added_by', v_ids_a);

    WITH r AS (
      UPDATE people SET invited_by = p_canonical_id::uuid
       WHERE invited_by = p_ghost_id::uuid
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('people_invited_by', v_ids_a);

    -- catalog added_by columns
    WITH r AS (UPDATE places SET added_by = p_canonical_id WHERE added_by = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('places_added_by', v_ids_a);

    WITH r AS (UPDATE orgs SET added_by = p_canonical_id WHERE added_by = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('orgs_added_by', v_ids_a);

    WITH r AS (UPDATE boards SET added_by = p_canonical_id WHERE added_by = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('boards_added_by', v_ids_a);

    WITH r AS (UPDATE events SET added_by = p_canonical_id WHERE added_by = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('events_added_by', v_ids_a);

    -- invites.person_id + invites.invited_by (both text)
    WITH r AS (UPDATE invites SET person_id = p_canonical_id WHERE person_id = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('invites_person_id', v_ids_a);

    WITH r AS (UPDATE invites SET invited_by = p_canonical_id WHERE invited_by = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('invites_invited_by', v_ids_a);

    -- community_people (composite PK community_id, person_id): dedup then repoint
    WITH d AS (
      DELETE FROM community_people
       WHERE person_id = p_ghost_id
         AND community_id IN (SELECT community_id FROM community_people WHERE person_id = p_canonical_id)
       RETURNING community_id)
    SELECT coalesce(jsonb_agg(community_id), '[]'::jsonb) INTO v_ids_b FROM d;
    v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('community_people', v_ids_b);

    WITH r AS (UPDATE community_people SET person_id = p_canonical_id WHERE person_id = p_ghost_id RETURNING community_id)
    SELECT coalesce(jsonb_agg(community_id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('community_people', v_ids_a);

    -- event_people (composite PK event_id, person_id): dedup then repoint (drifted)
    WITH d AS (
      DELETE FROM event_people
       WHERE person_id = p_ghost_id
         AND event_id IN (SELECT event_id FROM event_people WHERE person_id = p_canonical_id)
       RETURNING event_id)
    SELECT coalesce(jsonb_agg(event_id), '[]'::jsonb) INTO v_ids_b FROM d;
    v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('event_people', v_ids_b);

    WITH r AS (UPDATE event_people SET person_id = p_canonical_id WHERE person_id = p_ghost_id RETURNING event_id)
    SELECT coalesce(jsonb_agg(event_id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('event_people', v_ids_a);

    -- event_guests (composite PK event_id, person_id): dedup then repoint (drifted)
    WITH d AS (
      DELETE FROM event_guests
       WHERE person_id = p_ghost_id
         AND event_id IN (SELECT event_id FROM event_guests WHERE person_id = p_canonical_id)
       RETURNING event_id)
    SELECT coalesce(jsonb_agg(event_id), '[]'::jsonb) INTO v_ids_b FROM d;
    v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('event_guests', v_ids_b);

    WITH r AS (UPDATE event_guests SET person_id = p_canonical_id WHERE person_id = p_ghost_id RETURNING event_id)
    SELECT coalesce(jsonb_agg(event_id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('event_guests', v_ids_a);

    -- mentions.subject_id (person subjects): dedup on mentions_dedupe then repoint (drifted)
    WITH d AS (
      DELETE FROM mentions m
       WHERE m.subject_id = p_ghost_id AND m.subject_type = 'person'
         AND EXISTS (
           SELECT 1 FROM mentions c
            WHERE c.subject_id = p_canonical_id AND c.subject_type = 'person'
              AND c.episode_event_id = m.episode_event_id
              AND coalesce(c.timestamp_seconds, -1) = coalesce(m.timestamp_seconds, -1))
       RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_b FROM d;
    v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('mentions_subject_id', v_ids_b);

    WITH r AS (UPDATE mentions SET subject_id = p_canonical_id WHERE subject_id = p_ghost_id AND subject_type = 'person' RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('mentions_subject_id', v_ids_a);

    -- public_stack_entries.entry_ref_id (person entries are entry_type='rider') (drifted)
    WITH r AS (UPDATE public_stack_entries SET entry_ref_id = p_canonical_id WHERE entry_ref_id = p_ghost_id AND entry_type = 'rider' RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('public_stack_entries_entry_ref_id', v_ids_a);

    -- story_riders (composite PK story_id, rider_id uuid): dedup then repoint
    WITH d AS (
      DELETE FROM story_riders
       WHERE rider_id = p_ghost_id::uuid
         AND story_id IN (SELECT story_id FROM story_riders WHERE rider_id = p_canonical_id::uuid)
       RETURNING story_id)
    SELECT coalesce(jsonb_agg(story_id), '[]'::jsonb) INTO v_ids_b FROM d;
    v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('story_riders', v_ids_b);

    WITH r AS (UPDATE story_riders SET rider_id = p_canonical_id::uuid WHERE rider_id = p_ghost_id::uuid RETURNING story_id)
    SELECT coalesce(jsonb_agg(story_id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('story_riders', v_ids_a);

    -- stories.author_id (defensive; author should be an auth user)
    WITH r AS (UPDATE stories SET author_id = p_canonical_id::uuid WHERE author_id = p_ghost_id::uuid RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('stories_author_id', v_ids_a);

    -- riding_days.created_by
    WITH r AS (UPDATE riding_days SET created_by = p_canonical_id::uuid WHERE created_by::text = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('riding_days_created_by', v_ids_a);

    -- riding_days.rider_ids (ARRAY): collapse if canonical already present, else replace
    WITH affected AS (
      SELECT id, rider_ids, (p_canonical_id = ANY(rider_ids)) AS would_dedup
        FROM riding_days
       WHERE p_ghost_id = ANY(rider_ids)
       FOR UPDATE),
    updated AS (
      UPDATE riding_days rd
         SET rider_ids = CASE WHEN a.would_dedup
             THEN array_remove(rd.rider_ids, p_ghost_id)
             ELSE array_replace(rd.rider_ids, p_ghost_id, p_canonical_id) END
        FROM affected a WHERE rd.id = a.id
       RETURNING rd.id, a.would_dedup)
    SELECT
      coalesce(jsonb_agg(id) FILTER (WHERE NOT would_dedup), '[]'::jsonb),
      coalesce(jsonb_agg(id) FILTER (WHERE would_dedup), '[]'::jsonb)
      INTO v_ids_a, v_ids_b FROM updated;
    v_refs_repointed    := v_refs_repointed    || jsonb_build_object('riding_days_rider_ids', v_ids_a);
    v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('riding_days_rider_ids', v_ids_b);

    -- claim_requests.node_id (historical audit lookups against canonical)
    WITH r AS (UPDATE claim_requests SET node_id = p_canonical_id WHERE node_id = p_ghost_id RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
    v_refs_repointed := v_refs_repointed || jsonb_build_object('claim_requests_node_id', v_ids_a);

    -- person_invite_notifications.person_id FK -> people(id). For a people
    -- canonical, dedup on the unique (person_id, inviter_id, notification_type)
    -- then repoint. For a profiles canonical the FK forbids repointing, so the
    -- ghost's rows are deleted (they would cascade-delete with the ghost anyway).
    IF p_canonical_kind = 'people' THEN
      WITH d AS (
        DELETE FROM person_invite_notifications n
         WHERE n.person_id = p_ghost_id
           AND EXISTS (
             SELECT 1 FROM person_invite_notifications c
              WHERE c.person_id = p_canonical_id
                AND c.inviter_id = n.inviter_id
                AND c.notification_type = n.notification_type)
         RETURNING id)
      SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_b FROM d;
      v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('person_invite_notifications', v_ids_b);

      WITH r AS (UPDATE person_invite_notifications SET person_id = p_canonical_id WHERE person_id = p_ghost_id RETURNING id)
      SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_a FROM r;
      v_refs_repointed := v_refs_repointed || jsonb_build_object('person_invite_notifications', v_ids_a);
    ELSE
      WITH d AS (DELETE FROM person_invite_notifications WHERE person_id = p_ghost_id RETURNING id)
      SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids_b FROM d;
      v_refs_deduplicated := v_refs_deduplicated || jsonb_build_object('person_invite_notifications_deleted', v_ids_b);
    END IF;

    -- person_slug_aliases: retarget existing ghost rows, then add ghost id +
    -- ghost slug as aliases so old /people URLs redirect to the canonical.
    WITH r AS (
      UPDATE person_slug_aliases SET person_id = p_canonical_id::uuid
       WHERE person_id = p_ghost_id::uuid
       RETURNING alias)
    SELECT coalesce(jsonb_agg(alias), '[]'::jsonb) INTO v_alias_rewrites FROM r;

    INSERT INTO person_slug_aliases (alias, person_id, reason)
    VALUES (p_ghost_id, p_canonical_id::uuid, 'merged')
    ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;

    v_ghost_slug := public.name_to_slug(coalesce(v_ghost_name, ''));
    IF v_ghost_slug <> '' AND v_ghost_slug <> p_ghost_id THEN
      INSERT INTO person_slug_aliases (alias, person_id, reason)
      VALUES (v_ghost_slug, p_canonical_id::uuid, 'merged')
      ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;
    END IF;

    -- Mark the canonical as having absorbed the ghost. profiles has no
    -- merged_at column, so only people gets the timestamp.
    IF p_canonical_kind = 'people' THEN
      UPDATE people SET merged_from_id = p_ghost_id, merged_at = now() WHERE id = p_canonical_id;
    ELSE
      UPDATE profiles SET merged_from_id = p_ghost_id WHERE id = p_canonical_id::uuid;
    END IF;

    -- Audit row BEFORE the delete (transactional with it).
    INSERT INTO merge_log (
      path, ghost_id, ghost_snapshot, canonical_id,
      references_repointed, references_deduplicated, alias_rewrites,
      claim_request_id, merged_by, note
    ) VALUES (
      'merge', p_ghost_id, v_ghost_snapshot, p_canonical_id,
      v_refs_repointed, v_refs_deduplicated, v_alias_rewrites,
      p_claim_request_id, p_admin_id,
      coalesce(p_note, '') || ' [canonical_kind=' || p_canonical_kind || ']'
    );

    -- Hard-delete the ghost.
    DELETE FROM people WHERE id = p_ghost_id;

    -- Dry run: undo everything above but keep the accumulated counts.
    IF p_dry_run THEN
      RAISE EXCEPTION 'dry_run_rollback' USING ERRCODE = 'DRYRN';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'DRYRN' THEN
      -- Implicit savepoint rolled every write back; variables survive.
      NULL;
  END;

  RETURN jsonb_build_object(
    'path', 'merge',
    'noop', false,
    'dry_run', p_dry_run,
    'ghost_id', p_ghost_id,
    'canonical_id', p_canonical_id,
    'canonical_kind', p_canonical_kind,
    'references_repointed', v_refs_repointed,
    'references_deduplicated', v_refs_deduplicated,
    'alias_rewrites', jsonb_array_length(v_alias_rewrites)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_person_into(text, text, text, uuid, boolean, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_person_into(text, text, text, uuid, boolean, text, uuid) FROM anon, authenticated;

COMMENT ON FUNCTION public.merge_person_into IS
  'Duplicate-person prevention Phase 3. Folds a ghost people row into a canonical people OR profiles row, repointing every person-referencing column (one list, kept current), writing person_slug_aliases + a merge_log snapshot, and hard-deleting the ghost. p_dry_run=true (default) runs the real write path then rolls it back via a DRYRN savepoint, returning accurate counts without committing. Service-role only.';

-- ============================================================================
-- 3. merge_person: delegate Path B to merge_person_into
-- ============================================================================
-- Signature, Path A, idempotency, status flip and auto-deny are unchanged. Only
-- the inlined Path B body (former steps 9-14) is replaced by a delegation, so
-- there is one repoint list for every fold-in path.
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
  v_auto_denied     int;
  v_merge_result    jsonb;
  c_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  -- ── 1. Lock the claim_request row ─────────────────────────────────────────
  SELECT * INTO v_claim_req FROM claim_requests WHERE id = p_claim_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_request_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_ghost_id    := v_claim_req.node_id;
  v_claimant_id := v_claim_req.claimant_id;

  -- ── 2. Idempotency (re-click + concurrent loser) ─────────────────────────
  IF v_claim_req.status = 'approved' THEN
    IF EXISTS (SELECT 1 FROM people WHERE id = v_ghost_id AND claimed_by = v_claimant_id)
       AND NOT EXISTS (SELECT 1 FROM people WHERE merged_from_id = v_ghost_id) THEN
      RETURN jsonb_build_object('path','claim_in_place','noop',true,'ghost_id',v_ghost_id,
        'canonical_id',v_ghost_id,'references_repointed','{}'::jsonb,
        'references_deduplicated','{}'::jsonb,'alias_rewrites',0,'claim_requests_auto_denied',0);
    ELSIF NOT EXISTS (SELECT 1 FROM people WHERE id = v_ghost_id) THEN
      SELECT id INTO v_canonical_id FROM people WHERE merged_from_id = v_ghost_id LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object('path','merge','noop',true,'ghost_id',v_ghost_id,
          'canonical_id',v_canonical_id,'references_repointed','{}'::jsonb,
          'references_deduplicated','{}'::jsonb,'alias_rewrites',0,'claim_requests_auto_denied',0);
      ELSE
        RAISE EXCEPTION 'merge_idempotency_check_failed: ghost % gone but no canonical carries merged_from_id', v_ghost_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'merge_idempotency_check_failed: claim % approved but ghost/canonical state inconsistent', p_claim_request_id;
    END IF;
  END IF;

  IF v_claim_req.status NOT IN ('pending', 'vouched') THEN
    RAISE EXCEPTION 'claim_request_not_actionable: status=%', v_claim_req.status USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Ghost exists ──────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = v_ghost_id) THEN
    RAISE EXCEPTION 'ghost_row_missing: people.id=% does not exist', v_ghost_id USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM people WHERE id = v_ghost_id FOR UPDATE;

  -- ── 4. Canonical lookup (people.claimed_by is the source of truth) ───────
  SELECT count(*) INTO v_canonical_count
    FROM (SELECT id FROM people
           WHERE claimed_by = v_claimant_id AND id <> v_ghost_id AND merged_from_id IS NULL
           LIMIT 2) s;

  IF v_canonical_count = 0 THEN
    v_path := 'claim_in_place';
    v_canonical_id := v_ghost_id;
  ELSIF v_canonical_count = 1 THEN
    v_path := 'merge';
    SELECT id INTO v_canonical_id FROM people
      WHERE claimed_by = v_claimant_id AND id <> v_ghost_id AND merged_from_id IS NULL;
    PERFORM 1 FROM people WHERE id = v_canonical_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'canonical_row_lookup_ambiguous: claimant % has % candidate canonical rows', v_claimant_id, v_canonical_count
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. Status flip on the current claim_request ──────────────────────────
  UPDATE claim_requests
     SET status = 'approved', status_reason = 'admin_approved',
         resolved_at = now(), resolved_by = p_admin_id, updated_at = now()
   WHERE id = p_claim_request_id;

  -- ── 6. Auto-deny competing pending/vouched claims on this node ────────────
  WITH ad AS (
    UPDATE claim_requests
       SET status = 'denied', status_reason = 'target_already_claimed',
           resolved_at = now(), resolved_by = p_admin_id, updated_at = now()
     WHERE node_id = v_ghost_id AND id <> p_claim_request_id AND status IN ('pending', 'vouched')
     RETURNING id)
  SELECT count(*) INTO v_auto_denied FROM ad;

  -- ── 7. Path A: claim the ghost in place ──────────────────────────────────
  IF v_path = 'claim_in_place' THEN
    UPDATE people SET node_status = 'claimed', claimed_by = v_claimant_id, claimed_at = now()
     WHERE id = v_ghost_id;

    SELECT row_to_json(p)::jsonb INTO v_ghost_snapshot FROM people p WHERE p.id = v_ghost_id;

    INSERT INTO merge_log (path, ghost_id, ghost_snapshot, canonical_id,
      references_repointed, references_deduplicated, alias_rewrites, claim_request_id, merged_by)
    VALUES ('claim_in_place', v_ghost_id, v_ghost_snapshot, v_ghost_id,
      '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, p_claim_request_id, p_admin_id);

    RETURN jsonb_build_object('path','claim_in_place','noop',false,'ghost_id',v_ghost_id,
      'canonical_id',v_ghost_id,'references_repointed','{}'::jsonb,
      'references_deduplicated','{}'::jsonb,'alias_rewrites',0,'claim_requests_auto_denied',v_auto_denied);
  END IF;

  -- ── 8. Path B: delegate the fold-in to merge_person_into (canonical is a
  --        people row here, committed, not a dry run) ───────────────────────
  IF v_ghost_id !~ c_uuid_re THEN
    RAISE EXCEPTION 'path_b_unavailable_non_uuid_ghost_id: ghost % is not a valid uuid string', v_ghost_id USING ERRCODE = 'P0001';
  END IF;
  IF v_canonical_id !~ c_uuid_re THEN
    RAISE EXCEPTION 'path_b_unavailable_non_uuid_canonical_id: canonical % is not a valid uuid string', v_canonical_id USING ERRCODE = 'P0001';
  END IF;

  v_merge_result := public.merge_person_into(
    v_ghost_id, v_canonical_id, 'people', p_admin_id,
    false, 'claim_request:' || p_claim_request_id::text, p_claim_request_id);

  RETURN v_merge_result || jsonb_build_object('claim_requests_auto_denied', v_auto_denied);
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_person(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_person(uuid, uuid) FROM anon, authenticated;
