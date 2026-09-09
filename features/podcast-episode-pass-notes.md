# Podcast / Episode pass: synthesis of Jay's July 30 note drop

> Status: PRE-BRIEF NOTES, not build-ready. Staged by a Claude Code planning session
> (July 30, 2026) from Jay's raw notes plus a two-agent code survey. Cowork should
> draft build-ready briefs from this; nothing here is queued or ordered yet.
> Everything below is grounded in file:line evidence from the survey.

---

## 1. Premise correction: what already exists

FNRad support is further along than the notes assume. Shipped in PR #139/#140/#142/#143 (+ authoring PR #144):

- An episode IS an Event (`event_type: "episode"`, `src/types/index.ts:222`) with `show_org_id`, `media_url`, `episode_number`, `public_slug`, `public_enabled` (types L424-434).
- A show IS an Org (`org_type: "media"`, L218). No separate episodes table, no EventSeries involvement.
- `event_guests` junction (L157-170), editor-managed, separate from attendance claims.
- Public chromeless pages at `/t/[slug]` for both episodes and shows (resolution order profile -> episode -> show in `src/app/t/[slug]/page.tsx:29-126`), curated via the shared stack (`public_stack_entries`, `MAX_ENTRIES = 20`, editor-only PUT routes).
- In-app authoring: Brands -> + New show -> + Add episode -> curate -> publish (ShowModule + EpisodeView, `POST /api/admin/show-episode`).

So "do a pass on podcast and episode features" means: fix the sharp edges in what shipped, then build the second wave (mentions, scheduled release, episode discoverability), not model podcasts from scratch.

---

## 2. Confirmed bugs (root-caused, ready for a bugfix cluster)

### B1. Tab title shows "Evt 1782850803307 Apuqit" (Jay reported; fully root-caused)
- Episode/show ids come from `genId()` in `src/app/api/admin/show-episode/route.ts:19-21`: `evt_${Date.now()}_${rand}`.
- `src/lib/entity-metadata.ts` builds the tab title from the URL param with no DB read; its `UUID_RE` (L17) only recognizes UUIDs as unhumanizable, so `humanizeSlug` (L38-46) title-cases the raw id into "Evt 1782850803307 A1b2c3".
- The show hub is the only surface emitting raw-id links: `src/components/orgs/show-module.tsx:140` (`/events/${e.id}`) and L92 (post-create route). Everywhere else uses `eventSlug()`.
- `useCanonicalPath` rewrites the address bar via history.replaceState but Next does NOT recompute generateMetadata, so the title stays wrong even after the URL fixes itself. This is why it "doesn't happen on the public link" (the /t/ page has its own metadata).
- Bonus: `entity-metadata.ts:33` description is contest-flavored ("who competed, who showed up") for all event types; no episode variant.
- Fix shape: (a) emit `eventSlug()` from show-module links, (b) broaden the generated-id pattern (`/^(evt|org|board)_\d{13}_/`) so raw ids fall back to the type label, (c) optionally add an episode entry to TYPE_DESC.

### B2. "I was there" on published episode/show pages is a DEAD CTA (highest severity)
- `stack-entry-card.tsx:215-217` renders IWasThere on event/org stacks, passing the EVENT's `public_slug` as `ownerSlug`.
- `POST /api/public/tag` (route.ts:104-108) resolves the slug via profile-only `readPublicTimeline()`, so every submission from an episode/show page 404s ("Could not save your mark"). PB-010 Phase 4a was never generalized when owner types were.
- The moment-validation block (route.ts:115-121) also has no event/org analogue.

### B3. Duplicate "I was there" claims (Jay reported)
- IWasThere is offered unconditionally: no check anywhere (component, read layer, or tag route) for an existing claim/tag linking the viewer to the moment. Server side inserts a fresh claim + tag_event every time (route.ts:232, 256); only abuse throttles guard it.
- Jay's ask: signed-in viewers (especially the profile owner or an already-linked person) should see their link status instead of the CTA; anonymous repeat-submits should at least dedupe server-side on (ghost email, moment).
- Note: solving "show my link status" properly needs viewer identity on what is today an anonymous island on a server-rendered page. Cheapest correct slice: pass viewer claim refs into the page when a session exists, and server-side dedupe for anon.

### B4. Preview unavailable when page is not public (Jay reported; confirmed gap)
- Visibility is a single `public_enabled` boolean (PATCH `/api/events/[id]/public-link`). Slug is minted on first enable. The "Preview" link on episode-page.tsx:155 / show-module.tsx:112 points at the public /t/ page, which requires `public_enabled`, so preview before publish is impossible.
- Fix shape: allow editors (requireEditor session) to view the /t/ page for a disabled owner, or mint a preview token. Pairs naturally with F3 below.

### B5. Stale equity copy: "Next distribution: April 2026"
- `src/app/people/[id]/page.tsx:582`, hardcoded, contradicts every other surface. Fix alongside the equity change below.

---

## 3. Equity offer change (explicit request: extend to end of FNRad Season 12)

Survey of every deadline surface:
- Machine value: `EQUITY_SNAPSHOT_DATE = "2026-09-30"` + `EQUITY_SNAPSHOT_LABEL` in `src/lib/equity-offer.ts:11-12`. The ONLY behavioral consumer is `intro-slideshow.tsx:44` (screen gate). `isEquityEligible` and `estimateShares` have no time gate.
- Six hardcoded date strings bypass the constants: `equity/page.tsx:18` (comment), `:89` ("First distribution September 2026"), `:102` (SEP 30 / 2026 stat tile), `membership/page.tsx:110` and `:392`, `people/[id]/page.tsx:582` (the stale April one).
- There is NO season model anywhere (no season field on events or orgs), so "end of Season 12" cannot be resolved from data. Jay must supply the concrete end-of-season date.

