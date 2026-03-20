# Lineage.wtf Roadmap

## What This Is
The definitive record of snowboard history — every board, every maker,
every person who rode them. Community authored, structured by Lineage.
Future partnership with the International Snowboard Museum.

## Stack
- Frontend + logic: Next.js, deployed on Vercel
- Database: Supabase (Postgres + auth + RLS + edge functions)
- Built solo, AI-assisted with Claude Code

## Stage
Proof of concept. Validating core engagement loops before broader launch.

---

## The Three Loops to Prove

These are the heart of the prototype. Everything else serves these.

1. **Personal timeline** — a rider lands on Lineage and immediately starts
   building their own board history. It feels personal from minute one.

2. **Invite loop** — they get excited enough to pull a friend in.
   "You have to add your quiver" is the hook.

3. **Database building** — they naturally start filling gaps. Adding a board
   that's missing, correcting an image, attaching a story. Contributing feels
   good, not like work.

The faster these are proven, the more confidence we have going into launch.

---

## What's Already Built

- Collective timeline — interactive scrubbable graph, 1983–present, across
  Riders, Events, Boards, Brands and Places
- Personal timeline — riders can log boards, places, events
- Compare feature
- Connections / social graph
- Onboarding flow
- Five core database entities: Riders, Events, Boards, Brands, Places
- Admin editor

---

## Current Focus — Board Entry Page Visual Interest

Board entries need to feel alive. The Collective is compelling but individual
board pages are thin. Priority is enriching them with community content.

### Priority 1 — Rider Stories
A story is text + user attribution + optional year and location.
One new table. Immediately adds soul to any board entry.
The most shareable thing on the page — drives the invite loop.

- [ ] `board_stories` table
  - `board_id`, `user_id`, `story_text`, `year_ridden`, `location`, `created_at`
  - RLS: anyone can read, authenticated users can insert their own
- [ ] Add story form on board entry page
- [ ] Stories section displayed on board entry page, attributed with rider profile link

### Priority 2 — Link Attachments
Users submit a URL, Lineage fetches Open Graph data and renders a rich card.
eBay listings, magazine scans, brand archive pages, YouTube reviews.
Better than hosted images — carries context, no copyright or storage risk.

- [ ] `board_links` table
  - `board_id`, `user_id`, `url`, `og_title`, `og_image`, `og_description`, `created_at`
  - RLS: anyone can read, authenticated users can insert their own
- [ ] Supabase edge function to fetch Open Graph data on URL submission
- [ ] Link cards section on board entry page displaying rich previews

### Priority 3 — Image Confirmation
Improve confidence in auto-searched board images using community signals.
Lower impact than stories and links but worth closing the loop on.

- [ ] Thumbs up / flag on current board image
- [ ] Image link submission field — suggest a better image URL
- [ ] Display community-confirmed images over auto-searched ones

---

## Phase 3 — Engagement and Loops (next)
Based on what community response to Phase 2 teaches us.

- [ ] Board completeness indicator — signals gaps, motivates contribution
- [ ] User profiles showing their contributions and stories
- [ ] Activity feed — recent stories, links, board additions
- [ ] "Boards from my era" / discovery features

## Phase 4 — Museum Partnership (future)
When the International Snowboard Museum is ready.

- [ ] Agree on canonical board ID scheme
- [ ] Import format for scanned board records and maker histories
- [ ] Link museum entries to Lineage board pages
- [ ] Co-branded attribution for museum-sourced content

---

## Not Yet
Avoid these until the loops are proven:

- Image uploads (link-first until hosting costs are justified)
- Complex moderation infrastructure
- Scaling or performance optimisation
- Anything that requires more than one user to feel useful

## Design Principles
- The database is authored by the community, Lineage provides the structure
- Link-first for media — avoid hosting costs and copyright risk
- Every feature must work for a community of one before it scales
- Personal before social — riders build their own history first,
  then naturally pull others in
- Each feature closes a loop — users do a thing, it saves, it shows up
  somewhere they care about

## Data Model Notes
*Update as schema evolves — keeps Claude Code consistent across sessions.*

### Core entities
- `boards` — the snowboard database
- `riders` — user profiles and public figures
- `events` — contests, film premieres, cultural moments
- `brands` — manufacturers and sponsors
- `places` — resorts, backcountry zones, spots

### To be added
- `board_stories` — rider stories attached to a board entry
- `board_links` — URL attachments with Open Graph previews
- `board_image_votes` — community confirmation of auto-searched images
