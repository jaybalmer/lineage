# Podcast pass Session C: episode page as a public destination + scheduled release

> **Build-ready Claude Code handoff. Drafted July 31, 2026 (Cowork).**
> Source chain: Jay's July 30 note drop -> `features/podcast-episode-pass-notes.md`
> (F2 + F3) -> this brief. Session A (quick-fix cluster + equity extension) shipped
> as PR #167. Session B (mentions foundation) shipped as PR #168 (migration
> `20260731000001_mentions.sql` live). This is Session C: make the PUBLIC episode
> page (`/t/[slug]`) a real destination that reflects the guest, and add scheduled
> release so an episode can go live at a set time.
>
> **Size: ~4 to 6 hr. One additive migration (`events.publish_at`).**
> **The migration is a HARD PRE-MERGE GATE** (see §4): `EVENT_STACK_COLS` selects
> an explicit column list and a missing column 404s the entire public read, so
> `publish_at` MUST exist in prod before this PR merges. Default order is
> migrate-first, then merge, and here it is mandatory, not optional.
>
> Pre-flight playbook: the 24-check schema/code-path playbook was applied at
> drafting against the live repo (July 31) via a whole-file code survey. Verified
> facts in §3 carry file:line provenance. Anything not verified is tagged
> "verify at build time".

---

## 0. What this delivers

Today the public chromeless episode page (`/t/[slug]` resolving to an
`event_type='episode'` Event) shows only the header + curated featured stack. It
is much thinner than the in-app episode page, which now also shows Mentions
(Session B) and member connections. Being on a podcast is a big deal; the public
page should reflect the guest and everything mapped to the episode.

Session C brings three things to the public episode page and adds scheduling:

1. **Published mentions on the public episode page.** The Session B mentions
   (audio memories with timestamped YouTube links) render on `/t/[slug]`,
   published-only, read-only. This is the payoff surface for the whole mentions
   feature: the shareable link now carries the mapped people/places/brands.
2. **Auto-surfaced linked stories.** Stories that link or tag the episode
   surface on the public page below the curated stack, without needing editor
   curation ("tag the podcast and your story shows up on the episode page").
   Decision locked July 31: yes, auto-surface.
3. **Episode discoverability on the show page.** The show hub lists its episodes
   at the timeline-section level, and public episode links resolve to `/t/[slug]`
   when the episode is public.
4. **Scheduled release (`events.publish_at`).** An episode can be set to go
   public at a future time via a render-time gate; editors always see it before
   then. First scheduling primitive in the codebase.

This is the surface that makes the delete-and-recreate end-to-end test of the
integrated podcast workflow meaningful (Jay's ep-21 page is the test case; see
§8 note).

---

## 1. DECISIONS (review before building)

Locked with Jay:

- **D1. Auto-surface tagged/linked stories on the public episode page** (below
  the curated stack). LOCKED July 31 (yes).

Defaults (shippable as-is; Jay can override in review):

- **D2. Published mentions render on the public episode page**, read-only, using
  the same `MentionRow context="episode"` component from Session B but with the
  editor affordances (Draft badge, edit pencil, Remove) suppressed on the public
  surface. Draft mentions never appear here (published-only server read). This is
  in scope for Session C even though the notes group it loosely; it is the
  natural home for the mentions payoff and is cheap given Session B built the row.
- **D3. Scheduled release is a render-time gate, not a scheduler.** Add
  `events.publish_at timestamptz` (null = manual). "Live" means
  `public_enabled = true AND (publish_at IS NULL OR publish_at <= now())`.
  Editors always see the page (extend the existing `isEditorSession` preview
  branch to also cover scheduled-but-not-yet-live, with a distinct banner). No
  cron, no queue: the gate is evaluated at read time, mirroring the PB-010
  announced-event auto-roll pattern. There is no scheduler infra to add.
- **D4. Episode discoverability = show-page list, not the general Events index.**
  Keep the `events/page.tsx` exclusion of `event_type='episode'` as-is (episodes
  do not belong mixed into the contest/decade Events index). Instead, surface the
  episode list prominently on the show hub (the `PublicShowView` already receives
  `payload.episodes`), and make public episode links resolve to `/t/[slug]` when
  the episode is public. If Jay wants episodes in the Events index behind an
  explicit "Episodes" type filter, that is a small follow, flagged here, NOT built
  this session. (This overrides the loose "un-hiding episodes from the events
  catalog" phrasing in the queue: dumping episodes into the general index mixes
  media with contests and breaks the decade semantics; the show hub stays the
  canonical episode home.)
