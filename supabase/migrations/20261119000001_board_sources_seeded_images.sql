-- Board image seeding: seeded placeholder images live as board_sources rows with
-- kind='image' (never in boards.image_url, which stays the manual/editor slot).
--
-- Posture change (Jay, 2026-11-02): seeded images are RE-HOSTED as a sized copy in
-- the public board-images bucket (seeded/{board_id}/...), with visible attribution,
-- a source link, a Report action and removal on any complaint. image_url keeps the
-- ORIGINAL remote URL so attribution and takedown always point at the real source;
-- hosted_url is our copy. This supersedes the "never a re-host" note on image_url.
--
-- Additive only: four new columns (status has a default, so existing existence rows
-- become 'active') and one partial index. Writes come from
-- scripts/seed-board-images.mjs (service role) and the editor-only
-- /api/admin/board-images route (service role); RLS public read is unchanged.

alter table board_sources
  add column if not exists hosted_url     text,
  add column if not exists status         text not null default 'active'
                                           check (status in ('active','removed')),
  add column if not exists source_tier    int,   -- 1 retrosnow, 2 issuu, 3 serper, 4 archive
  add column if not exists removed_reason text;

comment on column board_sources.image_url is
  'kind=image: the ORIGINAL remote image URL (attribution/takedown pointer). Our re-hosted copy is hosted_url.';
comment on column board_sources.hosted_url is
  'kind=image: our re-hosted sized copy in the board-images bucket (seeded/{board_id}/...).';
comment on column board_sources.status is
  'active | removed. Removal is soft so a seeder re-run never re-adds a taken-down image.';

create index if not exists idx_board_sources_image_active
  on board_sources (board_id, source_tier, created_at)
  where kind = 'image' and status = 'active';
