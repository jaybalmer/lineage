-- BUG-103: contribution-token claw-back support.
--
-- A member could farm contribution tokens by adding a timeline entry, deleting
-- it, then re-adding it: every add awarded fresh tokens (bounded only by the
-- 20/day cap) and the delete reversed nothing. Contribution tokens feed the
-- Sept 30 equity snapshot, so the count has to reflect net surviving
-- contributions, not add/delete churn.
--
-- Fix model (Jay's call, June 24): claw back. Award on create as before, then
-- reverse the award when the earning entity is deleted. To reverse the exact
-- amount a given entity earned, the ledger has to remember which entity each
-- award belongs to, and the reversal needs an atomic, clamped decrement.
--
-- Both objects below are additive. The award write path sets source_ref
-- unconditionally and the reversal calls decrement_contribution_tokens, so this
-- migration is a HARD pre-merge gate: apply it BEFORE the PR merges or the
-- ledger insert silently drops its row (best-effort award swallows the error)
-- and the new reversal RPC 404s.

-- 1. Tie each award to the entity that earned it.
--    Values are prefixed keys: 'claim:<id>', 'story:<id>', 'entity:<id>',
--    'conn:<story_id>:<type>:<entity_id>'. Nullable so historical rows and the
--    uncapped onboard award stay valid.
alter table public.token_events
  add column if not exists source_ref text;

-- 2. The reversal looks up a user's awards for one entity. Partial index keeps
--    it cheap and self-documents the access pattern.
create index if not exists token_events_user_source_ref_idx
  on public.token_events (user_id, source_ref)
  where source_ref is not null;

-- 3. Clamped, atomic balance decrement mirroring increment_contribution_tokens
--    (migration-013, dashboard). greatest(0, ...) means a reversal never drives
--    a balance below zero, so no negative balances are ever introduced.
create or replace function public.decrement_contribution_tokens(
  p_user uuid,
  p_amount integer
)
returns void
language sql
as $$
  update public.profiles
     set token_contribution = greatest(0, coalesce(token_contribution, 0) - p_amount)
   where id = p_user;
$$;
