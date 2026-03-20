-- ─── place_image_votes ────────────────────────────────────────────────────────
-- Community photo suggestions for places. One vote per user per place.
create table if not exists place_image_votes (
  id                   uuid        primary key default gen_random_uuid(),
  place_id             text        not null references places(id) on delete cascade,
  user_id              uuid        not null references auth.users(id) on delete cascade,
  vote                 text        not null check (vote in ('up', 'flag')),
  suggested_image_url  text        check (char_length(suggested_image_url) <= 2048),
  created_at           timestamptz not null default now(),
  unique (place_id, user_id)
);

create index place_image_votes_place_id_idx on place_image_votes(place_id);

alter table place_image_votes enable row level security;

create policy "place_image_votes: public read"
  on place_image_votes for select using (true);

create policy "place_image_votes: insert own"
  on place_image_votes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "place_image_votes: update own"
  on place_image_votes for update to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "place_image_votes: delete own"
  on place_image_votes for delete to authenticated
  using (auth.uid() = user_id);

-- ─── event_image_votes ────────────────────────────────────────────────────────
-- Community photo suggestions for events. One vote per user per event.
create table if not exists event_image_votes (
  id                   uuid        primary key default gen_random_uuid(),
  event_id             text        not null references events(id) on delete cascade,
  user_id              uuid        not null references auth.users(id) on delete cascade,
  vote                 text        not null check (vote in ('up', 'flag')),
  suggested_image_url  text        check (char_length(suggested_image_url) <= 2048),
  created_at           timestamptz not null default now(),
  unique (event_id, user_id)
);

create index event_image_votes_event_id_idx on event_image_votes(event_id);

alter table event_image_votes enable row level security;

create policy "event_image_votes: public read"
  on event_image_votes for select using (true);

create policy "event_image_votes: insert own"
  on event_image_votes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "event_image_votes: update own"
  on event_image_votes for update to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "event_image_votes: delete own"
  on event_image_votes for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Storage: place-images ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-images',
  'place-images',
  true,
  10485760,
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

create policy "place-images: public read"
  on storage.objects for select using (bucket_id = 'place-images');

create policy "place-images: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images');

create policy "place-images: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'place-images' and auth.uid()::text = (storage.foldername(name))[2]);

create policy "place-images: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'place-images' and auth.uid()::text = (storage.foldername(name))[2]);

-- ─── Storage: event-images ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  10485760,
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

create policy "event-images: public read"
  on storage.objects for select using (bucket_id = 'event-images');

create policy "event-images: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-images');

create policy "event-images: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-images' and auth.uid()::text = (storage.foldername(name))[2]);

create policy "event-images: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-images' and auth.uid()::text = (storage.foldername(name))[2]);
