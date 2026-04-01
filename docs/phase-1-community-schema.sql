-- ============================================================================
-- PHASE 1: Community Architecture — Schema Changes
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Create the communities table
CREATE TABLE communities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  emoji      text,
  status     text NOT NULL DEFAULT 'active',  -- 'active' | 'coming_soon'
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed the launch communities
INSERT INTO communities (slug, name, emoji, status, sort_order) VALUES
  ('snowboarding',  'Snowboarding',     '🏂', 'active',      0),
  ('surf',          'Surf',             '🏄', 'coming_soon', 1),
  ('skate',         'Skateboarding',    '🛹', 'coming_soon', 2),
  ('ski',           'Skiing',           '⛷️', 'coming_soon', 3),
  ('mtb',           'Mountain Biking',  '🚵', 'coming_soon', 4);

-- 3. Node ↔ Community junction tables (many-to-many)
CREATE TABLE community_people (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  person_id    text NOT NULL,
  PRIMARY KEY (community_id, person_id)
);

CREATE TABLE community_places (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  place_id     text NOT NULL,
  PRIMARY KEY (community_id, place_id)
);

CREATE TABLE community_orgs (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  org_id       text NOT NULL,
  PRIMARY KEY (community_id, org_id)
);

CREATE TABLE community_boards (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  board_id     text NOT NULL,
  PRIMARY KEY (community_id, board_id)
);

CREATE TABLE community_events (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  event_id     text NOT NULL,
  PRIMARY KEY (community_id, event_id)
);

-- 4. Add community_id to claims and stories
ALTER TABLE claims  ADD COLUMN community_id uuid REFERENCES communities(id);
ALTER TABLE stories ADD COLUMN community_id uuid REFERENCES communities(id);

-- 5. Add primary_community_id to profiles
ALTER TABLE profiles ADD COLUMN primary_community_id uuid REFERENCES communities(id);

-- 6. Backfill: assign ALL existing data to the snowboarding community
-- (Run each block separately if you prefer to verify as you go)

-- 6a. Junction tables — enroll every existing entity into snowboarding
--     NOTE: "people" = catalog riders (historical/notable), "profiles" = registered users.
--     Both need community membership. Some profiles also exist in people (deduped by id).
INSERT INTO community_people (community_id, person_id)
SELECT c.id, p.id FROM communities c, people p WHERE c.slug = 'snowboarding'
ON CONFLICT DO NOTHING;

INSERT INTO community_people (community_id, person_id)
SELECT c.id, pr.id FROM communities c, profiles pr WHERE c.slug = 'snowboarding'
ON CONFLICT DO NOTHING;

INSERT INTO community_places (community_id, place_id)
SELECT c.id, p.id FROM communities c, places p WHERE c.slug = 'snowboarding'
ON CONFLICT DO NOTHING;

INSERT INTO community_orgs (community_id, org_id)
SELECT c.id, o.id FROM communities c, orgs o WHERE c.slug = 'snowboarding'
ON CONFLICT DO NOTHING;

INSERT INTO community_boards (community_id, board_id)
SELECT c.id, b.id FROM communities c, boards b WHERE c.slug = 'snowboarding'
ON CONFLICT DO NOTHING;

INSERT INTO community_events (community_id, event_id)
SELECT c.id, e.id FROM communities c, events e WHERE c.slug = 'snowboarding'
ON CONFLICT DO NOTHING;

-- 6b. Tag all existing claims and stories as snowboarding
UPDATE claims
SET community_id = (SELECT id FROM communities WHERE slug = 'snowboarding')
WHERE community_id IS NULL;

UPDATE stories
SET community_id = (SELECT id FROM communities WHERE slug = 'snowboarding')
WHERE community_id IS NULL;

-- 6c. Set primary community for all existing profiles
UPDATE profiles
SET primary_community_id = (SELECT id FROM communities WHERE slug = 'snowboarding')
WHERE primary_community_id IS NULL;

-- 7. Indexes for performance on junction tables
CREATE INDEX idx_community_people_person ON community_people(person_id);
CREATE INDEX idx_community_places_place  ON community_places(place_id);
CREATE INDEX idx_community_orgs_org      ON community_orgs(org_id);
CREATE INDEX idx_community_boards_board  ON community_boards(board_id);
CREATE INDEX idx_community_events_event  ON community_events(event_id);
CREATE INDEX idx_claims_community        ON claims(community_id);
CREATE INDEX idx_stories_community       ON stories(community_id);
