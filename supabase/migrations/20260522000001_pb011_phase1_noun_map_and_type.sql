-- ============================================================================
-- PB-011 Phase 1 (Foundation): noun_map and type columns on communities
-- ============================================================================
--
-- Data-layer only. Adds two additive columns so the Phase 2 nav chassis can
-- read community-native category labels and the interest/place distinction
-- straight from the store:
--
--   noun_map  jsonb   per-community display-label overrides, keyed by the
--                     global schema nouns (people, places, events, boards,
--                     brands, stories). Only overrides are stored; missing
--                     keys fall back to the global label in code.
--   type      text    'interest' or 'place'. All five seeded communities are
--                     'interest' at launch (no place communities yet).
--
-- Both columns are NOT NULL with defaults, so every existing row stays valid
-- with no backfill beyond the one cultural override below (snowboarding
-- people are Riders). No behaviour changes for users on this migration; the
-- columns are read by Phase 2.
--
-- Idempotent: safe to re-run. If noun_map or type already exist the column
-- adds are skipped (see PB-011 Phase 1 brief, section 6 pre-deploy check).

-- ── communities.noun_map ────────────────────────────────────────────────────

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS noun_map jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── communities.type (interest | place) ─────────────────────────────────────

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'interest'
  CHECK (type IN ('interest', 'place'));

-- ── Seed snowboarding's cultural override ───────────────────────────────────
-- People are called Riders in snowboarding. Every other noun falls back to the
-- global label, so this is the only override seeded in Phase 1. The four
-- coming-soon communities (surf, skate, ski, mtb) keep the empty-object default
-- and get their own noun maps when each comes online.

UPDATE public.communities
  SET noun_map = '{"people": "Riders"}'::jsonb
  WHERE slug = 'snowboarding';
