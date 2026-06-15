-- Comment-email cadence preference (per user).
--
-- Governs how often a story author is emailed about new comments:
--   smart (default) | each | 6h | daily | off
-- See src/lib/comment-email-prefs.ts for the modes and
-- src/lib/emails/comment-emails.ts for how each is applied.
--
-- Additive and backwards compatible: existing rows take the 'smart' default,
-- and the app degrades to 'smart' if this column is absent (so the code can
-- deploy before this runs without erroring). The column is intentionally NOT
-- added to the public people catalog select in lineage-store.ts, so a member's
-- cadence stays server-side only.

alter table public.profiles
  add column if not exists comment_email_pref text not null default 'smart';

alter table public.profiles
  drop constraint if exists comment_email_pref_valid;

alter table public.profiles
  add constraint comment_email_pref_valid
  check (comment_email_pref in ('smart', 'each', '6h', 'daily', 'off'));
