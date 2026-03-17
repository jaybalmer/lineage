-- ─── board_stories ────────────────────────────────────────────────────────────
-- Authenticated users can attach a short personal story to any board entry.
-- board_id is text to match the boards table's string primary key.

create table if not exists board_stories (
  id          uuid        primary key default gen_random_uuid(),
  board_id    text        not null references boards(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  story_text  text        not null check (char_length(story_text) between 1 and 2000),
  year_ridden integer     check (year_ridden >= 1960 and year_ridden <= extract(year from now()) + 1),
  location    text        check (char_length(location) <= 120),
  created_at  timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index board_stories_board_id_idx on board_stories(board_id);
create index board_stories_user_id_idx  on board_stories(user_id);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table board_stories enable row level security;

-- Anyone (including anonymous visitors) can read stories
create policy "board_stories: public read"
  on board_stories for select
  using (true);

-- Authenticated users can add their own stories
create policy "board_stories: insert own"
  on board_stories for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authors can edit their own stories
create policy "board_stories: update own"
  on board_stories for update
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authors can delete their own stories
create policy "board_stories: delete own"
  on board_stories for delete
  to authenticated
  using (auth.uid() = user_id);
