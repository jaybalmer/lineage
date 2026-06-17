-- ============================================================================
-- BUG-066 — Duplicate "Rode with X" rider cards on the timeline and person page.
-- ============================================================================
--
-- Two confirmed failure modes (prod, June 17 working session):
--   1. Companion-edge leak (year collision): the personal timeline folds a
--      companion `rode_with` into its `rode_at` place card keyed by
--      (subject_id, start_date, end_date). Dates are year-only, so every 2026
--      visit collapses to the same key. With 2+ `rode_at` in a year the fold
--      refuses to guess (companion-grouping.ts) and each companion row leaks as
--      a bare standalone card. (Jay -> Sean Balmer, 1986: 3 rode_at + 3 rode_with.)
--   2. Standalone duplicate adds: every non-board predicate plain-inserts, so a
--      repeated "rode with Cory" tag piles up. (Cy 2 -> Cory Yip, 2026: 5 rows.)
--
-- Fix has three parts; this migration is the schema half (run BEFORE the PR
-- merges, because the write path sends parent_claim_id):
--   - add claims.parent_claim_id: a companion `rode_with` is parented to its
--     `rode_at` so the fold uses the explicit link, not the ambiguous date key;
--     a standalone / crew `rode_with` has parent_claim_id = NULL and is the row
--     the write-dedup upserts (one crew relationship row per pair, year range).
--   - rebuild claims_public so the new column is exposed to public reads.
--
-- TYPE NOTE: parent_claim_id is TEXT, matching claims.id. claims.id /
-- subject_id / object_id are all text (client-generated `claim_...` ids and
-- people slugs like `cy_2`); only profiles.id / auth.users.id are uuid.
--
-- _public view freeze rule (CLAUDE.md gotcha #9 / Group F): claims_public is
-- `SELECT c.*`, expanded at create time. A newly added column does NOT appear
-- in the view until it is rebuilt with CREATE OR REPLACE VIEW. Rebuilt below,
-- preserving the BUG-060 security_invoker + tag_event_publicly_visible() shape
-- verbatim (only the implicit column list changes).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE VIEW.

-- ── 1. parent_claim_id column ───────────────────────────────────────────────

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS parent_claim_id text;

COMMENT ON COLUMN public.claims.parent_claim_id IS
  'BUG-066. Self-reference (text, matches claims.id) used by companion `rode_with` rows to point at their parent `rode_at` claim. Set => a per-ride companion edge that folds into its place card as a chip; NULL => a standalone / crew relationship row (the one card per pair, deduped on write with a widening year range). NULL for every non-rode_with predicate.';

-- ── 2. rebuild claims_public (column-list freeze, BUG-060 shape preserved) ───

CREATE OR REPLACE VIEW public.claims_public
  WITH (security_invoker = true) AS
  SELECT c.*
    FROM public.claims c
   WHERE public.tag_event_publicly_visible(c.tag_event_id);

GRANT SELECT ON public.claims_public TO anon, authenticated;

COMMENT ON VIEW public.claims_public IS
  'PB-009 permissive default, BUG-060 fix, BUG-066 column add. Read-only view of claims (now incl. parent_claim_id); base-table RLS gates public/private/owner, public.tag_event_publicly_visible() gates tag status. Public reads must query this view; writes go to claims directly.';

-- ── Verification (run after applying) ───────────────────────────────────────
-- Column is present and exposed through the view:
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'claims'
--       and column_name = 'parent_claim_id';
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'claims_public'
--       and column_name = 'parent_claim_id';   -- must return one row
