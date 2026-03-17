-- ─── board_image_votes ────────────────────────────────────────────────────────
-- Community signals on the auto-searched board image.
-- One vote per user per board (unique constraint).
-- vote: 'up' = confirmed correct, 'flag' = wrong/misleading.
-- suggested_image_url: optionally submit a better image link.

create table if not exists board_image_votes (
  id                   uuid        primary key default gen_random_uuid(),
  board_id             text        not null references boards(id) on delete cascade,
  user_id              uuid        not null references auth.users(id) on delete cascade,
  vote                 text        not null check (vote in ('up', 'flag')),
  suggested_image_url  text        check (char_length(suggested_image_url) <= 2048),
  created_at           timestamptz not null default now(),
  unique (board_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index board_image_votes_board_id_idx on board_image_votes(board_id);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table board_image_votes enable row level security;

-- Anyone can read vote counts
create policy "board_image_votes: public read"
  on board_image_votes for select
  using (true);

-- Authenticated users can cast their vote
create policy "board_image_votes: insert own"
  on board_image_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authors can change their vote or add a suggestion
create policy "board_image_votes: update own"
  on board_image_votes for update
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authors can retract their vote
create policy "board_image_votes: delete own"
  on board_image_votes for delete
  to authenticated
  using (auth.uid() = user_id);
