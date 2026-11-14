-- Podcast archive staging, Phase 1 (brief: podcast-archive-staging-brief-v2.md, section 5).
--
-- Four isolated tables that hold candidate episodes, stories, nodes and mentions
-- for the FNRad back catalog review. NOTHING here is public and nothing here
-- references a catalog row until the Phase 3 publish step writes the ids back
-- (episode_event_id, subject_id, published_mention_id).
--
-- Additive only. Service-role only: RLS on with no policies, and the anon and
-- authenticated roles have every grant revoked, so the two stats views cannot
-- be used to read around RLS either.
--
-- Deviations from the brief's column list (noted in the PR):
--   * podcast_staging_nodes.flags text[]: resolver flags (all-inferred, catalog
--     duplicate, weak candidate) so the Nodes tab can filter "flagged" in SQL.
--   * podcast_staging_stories.position int: seed order, a stable tiebreak for
--     two stories at the same timestamp.
--   * Both stats views use LEFT joins (a node or episode with nothing under it
--     still shows zero instead of vanishing) and security_invoker.

create table if not exists public.podcast_staging_episodes (
  id uuid primary key default gen_random_uuid(),
  show_org_id text references public.orgs(id) on delete set null,
  archive_label text,                 -- 'S10E15', 'SPECIAL', 'S9BONUS8'
  guest text,
  episode_name text not null,
  proposed_episode_number int,        -- D1 / D2 / D12; written to events only at publish
  air_date date,
  media_url text,
  video_id text not null,
  series_note text,                   -- D3
  wave text,
  status text not null default 'loaded'
    check (status in ('loaded','in_review','ready','published','skipped')),
  episode_event_id text references public.events(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id)
);

create table if not exists public.podcast_staging_nodes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('person','place','org','board','event')),
  name text not null,
  normalized_name text not null,
  resolution text not null default 'unresolved'
    check (resolution in ('unresolved','matched','ambiguous','review','new','needs_detail')),
  subject_id text,                    -- catalog id once matched or created; no FK, same as mentions
  candidates jsonb not null default '[]',
  ghost jsonb not null default '{}',
  heard_as text[] not null default '{}',
  flags text[] not null default '{}',
  decision text not null default 'pending'
    check (decision in ('pending','approved','hold','rejected')),
  merged_into uuid references public.podcast_staging_nodes(id) on delete set null,
  also_known_as uuid references public.podcast_staging_nodes(id) on delete set null,  -- D10
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_type, normalized_name)
);

create table if not exists public.podcast_staging_stories (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_staging_episodes(id) on delete cascade,
  timestamp_seconds integer not null check (timestamp_seconds >= 0),
  position integer not null default 0,
  title text not null,
  excerpt text not null,
  decision text not null default 'pending'
    check (decision in ('pending','approved','trimmed','hold_sensitive')),
  activity text,
  skip_reason text,
  revision_pending jsonb,             -- D11: new seed content for an already-decided story
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, timestamp_seconds, title)
);

create table if not exists public.podcast_staging_mentions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.podcast_staging_stories(id) on delete cascade,
  node_id uuid not null references public.podcast_staging_nodes(id) on delete restrict,
  heard_as text,
  inferred boolean not null default false,
  decision text not null default 'inherit' check (decision in ('inherit','rejected')),
  published_mention_id uuid references public.mentions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (story_id, node_id)
);

create index if not exists podcast_staging_mentions_node on public.podcast_staging_mentions (node_id);
create index if not exists podcast_staging_stories_episode on public.podcast_staging_stories (episode_id, timestamp_seconds);
create index if not exists podcast_staging_nodes_filter on public.podcast_staging_nodes (subject_type, resolution, decision);

-- Per-node counts for the Nodes tab, so the table sorts and filters in SQL.
create or replace view public.podcast_staging_node_stats
with (security_invoker = true) as
select n.id,
       count(distinct s.episode_id)                                         as episode_count,
       count(distinct s.id)                                                 as story_count,
       count(distinct s.id) filter (where s.decision <> 'trimmed')         as kept_story_count,
       count(m.id) filter (where m.inferred)                                as inferred_count,
       count(m.id)                                                          as mention_count
from public.podcast_staging_nodes n
left join public.podcast_staging_mentions m on m.node_id = n.id
left join public.podcast_staging_stories  s on s.id = m.story_id
group by n.id;

-- Per-episode counts for the Episodes tab.
create or replace view public.podcast_staging_episode_stats
with (security_invoker = true) as
select e.id,
       count(distinct s.id)                                          as story_count,
       count(distinct s.id) filter (where s.decision = 'trimmed')   as trimmed_count,
       count(m.id)                                                   as mention_count,
       count(m.id) filter (where m.inferred)                         as inferred_count
from public.podcast_staging_episodes e
left join public.podcast_staging_stories  s on s.episode_id = e.id
left join public.podcast_staging_mentions m on m.story_id = s.id
group by e.id;

-- Service-role only. RLS on with no policies means anon and authenticated clients see nothing.
alter table public.podcast_staging_episodes enable row level security;
alter table public.podcast_staging_nodes    enable row level security;
alter table public.podcast_staging_stories  enable row level security;
alter table public.podcast_staging_mentions enable row level security;

revoke all on public.podcast_staging_episodes      from anon, authenticated;
revoke all on public.podcast_staging_nodes         from anon, authenticated;
revoke all on public.podcast_staging_stories       from anon, authenticated;
revoke all on public.podcast_staging_mentions      from anon, authenticated;
revoke all on public.podcast_staging_node_stats    from anon, authenticated;
revoke all on public.podcast_staging_episode_stats from anon, authenticated;
