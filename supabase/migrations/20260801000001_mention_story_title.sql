-- ============================================================================
-- Podcast pass: story titles on mentions.
-- ============================================================================
--
-- A story from the transcript workflow spans several mention rows, one per
-- subject, sharing a timestamp and an excerpt. The episode page groups those
-- back into one card, but the card had no headline: it led with a two-line clip
-- of the excerpt, which does not scan across eighteen of them.
--
-- The seed file already carries a `title` per story for the human reviewing it.
-- This column is where that title lands, so the episode page can lead with it
-- the way the review page does. Denormalized across the story's rows exactly
-- like excerpt already is, because a mention is the unit the schema stores and
-- a story is a grouping over it.
--
-- Additive only, nullable, no default. Every existing mention keeps rendering
-- excerpt-first. Safe to re-run.

alter table public.mentions
  add column if not exists story_title text;

comment on column public.mentions.story_title is
  'Optional headline for the story this mention belongs to. Shared by every mention at the same moment, so the episode page can group them under one title. Null renders excerpt-first, as before.';
