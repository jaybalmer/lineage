-- linestry-ops brief T2: canonical map of ops PII tokens to raw values.
-- Service-role only (RLS enabled, no policies => anon/authenticated get nothing,
-- service role bypasses RLS). Populated/read by bugs/scrub-pii.py so a hosted
-- runner with only the service-role key (no bugs/private/) can resolve and
-- assign tokens. See features/linestry-ops-repo-brief.md.
-- Applied to prod 2026-09-09 via Supabase MCP apply_migration.
create table if not exists public.ops_pii_map (
  token      text primary key,
  kind       text not null,
  raw_value  text not null,
  created_at timestamptz not null default now()
);

alter table public.ops_pii_map enable row level security;

comment on table public.ops_pii_map is 'Canonical ops PII token map (kind=reporter|session, token R-nn/S-nn) to raw email/session id. Service-role only: RLS enabled with no policies. Read/written by bugs/scrub-pii.py. See features/linestry-ops-repo-brief.md.';
