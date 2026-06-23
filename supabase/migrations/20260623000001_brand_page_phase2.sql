-- Brand Page Redesign Phase 2 (Curated / partner layer)
-- Additive columns on orgs that drive the curated render path (gated by
-- curation_tier) and the /admin/brand/[id] manage surface. All nullable, none
-- sent by the member create path (/api/catalog/entity), so this is a plain
-- additive change with no write-path dependency: migrate-then-merge is safe.
-- Idempotent.
--
--   curation_tier      'standard' (default) | 'curated' | 'founding'. Standard
--                      renders the Phase 1 header only; curated/founding render
--                      the curated sections. 'founding' adds the partner ribbon.
--   heritage_statement brand-authored editorial blurb; its first line also
--                      derives the hero tagline (no separate tagline field).
--   brand_milestones   ordered [{ "year": 1979, "label": "Founded in Vancouver" }]
--   featured_rider_ids owner-ordered person ids for the team rail
--   brand_media        [{ "kind","title","subtitle","image_url","link_url" }]
--   brand_links        [{ "label","url" }] outbound brand links
--   partner_label      e.g. 'Founding Brand Partner' (founding tier ribbon text)
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS curation_tier      text DEFAULT 'standard';
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS heritage_statement text;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS brand_milestones   jsonb;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS featured_rider_ids uuid[];
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS brand_media        jsonb;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS brand_links        jsonb;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS partner_label      text;
