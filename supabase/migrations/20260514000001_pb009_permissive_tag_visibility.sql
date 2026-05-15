-- ============================================================================
-- PB-009 — Permissive-by-default tag visibility with per-subject opt-in gate
-- ============================================================================
--
-- Phase 2 shipped a consent-first model: every member-asserted tag landed
-- with status='pending' and stayed hidden from public reads until the tagged
-- subject approved it at /me/tags. In practice this read as broken — riders
-- tag people from real moments, the tagged person vanished, and the asserter
-- thought their post was buggy.
--
-- This migration flips the default to permissive: pending tags are visible
-- unless the subject has opted into approval gating via the new
-- profiles.require_tag_approval column. Owner controls (decline / disable)
-- continue to work regardless of the gate setting — declined and disabled
-- rows stay hidden in both modes.
--
-- Visibility decision per row:
--   tag_event_id IS NULL                  → visible (grandfathered)
--   tag.status = 'approved'               → visible
--   tag.status = 'pending'  + gate OFF    → visible (new permissive default)
--   tag.status = 'pending'  + gate ON     → hidden  (subject opted in)
--   tag.status = 'declined' | 'disabled'  → hidden
--
-- Forward-warning: when PB-009 Phase 5 introduces the 'protected' subject
-- tier with co-sign requirements, the view should treat protected subjects
-- as gate-on regardless of the user-set flag. That layer can stack on top of
-- this migration without a schema change — the WHERE clause adds a guard on
-- subject_tier_at_assert. Out of scope here.
--
-- Forward-warning (Phase 4 reporting): permissive default means more eyes on
-- pending tags → likely more abuse reports per asserter. Throttling on
-- reports-per-asserter may be needed; tracked separately.
--
-- Idempotent — column add uses IF NOT EXISTS, view DDL uses CREATE OR REPLACE.

-- ── 1. profiles.require_tag_approval ───────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS require_tag_approval boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.require_tag_approval IS
  'PB-009. When true, tags asserted against this profile stay hidden from the _public views until the subject approves them at /me/tags. Default false: pending tags are publicly visible (the asserter and viewers see them immediately) and the inbox is a notification + remove-tool, not a gate. Phase 5 will force this flag true for protected-tier subjects regardless of user setting.';

-- ── 2. story_riders_public — honor subject preference ─────────────────────
--
-- LEFT JOIN to profiles is keyed by p.id::text = te.subject_id because
-- subject_id is text-typed and may hold catalog ids that aren't valid uuids
-- (the cast on the profiles side stays inside Postgres' uuid index domain).
-- Subjects with no profiles row (ghost catalog people) get NULL for
-- require_tag_approval, which COALESCE treats as false → permissive.

CREATE OR REPLACE VIEW public.story_riders_public
  WITH (security_invoker = true) AS
  SELECT sr.*
    FROM public.story_riders sr
    LEFT JOIN public.tag_events te ON te.id = sr.tag_event_id
    LEFT JOIN public.profiles    p  ON p.id::text = te.subject_id
   WHERE sr.tag_event_id IS NULL
      OR te.status = 'approved'
      OR (te.status = 'pending' AND COALESCE(p.require_tag_approval, false) = false);

-- ── 3. claims_public — same shape ──────────────────────────────────────────

CREATE OR REPLACE VIEW public.claims_public
  WITH (security_invoker = true) AS
  SELECT c.*
    FROM public.claims c
    LEFT JOIN public.tag_events te ON te.id = c.tag_event_id
    LEFT JOIN public.profiles    p  ON p.id::text = te.subject_id
   WHERE c.tag_event_id IS NULL
      OR te.status = 'approved'
      OR (te.status = 'pending' AND COALESCE(p.require_tag_approval, false) = false);

GRANT SELECT ON public.story_riders_public TO anon, authenticated;
GRANT SELECT ON public.claims_public       TO anon, authenticated;

COMMENT ON VIEW public.story_riders_public IS
  'PB-009 permissive default. Read-only view of story_riders with visibility filter: approved + grandfathered + pending-when-subject-not-gated. Public reads must query this view; writes go to story_riders directly.';
COMMENT ON VIEW public.claims_public IS
  'PB-009 permissive default. Read-only view of claims with visibility filter: approved + grandfathered + pending-when-subject-not-gated. Public reads must query this view; writes go to claims directly.';
