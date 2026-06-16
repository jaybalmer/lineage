-- ============================================================================
-- BUG-060 — Event +Add rider (and any tag-of-another-person claim) vanishes on
--           refresh, because the _public views cannot read tag_events.
-- ============================================================================
--
-- Symptom (confirmed against prod, Westbeach_Classic_1993 = event_1774838473372_wnrct):
--   base `claims` for the event ........ service 37, anon 37   (rows persisted, public)
--   `claims_public` for the event ...... service 37, anon 1    (only the 1 grandfathered row)
--   `tag_events` (any) ................. service 136, anon 0    (RLS: no policies)
--
-- Root cause: `claims_public` / `story_riders_public` are defined
-- `WITH (security_invoker = true)` and `LEFT JOIN public.tag_events`. tag_events
-- has RLS enabled with NO policies, so anon/authenticated read zero rows from it.
-- Under security_invoker the join runs as the *caller*, so `te.status` resolves
-- to NULL for every row and the visibility WHERE collapses to "only rows with
-- tag_event_id IS NULL". Self-claims have no tag_event (you do not tag yourself)
-- so they survive; any claim that tags ANOTHER person (event rosters, rode_with
-- someone) gets a paired tag_event and disappears from every client read.
--
-- This contradicts the original PB-009 intent. 20260513000001_pb009_tag_events.sql
-- states the views "left-join tag_events under definer privileges", but
-- 20260513000004 / 20260514000001 wrote them `security_invoker = true` (the
-- opposite). The story path masks the bug only because GET /api/stories reads
-- riders server-side with the service role.
--
-- Fix (minimal, privacy-preserving): keep the views `security_invoker = true`
-- so the base-table RLS on claims/story_riders KEEPS governing public/private
-- and owner-own visibility automatically (no need to re-encode it in the view),
-- and move ONLY the tag-status check into a SECURITY DEFINER helper function
-- that is allowed to read tag_events/profiles. The function returns a single
-- boolean, so it resolves the tag-status filter for every caller without
-- exposing any tag_events rows (asserter ids, hashed visitor records, declined/
-- disabled moderation state stay private).
--
-- Idempotent: CREATE OR REPLACE throughout; the views keep the same output
-- columns (c.* / sr.*) so the replace is in place.
--
-- _public view freeze rule (CLAUDE.md gotcha #9): these views are rebuilt here.
-- If `claims` or `story_riders` later gains a column, the matching view must be
-- rebuilt again; `SELECT c.*` is expanded at create time, not at read time.

-- ── 1. tag-status visibility helper (SECURITY DEFINER) ──────────────────────
-- Mirrors the permissive-default predicate from 20260514000001:
--   tag_event_id IS NULL                          -> visible (grandfathered)
--   tag.status = 'approved'                        -> visible
--   tag.status = 'pending' AND gate OFF            -> visible (permissive default)
--   tag.status = 'pending' AND gate ON             -> hidden
--   tag.status = 'declined' | 'disabled' | missing -> hidden
-- The LEFT JOIN to profiles keys on p.id::text = te.subject_id because
-- subject_id is text-typed and may hold non-uuid catalog ids; ghost subjects
-- with no profiles row COALESCE to false (permissive), same as the old view.

CREATE OR REPLACE FUNCTION public.tag_event_publicly_visible(p_tag_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_tag_event_id IS NULL
    OR EXISTS (
      SELECT 1
        FROM public.tag_events te
        LEFT JOIN public.profiles p ON p.id::text = te.subject_id
       WHERE te.id = p_tag_event_id
         AND ( te.status = 'approved'
               OR ( te.status = 'pending'
                    AND COALESCE(p.require_tag_approval, false) = false ) )
    );
$$;

COMMENT ON FUNCTION public.tag_event_publicly_visible(uuid) IS
  'BUG-060. SECURITY DEFINER so the _public views (security_invoker) can resolve the PB-009 tag-status visibility filter without granting callers any read access to tag_events. Returns true for grandfathered (null), approved, and pending-when-subject-not-gated tags; false for declined/disabled/missing or gated-pending.';

REVOKE ALL ON FUNCTION public.tag_event_publicly_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tag_event_publicly_visible(uuid)
  TO anon, authenticated, service_role;

-- ── 2. claims_public — same visibility, via the helper ──────────────────────
-- Stays security_invoker: the base `claims` RLS continues to gate public vs
-- private (and owner-own) per role; the helper adds the tag-status filter.

CREATE OR REPLACE VIEW public.claims_public
  WITH (security_invoker = true) AS
  SELECT c.*
    FROM public.claims c
   WHERE public.tag_event_publicly_visible(c.tag_event_id);

-- ── 3. story_riders_public — same shape (no visibility column on the base) ──

CREATE OR REPLACE VIEW public.story_riders_public
  WITH (security_invoker = true) AS
  SELECT sr.*
    FROM public.story_riders sr
   WHERE public.tag_event_publicly_visible(sr.tag_event_id);

GRANT SELECT ON public.claims_public       TO anon, authenticated;
GRANT SELECT ON public.story_riders_public TO anon, authenticated;

COMMENT ON VIEW public.claims_public IS
  'PB-009 permissive default, BUG-060 fix. Read-only view of claims; base-table RLS gates public/private/owner, public.tag_event_publicly_visible() gates tag status (approved + grandfathered + pending-when-subject-not-gated). Public reads must query this view; writes go to claims directly.';
COMMENT ON VIEW public.story_riders_public IS
  'PB-009 permissive default, BUG-060 fix. Read-only view of story_riders; base-table RLS gates row access, public.tag_event_publicly_visible() gates tag status. Public reads must query this view; writes go to story_riders directly.';

-- ── Verification (run after applying) ───────────────────────────────────────
-- As the ANON role (or logged-out on the live event page) the event roster
-- should jump from 1 to 37:
--   set local role anon;
--   select count(*) from public.claims_public
--     where object_id = 'event_1774838473372_wnrct'
--       and predicate in ('competed_at','spectated_at','organized_at');
--   reset role;
-- And private claims must STILL be hidden from anon (expect 0):
--   set local role anon;
--   select count(*) from public.claims_public where visibility = 'private';
--   reset role;
