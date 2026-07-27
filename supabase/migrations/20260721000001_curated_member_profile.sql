-- Curated Member Profile (curated-member-profile brief, July 21 2026)
--
-- The paid differentiator: a member's profile gains a curated Statement block
-- and a personal Milestones spine, the way partner brands got curated pages.
-- Additive columns only. The write path is member-gated and conditional
-- (PATCH /api/me/profile-curation rejects free-tier callers, and only sends
-- these fields), so there is no unconditional-insert window: migrate-then-merge
-- is safe with no hard pre-merge gate.
--
-- profile_theme was dropped from scope (the card theme picker is not being
-- re-introduced); only the statement + milestones ship.

alter table public.profiles add column if not exists profile_statement text;      -- rider statement; first line renders as the tagline
alter table public.profiles add column if not exists profile_milestones jsonb;    -- [{year int, label text}], owner-ordered
