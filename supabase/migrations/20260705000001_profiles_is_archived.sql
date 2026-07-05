-- Admin user archive (soft hide). Additive, idempotent, reversible.
-- is_archived hides a profile from all PUBLIC surfaces; the account holder
-- still sees their own profile/timeline. No data is deleted. archived_at /
-- archived_by are a lightweight audit trail (who hid this, when).
--
-- Not sent by any write path, so this is NOT a pre-merge migration gate.
-- Does not affect claims_public / story_riders_public (those select the
-- claims / story_riders column lists, not profiles), so no view rebuild.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_by uuid;

COMMENT ON COLUMN public.profiles.is_archived IS
  'Admin soft-hide. When true, the profile is excluded from all public reads (people directory, connections, compare, feed, entity rosters/chips, search). The account holder still sees their own profile when logged in. Reversible; no data deletion.';
