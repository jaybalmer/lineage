-- ============================================================================
-- PB-009 Phase 1 (Migration D) — story_riders_public + claims_public views
-- ============================================================================
--
-- Public reads of story_riders and claims must filter to status='approved'.
-- The views are the discipline point: every read path is repointed to the
-- _public variant, every write path keeps using the underlying table. A lint
-- rule / code-review checklist (documented in CLAUDE.md and the PR body)
-- forbids new direct reads of story_riders / claims outside the API write
-- routes.
--
-- security_invoker = true preserves the existing RLS chain on the underlying
-- tables. The views ADD a tag-status filter; they do not relax permissions.
-- security_invoker requires Postgres 15+ (Supabase runs PG 15.x).
--
-- Grandfathered rows (tag_event_id IS NULL) are treated as approved. After
-- Migration E (backfill) this is a no-op clause — every existing row gets a
-- paired tag_event — but the clause stays in place as a defensive fallback
-- for any future grandfathering scenario (e.g. data imports).

CREATE OR REPLACE VIEW public.story_riders_public
  WITH (security_invoker = true) AS
  SELECT sr.*
    FROM public.story_riders sr
    LEFT JOIN public.tag_events te ON te.id = sr.tag_event_id
   WHERE sr.tag_event_id IS NULL
      OR te.status = 'approved';

CREATE OR REPLACE VIEW public.claims_public
  WITH (security_invoker = true) AS
  SELECT c.*
    FROM public.claims c
    LEFT JOIN public.tag_events te ON te.id = c.tag_event_id
   WHERE c.tag_event_id IS NULL
      OR te.status = 'approved';

-- Anon and authenticated roles can SELECT from the views (the view's
-- security_invoker mode means the underlying table RLS still applies on
-- top — this GRANT just opens the view itself).
GRANT SELECT ON public.story_riders_public TO anon, authenticated;
GRANT SELECT ON public.claims_public       TO anon, authenticated;

COMMENT ON VIEW public.story_riders_public IS
  'PB-009 Phase 1. Read-only view of story_riders filtered to approved (or grandfathered NULL tag_event_id) rows. ALL public read paths must query this view, not story_riders directly. Write paths continue to use the underlying story_riders table.';
COMMENT ON VIEW public.claims_public IS
  'PB-009 Phase 1. Read-only view of claims filtered to approved (or grandfathered NULL tag_event_id) rows. ALL public read paths must query this view, not claims directly. Write paths continue to use the underlying claims table.';
