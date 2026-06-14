-- Community Landing Redesign, Phase 2 (Workstream A)
-- Two additive, nullable image columns on communities:
--   hero_image_url  -> full-width background photo on the community landing page
--   avatar_url      -> community profile image (replaces the color-dot in the header)
-- Both nullable, no default, no backfill. Idempotent. Mirrors the profiles
-- precedent (avatar_url + card_bg_url). Apply to prod via the Supabase SQL
-- editor BEFORE merging the code that reads/writes these columns.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS avatar_url     text;
