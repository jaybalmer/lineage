-- 20260623000001_rls_enable_flagged_tables.sql
-- Close the Supabase "rls_disabled_in_public" advisor errors (flagged 22 Jun 2026).
--
-- Five public-schema tables had RLS disabled, so the public anon key could read,
-- insert, update, and delete them directly through PostgREST, bypassing every
-- API-route auth check (requireAuth / requireEditor). Enable RLS on all five and
-- add only the policies needed to preserve current client behavior.
--
-- Classification (verified against the codebase, not migrations, since RLS for
-- several tables was configured directly in the dashboard):
--   people        read client-side (public catalog browse + /claim page) and
--                 inserted by authenticated members (addUserPerson, store ~739);
--                 all updates/deletes are service-role API routes.
--   event_series  read client-side (catalog load, store ~189); written only via
--                 the service-role /api/catalog/entity route.
--   token_events  service-role only (lib/tokens.ts, stripe webhook, gift redeem,
--                 admin memberships, me/tokens-today). Never touched by anon key.
--   gift_codes    service-role only (gift validate/redeem, stripe webhook).
--   distributions not referenced anywhere in the app.
--
-- The Supabase service role has BYPASSRLS, so every API route keeps working
-- unchanged. Policies are created before RLS is enabled, inside one transaction,
-- so there is no window where reads break. Re-runnable (drop policy if exists).

begin;

-- people: public catalog read for all; authenticated members may insert riders.
-- No update/delete policy => only the service role can modify/remove people,
-- which matches today (every people update/delete already runs server-side).
drop policy if exists "people_public_read"  on public.people;
drop policy if exists "people_member_insert" on public.people;
create policy "people_public_read"  on public.people for select using (true);
create policy "people_member_insert" on public.people for insert to authenticated with check (true);
alter table public.people enable row level security;

-- event_series: public catalog read only. Writes are service-role (catalog/entity).
drop policy if exists "event_series_public_read" on public.event_series;
create policy "event_series_public_read" on public.event_series for select using (true);
alter table public.event_series enable row level security;

-- token_events: server-only ledger. No policies => anon/authenticated fully denied.
alter table public.token_events enable row level security;

-- gift_codes: server-only. No policies => anon/authenticated fully denied.
alter table public.gift_codes enable row level security;

-- distributions: unused by the app. No policies => locked to the service role.
alter table public.distributions enable row level security;

commit;
