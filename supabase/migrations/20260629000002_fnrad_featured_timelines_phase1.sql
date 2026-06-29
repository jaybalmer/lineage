-- ============================================================================
-- FNRad Featured Timelines — Phase 1 (Foundation)
-- ============================================================================
--
-- Data-layer + types-only. No UI, no new API surface ships in this phase. This
-- migration is the foundation Phases 2 to 4 build on. See the build brief in
-- features/event-featured-timelines-build-brief.md (§5).
--
-- What it adds:
--   public_stack_entries.owner_type / owner_id   generalize the curated-stack
--                                                 owner from profile-only to any
--                                                 of {profile, event, org}, so an
--                                                 episode (event) and a show (org)
--                                                 each own a curated stack the
--                                                 same way a profile does (§5.1).
--   events.show_org_id / media_url / episode_number   episode linkage + metadata
--                                                 for event_type='episode' (§5.3).
--   event_guests                                  editor-managed header guest(s)
--                                                 per episode, kept separate from
--                                                 attendance claims and the stack
--                                                 so the guest header is
--                                                 unambiguous (§5.3).
--   orgs/events.public_slug / public_enabled      the public, login-free
--                                                 chromeless /t/[slug] surface for
--                                                 shows and episodes, mirroring the
--                                                 profile public-timeline columns
--                                                 (§5.5). Slugs are minted on first
--                                                 enable (Phase 2/3) by the shared-
--                                                 namespace minter in
--                                                 src/lib/public-slug.ts, NOT here:
--                                                 there is no FNRad org or episode
--                                                 in prod yet, so there is nothing
--                                                 to backfill.
--
-- The 'media' OrgType and 'episode' EventType values are TS-only: orgs.org_type
-- and events.event_type are plain text columns (no DB enum), so no DB change is
-- needed to allow the new values — just the TS unions and any UI labels.
--
-- Idempotent: every add is guarded with "if not exists" / "drop ... if exists"
-- so the migration is safe to re-run.
--
-- MERGE-BEFORE-MIGRATION GATE (§5.1): once the Phase 1 code merges, the stack
-- write path sends owner_type/owner_id, so this migration MUST be applied before
-- the Phase 1 PR merges or stack writes 500 in the window (Group F lesson).

-- ── §5.1 Generalize the stack owner ─────────────────────────────────────────

alter table public.public_stack_entries
  add column if not exists owner_type text not null default 'profile',
  add column if not exists owner_id uuid;

-- owner_type must be one of the three supported owner kinds. Dropped-then-added
-- so the migration is re-runnable.
alter table public.public_stack_entries
  drop constraint if exists public_stack_entry_owner_type_valid;

alter table public.public_stack_entries
  add constraint public_stack_entry_owner_type_valid
  check (owner_type in ('profile', 'event', 'org'));

-- owner_profile_id was NOT NULL with an FK to profiles. Event/org-owned rows
-- have no profile, so relax it to nullable. The FK stays (a null skips the FK
-- check), so profile-owned rows keep cascading on profile delete; the Phase 1
-- write path keeps populating owner_profile_id for owner_type='profile'.
alter table public.public_stack_entries
  alter column owner_profile_id drop not null;

-- Backfill the new generalized owner columns from the existing profile owner so
-- every pre-existing row is addressable by (owner_type, owner_id). owner_type
-- already defaulted to 'profile' on the add above.
update public.public_stack_entries
  set owner_id = owner_profile_id
  where owner_id is null and owner_profile_id is not null;

create index if not exists public_stack_entries_owner
  on public.public_stack_entries (owner_type, owner_id, position);

-- ── §5.3 Event: episode linkage + metadata ──────────────────────────────────
-- event_type='episode' is TS-only (events.event_type is text). These columns
-- are additive and nullable, so non-episode events are unaffected.

alter table public.events
  add column if not exists show_org_id uuid references public.orgs(id) on delete set null,
  add column if not exists media_url text,
  add column if not exists episode_number int;

create index if not exists events_show_org_id
  on public.events (show_org_id)
  where show_org_id is not null;

-- Editor-managed header guest(s) for an episode. Separate from attendance claims
-- and from the curated stack so the guest header is unambiguous (§5.3).
create table if not exists public.event_guests (
  event_id uuid not null references public.events(id) on delete cascade,
  -- person_id is text, not uuid: catalog person ids are mixed-type (roughly 29
  -- people.id values are still non-uuid), matching entry_ref_id in the stack
  -- table. No FK for the same reason (people live across people + profiles).
  person_id text not null,
  position int not null default 0,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id)
);

create index if not exists event_guests_event
  on public.event_guests (event_id, position);

-- ── §5.5 Public chromeless links for shows (orgs) and episodes (events) ──────
-- Mirror the profile public-timeline columns. Slugs share one namespace with
-- profiles (linestry.com/t/{slug}); the collision-safe minter in
-- src/lib/public-slug.ts allocates across all three tables. Minted on first
-- enable (Phase 2/3), not backfilled here.

alter table public.orgs
  add column if not exists public_slug text,
  add column if not exists public_enabled boolean not null default false;

alter table public.events
  add column if not exists public_slug text,
  add column if not exists public_enabled boolean not null default false;

-- Unique only among populated slugs (mirrors profiles_public_slug_key), so the
-- many null rows do not collide with each other.
create unique index if not exists orgs_public_slug_key
  on public.orgs (public_slug)
  where public_slug is not null;

create unique index if not exists events_public_slug_key
  on public.events (public_slug)
  where public_slug is not null;
