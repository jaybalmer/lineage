-- node-claim-admin-invite: let claim_requests hold an anonymous, email-first claim.
--
-- The existing flow (claim_kind='member') is unchanged: an authenticated claimant
-- with claimant_id, merged via merge_person. The new flow (claim_kind='public_invite')
-- has no account at submit time, so it carries an email instead of a claimant_id and
-- is folded in at signup via promoteGhostToAccount (NOT merge_person).
--
-- Additive + the existing POST /api/claim-requests does not send these columns, so
-- there is no PGRST204-on-existing-insert risk. The new anonymous route depends on
-- the columns, so apply this BEFORE the PR merges.

alter table claim_requests add column if not exists claimant_email text;
alter table claim_requests add column if not exists email_verified_at timestamptz;
alter table claim_requests add column if not exists claim_kind text not null default 'member';
-- claim_kind in ('member','public_invite').

-- The member flow always set claimant_id; the public_invite flow never can. A
-- column that is already nullable makes this a no-op.
alter table claim_requests alter column claimant_id drop not null;

-- Exactly one identity source per row.
alter table claim_requests add constraint claim_requests_identity_chk
  check (
    (claim_kind = 'member'        and claimant_id is not null and claimant_email is null) or
    (claim_kind = 'public_invite' and claimant_id is null     and claimant_email is not null)
  );

-- One open email claim per (node, email): backs the D6 duplicate guard.
create index if not exists claim_requests_email_open_idx
  on claim_requests (lower(claimant_email), node_id)
  where status in ('pending','vouched');
