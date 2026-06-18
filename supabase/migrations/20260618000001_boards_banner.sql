-- Boards Catalog Banner
-- Adds an admin-settable banner image for the community /boards catalog page.
-- Separate from hero_image_url (community page) and landing_banner_url (root
-- homepage): the boards catalog can show its own photo. Nullable, no backfill;
-- when unset the boards page renders with no band. Idempotent. Set per community
-- from /admin/community, same plumbing as the other community images.
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS boards_banner_url text;
