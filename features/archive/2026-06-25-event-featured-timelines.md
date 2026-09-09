# Build Brief: FNRad Featured Timelines (Event + Org Stack View)

> Build-ready Claude Code handoff. Supersedes `Operations/event-featured-timelines-brief.md` (the concept brief) for build purposes. Decisions are locked (June 25 2026 AskUserQuestion round). Pre-flight applied against the live repo; verified facts in §4 carry file:line provenance.
> Drafted: June 25, 2026. Forcing function: FNRad new season, August 2026.
> No em dashes anywhere (standing rule).

---

## 0. Size and shape

This is a multi-session feature, phased into shippable PRs (§7). It is mostly a *generalization* of the existing profile Stack View (PB-010A) to two new owner types (event, org), plus an FNRad show surface and an in-app community-expansion loop. It is not a from-scratch build. Phase 1 is a migration + types foundation; Phases 2 to 4 each ship a usable surface. Start at Phase 1.

---

## 1. What we are building and why

Linestry is the index and the relational graph. A podcast episode names dozens of people, boards, places, and events in passing; today they evaporate. This feature catches them: each episode gets a curated featured set (who and what was discussed), the show (FNRad) gets a branded hub page, and the community expands the web around both.

FNRad (Erik's podcast) is the live proving ground, new season in August. It proves the "interview feeds the graph" thesis with a real partner, and it is the exact surface Jeff Patterson's future interview series and the International Snowboard Museum would later plug into, with no second build. Jeff is a boards-section advisor and ISM a future preservation partner; we are not building the museum here.

---

## 2. Locked decisions (June 25)

1. **FNRad is a media-company Org.** Its detail page doubles as the curated media page and the community hub. FNRad lives inside the snowboarding community; it is NOT its own platform Community.
2. **Episodes are Events** linked to the FNRad org. Each episode page is a curated featured timeline.
3. **v1 includes public chromeless links; anonymous tagging waits.** The show and every episode get a public, login-free `/t/[slug]` link so the URL can be tagged onto show notes, IG, YouTube descriptions, and anywhere the podcast is shared. **Anonymous tag-to-claim** from those public pages is NOT shipped in v1, but it is fully specified in §8 as a **call to make at build time** when the public surface is built (it reuses an existing loop, so the decision is whether to switch it on, not whether to build it).
4. **v1 ships the full surface set:** FNRad show/hub page + episode pages + curated lists at both levels + in-app member contribution + **public chromeless shareable links** for the show and each episode.
5. **Editor-curated.** Jay or a Linestry editor builds each episode's featured set and the show canon. (Giving Erik a scoped editor role is a fast-follow, §8.)
6. **Multiple featured guests per episode** are supported.
7. **Data model: generalize `public_stack_entries` to a polymorphic owner** (`owner_type` in profile/event/org), not parallel tables. Engineering call, carried here.

---

## 3. Architecture in one paragraph

The profile Stack View already stores an owner's curated, ordered set of cards in `public_stack_entries` and renders it through decoupled, store-free components. We widen "whose stack is this" from profile-only to any of {profile, event, org}. An episode (Event) and the show (Org) each own a curated stack the same way a profile does. The episode page and the FNRad org page render that stack in-app. Editors curate via a generalized version of the existing stack picker. The community-expansion loop reuses the Story Connections junction pattern, generalized from stories to events.

---

## 4. Verified facts (provenance)

1. `OrgType = "brand" | "shop" | "team" | "magazine" | "event-series"` (`src/types/index.ts:192`). No media/show value yet.
2. `EventType = "contest" | "film-shoot" | "trip" | "camp" | "gathering"` (`src/types/index.ts:193`). No episode value yet.
3. `public_stack_entries` columns: `id, owner_profile_id, entry_type, entry_ref_id (text, nullable), category_key (nullable), position, custom_title, custom_summary, created_at, updated_at` (`src/types/index.ts:133-144`). Shape enforced by a DB constraint named `public_stack_entry_shape`. `entry_ref_id` is text because catalog ids are mixed-type.
4. `PublicStackEntryType = story|place|event|board|rider|category_summary`; `PublicStackCategoryKey = places|boards|events|riders|stories` (`src/types/index.ts:119-127`).
5. Stack curate backend: `GET/PUT /api/me/stack` (`src/app/api/me/stack/route.ts`). PUT is delete-and-reinsert for the caller, `owner_profile_id` hardcoded to `user.id`, `MAX_ENTRIES=20`, validation mirrors the shape constraint. Public read: `GET /api/public/stack/[slug]` (`src/app/api/public/stack/[slug]/route.ts`). Manage UI: `src/app/me/settings/public-timeline/page.tsx`.
6. Public read resolver: `src/lib/public-timeline-read.ts` is the single slug-to-payload resolver. Reads through `claims_public` / `story_riders_public`; `resolveEnabledProfile()` keys on `profiles.public_slug` + `public_timeline_enabled` + `public_timeline_default_view`. `resolveEntities()` (lines ~235-309) resolves people/places/events/orgs/boards by id, people merged catalog-wins from `people` + `profiles`.
7. Chromeless route + cards: `src/app/t/[slug]/page.tsx` (+ `opengraph-image.tsx`); components in `src/components/public-timeline/` (`stack-view.tsx`, `stack-entry-card.tsx`, `stack-header.tsx`, `stack-timeline-toggle.tsx`, `public-timeline.tsx`, `public-profile-view.tsx`). Store-free, fed a server-resolved payload.
8. Episode page base: events render at `src/app/(community)/[community]/events/[id]/page.tsx`. Predicates `competed_at`/`spectated_at`/`organized_at` drive an attendee list; stories already surface via `StoryCard`; uses `isAuthUser`, `useCanonicalPath`, `eventSlug`/`seriesSlug`, `parseYouTubeId`.
9. Org (show) page base: orgs render at `src/app/(community)/[community]/brands/[slug]/page.tsx` (+ `orgs/[id]/page.tsx` redirect). Orgs are the "brands" surface.
10. Story Connections pattern to mirror: junctions `story_places` / `story_events` / `story_orgs`, each `(story_id, X_id, added_by)`, read in `public-timeline-read.ts` lines ~186-216; riders flow through `story_riders_public` (PB-009 pending pipeline). Removal rights are adder/author/editor. Components: `SearchPicker`, `AddConnectionsPopover` (from the Story Connections work).
11. profiles public columns (PB-010 Phase 1): `public_slug`, `public_timeline_enabled`, `public_timeline_default_view`. (Mirror onto orgs/events only in the fast-follow, not v1.)
12. Entity links: `entityHref(id, type, catalog)` + `CommunityLink`; slug helpers `orgSlug`/`eventSlug`/`seriesSlug` in `entity-links.ts` / `mock-data.ts`.
13. Auth: `requireEditor` / `requireModerator` / `getServiceClient` in `src/lib/auth.ts`; `/admin/*` gated by `requireEditorPage()` in `src/app/admin/layout.tsx`. "Editor" = `is_editor` OR founding tier.
14. Migrations: applied as SQL in the Supabase dashboard (no local migration runner). Surface every migration as copy-paste SQL in the Ship sequence.

---

## 5. Data model changes

### 5.1 Generalize the stack owner (Phase 1, migration)
On `public_stack_entries`:
- Add `owner_type text not null default 'profile'` with a check in (`'profile'`, `'event'`, `'org'`).
- Add `owner_id uuid`.
- Backfill `owner_id = owner_profile_id`, `owner_type = 'profile'` for all existing rows.
- Keep `owner_profile_id` for now (do not drop in this phase) to avoid breaking any unseen reader; new code reads/writes `owner_type` + `owner_id`. A later cleanup can drop it once nothing references it.
- Replace/extend the `public_stack_entry_shape` constraint only if needed for the new columns; do NOT weaken the existing entry_type/ref/category invariant. Add an index on `(owner_type, owner_id, position)`.

This is a **merge-before-migration gate**: the generalized write path will send `owner_type`/`owner_id`, so the migration MUST be applied before the Phase 1 PR merges or stack writes 500 in the window (Group F lesson).

### 5.2 Org: media type (Phase 1)
- Add `"media"` to the `OrgType` union in `src/types/index.ts` and to any org-type UI dropdown/labels. The DB `orgs.org_type` is text, so no DB enum change; just allow and label the value.
- No new org columns for v1 (the show page reuses existing `name`, `logo_url`, description; the canon stack is `public_stack_entries` with `owner_type='org'`). `public_slug`/enabled for chromeless is fast-follow only.

### 5.3 Event: episode type + linkage (Phase 1)
- Add `"episode"` to the `EventType` union (and any UI list).
- Add columns to `events`: `show_org_id uuid` (the FNRad org), `media_url text` (podcast audio/video link), `episode_number int`. Episode date reuses existing `start_date`/`year`.
- New junction `event_guests (event_id uuid, person_id uuid, position int, added_by uuid, created_at timestamptz default now(), primary key (event_id, person_id))` to mark the header guest(s). Editor-managed. Kept separate from attendance claims and from the curated stack so the guest header is unambiguous.

### 5.5 Public chromeless links (Phase 1 columns; render in Phases 2 to 3)
Give orgs and events a public, login-free surface that reuses the `/t/[slug]` chromeless route the same way profiles do.
- Add to `orgs` and to `events`: `public_slug text` and `public_enabled boolean not null default false`.
- **Shared slug namespace.** Extend the existing `src/lib/public-slug.ts` collision-safe minter to allocate across profiles + orgs + events together, so `linestry.com/t/{slug}` stays one consistent shareable shape for people, shows, and episodes and no two owners can collide. Backfill slugs for the FNRad org and its episodes (or mint on first enable).
- **Default view = stack** for org and event owners (the featured set is a stack). Profiles keep their existing `public_timeline_default_view`; non-profile owners do not need that column, default them to stack in code.
- Disabled or unknown slug resolves to null, route returns 404, leaks nothing (mirrors `resolveEnabledProfile`).
- The stack itself is owner-curated, so no `_public` view on the stack table; referenced entities still resolve through the existing visibility-safe reads.

### 5.4 Community-expansion junctions (Phase 4)
Mirror Story Connections, scoped to events:
- `event_people (event_id, person_id, added_by, created_at)` for member-added riders. To stay consistent with PB-009, member-added riders flow through the tag pipeline (pending + `/me/tags`) like story riders; editor-added are approved. (If reusing the tag pipeline proves heavy, fall back to the simpler junction + editor-removal model used for places/events/orgs below; flag this at build time.)
- `event_places (event_id, place_id, added_by)`, `event_events (event_id, related_event_id, added_by)`, `event_orgs (event_id, org_id, added_by)`, `event_boards (event_id, board_id, added_by)`. Removal rights: adder or editor (no separate "author" since the episode has no single author; the show editor stands in).

---

## 6. Surfaces

### 6.1 Episode page (Phase 2)
Extend `events/[id]/page.tsx` with an episode variant when `event_type='episode'`:
- Header: title, episode number, date, guest avatars (from `event_guests`), `media_url` embed (reuse `parseYouTubeId` for YouTube; otherwise a clean outbound link), link back to the FNRad show page.
- Curated featured set: render the event-owned stack (the same card system as the profile Stack View), resolved server-side.
- Community connections section (wired in Phase 4): member-added riders/places/events/orgs/boards with an "add what's missing" affordance.

### 6.2 FNRad show / hub page (Phase 3)
Render an org with `org_type='media'` as a show hub (branch in `brands/[slug]/page.tsx`, or a dedicated `media/[slug]` route if cleaner; decide at build, default to branching the existing org route to avoid new routing):
- Header: show identity (name, logo, description).
- Canon list: the org-owned curated stack (key guests, boards, places, moments).
- Episodes: list every Event with `show_org_id = this org`, newest first, each linking to its episode page.
- Hub affordance: a contribution CTA / challenge prompting members to add what they know.

### 6.3 Editor curation surface (Phases 2 and 3)
Generalize the existing stack picker so an editor can curate a stack for an event or an org, not just their own profile:
- New routes `PUT /api/orgs/[id]/stack` and `PUT /api/events/[id]/stack`, gated by `requireEditor`, writing `public_stack_entries` with the right `owner_type`/`owner_id` (reuse the `/api/me/stack` validation + delete-and-reinsert logic, parameterized on owner).
- A curate entry point for editors on the org and episode pages (reuse the `/me/settings/public-timeline` picker UI, generalized to accept an owner target). Keep `/api/me/stack` behavior unchanged for profiles.

### 6.4 Read path
Generalize `readPublicStack` (and the in-app stack read) in `public-timeline-read.ts` to resolve a stack by `(owner_type, owner_id)`. Curated entries that point at a record which is not visibility-safe drop gracefully (PB-010A behavior, preserve it). The stack table itself is owner-curated (not tag-gated), so no `_public` view on the stack; referenced entities still resolve through the existing visibility-safe reads.

### 6.5 Public chromeless render + share (Phase 2 for episodes, Phase 3 for the show)
The public link is part of v1.
- Extend the `/t/[slug]/page.tsx` resolver to resolve an org or event owner (by `public_slug`, only when `public_enabled = true`) and render its curated stack chromelessly, reusing the existing store-free `stack-view` components. Add a resolution order in `public-timeline-read.ts` (profile, then org, then event) using the shared slug namespace from §5.5.
- Reuse the `/t/[slug]/opengraph-image.tsx` pattern to emit an OG card for org and event owners (show name / episode title + guest), so a shared link unfurls cleanly on IG, X, Facebook, iMessage.
- Owner opt-in + share affordance: an editor toggles `public_enabled` and gets a copy-link control on the in-app show/episode page (mirrors the profile `PATCH`/copy-link from `me/settings/public-timeline`, generalized to the org/event owner and gated by `requireEditor`).
- The public page is read-only in v1. The "add what's missing" affordances stay behind login. See §8 for the anonymous-tagging call.

---

## 7. Phasing (one PR per phase; run the full Ship sequence each)

- **Phase 1 — Foundation (migration + types).** §5.1 stack generalization, §5.2 media org type, §5.3 episode columns + `event_guests`, §5.5 public `public_slug` + `public_enabled` columns on orgs/events + the shared-namespace slug minter + slug backfill. TS types updated. No UI. Hard merge-before-migration gate on §5.1. Acceptance: tsc clean; existing profile stacks still read/write unchanged through `/api/me/stack`; new columns present; slugs minted with no cross-type collision; backfill verified.
- **Phase 2 — Episode pages + event curation + public episode link.** §6.1 in-app episode render, §6.3 event curate route + editor picker, §6.4 event-owned stack read, §6.5 public chromeless episode render + OG card + editor `public_enabled` toggle + copy-link. Acceptance: an editor can build an episode's featured set and publish a public link; a signed-in member sees the in-app episode page (guests, media embed, curated stack); the public `/t/[slug]` link renders read-only and unfurls with an OG card; non-editors cannot curate or publish; disabled link 404s; tsc + eslint clean; no regression on non-episode events.
- **Phase 3 — FNRad show / hub page + org curation + public show link.** §6.2 show page, org curate route + picker, §6.5 public chromeless show render + OG + enable/copy-link. Acceptance: the FNRad org renders as a hub with canon stack + episode list + CTA; the public show `/t/[slug]` link renders read-only; editor can curate the canon and publish; existing brand/org pages unaffected.
- **Phase 4 — In-app community expansion.** §5.4 junctions, member add-connection UI (reuse `SearchPicker` / `AddConnectionsPopover`), editor removal, render in §6.1 connections section. Acceptance: a signed-in member can add a place/event/org/board/rider to an episode; adder + editor can remove; member-added riders respect the tag-pipeline decision in §5.4; tsc + eslint clean.

Each phase is independently shippable and useful. Phases 2 and 3 can swap order. Phase 4 can ship after the season starts if needed.

---

## 8. Deferred, with one call to make at build time

**Anonymous tag-to-claim from the public pages (a build-time decision, not a fast-follow to forget).** The public chromeless show/episode pages ship read-only in v1. Letting a logged-out visitor add themselves or a connection directly from that public page reuses the existing PB-010 Phase 4 loop (`POST /api/public/tag`, ghost + claim + `tag_event`, hashed ip/email throttle, claim-your-spot email), and unclaimed tags already ship hidden-until-claimed, so the moderation surface is contained. **The call to make when the public surface is built (Phase 2):** switch it on for episodes or keep the public page read-only until after the season starts. Recommended default: keep read-only for the August launch, turn it on once a few episodes have public traffic to learn from. This is a one-line capability gate, not new construction.

**True fast-follow / separate briefs (not v1):**
- A scoped editor/owner role so Erik curates FNRad himself.
- The media section (a first-class photo/video content type browsable by photographer/rider/place/board/time) and the photographer rights system.
- Building anything for Jeff / ISM. Jeff is a boards-section advisor; ISM is a future preservation partner secured by a share donation.

---

## 9. FNRad rollout (the August forcing function)

1. Create the FNRad **org** (`org_type='media'`) in the catalog.
2. Build its **canon stack** (a handful of key guests/boards/places).
3. For each episode: create an **Event** (`event_type='episode'`, `show_org_id` = FNRad, `media_url`, date, `episode_number`), set `event_guests`, and curate a small featured set (five entries is enough to prove the loop) from the rundown or transcript.
4. The show page lists episodes; each episode page shows its featured set; members expand via the community section.

Settle with Erik: who supplies each episode's rundown/transcript, and the cadence. Editor-curated for v1, so this is a Linestry-side task with FNRad's input.

---

## 10. Pre-flight SQL (verify against current prod before Phase 1)

Run these reads first; they confirm the assumptions above hold on live data before the migration:

```sql
-- Stack table shape + the named constraint
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'public_stack_entries' order by ordinal_position;

select conname, pg_get_constraintdef(oid)
from pg_constraint where conname = 'public_stack_entry_shape';

-- Confirm orgs.org_type / events.event_type are text (so new values need no enum change)
select table_name, column_name, data_type
from information_schema.columns
where (table_name = 'orgs' and column_name = 'org_type')
   or (table_name = 'events' and column_name = 'event_type');

-- Confirm no FNRad org or episode events exist yet (clean seed)
select id, name, org_type from orgs where name ilike '%fnrad%' or org_type = 'media';
select id, name, event_type from events where event_type = 'episode';

-- Confirm orgs/events do NOT yet have public_slug/public_enabled (Phase 1 adds them),
-- and capture the existing profiles public-slug shape to mirror the minter against.
select table_name, column_name
from information_schema.columns
where column_name in ('public_slug','public_enabled','public_timeline_enabled')
  and table_name in ('profiles','orgs','events')
order by table_name, column_name;
```

The Phase 1 migration SQL (stack owner columns + backfill, media/episode allowances are TS-only, episode columns, `event_guests`) gets written in the Phase 1 session and surfaced as copy-paste SQL in the Ship sequence, applied before merge.

---

## 11. Build-drafting checks applied

Group A schema introspection (stack columns, enums, constraint name verified, §4). Code-path grep (curate save, public read, org/event pages, Story Connections junctions located, §4). Group F migration-before-merge gate flagged on §5.1. `_public` view discipline addressed (§6.4: stack is owner-curated, no view; referenced entities stay visibility-safe). Owner vs editor terminology fixed (curation is editor-gated, members only expand). Open question for build: §5.4 rider tag-pipeline-vs-simple-junction (recommended default given, flag if the pipeline reuse balloons).
