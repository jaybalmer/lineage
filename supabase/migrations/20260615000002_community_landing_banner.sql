-- Landing Page Banner + Refresh (Workstream A 3.1)
-- Adds an admin-settable banner image for the root homepage (/). Separate from
-- the per-community hero/avatar (migration 20260613000001): the homepage band
-- and the /snowboarding hero can show different photos. Nullable, no backfill;
-- when unset the homepage renders with no band. Idempotent.
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS landing_banner_url text;
