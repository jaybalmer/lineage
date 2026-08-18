-- BUG-159: keep old /t/<slug> links resolvable after a public_slug is re-minted.
--
-- profiles.public_slug is minted once and frozen, but person timeline links
-- derive from the live display_name, so a renamed member's Stack URL (/t/<slug>)
-- disagrees with their timeline URL. The fix re-mints public_slug on rename; this
-- table holds the outgoing slug so links already shared keep resolving (the
-- /t/[slug] resolver falls back here and 308-redirects to the current slug).
--
-- Additive only (CREATE TABLE + index + RLS-on with no anon policy). The /t/
-- resolver and the slug minter reach this table via the service-role client, so
-- no anon/authenticated policy is needed; RLS-on denies everyone else by default.
--
-- The slug namespace is shared across profiles, orgs, and events (FNRad), so the
-- alias carries owner_type + owner_id, mirroring the /people/ person_slug_aliases
-- pattern (see src/lib/person-redirects.ts).
create table if not exists public_slug_aliases (
  slug        text primary key,
  owner_type  text not null,
  owner_id    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_public_slug_aliases_owner
  on public_slug_aliases (owner_type, owner_id);

alter table public_slug_aliases enable row level security;
