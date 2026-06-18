-- Story author timeline toggle (author, not subject)
-- Adds a per-story boolean controlling whether a story appears on its author's
-- own personal timeline. Default true preserves every existing story's current
-- behavior (nothing moves until an author opts a story off by hand). When false,
-- the story is still public on its linked entity pages and in the community feed,
-- it is only kept off the author's timeline, their Stack candidates, and gathered
-- into a separate "Contributions" section on the profile.
--
-- Hard pre-deploy gate: POST/PATCH /api/stories send on_timeline unconditionally
-- once the code is live, so this column MUST exist before the PR merges or every
-- story insert fails with PGRST204 for the gap window. There is no stories_public
-- view, so no view rebuild is required. Idempotent.
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS on_timeline boolean NOT NULL DEFAULT true;
