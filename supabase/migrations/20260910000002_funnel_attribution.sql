-- ============================================================================
-- First-touch acquisition attribution
-- ============================================================================
--
-- Two additive tables. Nothing here alters an existing table, and nothing here
-- touches profiles.
--
--   ref_codes    short, human-typeable codes for spoken campaign callouts
--                (a podcast host reading linestry.com/r/fnrad-s12e04 on air).
--                Resolved at request time by src/app/r/[code]/route.ts.
--
--   acquisition  one durable row per member recording where they came from.
--                first_* is written once and never updated: the write path
--                inserts, and on a unique violation updates only the last_*
--                columns. Immutability is enforced by that access pattern.
--
-- Both are written by POST /api/attribution/attach (service role, requireAuth)
-- and read by GET /api/admin/users and /r/[code]. RLS is enabled with zero
-- policies on acquisition so anon/authenticated keys cannot read or write it,
-- matching analytics_events. ref_codes gets a public read policy for active
-- rows: harmless (a code is spoken on a podcast) and keeps a future client-side
-- lookup unblocked.
--
-- Idempotent: safe to re-run.

-- ── ref_codes ───────────────────────────────────────────────────────────────
-- events.id is TEXT, not uuid. Getting this wrong throws 42804.
create table if not exists public.ref_codes (
  code              text primary key,
  label             text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  event_id          text references public.events(id) on delete set null,
  destination_path  text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists ref_codes_active_idx
  on public.ref_codes (active)
  where active;

alter table public.ref_codes enable row level security;

drop policy if exists "ref_codes_select_active" on public.ref_codes;
create policy "ref_codes_select_active" on public.ref_codes
  for select using (active);

comment on table public.ref_codes is
  'Short spoken campaign codes resolved by /r/[code]. destination_path is validated with safeReturnTo() before any redirect.';

-- ── acquisition ─────────────────────────────────────────────────────────────
-- profiles.id is uuid. One row per member; cascade so a deleted profile leaves
-- no orphan.
create table if not exists public.acquisition (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  first_source        text,
  first_medium        text,
  first_campaign      text,
  first_content       text,
  first_term          text,
  first_ref           text,
  first_referrer      text,
  first_landing_path  text,
  first_seen_at       timestamptz,
  last_source         text,
  last_medium         text,
  last_campaign       text,
  last_ref            text,
  last_seen_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Cohort queries: "everyone who came from fnrad", "everyone from the s12 campaign".
create index if not exists acquisition_first_source_idx
  on public.acquisition (first_source)
  where first_source is not null;

create index if not exists acquisition_first_campaign_idx
  on public.acquisition (first_campaign)
  where first_campaign is not null;

create index if not exists acquisition_first_ref_idx
  on public.acquisition (first_ref)
  where first_ref is not null;

alter table public.acquisition enable row level security;

comment on table public.acquisition is
  'First-touch and last-touch acquisition per member. first_* columns are write-once: the attach route inserts, then on conflict updates only last_*. Written by POST /api/attribution/attach.';
