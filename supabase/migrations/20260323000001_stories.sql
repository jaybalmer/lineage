-- ── Stories ───────────────────────────────────────────────────────────────────

create table if not exists stories (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  title         text,
  body          text not null default '',
  story_date    date not null,
  visibility    text not null default 'public' check (visibility in ('public','private','shared')),
  linked_event_id  text references events(id) on delete set null,
  linked_place_id  text references places(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists story_photos (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references stories(id) on delete cascade,
  url         text not null,
  caption     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists story_boards (
  story_id    uuid not null references stories(id) on delete cascade,
  board_id    text not null references boards(id) on delete cascade,
  primary key (story_id, board_id)
);

create table if not exists story_riders (
  story_id    uuid not null references stories(id) on delete cascade,
  rider_id    uuid not null references profiles(id) on delete cascade,
  primary key (story_id, rider_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index on stories (author_id);
create index on stories (story_date);
create index on stories (linked_event_id) where linked_event_id is not null;
create index on stories (linked_place_id) where linked_place_id is not null;
create index on stories (created_at desc);
create index on story_photos (story_id);
create index on story_boards (board_id);
create index on story_riders (rider_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table stories       enable row level security;
alter table story_photos  enable row level security;
alter table story_boards  enable row level security;
alter table story_riders  enable row level security;

-- Stories: public rows readable by anyone; write only by author
create policy "stories_select" on stories
  for select using (visibility = 'public' or author_id = auth.uid());

create policy "stories_insert" on stories
  for insert with check (author_id = auth.uid());

create policy "stories_update" on stories
  for update using (author_id = auth.uid());

create policy "stories_delete" on stories
  for delete using (author_id = auth.uid());

-- story_photos: readable if parent story is readable
create policy "story_photos_select" on story_photos
  for select using (
    exists (
      select 1 from stories s
      where s.id = story_id
        and (s.visibility = 'public' or s.author_id = auth.uid())
    )
  );

create policy "story_photos_insert" on story_photos
  for insert with check (
    exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );

create policy "story_photos_delete" on story_photos
  for delete using (
    exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );

-- story_boards / story_riders: same pattern
create policy "story_boards_select" on story_boards
  for select using (
    exists (
      select 1 from stories s
      where s.id = story_id and (s.visibility = 'public' or s.author_id = auth.uid())
    )
  );

create policy "story_boards_insert" on story_boards
  for insert with check (
    exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );

create policy "story_boards_delete" on story_boards
  for delete using (
    exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );

create policy "story_riders_select" on story_riders
  for select using (
    exists (
      select 1 from stories s
      where s.id = story_id and (s.visibility = 'public' or s.author_id = auth.uid())
    )
  );

create policy "story_riders_insert" on story_riders
  for insert with check (
    exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );

create policy "story_riders_delete" on story_riders
  for delete using (
    exists (select 1 from stories s where s.id = story_id and s.author_id = auth.uid())
  );

-- ── Storage bucket: story-images ─────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('story-images', 'story-images', true)
on conflict (id) do nothing;

create policy "story_images_select" on storage.objects
  for select using (bucket_id = 'story-images');

create policy "story_images_insert" on storage.objects
  for insert with check (bucket_id = 'story-images' and auth.role() = 'authenticated');

create policy "story_images_delete" on storage.objects
  for delete using (bucket_id = 'story-images' and auth.uid()::text = (storage.foldername(name))[1]);
