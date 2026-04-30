-- ============================================================================
-- PB-008 Phase 2 Session 1: Person slug aliases
-- Run in Supabase SQL Editor
-- ============================================================================
--
-- Captures every old slug or id that should redirect to a canonical person
-- node. Two writers populate this table:
--
--   * The merge handler, which records `<old_id> -> <canonical_id>` whenever
--     a duplicate person is folded into another (reason = 'merged'). The
--     people / profiles row carrying merged_from_id is the canonical side.
--
--   * The claim handler, which records `<old_slug> -> <canonical_id>` when a
--     ghost person (catalog) is claimed and the resulting display_name
--     produces a new slug (reason = 'reslugged').
--
-- The redirect middleware reads this table together with the merged_from_id
-- column to build an in-memory alias map cached at the edge.

create table if not exists person_slug_aliases (
  alias text primary key,
  person_id uuid not null,
  reason text not null check (reason in ('merged', 'reslugged', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists idx_person_slug_aliases_person on person_slug_aliases (person_id);

-- Aliases may target either a profiles row (claimed/verified user) or a
-- people row (catalog/unclaimed ghost), so we intentionally do not add a
-- foreign-key constraint. Application code keeps the references consistent
-- with people.id and profiles.id when writing.

alter table person_slug_aliases enable row level security;

create policy "Anyone can read slug aliases"
  on person_slug_aliases for select
  using (true);

-- Writes are limited to the service role; no insert/update/delete policy is
-- defined for anon or authenticated, so RLS denies them by default.
