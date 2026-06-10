-- Story Connections: community-added place and event links on stories.
-- Riders need no schema change (story_riders + tag_events already cover them).
-- added_by is the community member who made the connection. NULL added_by
-- means the adder's profile was deleted; removal rights then fall to the
-- story author and editors.

create table if not exists story_places (
  story_id    uuid not null references stories(id) on delete cascade,
  place_id    text not null references places(id) on delete cascade,
  added_by    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (story_id, place_id)
);

create table if not exists story_events (
  story_id    uuid not null references stories(id) on delete cascade,
  event_id    text not null references events(id) on delete cascade,
  added_by    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (story_id, event_id)
);

create index if not exists story_places_place on story_places (place_id);
create index if not exists story_events_event on story_events (event_id);

alter table story_places enable row level security;
alter table story_events enable row level security;

-- Reads go through the service-role API route, but add a public select
-- policy mirroring story_boards so nothing breaks if a client read appears.
create policy "story_places_select" on story_places
  for select using (
    exists (select 1 from stories s where s.id = story_id
            and (s.visibility = 'public' or s.author_id = auth.uid()))
  );
create policy "story_events_select" on story_events
  for select using (
    exists (select 1 from stories s where s.id = story_id
            and (s.visibility = 'public' or s.author_id = auth.uid()))
  );

comment on table story_places is
  'Community-added place connections on stories. Author''s own primary link stays on stories.linked_place_id. Not person-implicating: no tag_events row.';
comment on table story_events is
  'Community-added event connections on stories. Author''s own primary link stays on stories.linked_event_id. Not person-implicating: no tag_events row.';
