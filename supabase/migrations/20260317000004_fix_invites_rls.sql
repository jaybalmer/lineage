-- Fix overly-permissive RLS policy on the invites table.
--
-- The previous policy "Auth users can update invites" used USING (true),
-- meaning any authenticated user could modify any invite row. This is
-- flagged by the Supabase linter (rls_policy_always_true).
--
-- Correct intent: a user should only be able to claim an invite that:
--   1. Has not already been claimed (claimed_at IS NULL)
--   2. Is being claimed by themselves (claimed_by = auth.uid())
--
-- The INSERT/admin path uses the service role key and bypasses RLS,
-- so this only tightens the client-side UPDATE surface.

drop policy if exists "Auth users can update invites" on public.invites;

-- Authenticated users may update an invite only if:
--   USING  → the invite is not yet claimed (prevents double-claiming)
--   WITH CHECK → the new claimed_by value is the current user (prevents claiming as someone else)
create policy "Auth users can claim their own invite"
  on public.invites
  for update
  to authenticated
  using   (claimed_at is null)
  with check (claimed_by = auth.uid());
