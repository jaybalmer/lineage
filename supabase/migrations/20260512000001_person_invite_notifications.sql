-- ============================================================================
-- PB-008 Phase 2 Session 4 (Item 1) — threshold notification dedup table
-- ============================================================================
--
-- Ambient-growth loop: when the 3rd distinct member tags an unclaimed person,
-- we email the inviter-of-record (people.invited_by) or, if null, the most
-- recent tagger. The UNIQUE (person_id, inviter_id, notification_type) tuple
-- on this table prevents repeat emails on subsequent tags by the same chain
-- of taggers.
--
-- Idempotent per the migration-idempotency gotcha: CREATE TABLE IF NOT EXISTS
-- followed by explicit ALTER TABLE ADD COLUMN IF NOT EXISTS for every column,
-- in case the table was created ad-hoc against prod from an earlier draft.
--
-- RLS on with no policies — service-role only.

CREATE TABLE IF NOT EXISTS public.person_invite_notifications (
  id                             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                      text        NOT NULL REFERENCES public.people(id)   ON DELETE CASCADE,
  inviter_id                     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type              text        NOT NULL,
  distinct_tagger_count_at_send  int         NOT NULL,
  sent_at                        timestamptz NOT NULL DEFAULT now()
);

-- Explicit ALTERs cover the case where the table pre-existed without one of
-- these columns (no-op when CREATE TABLE above already ran).
ALTER TABLE public.person_invite_notifications
  ADD COLUMN IF NOT EXISTS id                             uuid        DEFAULT gen_random_uuid();
ALTER TABLE public.person_invite_notifications
  ADD COLUMN IF NOT EXISTS person_id                      text;
ALTER TABLE public.person_invite_notifications
  ADD COLUMN IF NOT EXISTS inviter_id                     uuid;
ALTER TABLE public.person_invite_notifications
  ADD COLUMN IF NOT EXISTS notification_type              text;
ALTER TABLE public.person_invite_notifications
  ADD COLUMN IF NOT EXISTS distinct_tagger_count_at_send  int;
ALTER TABLE public.person_invite_notifications
  ADD COLUMN IF NOT EXISTS sent_at                        timestamptz DEFAULT now();

-- UNIQUE constraint. Wrap in DO block since adding the same constraint twice
-- errors. Constraint name is fixed so duplicate runs are no-ops.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.person_invite_notifications'::regclass
       AND conname  = 'person_invite_notifications_person_inviter_type_uniq'
  ) THEN
    ALTER TABLE public.person_invite_notifications
      ADD CONSTRAINT person_invite_notifications_person_inviter_type_uniq
      UNIQUE (person_id, inviter_id, notification_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_person_invite_notifications_person
  ON public.person_invite_notifications (person_id);

ALTER TABLE public.person_invite_notifications ENABLE ROW LEVEL SECURITY;
-- No policies. Service role bypasses RLS; anon/authenticated cannot read or write.

COMMENT ON TABLE public.person_invite_notifications IS
  'PB-008 Phase 2 Session 4 (Item 1). Dedup ledger for ambient-growth threshold emails. One row per (person_id, inviter_id, notification_type) tuple. ON DELETE CASCADE from people.id handles Path B merge; Session 3 merge_person RPC clears the rows for Path A (claim in place) explicitly.';

-- ============================================================================
-- distinct_tagger_summary — UNION-aggregate over every tagging surface
-- ============================================================================
-- Returns { distinct_count, most_recent_actor } for a person_id. Used by
-- maybeFireThresholdNotification to decide whether the threshold has been
-- crossed and who to send the email to when invited_by is null.
--
-- SECURITY DEFINER so the function can read RLS-protected tables under
-- service-owner privileges. Caller identity is enforced at the route handler
-- via requireAuth(); the function itself takes no caller-trust input beyond
-- the person_id it counts against.
--
-- Tagging surfaces (must stay in sync with src/lib/invite-tracking.ts plan):
--   1. claims with subject_type='person' AND subject_id = p_person_id
--   2. claims with object_type='person'  AND object_id  = p_person_id
--   3. story_riders.rider_id = p_person_id (only when p_person_id is a UUID,
--      since rider_id is uuid-typed via FK to profiles.id)
--   4. riding_days.rider_ids ARRAY-contains p_person_id
--
-- community_people is excluded — it's metadata-only (per phase-1 backfill),
-- not a real tagging surface; confirmed no INSERT path in src/.
--
-- Self-tags (asserted_by/author_id/created_by = p_person_id) are excluded so
-- a person editing their own profile doesn't bump the count.

CREATE OR REPLACE FUNCTION public.distinct_tagger_summary(p_person_id text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tuples AS (
    -- Surface 1+2: claims with person on either side
    SELECT asserted_by::text AS actor, created_at AS ts
      FROM claims
     WHERE asserted_by IS NOT NULL
       AND asserted_by::text <> p_person_id
       AND (
         (subject_id = p_person_id AND subject_type = 'person')
         OR (object_id = p_person_id AND object_type = 'person')
       )
    UNION ALL
    -- Surface 3: story_riders (uuid-only)
    SELECT s.author_id::text AS actor, s.created_at AS ts
      FROM story_riders sr
      JOIN stories s ON s.id = sr.story_id
     WHERE p_person_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND sr.rider_id = p_person_id::uuid
       AND s.author_id IS NOT NULL
       AND s.author_id::text <> p_person_id
    UNION ALL
    -- Surface 4: riding_days rider_ids array
    SELECT created_by::text AS actor, created_at AS ts
      FROM riding_days
     WHERE p_person_id = ANY(rider_ids)
       AND created_by IS NOT NULL
       AND created_by::text <> p_person_id
  )
  SELECT jsonb_build_object(
    'distinct_count',     count(DISTINCT actor),
    'most_recent_actor',  (array_agg(actor ORDER BY ts DESC NULLS LAST))[1]
  )
  FROM tuples;
$$;

REVOKE ALL ON FUNCTION public.distinct_tagger_summary(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.distinct_tagger_summary(text) FROM anon, authenticated;

COMMENT ON FUNCTION public.distinct_tagger_summary IS
  'PB-008 Phase 2 Session 4 (Item 1). UNION-aggregate over claims, story_riders, and riding_days to return { distinct_count, most_recent_actor } for an unclaimed person. Used by maybeFireThresholdNotification.';
