-- ── Story reactions ──────────────────────────────────────────────────────────
-- One reaction per member per story; changing reaction = upsert on the PK.

create table if not exists story_reactions (
  story_id      uuid not null references stories(id) on delete cascade,
  reactor_id    uuid not null references profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('stoke','fire','laugh','respect','classic')),
  created_at    timestamptz not null default now(),
  primary key (story_id, reactor_id)
);

create index on story_reactions (story_id);

-- ── Story comments ───────────────────────────────────────────────────────────

create table if not exists story_comments (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references stories(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index on story_comments (story_id, created_at);

-- ── Comment notification dedup / batching ────────────────────────────────────
-- One row per story. last_sent_at drives the 6-hour batch window.

create table if not exists story_comment_notifications (
  story_id      uuid primary key references stories(id) on delete cascade,
  last_sent_at  timestamptz not null default now(),
  send_count    int not null default 1
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Writes go through API routes with the service client; these policies are
-- defense in depth, mirroring the stories pattern.

alter table story_reactions enable row level security;
alter table story_comments  enable row level security;
alter table story_comment_notifications enable row level security;

create policy "story_reactions_select" on story_reactions
  for select using (
    exists (select 1 from stories s where s.id = story_id
            and (s.visibility = 'public' or s.author_id = auth.uid()))
  );
create policy "story_reactions_write" on story_reactions
  for all using (reactor_id = auth.uid()) with check (reactor_id = auth.uid());

create policy "story_comments_select" on story_comments
  for select using (
    exists (select 1 from stories s where s.id = story_id
            and (s.visibility = 'public' or s.author_id = auth.uid()))
  );
create policy "story_comments_insert" on story_comments
  for insert with check (author_id = auth.uid());
create policy "story_comments_delete" on story_comments
  for delete using (author_id = auth.uid());
-- Story-author and editor deletes run through the service client.
