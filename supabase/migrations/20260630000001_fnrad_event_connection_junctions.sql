-- ============================================================================
-- FNRad Featured Timelines — Phase 4 (in-app community expansion)
-- ============================================================================
--
-- Five junction tables letting a signed-in member add what an episode covered:
-- the riders, places, related events, orgs/brands, and boards discussed but not
-- in the editor-curated featured set. Mirrors the Story Connections junctions
-- (story_places / story_events / story_orgs), scoped to events.
--
-- Build-time decision (brief §5.4, confirmed with Jay): member-added riders use
-- the SAME simple adder/editor-removal model as the other four types, NOT the
-- PB-009 tag pipeline. So there is no tag_event pairing, no _public view, and no
-- consent gate here: these connections render in-app only (the public chromeless
-- page stays the editor-curated stack), and removal rights are adder-or-editor.
--
-- ids are text to match the mixed-type catalog ids (events.id, people.id, etc.),
-- exactly like public_stack_entries.entry_ref_id and event_guests. event_id FKs
-- to events(id) (text) with cascade so an episode's connections clean up on
-- delete; the ref columns carry no FK for the same mixed-type reason. added_by
-- FKs to profiles(id) (uuid) and set-null on delete so removal rights survive a
-- deleted account (an editor can still remove).
--
-- Idempotent: guarded with "if not exists".
--
-- MERGE-BEFORE-MIGRATION GATE: the Phase 4 connections API reads + writes these
-- tables, so apply this migration before the Phase 4 PR merges or the new route
-- 500s in the window.

create table if not exists public.event_people (
  event_id text not null references public.events(id) on delete cascade,
  person_id text not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id)
);
create index if not exists event_people_event on public.event_people (event_id);

create table if not exists public.event_places (
  event_id text not null references public.events(id) on delete cascade,
  place_id text not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, place_id)
);
create index if not exists event_places_event on public.event_places (event_id);

create table if not exists public.event_events (
  event_id text not null references public.events(id) on delete cascade,
  related_event_id text not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, related_event_id)
);
create index if not exists event_events_event on public.event_events (event_id);

create table if not exists public.event_orgs (
  event_id text not null references public.events(id) on delete cascade,
  org_id text not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, org_id)
);
create index if not exists event_orgs_event on public.event_orgs (event_id);

create table if not exists public.event_boards (
  event_id text not null references public.events(id) on delete cascade,
  board_id text not null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, board_id)
);
create index if not exists event_boards_event on public.event_boards (event_id);
