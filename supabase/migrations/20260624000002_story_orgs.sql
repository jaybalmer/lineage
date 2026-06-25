-- Story Connections: community-added brand/org links on stories.
-- Not person-implicating: plain junction, no tag_events. The author's own
-- primary link stays on stories.linked_org_id. added_by is the community
-- member who made the connection; NULL means their profile was deleted and
-- removal rights fall to the story author and editors.
--
-- Direct clone of story_places / story_events. org_id is text because orgs.id
-- is text (matching places.id / events.id), not uuid.

create table if not exists story_orgs (
  story_id    uuid not null references stories(id) on delete cascade,
  org_id      text not null references orgs(id) on delete cascade,
  added_by    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (story_id, org_id)
);

create index if not exists story_orgs_org on story_orgs (org_id);

alter table story_orgs enable row level security;

create policy "story_orgs_select" on story_orgs
  for select using (
    exists (select 1 from stories s where s.id = story_id
            and (s.visibility = 'public' or s.author_id = auth.uid()))
  );

comment on table story_orgs is
  'Community-added brand/org connections on stories. Author''s own primary link stays on stories.linked_org_id. Not person-implicating: no tag_events row.';
