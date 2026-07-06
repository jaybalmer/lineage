-- Email-deliverability hardening: honor one-click List-Unsubscribe.
--
-- The transactional notification emails (invite, claim, comment, tag-decision)
-- carry a List-Unsubscribe header pointing at GET/POST /api/unsubscribe. That
-- route records the address here; every notification send path checks this
-- table first and skips a suppressed address. Keyed on the raw email (lowercased)
-- because recipients are a mix of members and non-members (invitees, ghosts) with
-- no profiles row, so a per-profile flag would not cover them.
create table if not exists email_suppressions (
  email           text primary key,
  unsubscribed_at timestamptz not null default now(),
  source          text
);

-- Service-role only: the /api/unsubscribe route and the send paths use the
-- service client, which bypasses RLS. Enable RLS with no policies so the anon
-- and authenticated roles cannot read the suppression list (it is a list of
-- email addresses).
alter table email_suppressions enable row level security;