Recommended shape (needs Jay's date):
1. Set `EQUITY_SNAPSHOT_DATE` to the real end-of-Season-12 date; keep it the machine gate.
2. Reword `EQUITY_SNAPSHOT_LABEL` to season phrasing, e.g. "the end of FNRad Season 12"; add a second constant for the exact-date sub-line ("Balances recorded <date> at 23:59 UTC") since several sentences assume a literal date.
3. Replace all six hardcoded strings with the constants so this never drifts again.
4. Copy-only + one-constant change, no migration. Could ride in the same PR as the bug cluster.

OPEN DECISION for Jay: what is the actual end date of Season 12?

---

## 4. Second-wave features (need briefs; decisions flagged)

### F1. Mentions as a timeline row (the big one)
Vision: every podcast mention of a person/place/brand/event is an "audio memory", surfaced as a small timeline row ("Mention by Jay Balmer on FNRad Podcast"), expandable to show the transcript excerpt, with a timestamped YouTube link (and audio play later). Appears on the episode timeline AND the mentioned entity's timeline; filterable; viewable all together.

Code reality: stories are one flat type, NO kind/type column (`src/types/index.ts:621-665`). Two modeling options:
- Option A, story kind: add `stories.kind` ('story' | 'mention') + mention fields (source_event_id, timestamp_seconds, transcript_excerpt). Pro: rides every existing surface (feed, timelines, /t/ stacks, reactions). Con: mentions are admin-curated third-party artifacts, not first-person narratives; visibility/authorship semantics differ; card design differs (small row vs full postcard).
- Option B, dedicated `mentions` table: (episode_event_id, subject_type, subject_id, timestamp_seconds, excerpt, youtube_url_at_ts, status). Pro: clean admin curation + review workflow, natural dedupe, per-subject fan-out without junction gymnastics. Con: every timeline surface needs a new renderer + merge.
- RECOMMENDED DEFAULT: Option B table + a compact MentionRow renderer merged into timeline grouping, because the curation workflow (draft -> reviewed -> published) and the many-subjects-per-episode shape fit a table much better than authored stories. The "story post per episode" from the notes stays a normal story linked to the episode.
- Timestamped link is trivial: youtube.com/watch?v=ID&t=123s off existing `media_url` + parseYouTubeId.

### F2. Episode page as a destination (guest-worthy)
- Notes: "being on a podcast is a big deal; the page reflects the guest". Today the public episode page is header + curated stack only.
- Gap found: the public /t/ episode page shows ONLY curated stack entries, while the in-app episode page auto-fetches all linked stories (`GET /api/stories?event_id=`, union of linked_event_id + community_events at `api/stories/route.ts:148-149`). The two surfaces disagree about what belongs to an episode. DECISION: should tagged/linked stories auto-surface on the public episode page (below the curated stack), so "tag the podcast and the story shows up on the episode page" works without editor curation?
- Episode list belongs at the timeline-section level on the show page (per notes: same interaction level as the timeline view buttons).
- Episodes are hidden from the events catalog (`events/page.tsx:211` filters out `event_type === "episode"`), so the show hub is the ONLY path to an episode, which compounds bug B1.

### F3. Scheduled release + preview tier
- Zero scheduling concepts exist (grep for publish_at/release_at/embargo/air_date: nothing). An episode goes live the instant the box is ticked.
- Proposal: `events.publish_at` (null = manual), /t/ read gates on `public_enabled AND (publish_at IS NULL OR publish_at <= now())`, editors always see it (which also solves B4 preview). Admin UI: datetime picker on the episode publish toggle.

### F4. Media community type: RECOMMEND AGAINST for now
- Nothing in the codebase branches on community `type` except a cosmetic pill in the community switcher. Adding `"media"` to the union buys nothing until branching is written.
- The media model already lives at the org layer (show org + episode events), which is the right home. If FNRad needs its own browse surface, the leverage is a Media index page (shows + episodes) plus `noun_map` labels, not a new community type.
- Naming hazard: "media" already means three things in the type layer (OrgType, BrandCategory, Org.brand_media). A fourth sense would bite.

### F5. Podcast transcript session skill (authoring workflow)
- Jay's intended workflow: "kick off a podcast session, drop the YouTube link" in Claude Code (NOT in-app AI). Skill pulls the transcript, drafts a mention list, Jay scrubs/corrects names and connections, and the finished output is a seed file that pushes into production (aligns with F1 Option B: rows insert as status='draft' or via a reviewed JSON seed).
- This is a `.claude/skills/` authoring artifact + a seed-file format + an idempotent import path, not app code. Design after F1 fixes the mention schema.
- Archive goal: this year's episodes done well at release, then backfill the full available archive, mapping all mentions into the graph.

---

## 5. Suggested sequencing

1. **Session A (quick-fix cluster, no migration expected):** B1 + B2 + B3 (server dedupe slice) + B4 (editor preview) + B5 + the equity date/copy change (needs Jay's Season 12 end date). All root-caused above.
2. **Session B (mentions foundation):** F1 schema + admin entry surface + MentionRow on episode/person timelines. One migration.
3. **Session C (episode page pass):** F2 auto-surfaced tagged stories + episode list placement + F3 publish_at.
4. **Session D (skill):** F5 transcript-to-mentions skill + seed import, once F1's shape is real.

Open decisions for Jay: Season 12 end date (sec 3); mention model A vs B (sec 4 F1, default B); auto-surface tagged stories on public episode pages (F2, default yes); Media community type deferred (F4, default agree).
