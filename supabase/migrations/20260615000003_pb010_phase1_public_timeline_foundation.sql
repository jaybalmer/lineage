-- ============================================================================
-- PB-010 / PB-010A Phase 1 (Foundation): public timeline + Stack View schema
-- ============================================================================
--
-- Data-layer only. No public route, no API, no UI ships in this phase. This
-- migration lays the schema that Phase 2 (chromeless /t/[slug]) and Phase 3
-- (Stack View + owner manage surface) build on. See the Phase 1 brief in
-- Operations/ for the full sequencing.
--
-- What it adds:
--   profiles.public_slug                  the first stored slug column for a
--                                         profile (person slugs were derived
--                                         from display_name until now). Unique
--                                         when present; populated by the
--                                         collision-safe backfill script
--                                         scripts/backfill-public-slug.mjs, NOT
--                                         in this SQL (raw SQL cannot reproduce
--                                         nameToSlug() faithfully).
--   profiles.public_timeline_enabled      opt-in gate (default false) for the
--                                         Phase 2 public route.
--   profiles.public_timeline_default_view nullable override; the app resolves
--                                         the effective default per owner type
--                                         (member -> stack, brand/event ->
--                                         timeline), so this column stays a pure
--                                         override rather than baking owner-type
--                                         logic into a DB default.
--   public_stack_entries                  the owner-curated Stack selection and
--                                         order (read + curated in Phase 3).
--
-- Idempotent: every add is guarded with "if not exists" / "drop ... if exists"
-- so the migration is safe to re-run.
--
-- gen_random_uuid() is used elsewhere in these migrations (pgcrypto is
-- available on this project). profiles.id is uuid (auth-user FK pattern), so
-- owner_profile_id references it as uuid. entry_ref_id is intentionally text,
-- because catalog ids are mixed-type: roughly 29 people.id values are still
-- non-uuid and claims.asserted_by is text. A uuid column would reject them.

-- ── profiles: three additive columns ────────────────────────────────────────

alter table public.profiles
  add column if not exists public_slug text,
  add column if not exists public_timeline_enabled boolean not null default false,
  add column if not exists public_timeline_default_view text;

-- public_timeline_default_view is a nullable override. When set it must be one
-- of the two known views. Dropped-then-added so the migration is re-runnable.
alter table public.profiles
  drop constraint if exists public_timeline_default_view_valid;

alter table public.profiles
  add constraint public_timeline_default_view_valid
  check (public_timeline_default_view is null
         or public_timeline_default_view in ('timeline', 'stack'));

-- Unique only among populated slugs, so the unbackfilled / opted-out rows
-- (public_slug is null) do not collide with each other.
create unique index if not exists profiles_public_slug_key
  on public.profiles (public_slug)
  where public_slug is not null;

-- ── public_stack_entries: owner-curated Stack selection ─────────────────────

create table if not exists public.public_stack_entries (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_type text not null
    check (entry_type in ('story', 'place', 'event', 'board', 'rider', 'category_summary')),
  -- nullable; text, because catalog ids are mixed-type. Null for category_summary.
  entry_ref_id text,
  -- only set when entry_type = 'category_summary'
  category_key text
    check (category_key in ('places', 'boards', 'events', 'riders', 'stories')),
  position int not null,
  custom_title text,
  custom_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_stack_entries_owner_pos
  on public.public_stack_entries (owner_profile_id, position);

-- Shape guardrail: a category_summary row carries a category_key and no
-- entry_ref_id; every other entry type carries an entry_ref_id and no
-- category_key. Dropped-then-added so the migration is re-runnable.
alter table public.public_stack_entries
  drop constraint if exists public_stack_entry_shape;

alter table public.public_stack_entries
  add constraint public_stack_entry_shape check (
    (entry_type = 'category_summary'
       and category_key is not null
       and entry_ref_id is null)
    or
    (entry_type <> 'category_summary'
       and entry_ref_id is not null
       and category_key is null)
  );

-- Backfill of profiles.public_slug runs separately, after this migration, via
-- scripts/backfill-public-slug.mjs (collision-safe, mirrors ensureUniquePublicSlug
-- in src/lib/public-slug.ts). See §5 of the Phase 1 brief.
