-- ============================================================================
-- PB-009 Phase 1 (Migration A) — tag_events foundation
-- ============================================================================
--
-- The tag_events table is the spine of PB-009 moderation. Every person-
-- implicating insert into story_riders or claims pairs with a tag_event row
-- that carries the moderation status. Public reads filter through
-- story_riders_public / claims_public (see Migration D) which require
-- status='approved' before a row becomes visible.
--
-- Phase 1 defaults every NEW tag_event to status='approved' for source='member'
-- to preserve existing product behaviour. Phase 2 introduces the owner inbox
-- and flips source='member' inserts to 'pending'. The table-level default
-- stays 'pending' so future sources (public_timeline_embed in PB-010) inherit
-- the safe default — application code overrides explicitly per source.
--
-- Idempotent — enum DO blocks, IF NOT EXISTS table/index guards.

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tag_event_source AS ENUM ('member', 'public_timeline_embed', 'editor', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_event_status AS ENUM ('pending', 'approved', 'declined', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_event_subject_tier AS ENUM ('standard', 'elevated', 'protected', 'unclaimed', 'catalog');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_event_decline_category AS ENUM ('this_wasnt_me', 'wrong_moment', 'preference', 'spam', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_event_display_state AS ENUM ('hidden', 'attributed', 'anonymous_aggregate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tag_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source                   tag_event_source NOT NULL,
  asserter_id              uuid REFERENCES public.profiles(id),
  asserter_visitor_record  jsonb,
  subject_id               text NOT NULL,
  subject_tier_at_assert   tag_event_subject_tier NOT NULL,
  predicate                text NOT NULL,
  moment_ref               jsonb NOT NULL,
  community_id             uuid,
  status                   tag_event_status NOT NULL DEFAULT 'pending',
  decision_by              uuid REFERENCES public.profiles(id),
  decision_at              timestamptz,
  decision_reason_category tag_event_decline_category,
  decision_reason_note     text,
  co_sign_by               uuid REFERENCES public.profiles(id),
  co_sign_at               timestamptz,
  display_state            tag_event_display_state NOT NULL DEFAULT 'anonymous_aggregate',
  expires_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Defensive ALTERs cover an ad-hoc earlier creation against prod
ALTER TABLE public.tag_events
  ADD COLUMN IF NOT EXISTS asserter_visitor_record  jsonb,
  ADD COLUMN IF NOT EXISTS community_id             uuid,
  ADD COLUMN IF NOT EXISTS decision_by              uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS decision_at              timestamptz,
  ADD COLUMN IF NOT EXISTS decision_reason_category tag_event_decline_category,
  ADD COLUMN IF NOT EXISTS decision_reason_note     text,
  ADD COLUMN IF NOT EXISTS co_sign_by               uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS co_sign_at               timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at               timestamptz;

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tag_events_subject_status_created
  ON public.tag_events (subject_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS tag_events_asserter_status
  ON public.tag_events (asserter_id, status);

-- Expiry sweep target (Phase 4): pending rows past their expires_at get auto-
-- declined by a scheduled job. The partial index keeps the sweep cheap.
CREATE INDEX IF NOT EXISTS tag_events_expiry_sweep
  ON public.tag_events (source, status, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tag_events_community
  ON public.tag_events (community_id, status)
  WHERE community_id IS NOT NULL;

-- Hot read path: only approved rows are visible to public reads. The _public
-- views filter on this column; the partial index keeps the lookup tight even
-- as the pending/declined tail grows.
CREATE INDEX IF NOT EXISTS tag_events_approved_by_subject
  ON public.tag_events (subject_id)
  WHERE status = 'approved';

-- ── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tag_events_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_events_updated_at ON public.tag_events;
CREATE TRIGGER tag_events_updated_at
  BEFORE UPDATE ON public.tag_events
  FOR EACH ROW EXECUTE FUNCTION public.tag_events_set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tag_events ENABLE ROW LEVEL SECURITY;
-- No policies. Service role bypasses RLS for writes; anon/authenticated cannot
-- read or write tag_events directly. Public read access is mediated by the
-- story_riders_public / claims_public views which left-join tag_events under
-- definer privileges (see Migration D's security_invoker setting).

COMMENT ON TABLE public.tag_events IS
  'PB-009 Phase 1. One row per person-implicating insert into story_riders or claims. status drives visibility through the _public views. Phase 1 defaults source=member inserts to ''approved'' at the application layer to preserve existing behaviour; Phase 2 flips that to ''pending'' and adds the owner inbox at /me/tags.';
