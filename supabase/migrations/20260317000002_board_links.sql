-- ─── board_links ──────────────────────────────────────────────────────────────
-- Authenticated users can attach a URL to any board entry.
-- Open Graph metadata (og_title, og_image, og_description) is fetched
-- server-side by the /api/boards/[id]/links edge function on submission
-- and stored here for fast, cached display without client-side fetching.

create table if not exists board_links (
  id             uuid        primary key default gen_random_uuid(),
  board_id       text        not null references boards(id) on delete cascade,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  url            text        not null check (char_length(url) between 7 and 2048),
  og_title       text        check (char_length(og_title) <= 300),
  og_image       text        check (char_length(og_image) <= 2048),
  og_description text        check (char_length(og_description) <= 500),
  created_at     timestamptz not null default now()
);

-- Prevent duplicate URLs on the same board
create unique index board_links_board_url_uidx on board_links(board_id, url);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index board_links_board_id_idx on board_links(board_id);
create index board_links_user_id_idx  on board_links(user_id);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table board_links enable row level security;

-- Anyone can read links
create policy "board_links: public read"
  on board_links for select
  using (true);

-- Authenticated users can add links
create policy "board_links: insert own"
  on board_links for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authors can update their own links (e.g. re-fetch OG data)
create policy "board_links: update own"
  on board_links for update
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authors can remove their own links
create policy "board_links: delete own"
  on board_links for delete
  to authenticated
  using (auth.uid() = user_id);
