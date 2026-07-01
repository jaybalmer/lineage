-- ============================================================================
-- Fix: public_stack_entries.owner_id must be TEXT, not UUID
-- ============================================================================
--
-- FNRad Featured Timelines Phase 1 added `owner_id uuid` to generalize the
-- curated-stack owner to {profile, event, org}. That was wrong: event and org
-- ids are TEXT (mixed-type catalog ids, e.g. 'evt_1782850803307_apuqit',
-- 'org_1780983954531_18txw'), so saving an episode's featured set or a show's
-- canon fails with:
--
--   invalid input syntax for type uuid: "evt_..."
--
-- on the insert into public_stack_entries (owner_id). Profile stacks were
-- unaffected because profile ids are real UUIDs and the profile read path keys
-- on owner_profile_id, not owner_id.
--
-- Fix: widen owner_id to text so it can hold profile UUIDs (as text), event ids,
-- and org ids alike. The existing profile rows convert cleanly (uuid -> its text
-- form). The (owner_type, owner_id, position) index rebuilds automatically. No
-- code change is needed: the read/write paths already pass text ids.
--
-- Idempotent: only alters when the column is still uuid.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_stack_entries'
      and column_name = 'owner_id'
      and data_type = 'uuid'
  ) then
    alter table public.public_stack_entries
      alter column owner_id type text using owner_id::text;
  end if;
end $$;