- **D5. Member-added `EpisodeConnections` stay OFF the public page this session.**
  The public episode page shows curated stack + published mentions + published
  linked stories, all of which are either editor-curated or public-visibility
  gated. Member connections may carry unmoderated third-party content, so they
  are deferred from the public surface. Flag to Jay if he wants them public.
- **D6. Public episode links resolve to `/t/[slug]` when public, else in-app.**
  The show module currently links every episode to the in-app `/events/[id]`
  page via a name slug. When an episode is public, the public-side lists
  (`PublicShowView`, and the show module's public link) point at `/t/[slug]`;
  unpublished episodes keep the in-app link for editors. Small change, keeps the
  shareable URL canonical.
- **D7. Linked-stories read is published-only, capped, read-only.** Reuse the
  `event_id` union (linked_event_id + `story_events`) already in
  `GET /api/stories`, but implement it in the public server read path via the
  service client + `_public` views (the `/t/` page never calls internal HTTP
  routes). Cap the initial render (default 12, newest-first) with a "See all on
  the episode" affordance that deep-links to the in-app episode page. No writing,
  no "I was there" on this list (that CTA is handled elsewhere and was fixed in
  Session A).

---

## 2. Why now

- Session B made mentions real but only in-app. The public `/t/[slug]` link is
  what gets shared to show notes and IG; without mentions and linked stories it
  under-delivers on "the page reflects the guest."
- FNRad Season 12 (Linestry presenting sponsor) commits browsable mentions and
  a per-episode spotlight on the PUBLIC shareable page. This session lights that
  up on the surface listeners actually reach.
- Scheduled release lets episode pages be prepared ahead and go live with the
  episode drop, instead of being toggled by hand at air time.

---

## 3. Verified facts (July 31, live repo, file:line provenance)

1. Public route `src/app/t/[slug]/page.tsx`: resolves profile -> episode -> show
   (body L112-118); editor preview of a not-public page at L120-129 re-reads
   without the enabled gate when `await isEditorSession()` (L124) and passes
   `preview` to the view. Anonymous/non-editor falls to `notFound()` (L130).
2. `PublicEpisodeView` (`src/components/public-timeline/public-episode-view.tsx`)
   renders ONLY the header + guests + media + curated featured `StackView`. It
   does NOT render mentions, member connections, or a linked-stories list. The
   amber "Preview. This page is not public yet" banner renders when `preview` is
   true (around L63-68). Verify exact line numbers at build time.
3. `readEventStack({slug, requireEnabled})` at
   `src/lib/public-timeline-read.ts:1081`; the `public_enabled` gate is L1093
   (`if (opts.requireEnabled && event.public_enabled !== true) return null`).
   `EVENT_STACK_COLS` at L891-892 is an EXPLICIT column list:
   `id, name, description, event_type, year, start_date, episode_number,
   media_url, show_org_id, public_slug, public_enabled`. The file comment
   L888-890 warns that selecting a non-existent column (e.g. `image_url`) 404s
   the whole read. This is why `publish_at` is a hard pre-merge gate (§4).
4. `readEventStack` does NOT read the `mentions` table (zero references in the
   file). Episode payload (`PublicEpisodePayload`, L923-930) carries owner, meta
   (`episode_number`, `media_url`, `date`, `show`, `guests`), resolved curated
   `entries`, `stories`, `entities`. Adding published mentions + linked stories
   means extending this reader.
5. Mentions public read is `GET /api/mentions?episode_id=X` (published-only
   unless editor + `include_drafts=1`), `src/app/api/mentions/route.ts`. The only
   reusable server lib helper is `hydrateEpisodes(rows)` in
   `src/lib/mentions-server.ts:17`. There is NO lib function that returns
   published mentions for an episode, so the `/t/` server component needs a new
   `readPublishedMentions(episodeId)` helper (published-only query +
   `hydrateEpisodes`), OR an inline service-client read in `readEventStack`.
6. `GET /api/stories` `event_id` handling (`src/app/api/stories/route.ts`
   L141-150): union of `linked_event_id` + `story_events` junction ids, with the
   list-path visibility filter `.eq("visibility","public")` (L96). POST does NOT
   stamp `community_id` and only sets the singular `linked_event_id` (L347); the
   `story_events` junction is written by the Story Connections flow, not the
   story POST. The public read path must replicate this union via the service
   client + `_public` views, NOT call the API route (D7).
7. Show module `src/components/orgs/show-module.tsx` renders the episode list
   L155-174, linking each episode via `CommunityLink` to
   `/events/${eventSlug(...) || e.id}` (L160), i.e. the IN-APP page, not `/t/`.
   `PublicShowView` (`src/components/public-timeline/public-show-view.tsx`, not
   read in the survey) renders the public-side episode list; confirm its link
   target at build time (D6).
8. `src/app/(community)/[community]/events/page.tsx:211` filters
   `e.event_type !== "episode"` out of the Events index (deliberate). D4 keeps
   this as-is.
9. `PATCH /api/events/[id]/public-link` (`route.ts` L36-89, `requireEditor`
   L40): accepts `enabled: boolean` OR `mint: true` (L45-49); mints the slug via
   `ensureUniquePublicSlug` (L80) with a 23505 retry (L79, L84). This is where
   `publish_at` handling is added. The `mint`/`enabled` split already models
   "slug exists but not public," so "slug exists, publish_at in future" is a
   natural third mode.
10. No scheduling concept exists anywhere: repo-wide grep for
    `publish_at|release_at|air_date|embargo|scheduled` returned nothing. Session
    C introduces the first one. Confirm no Vercel cron is configured
    (`vercel.json`) at build time; the render-time gate needs none.
11. There is NO `_public` view over `events`; all event reads go direct to
    `db.from("events")` (public-timeline-read L1086/L1141/L1232, public-link
    route L24/L54, mentions-server L23). So `publish_at` is a clean additive
    `ALTER TABLE` with no view rebuild (contrast the Group F
    `claims_public`/`story_riders_public` freeze lesson, which does NOT apply
    here).
12. In-app episode page `src/components/events/episode-page.tsx` section order:
    header + editor controls (L158-223), media embed (L225-244), Featured set
    (L246-264), Mentions "Mentioned in this episode" (L266-288, Session B),
    EpisodeConnections (L290-291). The public page should mirror the read-only
    subset (Featured, then Mentions, then linked stories).
13. `parseYouTubeId` at `src/lib/utils.ts:151`; timestamped link
    `https://www.youtube.com/watch?v={id}&t={seconds}s`. The Session B MentionRow
    already builds "Watch at mm:ss"; reuse it.
14. Episodes flow through the client catalog store; if `publish_at` needs to be
    visible client-side (e.g. for the admin schedule picker state), confirm
    whether the catalog-load/`catalog-junctions` select needs the new column
    (verify at build time; the admin picker can also read it from the
    public-link GET).

---

## 4. Migration: `supabase/migrations/20260731000002_event_publish_at.sql`

> Latest existing migration is `20260731000001_mentions.sql`. Use the next
> ordinal. **HARD PRE-MERGE GATE:** `EVENT_STACK_COLS` will be extended to select
> `publish_at`; a missing column 404s the public read (fact 3). Apply this to prod
> BEFORE merging the PR. There is no `_public` view over events, so no view
> rebuild.

```sql
-- Podcast pass Session C: scheduled episode release.
-- Render-time gate only: an episode is live when
--   public_enabled = true AND (publish_at IS NULL OR publish_at <= now()).
-- No scheduler; the gate is evaluated on read (PB-010 announced-event pattern).
-- Additive, nullable. Existing episodes keep publish_at = NULL (manual behavior
-- unchanged).

alter table public.events
  add column if not exists publish_at timestamptz;

comment on column public.events.publish_at is
  'Scheduled public release for episodes. NULL = manual. Live gate is public_enabled AND (publish_at IS NULL OR publish_at <= now()); evaluated at read time, editors bypass.';
```

Rollback: `alter table public.events drop column if exists publish_at;`

---

## 5. Types (`src/types/index.ts`)

Add to the `Event` interface (near `public_enabled`, L434):

```typescript
publish_at?: string | null   // ISO timestamp; scheduled public release, null = manual
```

No new interfaces. The public read payloads already carry `stories` and gain a
`mentions` field:

```typescript
// on PublicEpisodePayload (public-timeline-read.ts ~L923)
mentions?: Mention[]   // published only, hydrated with episode context
```

---

## 6. API + read-path changes

| Change | Where | Notes |
|---|---|---|
| `publish_at` accepted on save | `PATCH /api/events/[id]/public-link` (route L36-89) | accept optional `publish_at: string \| null`; write it in the events update alongside `public_enabled`. Sending it is conditional (only when the key is present), so the write path does NOT send it unconditionally; the pre-merge gate comes from the READ select (§4), not this write. |
| live gate includes schedule | `readEventStack` gate (L1093) + the `/t/[slug]` editor-preview branch (page L120-129) | `requireEnabled` now means `public_enabled === true AND (publish_at == null OR publish_at <= now())`. Editors still bypass via the preview re-read; give scheduled-but-future its own banner copy ("Scheduled. Goes public on <date>.") distinct from the never-published preview banner. |
| published mentions in payload | new `readPublishedMentions(episodeId)` in `mentions-server.ts` (or inline in `readEventStack`) | published-only, `hydrateEpisodes` for the link context; attach to `PublicEpisodePayload.mentions`. |
| linked stories in payload | `readEventStack` | replicate the `event_id` union (linked_event_id + `story_events`) via service client + `_public` views, `visibility='public'`, newest-first, cap 12 (D7). Do NOT call `GET /api/stories`. |
| `EVENT_STACK_COLS` gains `publish_at` | `public-timeline-read.ts:891-892` | the reason for the pre-merge gate. |
| public episode link target | `PublicShowView` + show-module public link (D6) | point at `/t/[slug]` when the episode is public. |

Route notes:
- The public read stays a server-component read through the service client and
  `_public` views; no new public HTTP route is required.
- The admin schedule control (a datetime picker) sits on the existing episode
  editor "Public link" control in `episode-page.tsx` (L158-223) and posts to the
  same `public-link` PATCH. Clearing the picker sends `publish_at: null`.

---

## 7. UI work

### 7a. Public episode page (`PublicEpisodeView`)
Add, below the curated Featured `StackView`, in this order:
1. **Mentions** section: published `MentionRow context="episode"` rows in
   timestamp order, editor affordances suppressed (no Draft badge, pencil, or
   Remove on the public surface). Hidden entirely when there are no published
   mentions.
2. **Linked stories** section: the capped published linked-stories list as
   read-only story cards (reuse the existing public story rendering used
   elsewhere on `/t/`), newest-first, with "See all on the episode" deep-linking
   to the in-app episode page when the count exceeds the cap. Hidden when empty.
Keep the chromeless styling; do not introduce `.postcard` dark-mode overrides.

### 7b. Scheduled-release editor control (`episode-page.tsx`)
On the episode editor controls row, add a datetime picker beside the Public link
toggle: "Publish at (optional)". Setting a future time with the page enabled
means the page is live to editors (with the scheduled banner) and goes public at
that time. Show the resolved state inline ("Scheduled: goes public <date>" /
"Public" / "Not public"). Empty picker = manual (publish_at null).

### 7c. Preview/scheduled banners (`PublicEpisodeView` preview branch)
Two distinct editor-only banners: existing "Preview. This page is not public
yet." for `public_enabled=false`, and a new "Scheduled. Goes public on <date>."
for `public_enabled=true AND publish_at > now()`. Both editor-only; anonymous
visitors get `notFound()` until the page is genuinely live.

### 7d. Show-page episode list (D4/D6)
Ensure the show hub surfaces the episode list prominently (it already receives
`payload.episodes`); link public episodes to `/t/[slug]`. No change to the
Events index.

---

## 8. Out of scope (hard list)
- Member-added `EpisodeConnections` on the public page (D5).
- Episodes in the general Events index / relaxing the `events/page.tsx` filter
  (D4); a type-filtered Episodes view is a future follow.
- The transcript-to-mentions skill + seed import: Session D.
- Any new mention authoring (Session B owns creation; this session only reads
  published mentions on the public surface).
- A real scheduler / cron / queue (render-time gate only, D3).
- Non-YouTube timestamped links, audio playback.
- Backfill or seeding of real FNRad episodes (separate content task).

> **End-to-end test note.** Jay's existing ep-21 page
> (`/snowboarding/events/FNRad_Jay_Balmer`) was authored by hand and predates the
> integrated workflow, so it is not a clean test. The plan (Jay, July 31) is to
> delete it and recreate it end-to-end once Session C and Session D are built:
> author the page (existing PR #144 flow), import mentions (Session D skill),
> publish, and confirm the public destination renders mentions + linked stories.
> This session should leave that recreate path working; the verified entity list
> for ep-21 is in Drive `FN-Rad-Podcast-Mentions-Linestry.xlsx`.

---

## 9. Acceptance criteria
A1. Migration applies clean; `information_schema` shows `events.publish_at`;
    existing episodes read back with `publish_at = NULL` and render exactly as
    today.
A2. A published mention on an episode appears on that episode's PUBLIC
    `/t/[slug]` page in timestamp order, read-only, with a working "Watch at
    mm:ss" link. No editor affordances render for an anonymous visitor.
A3. A draft mention does NOT appear on the public page for anyone (including an
    editor viewing the public surface); it still shows in-app per Session B.
A4. A public story that links/tags the episode auto-surfaces on the public page
    below the curated stack, newest-first, capped, with "See all on the episode".
    A private/unlisted story does not appear.
A5. Setting `publish_at` to a future time on an enabled episode: an anonymous
    visitor gets `notFound()`; an editor sees the page with the "Scheduled" banner.
    After the time passes (or setting it to the past), the anonymous visitor sees
    the live page. No deploy or cron needed.
A6. Clearing the schedule (`publish_at = null`) restores manual behavior: enabled
    = live immediately, disabled = not public.
A7. Public episode links from the show page resolve to `/t/[slug]` for public
    episodes; unpublished episodes keep the in-app link for editors.
A8. An episode with zero mentions and zero linked stories renders the public page
    byte-identical to today (only header + curated stack).
A9. `npx tsc --noEmit` clean; no em dashes in any new user-visible string.

---

## 10. Suggested order
1. Pre-flight reads (§11), then the migration; apply to prod (pre-merge gate).
2. Type + `EVENT_STACK_COLS` + `publish_at` on the public-link PATCH + the live
   gate in `readEventStack` and the `/t/` editor-preview branch (schedule
   plumbing first, since the read select is the gate).
3. `readPublishedMentions` + attach to the episode payload; render the Mentions
   section on `PublicEpisodeView`.
4. Linked-stories union in the public read + render the linked-stories section.
5. Editor schedule picker + banners; show-page public link target (D6).
6. Acceptance A1 to A9, tsc, PR, Ship sequence (surface the migration SQL in
   chat, confirm applied BEFORE merge given the hard gate, prompt the merge,
   SHIP-LOG `type: feature`, `scope: podcast-episode-destination`).

## 11. Builder pre-flight (before writing code)
- Whole-file reads: `public-timeline-read.ts` (esp. `readEventStack` L1081-1140
  and `EVENT_STACK_COLS`), `public-episode-view.tsx`, `public-show-view.tsx`,
  `t/[slug]/page.tsx`, `api/events/[id]/public-link/route.ts`,
  `api/stories/route.ts` (the `event_id` union L141-150), and
  `episode-page.tsx`.
- Confirm the `story_events` + `stories_public`/visibility read shape used
  elsewhere in `/t/` so the linked-stories union matches the existing public
  story read (do not introduce a new visibility path).
- Confirm no Vercel cron (`vercel.json`); the gate is render-time.
- Confirm whether the client catalog-load select needs `publish_at` (fact 14),
  or whether the admin picker reads it from the public-link GET.
- Dev server for smoke runs from the WORKTREE path, not `~/lineage`; stop any
  stale dev server first so port 3000 binds to the worktree instance.
- Test data: create a throwaway media show + episode via Brands -> + New show ->
  + Add episode; add one published + one draft mention; link one public story;
  delete after the pass.

## 12. Post-deploy assertions
```sql
-- column landed
select column_name from information_schema.columns
where table_name = 'events' and column_name = 'publish_at';  -- expect 1 row

-- no episode accidentally scheduled by the migration (all NULL after add)
select count(*) from public.events where publish_at is not null;  -- expect 0 pre-use
```
Both true-by-construction on day one (additive nullable column); no assertion is
noisy from the start (playbook check 9).
