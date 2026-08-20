-- BUG-174: Public Stack (Mini timeline) is on by default for every member.
--
-- The Stack/Timeline toggle on /people/[id] renders only when the viewed profile
-- has public_timeline_enabled = true AND a public_slug, so only members who had
-- opted in ever showed it. Jay's call (2026-08-20 live session): the public Stack
-- is the same information as the member's public timeline, read through the same
-- visibility rules (claims_public + public stories), so it goes on by default for
-- everyone. This migration flips the default for new rows and backfills existing
-- ones; the uncurated-starter derivation ships in code (readPublicStack) so no
-- member gets an empty Stack in the window.
--
-- Slug minting is intentionally NOT in this file: public_slug must go through
-- ensureUniquePublicSlug (src/lib/public-slug.ts) so collisions and the BUG-159
-- public_slug_aliases history behave exactly like the live enable path. New rows
-- mint on their first auth-gated request via ensureProfile; existing null-slug
-- rows are backfilled by a one-time run of that same helper (see the PR / ship
-- notes), never by raw SQL slug construction.

-- ── SAFE (additive): new profile rows are born with the public timeline enabled.
alter table profiles
  alter column public_timeline_enabled set default true;

-- ── GATED (UPDATE of existing profiles rows; pre-approved by Jay 2026-08-20).
-- Enable every member who has not already opted in, EXCEPT:
--   * archived profiles (is_archived is true), and
--   * explicitly private profiles (privacy_level = 'private') — Decision 5: do
--     not force a public surface onto an explicitly private profile.
-- Members who were already enabled are left untouched (idempotent re-run safe).
update profiles
   set public_timeline_enabled = true
 where public_timeline_enabled is distinct from true
   and is_archived is not true
   and privacy_level is distinct from 'private';
