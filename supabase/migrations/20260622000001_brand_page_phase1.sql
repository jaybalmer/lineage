-- Brand Page Redesign Phase 1 (Baseline lift)
-- Two additive, nullable columns on orgs for the redesigned brand page header.
--   brand_color: a per-brand accent hex (e.g. '#D72638'). When null the page
--                falls back to the Linestry accent (--accent, #3B82F6), so
--                untouched pages stay on-brand for Linestry.
--   banner_url:  a curated hero image. Phase 1 standard pages do not render a
--                banner (they use a 5px brand-color accent bar); this column is
--                seeded now so Phase 2's curated hero can read it without a
--                second migration.
-- Neither is sent by the member create path (/api/catalog/entity), so this is a
-- plain additive change with no write-path dependency: migrate-then-merge is
-- safe. Nullable, no backfill, idempotent.
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS brand_color text;

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS banner_url text;
