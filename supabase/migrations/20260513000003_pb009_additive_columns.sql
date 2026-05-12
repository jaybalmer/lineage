-- ============================================================================
-- PB-009 Phase 1 (Migration C) — additive columns
-- ============================================================================
--
-- Wires the existing tagging tables (story_riders, claims) to tag_events via
-- tag_event_id, and lays in the per-moment visitor-display fields PB-010 will
-- need in Phase 6 (no render logic ships yet — columns only).
--
-- All columns are nullable / defaulted so existing rows remain valid. The
-- backfill in Migration E populates tag_event_id retroactively.

-- ── story_riders.tag_event_id ───────────────────────────────────────────────

ALTER TABLE public.story_riders
  ADD COLUMN IF NOT EXISTS tag_event_id uuid REFERENCES public.tag_events(id);

CREATE INDEX IF NOT EXISTS story_riders_tag_event
  ON public.story_riders (tag_event_id);

-- ── claims.tag_event_id ─────────────────────────────────────────────────────

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS tag_event_id uuid REFERENCES public.tag_events(id);

CREATE INDEX IF NOT EXISTS claims_tag_event
  ON public.claims (tag_event_id);

-- ── visitor_display_setting enum ────────────────────────────────────────────
-- Per-profile default + per-moment overrides. PB-010 Phase 6 reads these to
-- decide how visitor-asserted tags render publicly.

DO $$ BEGIN
  CREATE TYPE visitor_display_setting AS ENUM ('hidden', 'attributed', 'anonymous_aggregate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── profiles: tier cache + visitor display default ──────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS node_tier_cache                tag_event_subject_tier DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS tier_changed_at                timestamptz,
  ADD COLUMN IF NOT EXISTS public_default_visitor_display visitor_display_setting NOT NULL DEFAULT 'anonymous_aggregate';

-- ── per-moment overrides on events / places / stories ──────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visitor_display_override visitor_display_setting;

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS visitor_display_override visitor_display_setting;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS visitor_display_override visitor_display_setting;

COMMENT ON COLUMN public.story_riders.tag_event_id IS
  'PB-009 Phase 1. FK to the paired tag_event. NULL means grandfathered (pre-Phase 1) — backfilled in Migration E. story_riders_public treats NULL as approved as a defensive fallback.';
COMMENT ON COLUMN public.claims.tag_event_id IS
  'PB-009 Phase 1. FK to the paired tag_event for person-implicating claims (subject or object is a non-asserter person). NULL for self-claims and grandfathered rows. claims_public treats NULL as approved.';
COMMENT ON COLUMN public.profiles.node_tier_cache IS
  'PB-009 Phase 1. Cached per-profile tier for fast read at tag-insert time. Source of truth lives in getSubjectTier(). Writes happen in Phase 4 when tier transitions go live.';
COMMENT ON COLUMN public.profiles.public_default_visitor_display IS
  'PB-009 Phase 1. Default render mode for visitor-asserted tags pointing at this profile. Per-moment overrides on events/places/stories take precedence (Phase 6).';
