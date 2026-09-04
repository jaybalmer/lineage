# Ship log

> Append-only record of what each Claude Code build session shipped: **bug-fix
> sessions and feature sessions both**. This is the machine-readable cross-cut the
> daily Cowork reconcile reads to close the loop. Bug sessions already reconcile
> through `bug-triage.md` (Queue to Shipped, keyed on `BUG-NNN` in the merged-PR
> message); feature sessions had no equivalent sweep, and this file is that sweep.
>
> **Chronological, newest at the bottom. Append only; never rewrite earlier entries.**
> The only edit allowed to an existing entry is flipping `status: pending` to
> `status: merged` (and filling the PR number / squash sha) during reconcile.
>
> Lives in `bugs/` (gitignored, local only), next to `bug-triage.md`. Not committed.

---

## How it gets written

Two writers, one safety net:

1. **The build agent (normal path).** At the end of any session that shipped
   something, Claude Code appends a full entry using the schema below. The agent
   knows the PR number it just opened, so it fills `pr:` directly. The repo
   `CLAUDE.md` and `NEXT-SESSION.md` standing rules tell it to do this.
2. **SessionEnd hook (safety net).** If the agent forgot, a `SessionEnd` hook in
   `.claude/settings.json` auto-appends a minimal **PENDING auto-stub** (branch,
   sha, any `BUG-NNN` ids found in the branch commits). It is idempotent: it skips
   if the branch is already named in this file, or if the branch is not ahead of
   `main`. So a question-only session writes nothing.
3. **Cowork reconcile (backstop).** The daily triage reads `git log main` for
   merged PRs (`(#NN)` plus `BUG-NNN` ids and `feat`/`fix` subjects), flips the
   matching entry to `status: merged` with the PR number, expands any auto-stub to
   a real one-line summary, and catches anything both writers missed. This is the
   Option 3 git-log sweep, now covering features as well as bugs.

## Entry schema

```
## YYYY-MM-DD - <short title> (<type>)
- type: bug | feature | chore
- pr: #NN            (or "(open PR)" until merged)
- branch: <branch name>
- ids: BUG-001, BUG-002   (or "none")
- scope: <slug>      (feature/chore only, optional; omit for bugs)
- migration: none | applied <file> | DEFERRED <file>
- status: pending | merged
- tsc: clean | n/a

<one or two sentences, house style: what shipped and why. No em dashes.>
```

Field notes: `ids` is what the bug reconcile greps, so always list every `BUG-NNN`
the session closed. `type: feature` (or `chore`) with `ids: none` is what closes the
feature-sweep gap.

`migration:` records the deploy gate so it is never left silently outstanding.
`none` when no SQL was needed; `applied <file>` once Jay has run it in Supabase
during the session; `DEFERRED <file>` only if Jay explicitly chose to run it later.

`status:` is now normally `merged` at session end, because the Ship sequence
(see the repo `CLAUDE.md`) walks Jay through the migration and the merge live before
the session wraps. Write `merged` with the real PR number once he confirms the merge.
Fall back to `pending` only when Jay defers the merge; the daily reconcile flips
those. The `SessionEnd` auto-stub still writes `pending` when the agent forgot to log.

---

## Entries

## 2026-06-10 - Bug-fix session 1 (bug)
- type: bug
- pr: #54
- branch: bugfix/session-1
- ids: BUG-022, BUG-015, BUG-013
- status: merged
- tsc: clean

Event Add People wrote through an authed POST /api/claims (server-side PB-008/PB-009 fan-out); shared member-card CTA repointed to /onboarding; feed event-link 404s fixed (catalog wins the mock merge). Plus the replay-timestamp capture change. Needs migration-011 (additive).

## 2026-06-11 - Store dead-write fix (chore)
- type: chore
- pr: #55
- branch: fix/store-dead-writes
- ids: none
- scope: store-persistence
- status: merged
- tsc: clean

Follow-up from session 1, no BUG-ID. updateClaim / removeRidingDay / updateRidingDay built Supabase queries that never executed; added PATCH/DELETE /api/claims/[id] so members can edit and delete their own claims.

## 2026-06-11 - Bug-fix session 2, tag-derived connections (bug)
- type: bug
- pr: #56
- branch: bugfix/session-2
- ids: BUG-014, BUG-023
- status: merged
- tsc: clean

Tag-derived relationships now surface on Compare and Connections (symmetric subject-or-object reads plus a new connection-derived overlap path through the _public views); Rode With quick-add shows a pending clock instead of a false success checkmark.

## 2026-06-11 - Board shelf + simplified board add (feature)
- type: feature
- pr: #58
- branch: feat/boards-timeline-redesign
- ids: none
- scope: board-shelf
- status: merged
- tsc: clean

Boards pulled out of the decade timeline into an image-forward BoardShelf (All/Rode/Collection toggle, model-year sort); simplified add (relationship plus optional year); new claims.board_relationship column. migration-012 applied. Docs follow-up in PR #59.

## 2026-06-11 - Bug-fix session 3, catalog-create + event dates (bug)
- type: bug
- pr: #57
- branch: bugfix/session-3
- ids: BUG-027, BUG-028, BUG-031
- status: merged
- tsc: clean

Shops now render on the brands list; nested catalog-create modal raised above its parent and persists; partial event dates no longer render NaN/undefined.

## 2026-06-12 - Bug-fix session 4, P2 batch subset (bug)
- type: bug
- pr: #60
- branch: bugfix/session-4
- ids: BUG-026, BUG-030, BUG-032
- status: merged
- tsc: clean

Place photo-upload Save kept inside the mobile frame; event Edit gated to creator-or-editor (enforced server-side); board model years de-duplicated in the picker.

## 2026-06-12 - Token earn model + equity offer (feature)
- type: feature
- pr: #61
- branch: feat/token-earn-equity
- ids: BUG-012
- scope: tokens-equity
- status: merged
- tsc: clean

Contribution-earning, daily-visit reward, founding member-token accrual, and the equity-offer repositioning. migration-013 plus backfill applied to prod. Closes BUG-012.

## 2026-06-12 - Tier grant rebalance (feature)
- type: feature
- pr: #62
- branch: feat/tier-grant-rebalance
- ids: none
- scope: tier-grants
- status: merged
- tsc: clean

Rebalanced tier token grants (annual 10 to 20, lifetime 30 to 70). Feature tweak, no bugs.

## 2026-06-13 - Admin grant ledger dedupe (bug)
- type: bug
- pr: #63
- branch: fix/admin-grant-dedupe
- ids: BUG-036
- status: merged
- tsc: clean

Admin token Grant was not idempotent; a double-submit appended phantom token_events rows. Fixed on the grant path. Relevant because that ledger feeds the equity calc.

## 2026-06-13 - Founding number assignment (bug)
- type: bug
- pr: #64
- branch: fix/founding-number
- ids: BUG-037
- status: merged
- tsc: clean

Founding member numbers now assign by max+1 and clear on downgrade. One acceptance line only partially met (concurrent signups can still read the same max); carved out under the Shipped entry, not reopened.

## 2026-06-13 - Profile + timeline trio (bug)
- type: bug
- pr: #65
- branch: fix/profile-timeline-trio
- ids: BUG-033, BUG-034, BUG-035
- status: merged
- tsc: clean

Public profile summary card no longer owner-only (BUG-035); profile stat tiles clickable (BUG-034); single-date claims stop rendering "to present" (BUG-033).

## 2026-06-13 - Community landing redesign Phase 1 (feature)
- type: feature
- pr: #66
- branch: feat/community-landing-redesign
- ids: none
- scope: community-timeline
- status: merged
- tsc: clean

/snowboarding is now a decade-grouped community timeline of public stories plus historical events (All/Stories/Events pills, Newest/Oldest/Most-connections sorts); removed Latest Stories / Recent Activity / Top Connections. New community-timeline.tsx, timeline-event-card.tsx, timeline-grouping.ts. No migration. PR up and verified, awaiting Jay's merge.

## 2026-06-13 - Community landing redesign Phase 2 (feature)
- type: feature
- pr: #67
- branch: feat/community-landing-phase2
- ids: none
- scope: community-landing-images-player
- status: merged
- tsc: clean

Community landing Phase 2: admin-set hero + avatar images for each community (additive migration 20260613000001 on communities, /admin/community editor screen, PATCH /api/admin/communities), the landing page renders the hero band + avatar with a color-dot fallback, and a public community timeline player launches from a Play button. TimelinePlayer was refactored into a reusable TimelinePlayerShell with personal play verified byte-for-byte unchanged. Migration must be applied to prod before merge; admin-upload and hero-render verification still pending post-migration. PR up, awaiting Jay's migration + merge.

## 2026-06-14 - /membership logged-out cluster (bug)
- type: bug
- pr: #68
- branch: fix/membership-loggedout
- ids: BUG-039, BUG-040
- status: merged
- tsc: clean

Fixed the launch-facing /membership logged-out experience. Relabeled the equity launch offer pool as "common shares" (not "founding shares") on /membership, /equity, and /account/membership, since FOUNDING is a membership tier and not a share class (BUG-039). Added a Membership link to the logged-out guest menu, under Sign in (BUG-040a). Gated the active-tier check on an authenticated user (authReady + isAuthUser) so logged-out visitors no longer see the Free tier marked "YOUR TIER" / "Active" and instead get a Sign in CTA, with paid tiers keeping their CTAs (BUG-040b). Pure client/UI, no migration. Verified logged-out in the dev preview; tsc clean.

## 2026-06-14 - List-page label and count polish (bug)
- type: bug
- pr: #69
- branch: fix/list-page-labels
- ids: BUG-016, BUG-019, BUG-021
- status: merged
- tsc: clean

Three small list-page fixes. The People category tab no longer flips from the community word ("Riders") to the global "People" when you open the top-level /people route: activeCommunity now resolves on the /people route too, so the label is constant idle and active (BUG-016). The /people header reworded from "N riders in the community graph" to "in the community" since the count is the directory length (already matching the rows rendered), not a graph-membership count; applied the same reword to the identical brands-page phrase for consistency (BUG-019). Event decade group labels render "1990s" again instead of "1990S": SectionDivider got an uppercase={false} opt-out used only for the decade label, word dividers keep small-caps (BUG-021). Pure client/UI, no migration. BUG-016 verified by logic + tsc (the "Riders" noun_map override is authed DB data, not present in the anon preview); BUG-019 and BUG-021 verified live in the dev preview.

## 2026-06-14 - Timeline player audio volume (bug)
- type: bug
- pr: #70
- branch: auto/bugfix-20260614-1142
- ids: BUG-041
- status: merged
- tsc: clean

Lowered the timeline player's default ambient music master gain from 0.45 to 0.22 in the shared useAmbientAudio hook (timeline-player.tsx) so the synthesized soundtrack sits under the moment on a phone at normal-to-low system volume. Master-only trim per the brief, so the pad/bass/reverb balance is unchanged; the existing Mute (M) toggle still works. Shared by all three play surfaces, so personal play is fixed now and community play inherits it when PR #67 lands. Pure client, no migration.

## 2026-06-14 - Wordmark in Calendula Bold (feature)
- type: feature
- pr: #71
- branch: feature/wordmark-calendula-font
- ids: none
- scope: wordmark-calendula-font
- status: merged
- tsc: clean

Swapped the "Linestry" wordmark from inherited Geologica to the licensed Calendula Bold, self-hosted via next/font/local as a new --font-wordmark variable applied to the header logo (nav.tsx) and homepage hero (page.tsx) wordmark text only; the accent dot, headings, body, decade labels, and the nav community name all stay Geologica. The root OG image (opengraph-image.tsx) reads the bundled Calendula-Bold.ttf server-side because Satori cannot parse woff2, with a graceful fallback to the prior Geologica 800 fetch, and next.config outputFileTracingIncludes pins the .ttf into the Vercel function bundle. Committed both font files under src/app/fonts/ (were untracked). Verified header, hero, dark mode, and the live OG PNG all render Calendula; measured identical glyph widths at weight 700/800/900 so font-black triggers no faux-bold synthesis on the single-weight face, leaving existing weight classes as is. The /word dictionary headword is intentionally left in Geologica (out of scope). No schema, no migration.

## 2026-06-15 - Adding a brand fails (bug)
- type: bug
- pr: #72
- branch: auto/bugfix-20260615-0500
- ids: BUG-042
- status: merged
- tsc: clean

Members could not add a board brand on /snowboarding/brands: addUserOrg in the Zustand store still POSTed to the requireEditor-gated /api/admin, so a non-editor got a 403, the optimistic insert rolled back, and the "Failed to save brand" toast fired. Repointed addUserOrg to the member-allowed /api/catalog/entity route with type "org" (matching addUserPlace / addUserBoard), and added an org branch to that route that whitelists id/name/org_type/brand_category/founded_year/country/website/description, stamps community_status='unverified' and added_by server-side, dedups on name, and awards a contribution token like place/board/event adds. Dropped the client-supplied added_by. No migration, no _public view change.

## 2026-06-15 - P1 batch: mobile story menu + comment-email reliability (bug)
- type: bug
- pr: #73
- branch: fix/bug-044-045-story-menu-comment-email
- ids: BUG-044, BUG-045
- status: merged
- tsc: clean

BUG-044: the story owner edit/delete (3-dots) trigger was opacity-0 group-hover:opacity-100, invisible on touch; gated the hover-reveal behind (hover: hover) and kept it visible (muted) on (hover: none), so mobile owners can reach edit/delete. Desktop hover-reveal unchanged; verified via the compiled CSS. BUG-045 (reliability): fireCommentNotification committed the 6h batch window before confirming the Resend send, so a failed send silently suppressed comment emails for 6h; now the window is committed only after a confirmed send. The reported case is a Hotmail deliverability / domain-auth root cause (verify SPF/DKIM/DMARC for linestry.com in Resend), handed to Jay as a DNS follow-up, not fixed in code. BUG-043 verified NOT reproducible on current main: the reported public story renders on /snowboarding (no community_id filter, public-only read, 21 of 21 public stories shown, the 1 private excluded), so no code change.

## 2026-06-15 - Owner edit/delete controls always-visible (BUG-044 regression) (bug)
- type: bug
- pr: #73
- branch: fix/bug-044-045-story-menu-comment-email
- ids: BUG-044
- status: merged
- tsc: clean

Follow-up correction to the earlier #73 BUG-044 fix on this same branch: the (hover:hover)/(hover:none) opacity juggling collided with group-hover (itself wrapped in (hover:hover) under Tailwind v4) and lost the cascade, so the story 3-dot edit/delete trigger was hidden even on desktop and owners could not edit at all. Removed the opacity gating so the owner-only control is always visible (muted, darkens on hover), which also covers the original touch case, and extended the same treatment to the other owner controls that shared the pattern: claim-card, day-card, post-card, day-post-card, and the editor remove-rider control on the events roster. The non-owner quick-claim affordance on post-card stays hover-gated.

## 2026-06-15 - Comment-email cadence preferences (feature)
- type: feature
- pr: #74
- branch: feat/comment-email-prefs
- ids: none
- scope: comment-email-prefs
- status: merged
- tsc: clean

Comment notification emails are now a per-user setting (profiles.comment_email_pref), default "smart" spacing: an email on comments 1, 2, 3, 4, 5, 10, 25, 50, 100, 200... so a normal story emails on every comment while a busy thread is throttled; plus every-comment, every-6h digest, once-a-day digest, and off. New /me/settings/notifications page (added to the /me sub-nav) and GET/PATCH /api/me/notification-prefs; every email footer states the current cadence and carries one-click HMAC-signed links (per user+pref) to switch cadence or turn off via /api/notifications/email-pref, no login needed and reversible. Migration 20260615000001 adds the column (default 'smart', check constraint); reads degrade to 'smart' if absent but writes need it, so apply before deploy. Stacked on PR #73 (shared comment-emails.ts); keeps the BUG-045 commit-after-send behavior.

## 2026-06-15 - Surface the equity offer, Batch A (feature)
- type: feature
- pr: #75
- branch: feat/surface-equity-offer
- commit: 85b06ac
- ids: none
- scope: equity-surfacing
- status: merged
- tsc: clean

Surfaced the /equity offer beyond /membership and /account/membership: a home teaser line above the footer (all viewers), a community-landing teaser card between the stats grid and the timeline, a "Your share so far" live estimate on My Timeline (one /api/equity/pool fetch plus estimateShares, with an encouraging prompt fallback for free riders who have no tokens yet, replacing the old "{n} tokens, in the equity pool" line), and token-earning microcopy on the Help Connect card and the add-entity modal. Copy only, no schema or new routes; reuses EQUITY_POOL_SHARES and estimateShares from src/lib/equity-offer.ts.

## 2026-06-15 - Landing page banner + refresh (feature)
- type: feature
- pr: #76
- branch: feat/landing-banner
- ids: none
- scope: landing-banner
- status: merged
- tsc: clean

Gave the root landing page (/) an admin-settable full-width banner band across the top. New communities.landing_banner_url column (migration 20260615000002, additive nullable, separate from the Phase 2 hero_image_url so the homepage and /snowboarding can show different photos), surfaced through the Community type, the setCommunityImages store setter (impl whitelists keys, so an explicit branch was added), the /api/admin/communities PATCH whitelist, and a third "Homepage banner" upload on /admin/community reusing the Phase 2 ImageUploadField. The page now always renders dark via a .dark wrapper regardless of the theme toggle, the second headline sentence is now "Let's weave our stories together.", and the Linestry wordmark links to /word. Banner reads the snowboarding community (single-community launch); unset renders no band. Apply migration 20260615000002 to prod before merge (the junctions select("*") and store path reference the column).

## 2026-06-15 - PB-010 Phase 1 public timeline foundation (feature)
- type: feature
- pr: #77
- branch: feat/pb010-phase1-foundation
- commit: edc7548
- ids: none
- scope: pb010-phase1
- status: merged
- tsc: clean

Data-layer-only foundation for the public timeline (/t/[slug]) and Stack View; no route, API, or UI. Migration 20260615000003 adds three additive profiles columns (public_slug with a partial unique index, public_timeline_enabled default false, public_timeline_default_view nullable with a timeline|stack check) and a public_stack_entries table (owner-curated stack order, category_summary shape constraint, entry_ref_id text so mixed-type catalog ids are accepted). Adds PublicStackEntry / PublicStackEntryType / PublicStackCategoryKey and the three fields on Person (no separate Profile type exists), plus src/lib/public-slug.ts with basePublicSlug + ensureUniquePublicSlug, the single place a unique slug is derived (reused by the backfill now and Phase 2's enable-toggle later; collision rule mirrors entity-links.ts). One-time scripts/backfill-public-slug.mjs populates public_slug collision-safe, dry-run by default and --apply to write, mirroring the helper inline because the repo has no tsx/ts-node runner. Decisions shipped as the brief's defaults (D1 backfill all, D2 entry_ref_id text, D3 nullable app-resolved view, D4 enabled false, D5 slug from display_name). Migration and backfill are applied to prod separately as a guided step; no PGRST204 window because nothing reads the columns yet.

## 2026-06-15 - PB-010 Phase 2 chromeless public timeline /t/[slug] (feature)
- type: feature
- pr: #78
- branch: feat/pb010-phase2-public-timeline
- commit: 525756e
- ids: none
- scope: pb010-phase2
- status: merged
- tsc: clean

First public surface for PB-010: a server-rendered, chromeless, read-only timeline at /t/{slug}. New src/lib/public-timeline-read.ts is the one resolve-and-read helper (slug to enabled profile; claims via claims_public; stories via author + rider through story_riders_public; catalog subset resolved by id, people merged from people + profiles catalog-wins like the store), shared by the page, GET /api/public/timeline/[slug] (unauthenticated, edge-cacheable, 404 on disabled/unknown), and the OG route so they cannot drift. src/components/public-timeline/* is a decoupled renderer fed the resolved payload with zero useLineageStore dependency (entity graphics copied as pure art rather than touching store-coupled post-card.tsx); reuses timeline-grouping + companion-grouping. /t/[slug]/page.tsx is a server component with generateMetadata + canonical, owner hero (avatar, name, era line, coarse region/country, bio), attribution footer, no AppNav; ?view=stack renders the timeline (Phase 3 breadcrumb). /t/[slug]/opengraph-image.tsx is a dynamic name+era share card on the /word OG pattern. Owner opt-in is PATCH /api/me/public-timeline + /me/settings/public-timeline (in MeSubNav), flipping public_timeline_enabled and minting public_slug on demand via ensureUniquePublicSlug. No migration (Phase 1 added every column). Smoked signed-out against live jay_balmer: 200, chromeless, 34 claims + 18 stories decade-grouped, SSR title/og/canonical/content in initial HTML, personalized OG PNG, zero non-public rows leaked, unknown/disabled both 404. Phase 3 (Stack View) is next.

## 2026-06-15 - Claims object_id referential guard (chore)
- type: chore
- pr: #79
- branch: fix/claims-object-id-guard
- ids: none
- scope: claims-integrity
- status: merged
- tsc: clean

Closes the orphan-claim gap behind the PB-010 audit. claims.object_id is a polymorphic reference (no DB foreign key possible) and POST /api/claims never checked the target existed, so a claim could persist against a mock id (p23, ew1) or a local-only id that only the asserter's own browser resolves via localStorage userEntities plus the mock-data fallback in the AddClaim picker; every other viewer and every server read then saw "Unknown". Adds an objectIdExists guard to POST /api/claims (person checked against people and profiles) returning 400 unknown_object, and drops the picker's mock-data fallback for signed-in users so an authed member can never select a mock id (anon/demo keep it). Prod claims was clean apart from 4 seed/dev event claims deleted directly, so this is defense-in-depth with zero real-member orphans. No migration. Deferred the await-entity-before-claim refactor and a symmetric subject_id guard.

## 2026-06-16 - Overlay positioning and scroll-lock pass (bug)
- type: bug
- pr: #80
- commit: dfdd6ff
- branch: auto/bugfix-20260616-0500
- ids: BUG-047, BUG-048, BUG-049
- status: merged
- tsc: clean

Mobile overlay-behavior pass. New shared useBodyScrollLock hook (src/lib/use-body-scroll-lock.ts) pins the body with position:fixed and a module-level reference count so stacked overlays (a modal opening a nested picker, a lightbox over a modal) share one lock and the page only unlocks when the last closes; applied across the modal set (add-story, add-claim, add-entity, edit-claim, edit-event, edit-profile, invite-rider, claim-request, verification-gate, decline, restrict-asserter, report-bug, add-connections, image-lightbox) so the background no longer scrolls behind any open popup (BUG-048). AddConnectionsPopover converted from a card-anchored popover to a centered modal (bottom sheet on mobile, centered card on desktop) with a fixed header and an internally scrolling body so it is always in view rather than off-screen below the comments (BUG-047). Community switcher dropdown pinned just below the sticky nav and clamped to the viewport on mobile, keeping the trigger-anchored dropdown on desktop, so entries are no longer clipped off the right edge on a 414px screen (BUG-049). Pure client/CSS, no migration.

## 2026-06-16 - PB-010A Phase 3 Stack View + owner manage surface (feature)
- type: feature
- pr: #81
- commit: fdd19c0
- branch: feat/pb010a-phase3-stack-view
- ids: none
- scope: pb010a-phase3
- status: merged
- tsc: clean

Adds the curated, share-first Stack View on the same /t/[slug] URL as the Phase 2 timeline, plus the owner surface to build it. readPublicStack() extends public-timeline-read.ts (reuses the Phase 2 read, never widens visibility): loads public_stack_entries, resolves each against the already-read claims/stories/entities, drops entries whose record is no longer visible, derives category_summary counts + era spans. GET /api/public/stack/[slug] (unauth, edge-cacheable, 404 on disabled). Store-free dark-ground renderer (stack-view, stack-entry-card six types with thumbnail priority + inline expand, stack-header with era/location/share/toggle). /t/[slug] view-switching resolves ?view= then default_view then member-default stack, clamped to timeline when the owner has no curated stack so Phase 2 links never hit an empty stack; mobile <480px auto-stack; in-header toggle swaps with no reload. Owner manage surface /me/public-view (linked from public-timeline settings) + GET/PUT /api/me/stack: pick/exclude, add category summaries, move-up/down reorder (no DnD dep), optional custom title/summary, suggested starter publishable in two taps, save + copy link, hard max 20 server-side. Stack-aware OG tiles. No "+" claim affordance (Phase 4, D3). No migration. Signed-in manage surface not yet interactively smoke-tested (localhost auth + DB-write gating); verified by tsc/eslint + server API contract + signed-out proxy gate; real-flow check is settings to Curate to Save to /t/<slug>?view=stack.

## 2026-06-16 - PB-010 Phase 4a anonymous tag-to-claim write path (feature)
- type: feature
- pr: #82
- commit: 9758568
- branch: pb010-phase4a-tag-write
- ids: none
- scope: pb010-phase4a
- status: merged
- tsc: clean

The write half of the public tag-to-claim growth loop. New unauthenticated POST /api/public/tag: an anonymous visitor on /t/{slug} taps "I was there" on a story/place/event moment, the endpoint resolves the slug to the enabled owner, validates the moment against the owner's public surface, upserts one ghost per visitor email (node_status=unclaimed, invited_by=null), inserts the implied claim (subject=ghost; place=rode_at, event=spectated_at/competed_at, story=rode_with owner per Q4) plus a paired tag_event whose subject is the timeline OWNER so it lands in the owner's existing /me/tags inbox under the Embed source with no new owner UI, throttles, and emails a claim-your-spot magic link. Migration-free: reuses PB-009 tag_events/tag_throttle/tag_blocklist. New src/lib/public-tag.ts does HMAC hashing of email+ip (never stored raw), blocklist check, and the L1_email 3/owner/day + L2_ip 8/day throttle (D1). insertTagEvent gained an optional asserterVisitorRecord (the blocklist cascade trigger keys off email_hash/ip_hash). New store-free IWasThere island on the public story card (timeline, inline) and story/place/event stack cards (panel), transitions in place to a check-your-email state. /me/tags route+page render the visitor name + story preview for embed tags. D2 = hidden until claimed (ghost has no public timeline; owner timeline reads only its own claims, so nothing leaks; owner moderates via /me/tags). Phase 4b (magic-link promotes the ghost via merge_person, tag flip, optional +N aggregate) is the follow-up. Verified end to end on jay_balmer in local dev against prod: 200, correct row shape (7.00-day expiry, hashed visitor record), friendly 429 on the 4th email tag, all test rows cleaned up afterward (prod confirmed 0 embed tag_events remaining). tsc + eslint clean.

## 2026-06-16 - PB-010 Phase 4b claim completion (feature)
- type: feature
- pr: #83
- branch: pb010-phase4b-claim-completion
- ids: none
- scope: pb010-phase4b
- status: merged
- tsc: clean

The authenticated tail of the public tag-to-claim loop: clicking the 4a claim-your-spot magic link now promotes the anonymous ghost into the new member. New authenticated POST /api/public/claim-complete, called by /auth/complete after sign-in. It resolves the unclaimed ghost by the verified session email (no client-supplied id, so no tampering surface), repoints the ghost's claims (subject_id, object_id, asserted_by) and story_riders onto the auth account, flips the paired public_timeline_embed tag_events from pending/anonymous_aggregate to approved/attributed with asserter_id set, drops a profiles.merged_from_id breadcrumb for old-URL redirects, and deletes the ghost. Idempotent and graceful: a second click, an expired 7-day hold, or a normal signup with no pending tag all return 200 with claimed:false (expired carries reason:expired and leaves the ghost owner-moderatable), never a 500. D6 was resolved to the invite-style repoint rather than merge_person: merge_person keys its canonical lookup on a people row with claimed_by=caller, but a brand-new signup has only a profiles row, so it would claim-in-place and strand the claim on a leftover ghost node that never surfaces on the member's subject=auth-id timeline; the invite-claim repoint keeps the profile canonical and is the proven path. Migration-free (reuses 4a/PB-009 tables). Verified end to end against prod with a throwaway user: happy path (ghost deleted, claim repointed, tag approved/attributed/asserter set, profile claimed + breadcrumb), idempotent re-call, and the expired-hold path all pass; all test rows cleaned up afterward (prod confirmed clean). tsc + eslint clean.

## 2026-06-16 - Story Connections create-new affordance (bug)
- type: bug
- pr: #84
- branch: bug-059-story-connections-add-new
- ids: BUG-059
- status: merged
- tsc: clean

The "+ Connect" / "I was there" Story Connections popover could only link existing entities; unlike the Add Story modal it had no "create a new rider/place/event" action when the search returned no match. Lifted the AddStoryModal pattern in: each SearchPicker now passes onAddNew/addNewLabel and an addingEntity state drives a stacked AddEntityModal, so a member creates and connects a brand-new entity in one flow (D1 = all three types, D2 = reused the Add Story labels). The popover connects immediately (the Add Story modal defers the write to a human Save click), so the new entity has to be persisted before the connection POST fires or it races the catalog write and trips the connections route's server-side FK checks. To close that race, addUserPlace/Board/Org/Event/Series now return Promise<boolean> (mirroring addUserPerson) and AddEntityModal awaits persistence before firing onAdded; the optimistic catalog set stays synchronous so existing fire-and-forget callers (list pages, admin, onboarding, add-claim) are unchanged. Verified signed-in in local preview against the real catalog: all three affordances render, the create modal stacks at z-[60] above the still-mounted popover, Escape no longer collapses the stack, and Cancel returns to the popover; the final create+connect write was not run against prod to avoid catalog pollution (reuses the proven connect() path + verified persistence ordering). tsc clean.

## 2026-06-16 - Event-rider claims hidden on client reads (bug)
- type: bug
- pr: #85
- branch: bug-060-tag-visibility-definer
- ids: BUG-060
- status: merged
- tsc: clean

Event "+Add rider" (and any claim that tags another person) appeared then vanished on refresh. Root cause confirmed in prod: claims_public / story_riders_public are security_invoker and LEFT JOIN tag_events, which has RLS enabled with no policies, so anon/authenticated read zero tag_events rows; under security_invoker the join runs as the caller, te.status resolves NULL for every row, and the visibility WHERE collapses to "tag_event_id IS NULL only". Self-claims (no tag_event) survived; tag-of-another-person claims (event rosters, rode_with someone) got a paired tag_event and disappeared. The story path masked it because GET /api/stories reads riders server-side via service role. The two PB-009 migrations contradicted each other (tag_events migration said "definer privileges", views were written security_invoker). Fix: keep the views security_invoker (base-table RLS keeps governing public/private + owner-own automatically) and move only the tag-status check into a SECURITY DEFINER helper tag_event_publicly_visible(uuid) that can read tag_events/profiles and returns a boolean (no tag_events rows exposed). Migration only, no app code change (every reader already queries claims_public). Validated read-only against prod: the helper reproduces the service-role claims_public row set exactly (105/106 total, 37 for Westbeach_Classic_1993). MIGRATION 20260616000001 is NOT yet applied to prod: Jay applies it in the Supabase dashboard (human-reviewed _public view rebuild), verifies anon event roster jumps 1 -> 37 and anon private-claims stays 0. tsc clean.

## 2026-06-16 - Public stack/timeline page cleanup (chore)
- type: chore
- pr: #86
- branch: pb010-stack-timeline-cleanup
- ids: none
- scope: pb010-public-stack-cleanup
- status: merged
- tsc: clean

Cleanup pass on the chromeless /t/[slug] stack page plus a matching cross-link on /people/[id]. Adds a Linestry brand mark (top-left, links home) so the chromeless page has a path back into the platform; hides the per-card "I was there too" tag affordance behind each stack card's expand chevron (it was always visible, one pill between every card); and repoints the "Timeline" toggle to open the full profile at /people/[id] instead of switching an in-page chromeless timeline, with the matching Stack/Timeline toggle added top-right on /people/[id] (Stack links to /t/[slug] when the person has a live public timeline, read from profiles.public_slug + public_timeline_enabled). Shared StackTimelineToggle extracted for both surfaces. Behavior change: stack owners' /t/[slug] now always shows the Stack, so the old ?view=timeline link and public_timeline_default_view='timeline' no longer render the chromeless timeline for them (Timeline now means the full profile); the chromeless timeline is retained only as the stackless-owner fallback. UI plus one client-side profiles read; no migration. Verified against prod data in local preview on both surfaces (brand mark href, toggle targets, hidden-until-expanded affordance, mobile top bar, no console errors). tsc clean.

## 2026-06-16 - Public stack story expansion + event roles (feature)
- type: feature
- pr: #87
- branch: pb010-stack-story-expand-roles
- ids: none
- scope: pb010-stack-story-expand-roles
- status: merged
- tsc: clean

Two follow-ups to the /t/[slug] stack cleanup (#86). (1) Clicking a story stack card now expands the full story in place (photos, YouTube, external link, full text) instead of the clamped summary; extracted a shared StoryMedia renderer reused by the chromeless timeline fallback (PublicStoryCard) and the stack expansion, and threaded the resolved stories + entities through public-profile-view -> stack-view -> stack-entry-card. (2) The tag panel on an event-linked story now offers Spectator / Competitor / Organizer; submitting writes the event-role claim (spectated_at / competed_at / organized_at against the linked event) with a moment_ref referencing both the story and the event, so it is tagged on the story and on the event. Standalone event cards gained Organizer too (was only competitor/spectator). The server validates the event is genuinely linked to the story (linked_event_id or a community event) before honouring it, rejecting an unmatched eventId. No migration (reuses claims / tag_events + the three role predicates). Verified in local preview against prod data: every story card expands to its photos in place, no console errors, and the role options render with the event name when a real linked event resolves (confirmed via a temporary stub, reverted); Jay's mock/local event refs do not resolve yet so roles stay dormant on his timeline until those stories are linked to real catalog events. tsc clean.

## 2026-06-16 - QoL cluster PR 1: profile redirect, stale connections, feed sort (bug)
- type: bug
- pr: #88
- branch: bug-qol-pr1-profile-connections-feed
- ids: BUG-046, BUG-038, BUG-055
- status: merged
- tsc: clean

BUG-046: logged-out /[community]/profile redirects to /people instead of rendering the mock/demo persona (no sign-in wall, no mock counts). BUG-038: /me/connections candidates are filtered to the live community directory (mirrors the /people community_slugs predicate) so a rider removed from the directory drops off. BUG-055: the feed defaults to a created_at "Recently added" sort with an event-date option, and the community timeline gains the same option with its event-date default unchanged; adds an optional sort=recent param to GET /api/stories. No migration.

## 2026-06-16 - QoL cluster PR 2: post-login returnTo, projected-pool equity (bug)
- type: bug
- pr: #89
- branch: bug-qol-pr2-returnto-equity
- ids: BUG-054, BUG-061
- status: merged
- tsc: clean

BUG-054: capture a validated returnTo (nav Sign in entry + stamped on the comment-email deep link) and honor it after login instead of always landing on My Timeline. Survives the OAuth /auth/callback hop and the magic-link generateLink redirect, honored at /auth/complete (default My Timeline, preserved on the expiry bounce) and on the client password path. New src/lib/safe-redirect.ts validates every returnTo to a same-origin relative path (no open redirect). BUG-061: floor the equity estimate denominator at a projected end-of-offer pool (PROJECTED_TOTAL_WEIGHTED = 1,000 x 20 = 20,000 weighted tokens) as tunable constants, so an early estimate is realistic (a 20-token member estimates about 100 shares) instead of dividing by the tiny live total; adds a "projected end-of-offer pool" qualifier and makes /equity display the same effective denominator it divides by. No migration. HUMAN-REVIEWED (auth flow + equity numbers).

## 2026-06-16 - Monogram mark swap + wordmark period removal + Calendula titles (feature)
- type: feature
- pr: #90
- branch: feature-monogram-mark-swap
- ids: none
- scope: logo-mark-swap
- status: merged
- squash: d69465a
- tsc: clean

Replaced the sprouting-nodes disc with the new interlocking b/l monogram (brand-blue body, var(--foreground) contrast dot, tilted 30 degrees left, viewBox cropped to the ink bounds) in src/components/ui/brand-mark.tsx, behind a new brandMarkSvgString(color, dotColor, knockout, tilt) API. Wired it through the favicon (mono), apple icon (white knockout so the tile shows through the center hole), and all three OG cards (root dark = blue body + white dot, /word and /t light = blue body + ink dot). Removed the blue wordmark period from the header, landing hero, /word header, and the root OG card. Added the mark to the nav header lockup. Extended Calendula Bold (var(--font-wordmark)) to the community name and Timeline headings. The three size-12 Compare glyphs render mono to avoid two-tone noise at tiny size. No schema, no migration. Verified every icon and OG PNG plus the inline surfaces in the browser.

## 2026-06-17 - Mobile tab-row overflow pass (bug)
- type: bug
- pr: #91
- branch: auto/bugfix-20260617-0500
- squash: f236f65
- ids: BUG-064, BUG-065, BUG-073
- status: merged
- tsc: clean

Fixed three 414px mobile horizontal-overflow issues. MeSubNav (src/components/ui/me-subnav.tsx) now centers the active tab in its horizontal scroller on mount by setting scrollLeft directly (no vertical page scroll), so selecting an off-screen settings or /me/tags tab no longer leaves the active tab scrolled off the right edge (BUG-064, BUG-073). The /me/tags source-filter chip row is client-state driven and never remounts, so it already preserves scroll on filter change. On /snowboarding/boards the tab group is now contained in its own min-w-0 overflow-x-auto box with shrink-0 nowrap buttons, so the row scrolls internally instead of widening the page and making the body drag sideways (BUG-065). Pure client/CSS, no migration.

## 2026-06-17 - /me/tags filter-chip scroll reset, BUG-073 residual (bug)
- type: bug
- pr: #92
- branch: bugfix/mobile-tab-overflow
- commit: a578962
- squash: 263f11f
- ids: BUG-073
- status: merged
- tsc: clean

Residual of the mobile tab-overflow cluster after the autonomous pipeline shipped BUG-064/065/073's main fixes in #91 (merged 12:03 UTC). #91 fixed the shared MeSubNav tab row but left the /me/tags source-filter chip row resetting on filter change: the page-level `if (!authReady || loading)` guard swapped out the whole content subtree on each reload, remounting the chip scroller at scrollLeft=0 (#91's note that the row "never remounts" was incorrect). Scoped the loading state to the cards area only, so the header and chip row stay mounted and keep their scroll position. This session first rebuilt #91's work on a stale local main (duplicate), then re-scoped PR #92 down to this one genuinely-new fix. Pure client, no migration.

## 2026-06-17 - rode_with relationship model + write dedup + companion fold-by-parent (bug)
- type: bug
- pr: #93
- branch: bugfix/bug066-rode-with-dedup
- commit: 095e6c3
- squash: 3687549
- ids: BUG-066
- status: merged
- tsc: clean

HUMAN-RUN P1. Fixes duplicate "Rode with X" rider cards on /snowboarding/profile and /people/[id]. Two root causes: the companion fold keyed on year-only (subject|start|end) collapsed every same-year visit to one key and gave up at 2+ rode_at, leaking each companion rode_with as a standalone card; and every non-board predicate plain-inserted, so repeat tags piled up. Added claims.parent_claim_id (text, matches claims.id) + rebuilt claims_public (SELECT c.* column freeze). Modal stamps parent_claim_id on per-ride companion rows (the place-card chip source) and upserts ONE crew rode_with per person with a widening year range (client-side, mirroring the board upsert); /api/claims adds the same NULL-parent crew upsert as the stale-state backstop. companion-grouping folds by the explicit parent link with a guarded legacy date-key fallback that will not absorb crew rows. PostCard already renders the range via formatDateRange, so the crew card shows the year span once it spans years; connection-summary prefers the crew row for the rode_with fact window. Carries migration 20260617000001 (run before merge) + a discovery-first backfill runbook docs/bug066-rode-with-backfill.sql (parent the Jay->Sean 1986 companions, collapse the Cy 2->Cory 2026 standalone dups with their paired tag_events). No account merge.

## 2026-06-17 - AddClaimModal visibility default to public (feature)
- type: feature
- pr: #94
- branch: fix/claim-visibility-default
- ids: none
- scope: profile-unification-phase-1
- squash: 5f0fa23
- status: merged
- tsc: clean

Phase 1 of the Profile Unification + Visibility Fix brief. AddClaimModal defaulted new claim visibility to "private" while POST /api/claims and quick-claim-popover both default "public", so claims added through the modal (boards, events, places, riders) silently landed private and were hidden from /people/[id] and /t/[slug]. Flipped the modal state default to "public" (feeds all four claim inserts); the explicit private control is unchanged. Pairs with a one-time Supabase backfill (private -> public, all predicates) that Jay runs by hand in the SQL editor; not part of this code PR. No migration. Phase 2 (collapse the profile URLs into /people/[id]) is a separate PR, not started.

## 2026-06-17 - Profile URL unification: owner-aware /people/[id] (feature)
- type: feature
- pr: #95
- branch: feature/profile-unification
- ids: none
- scope: profile-unification-phase-2
- squash: 21a8e68
- status: merged
- tsc: clean

Phase 2 of the Profile Unification + Visibility Fix brief. Collapses the four overlapping profile renderers into one canonical in-app address: /people/[id] renders OWNER mode when the viewer is the subject (full timeline toolkit, claims unfiltered by visibility, optimistic adds via getAllClaims) and the read-only PUBLIC view for everyone else. Extracted the former /[community]/profile ProfilePage verbatim into src/components/profile/owner-timeline-panel.tsx and render it from /people/[id]'s owner branch (placed before notFound() so an owner reaching their page by id never 404s). /me/timeline and /{community}/profile now redirect via new ownProfilePath() (server auth.getUser -> /people/{id}, anon -> /people); /{community}/profile/[id] folds the orphaned legacy ProfileDetailPage into /people/[id]. Repointed the nav "My Timeline" lens + avatar item at the viewer's unified /people/{slug} with matching active-state. Old URLs keep working via redirect. No DB or schema change. Branched off main (independent of Phase 1 #94). Owner-mode acceptance matrix to be run on the Vercel preview (local auth impractical). Also includes a second commit (26c1e0e): an intentional dark brand-guide redesign of the /t/[slug] OG share card (Calendula wordmark lockup, near-black ground), which had appeared uncommitted in the shared working tree from a concurrent session and Jay confirmed should ship here. The empty _render-og.cjs scratch file was left out.

## 2026-06-17 - Person-first dark OG share card for /t/[slug] (feature)
- type: feature
- pr: #96
- branch: feature/og-share-card-redesign
- ids: none
- scope: pb-010-og-card
- squash: 01d40b7
- status: merged
- tsc: clean

Redesigns the /t/[slug] Open Graph share card into a person-first dark layout: a small Linestry lockup masthead (tilted blue mark + Calendula Bold wordmark), the timeline owner as the hero (name large, era + region/country + share link below), and a global "I'll show you mine . . ." invite at the foot. Drops the eyebrow and oversized lockup of the prior dark card; no colored entity tiles. Owner data (display_name, era_start, region, country, slug) comes live from readPublicTimelineOwner; field names verified against the live function, no-owner fallback preserved. Calendula loads from the local TTF via fs.readFile (Node runtime), Geologica body weights fetch per-weight from Google Fonts at render time. Branched off main, independent of feature/profile-unification. Overlap to reconcile: PR #95 also rewrites this same file via commit 26c1e0e (the earlier eyebrow/big-lockup dark card), so #95 and #96 will conflict on merge; #96 is the newer intended design and should win. No migration. Removed the stale .git/index.lock and empty _render-og.cjs left by the prior tool session. Social platforms cache OG images, so existing shared links need a re-scrape after deploy.

## 2026-06-17 - Remove landing-page feature cards (chore)
- type: chore
- pr: #97
- branch: chore/landing-remove-feature-cards
- ids: none
- scope: landing-page
- squash: 91480ff
- status: merged
- tsc: clean

Removes the three numbered icon/emoji feature cards (Map your timeline / Find where lines cross / Build the collective timeline) from the bottom of the landing page per Jay's call to declutter. Drops the FEATURES array and its render block in src/app/page.tsx; the page now flows hero -> snowboarding CTA box -> equity teaser -> footer with no leftover gap. The cn import stays (still used for hero padding). Copy-only/markup-only, no DB or schema change. Branched off origin/main (which already had #96), independent of the now-merged profile-unification work. Verified in local preview: cards gone, no console errors, clean layout.

## 2026-06-18 - BUG-062: remove non-functional dot row from member card (bug)
- type: bug
- pr: #98
- branch: auto/bugfix-20260618-0713
- ids: BUG-062
- status: merged
- tsc: clean

Removed the unlabeled five-dot row from the member card popup (src/components/ui/member-card-overlay.tsx), which Cory reported read like a broken scroll/pagination control. The dots encoded riding-decades via filledDots but had no label, so a viewer could not decode them; per the brief default they are gone, not labeled. Dropped the now-unused yearsRiding and filledDots locals with the row. The wordmark is absolutely positioned and the stats trio keeps its own marginBottom, so the card shrinks with no leftover gap. The celebration burst (spawnBurst) and rider-card warp-thread texture are untouched. Client/UI only, no migration.

## 2026-06-18 - Boards catalog brand-first redesign (feature)
- type: feature
- pr: #99 (97d9e4d)
- branch: feat/boards-catalog-redesign
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Rebuilt /boards from a four-tab flat list into a brand-first photo catalog: a community intro card (The Snowboard Catalog heading plus Boards/Brands stats and Add a board CTA), a brand index of cards with cover thumbnail strips (Most boards / A-Z sort), and an in-page brand drill-down of portrait product tiles (newest model year first, breadcrumb back to Boards, link to /brands/[slug] when an org matches, Newest / Most collected sort). New in-file BoardCover encapsulates the image fallback chain (manual image_url, then useBoardImage auto cover, then brand org logo contained, then greyed BrandMark); tiles show collector counts from owned_board claims, the compact unverified pill and Added by, and keep QuickClaim. Search renders a flat tile grid across brands; My Boards and the ?year= seed are preserved; container widened to max-w-5xl. No schema, API, or migration change; reads entirely from the Zustand catalog. Branched off origin/main (which already had BUG-062 #98). Verified in local preview incl. fallback branches, collector count, and 0px overflow at 375px (2-up grid).

## 2026-06-18 - Boards catalog enhancements batch (feature)
- type: feature
- pr: #99 (97d9e4d)
- branch: feat/boards-catalog-redesign
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Second commit on the same PR #99, layering Jay's follow-up asks onto the brand-first redesign: All-boards vs Brands level switch plus clickable Boards/Brands stat counters; a tile/row "+" actions menu (View board page for everyone, Rode it / In my collection marks for signed-in users writing owned_board with board_relationship); six sorts (Newest/Oldest, Most/Least rode, Most/Least owned) with rode/own counts derived from board_relationship and shown on tiles and rows; decade dividers on chrono sorts (reverse on Oldest, dropped for collection sorts and single-year views); a list/card view toggle (cards default); "+ Add a brand" beside Add a board (org modal defaulted to brand via new AddEntityModal initialOrgType prop); brand detail gains a dedicated View brand page button and a year filter as the third breadcrumb segment (Boards / Brand / All time | year); intro description states how many boards and brands are mapped. Admin-set boards-page banner: new communities.boards_banner_url wired through type + store setCommunityImages + /api/admin/communities + /admin/community (new "boards" image kind) + a banner band on the page. Presentational pieces extracted to boards/board-parts.tsx. REQUIRES migration supabase/migrations/20260618000001_boards_banner.sql (ALTER TABLE communities ADD COLUMN boards_banner_url text) run by Jay before the banner works; everything else is migration-free. Verified all front-end items in local preview, 0px overflow at 375px; banner render path guarded (dormant until column exists).

## 2026-06-18 - Story author timeline toggle (feature)
- type: feature
- pr: #100 (18dac30)
- branch: feat/story-on-timeline-toggle
- ids: none
- scope: story-on-timeline
- status: merged
- tsc: clean

New stories.on_timeline boolean (default true; migration 20260618000002, manual SQL before merge) lets an author keep a story off their own personal timeline while it still shows on the linked entity page and in the community feed. The Add Story modal gets an always-visible "Add to my timeline" switch defaulting off when opened from an entity page (place/event/board/brand pre-linked) and on for a generic add. Owner timeline, public profile, and Stack candidates filter to on_timeline=true; a new Contributions section gathers an author's off-timeline stories (owner view keeps the edit menu to re-toggle, public view read-only). GET /api/stories gains an optional on_timeline filter; the community feed and entity pages are unchanged. No stories_public view, so no view rebuild. tsc clean, eslint baseline-equal (zero new for touched files); render-health verified on /people/jay_balmer where the missing-column 500s positively confirm the wiring and the migration gate. Replaces the SessionEnd auto-stub that mislabeled this type:bug / BUG-062 (BUG-062 shipped earlier in #98, not this session).

## 2026-06-18 - Equity distribution reframed as Community Trust (chore)
- type: chore
- pr: #101
- branch: copy/equity-community-trust
- ids: none
- scope: equity-copy
- status: merged
- tsc: clean

Copy-only reframe of /equity from share issuance to the Lineage Community Trust, one file (src/app/equity/page.tsx, 14 insertions, 7 deletions). The Section 1 offer-card note now says shares are held collectively in the trust on the member's behalf with each slice set by tokens; Section 4 Distribution Mechanics swaps the Issuance item for a Community Trust item, adds a Your stake item (beneficial interest proportional to weighted token balance across a future sale, dividend, or IPO), and rewords Tokens stay tokens so tokens are the measuring stick the trust uses on snapshot day to calculate each member's beneficial interest. No logic, schema, API, or migration change. The edit arrived uncommitted on feat/story-on-timeline-toggle and was peeled onto its own branch off origin/main (which already had #100 merged). tsc clean, no em dashes.

## 2026-06-19 - View-ordering polish (bug)
- type: bug
- pr: #102 (3696ec4)
- branch: auto/bugfix-20260619-0508
- ids: BUG-078, BUG-079
- status: merged
- tsc: clean

Two client-only view-ordering papercuts in one PR. BUG-078: place pages now auto-switch to the Stories tab once stories load when the place has at least one story, falling back to All for empty-stories places, with a userSwitchedTab ref so an explicit tab click is never overridden. BUG-079: the stack-curate "Sort by year" button now toggles ascending/descending on each click (new sortDir state, direction-aware comparator) with null-year summaries pinned to the end in both directions, and the label reflects the current order ("Year, oldest first" / "Year, newest first"). No migration, no _public view, no auth/payments. Lead BUG-062 and the BUG-041 verdict example were both already shipped (PR #98 and PR #72), so this run took the next auto-merge-safe brief.

## 2026-06-19 - Boards brand cards show imageful boards (feature)
- type: feature
- pr: #103
- branch: feat/boards-brand-card-covers
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Follow-up to the boards catalog (PR #99). Brand index cards rendered the first 3 boards by model year blindly, so a brand whose newest board had no cover image showed a greyed BrandMark even when older boards had photos (Lib Tech showed 1 image with 3 more available). Now each card probes a bounded candidate pool (most riders first then newest, capped at 8) and displays only boards that resolve to a real image, highest riders first. BoardCover gained an optional onResolve(hasImage) callback; loading candidates hold placeholder slots, settled-imageless boards are skipped, and an all-imageless brand falls back to the top 3 so the strip is never empty. Adds a distinct-riders (any owned_board) count to drive the ordering. No schema/API change; reads from the Zustand catalog; useBoardImage stays localStorage-cached 7 days. Verified in preview: Lib Tech 1->3 real photos, all 25 brand cards show >=1 image, 0px overflow at 375px.

## 2026-06-19 - Boards brand cards surface community-added images (feature)
- type: feature
- pr: #104
- branch: feat/boards-brand-card-community-images
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Follow-up to PR #103. Brand cards still missed images people ADDED: community images live in board_image_votes (pasted links archived to storage + uploads) and were surfaced only via the per-board, async, localStorage-cached (7-day) useBoardImage probe, which the card ran only for the top boards in each brand. So an image on a board below the probe cap never showed ("only the first board works"), and an image added after a board was probed stayed hidden behind a stale no-image cache ("takes time to refresh"). Fix: new GET /api/board-image/list returns a fresh board_id->community image map for the whole catalog (most recent per board), loaded once per page mount (not localStorage-cached); BoardCover takes an overrideUrl that wins over the stored column and skips the auto lookup (undefined brand/model short-circuits the hook), threaded through tiles + list rows; BrandIndexCard treats community/stored images as a curated tier that is always eligible (not gated by the probe cap) and ranks ahead of auto-guessed Serper covers, each tier most-riders-first then newest. No schema/migration. Verified in preview (local reads prod board_image_votes): Sims leads with its two community photos incl. the 1985 Kidwell board (the non-newest case that was broken), all 25 cards show >=1 image, 0px overflow at 375px.

## 2026-06-19 - Boards photo add/remove reflected on cards (feature)
- type: feature
- pr: #104
- branch: feat/boards-brand-card-community-images
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Second commit on PR #104. Removing (or adding) a photo on a board page updated board_image_votes and the board page's own cover, but the brand index and catalog tiles kept showing the old image because they read through useBoardImage's 7-day localStorage cache, which the mutation never invalidated (a removed photo lingered; a freshly added one could stay hidden). Added clearBoardImageCache(boardId) to use-board-image.ts (drops every cache entry keyed `${boardId}|...`), called after a successful saveImageUrl (add) and handleRemovePhoto (remove). Other surfaces then re-fetch on next mount: a removal is gone from board_image_votes so the bulk list map omits it and the per-board route falls through to the auto cover; an add is picked up fresh. The board page itself was already correct via its live displayImageUrl (suggestedImageUrl ?? boardImageUrl, where boardImageUrl is fetched WITHOUT board_id so it is a Serper fallback not the community image). Verified helper against the live cache (removing one board's entry left the other 193 intact). Note: use-board-image.ts carries one PRE-EXISTING eslint error (react-hooks v7 bump flags a synchronous setState in the untouched hook effect; main ships it) - not introduced here, hook body unchanged.

## 2026-06-19 - Boards polish: nav reset, Featured, add-with-image, recently-added, brand picker (feature)
- type: feature
- pr: #105
- branch: feat/boards-polish-nav-featured-images
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Seven-item cleanup/polish pass on the /boards catalog and related surfaces. (1) Nav reset: the catalog now drives view/brand/year/search through the URL, so the bare /boards nav link resets a drilled-in brand, active search, or chosen view back to default (clicking "Boards" while inside Burton previously kept showing Burton). (2) Featured: third tab alongside Brands/All boards, surfacing boards with a curated photo (stored boards.image_url OR a board_image_votes community image; Serper auto-guesses excluded) - verified "15 boards with a photo" against prod. (3) Breadcrumb: a board page's brand crumb now returns to that brand's catalog list (/boards?brand=X) instead of the brand org page; the org page stays reachable from the sidebar Brand card + the "View brand page" button. (4) Add-with-image: AddEntityModal board branch gains an optional cover (file upload to board-images bucket or paste-a-URL archived via /api/boards/archive-image), persisted to boards.image_url (new field on /api/catalog/entity board insert; column existed, was unused/0 rows) and added to the board page's displayImageUrl fallback chain (auth-gated, mirrors the live board-page uploader). (5) Recently added rail above the listing, newest boards first; optimistic created_at stamp in addUserBoard puts a just-added board at the very top before the server round-trip. (6) Default brand: opening Add-a-board from a brand view pre-fills that brand via initialName. (7) Brand picker: free-text brand input replaced by a searchable BrandCombobox over existing brands (orgs of type brand + distinct board brands) with a "use X as a new brand" escape hatch. Supporting: communityHref strips ?query/#hash before matching the route segment so community-scoped links with params get prefixed (the new breadcrumb relies on this); added Board.created_at to types. No migration (image_url + created_at columns already exist). Verified live in preview (anon): all items except the auth-gated image-upload UI, which was code-reviewed against the in-prod board-page uploader.

## 2026-06-19 - Boards auto-cover source credit (feature)
- type: feature
- pr: #106
- branch: feat/boards-image-source-credit
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Auto-fetched board covers (Serper / Google Image Search, served by /api/board-image when a board has no community photo) now credit their source. Serper already returns the site source + the source-page link next to imageUrl, but the route kept only the URL; it now passes through source and link, and the board detail page shows a small "Image via {domain}" credit under the cover linking to the source page (new tab, rel=noopener noreferrer nofollow, domain derived from the link hostname). Credit shows ONLY when the auto image is on screen: a community upload (board_image_votes) or the stored board.image_url takes precedence and is not a third-party source, so neither is credited. Scope (Jay's pick): credit the live images (ephemeral, board page fetches the route directly so source/link are fresh each load, no caching/schema change) + board detail page only (cards/tiles untouched). Verified in preview: Arbor A-Frame shows "Image via snowdb.com" linking to its snowdb catalog page; community-cover boards (Burton Terje) show no credit. Branched off origin/main (which already had #104) - a concurrent feat/boards-polish-nav-featured-images branch held the working tree, so this was lifted onto a clean branch. No migration.

## 2026-06-19 - Admin board image editing + grey-mark cover fallback (feature)
- type: feature
- pr: #107
- branch: feat/admin-board-image-edit
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Two board asks. (1) Admin image editing: the /admin Dataset Editor Boards table already inline-edits brand/model/year/shape; added an Image column so editors can clean up covers too - shows the current boards.image_url thumbnail, and editing a row exposes an image-URL field (paste to set, blank to clear) persisted via the existing updateCatalogEntity -> POST /api/admin update (requireEditor-gated, full data passed through, no whitelist). (2) Board page no-image fallback now renders the greyed Linestry BrandMark on a muted field (matching BoardCover on the catalog cards) instead of the snowboard emoji. Precedence note: board.image_url is read after a community suggestion (board_image_votes) on both the board page and catalog covers, so an admin-set cover shows where a board has no community image; clearing a bad community photo still happens on the board page. No schema change (image_url column exists). Verified: board page renders with the BrandMark import, emoji removed, grey-mark call identical to the live-verified BoardCover fallback, no console errors. Admin table NOT live-tested (/admin is requireEditor-gated, unreachable as anon localhost) - verified by tsc + against the existing proven edit pattern. The one eslint error in admin/page.tsx is pre-existing (react-hooks v7, untouched MembersTable effect). Branched off origin/main.

## 2026-06-19 - Boards cover watermark + broken-image fallback (feature)
- type: feature
- pr: #108
- branch: feat/boards-cover-watermark-broken
- ids: none
- scope: boards-catalog
- status: merged
- tsc: clean

Two cover-image asks in the shared BoardCover (catalog cards/tiles). (1) Watermark: an auto-sourced (Serper) cover now carries a small greyed Linestry mark in the corner as an unverified-guess signal; curated covers (community board_image_votes upload or stored board.image_url) are not watermarked; shown only on larger covers (markSize >= 40, the portrait tiles) so tiny thumbnails stay clean. (2) Broken images: a cover whose URL fails to load (404/expired) falls through to the greyed BrandMark instead of a broken-image icon - the broken URL is remembered by value (erroredUrl === imageUrl, auto-resets on board change, no setState-in-effect) and the auto-selection onResolve callback is told false so the brand index drops it. Verified in preview: 126 watermarks across 131 auto covers, 0 on the 12 community covers; forced-broken cover drops the img and shows the grey mark; no console errors. No schema change. Catalog only (board detail page has its own cover, deferred until #106/#107 land). Branched off origin/main. Note: auto covers + watermark only appear where SERPER_API_KEY is set (localhost today; needs the Vercel env var), but the broken-image fallback helps community/stored covers everywhere.

## 2026-06-19 - react-hooks set-state-in-effect cleanup (chore)
- type: chore
- pr: #109
- branch: chore/eslint-setstate-in-effect
- commit: c8c458c
- ids: none
- scope: lint-react-hooks-v7
- status: merged
- tsc: clean

eslint-plugin-react-hooks v7.0.1 added react-hooks/set-state-in-effect; 38 pre-existing violations across 21 files were erroring on main. Refactored each behavior-preserving: image hooks (use-board-image/event/place) do only async work and set state in .then() with the localStorage read kept in the effect (boardId folded into deps, fixing its exhaustive-deps warning); theme.ts uses useSyncExternalStore (hydration-safe SSR toggle icon); compare-player/timeline-player share a useSlideEntrance hook plus render-time resets; pages/modals/nav use setState-during-render resets, lazy-init for one-shot localStorage reads, and return-data-then-apply for data loaders (feed/stories/admin/blocks/trust). set-state-in-effect 38 to 0, tsc clean, no new lint errors. Verified in preview: board covers resolve on /snowboarding/boards (120 imgs loaded, 0 pulses, real auto covers) and the theme toggle works. Pre-existing unrelated errors (no-html-link-for-pages, refs, unescaped-entities, purity) left out of scope. Branched off origin/main; untracked stray lineage-collective-lines.jsx not touched.

## 2026-06-19 - Add a Story scroll-friendly date picker (feature)
- type: feature
- pr: #110
- branch: feat/story-date-picker
- commit: bc4d639
- ids: none
- scope: story-date-picker
- status: merged
- tsc: clean

Jay flagged the Add a Story date field as awkward on mobile: a native <input type="date"> opens a calendar on the current month, so logging a story from decades ago means tapping back year by year, which is bad for a history app where the date is central. Replaced it with a reusable DateSelect (src/components/ui/date-select.tsx) built from three native <select>s (Year / Month / Day), which render as the iOS wheel picker and the Android scroll list, so any year is one scroll. Pure input-ergonomics swap: it emits the same YYYY-MM-DD string, so the stories.story_date (date NOT NULL) contract and all downstream sort/group/format are untouched, no schema change. Year range 2026..1960 with out-of-range edited values auto-included; day list adapts to the month and is leap-year aware (clamps 31 to 28/29 on Feb); emits "" until all three parts are set so required-date validation still fires. Wired into add-story-modal.tsx only (the other three native date inputs in add-entity/edit-event/add-claim left as a follow-up since claim/event use date ranges + partial dates). Verified at mobile 375px + desktop in preview: placeholders on new, prefill on edit, clamping, leap year, correct emission, no console errors; tsc clean. Branched off origin/main.

## 2026-06-20 - Invite claim preserves the invited name (bug)
- type: bug
- pr: #111
- branch: fix/invite-claim-display-name
- commit: 0a31c62
- ids: none
- status: merged
- tsc: clean

John Stewart's email-invite claim renamed him to johnstew777 (his email local part). Invite claims merged inline in /auth/complete from a token kept in localStorage/sessionStorage, which does not survive the magic-link email hop (a new tab has empty sessionStorage; a different device has empty localStorage), so the merge silently no-opped and the brand-new profile kept the user.email.split("@")[0] placeholder. New POST /api/invite/claim binds the claim to the verified session email (or a forwarded token), repoints the ghost's claims/story_riders, restores the invited display_name (overwriting only a blank or placeholder name) plus empty identity fields, marks the invite claimed, and deletes the ghost; it runs before /api/public/claim-complete so the email-invite ghost is gone before that route's email scan. /auth/complete forwards any stored token and reads the profile back after the claims. /api/invite stores the email lowercased; /claim/[token] also writes the token to localStorage. Migration-free; tsc clean; dev-server smoke test passed (401 auth gate plus both modified pages render and redirect with no console/server errors); full magic-link round-trip needs a manual test. Follow-ups: John's existing prod record still needs a one-time display_name UPDATE (recover the name from invites.person_name where claimed_by is his profile id); the same name-restoration gap exists in claim-complete for PB-010 public ghosts; email-less invites opened cross-device still need the token carried in the magic-link URL.

## 2026-06-20 - Admin edit member display name (feature)
- type: feature
- pr: #112
- branch: fix/admin-edit-member-name
- commit: 4fb10f8
- ids: none
- scope: admin-member-name-edit
- status: merged
- tsc: clean

The /admin Members table could change tier/tokens/status/editor but not a member's display_name, so fixing a wrong name (e.g. a profile that picked up an email-placeholder name pre-#111) needed direct SQL. Adds an inline name editor (pencil affordance) on each Members row, decoupled from the membership edit form on purpose: renaming posts only { user_id, display_name } so it never re-applies the tier block (which would reset an annual member's membership_expires_at). POST /api/admin/memberships now accepts display_name and updates it when non-empty (never blanks). requireEditor-gated; no schema change (profiles.display_name exists). tsc clean; smoke test = both /api/admin/memberships verbs 401 without an editor session and /admin redirects anon via the editor gate; the authed admin UI is editor-gated so the inline editor was verified by tsc + the existing edit pattern, not click-tested. Follow-on from #111; gives Jay the in-app way to fix John Stewart's record.

## 2026-06-20 - Restore public-tag ghost name on claim-complete (bug)
- type: bug
- pr: #113
- branch: fix/public-claim-complete-display-name
- commit: f7d4ffe
- ids: none
- status: merged
- tsc: clean

Closes the name-restoration gap #111 flagged for PB-010 public ghosts. POST /api/public/claim-complete promoted an anonymous "I was there" ghost into a new member (repoint claims/story_riders, flip the paired tag_events from pending/anonymous_aggregate to approved/attributed, leave a merged_from_id breadcrumb, delete the ghost) but never copied the ghost's display_name, so a cross-device signup (onboarding.display_name lost) kept the user.email.split("@")[0] placeholder. Mirrors #111's invite-claim identity restore inside claim-complete's per-ghost loop: reads the ghost identity (display_name, birth_year, riding_since, bio, avatar_url) before deleting it, adopts display_name only when the profile's is blank or equals the email local part, and fills the other fields only when empty. The ghost's typed name comes from POST /api/public/tag (display_name: name); /auth/complete already reads the profile back after this route runs, so the restored name shows on the same load with no refresh. Verified PB-010 flow unchanged and the promotion stays idempotent (a second click finds no ghost; the defensive multi-ghost loop will not overwrite a now-real name). Migration-free; tsc clean. Not browser-verifiable (server-side cross-device magic-link promotion), so checked via tsc + the /auth/complete caller trace. Branched off origin/main since the working branch (fix/admin-edit-member-name, #112) was unrelated.

## 2026-06-21 - Boards & Brands catalog polish (bug)
- type: bug
- pr: #114 (a7c2722)
- branch: auto/bugfix-20260621-0504
- ids: BUG-081, BUG-084, BUG-086
- status: merged
- tsc: clean

Three client-only fixes to the #99 boards/brands catalog. BUG-081: the brands "Most connections" headline number rendered conn.total (includes boards) while the sort ranks by conn.rel (people + events + places), so the count did not descend down the list; the card now shows conn.rel as the headline and keeps the rider/event/place/board split in the breakdown line (comparator unchanged). BUG-086: the "My Boards" filter active state used bg-[#1C1917]/15 border-[#1C1917]/30, invisible on the dark near-black background; switched to theme tokens bg-surface-active border-border-default text-foreground (same fix applied to the identical "My Brands" filter on the brands page). BUG-084: the own-timeline claim-card edit/delete menu trigger was opacity-0 group-hover:opacity-100, so the ⋯ never appeared on touch (no hover on mobile); dropped the opacity gating so the muted ⋯ is always visible and taps open the menu, matching the BUG-044 owner-menu treatment. board-parts.tsx has no card menu, so no change there. Migration-free; tsc clean.

## 2026-06-21 - Token game feel: make earning legible (feature)
- type: feature
- pr: #115
- branch: feat/token-game-feel
- ids: none
- scope: token-game-feel
- status: merged
- tsc: clean

Token earning ran correctly but was invisible (Cory Q1/Q2/Q3): every grant was a silent server-side side effect with no feedback, no daily-progress view, and no signal that free accounts earn. No change to award amounts or the 20/day cap; this only surfaces what already runs. D1: the four award routes (claims, stories, story connections, catalog entity) now return tokens_awarded (the amount the ledger actually recorded, 0 when the daily content cap is spent), and a shared store awardFeedback() shows a "+N tokens earned" toast at the point of action or a daily-cap nudge on 0. The connections popover augments its existing "Connected." toast instead of stacking a second one, and a tokenEarnTick bumps so the chip refreshes without a reload. D2: new GET /api/me/tokens-today returns content_earned_today, cap (imported from tokens.ts, never hardcoded), visit_awarded_today, total_earned_today, and an active visit_streak, all derived from token_events on the same UTC-day boundary as tokens.ts (60-day windowed read for the streak, no migration). New DailyTokenChip renders a progress bar toward the cap, a showing-up/streak line, and an expandable "How earning works" table (canonical values, no verification entry, links to /equity), on /account/membership and the owner My Timeline for all tiers. D3: the free-tier note now shows even at a zero balance. D5 streak included via the windowed read. CAPPED_SOURCES exported from tokens.ts for the new endpoint. Verified: tsc clean; tokens-today 401s unauthed with the right shape; DailyTokenChip screenshotted at desktop, 375px (0px horizontal overflow), and dark mode via a throwaway demo route removed before commit. Authed paths (real toast on save, live chip numbers) need a logged-in session, smoke per brief §8.

## 2026-06-22 - Launch UI polish batch (bug)
- type: bug
- pr: #116 (cfce6d9)
- branch: auto/bugfix-20260622-0500
- ids: BUG-080, BUG-087, BUG-088, BUG-091
- status: merged
- tsc: clean

Four independent client-only launch papercuts; the prior lead (BUG-081/084/086) had already shipped via PR #114, so this picked up the next auto-merge-safe ready brief. BUG-080: the story photo grid gave the first of three photos a col-span-2 (uneven row); now 3 photos render equal on one grid-cols-3 row and 4 photos render as a 2x2 (grid-cols-2), with 1/2/5+ and the +N overflow unchanged. BUG-087: the membership share card hardcoded an all-caps "LINESTRY" in the display font; it now renders mixed-case "Linestry" in the Calendula wordmark font (var(--font-wordmark)), per the brand rule; the small letter-spaced LINESTRY.COM url caption is left as-is. BUG-088: the onboarding selected resort/brand chip used hardcoded bg-blue-950/30 + text-blue-200, near-invisible blue-on-pale-blue in light mode; switched to theme tokens bg-accent-tint + border-accent/40 + text-accent-strong so it meets AA in both themes (applied to the identical PlaceSelect and BrandSelect chips). BUG-091: the category nav row labelled the riders tab "People" on /me/* (settings, tags) because activeCommunity was unresolved there; added an onMeRoute branch so it resolves from communitySlug (already the active community) and the tab reads "Riders", mirroring the BUG-016 /people fix; no routing/showCommunityRule change. Migration-free; tsc clean.

## 2026-06-22 - Membership tier-state + founding re-purchase guard (bug)
- type: bug
- pr: #117 (fe7e714)
- branch: bugfix/membership-tier-state-077
- ids: BUG-077
- migration: none
- status: merged
- tsc: clean

/membership misrepresented a signed-in member's tier: the hero "Claim founding spot" button was live for an existing founding/paid member (charge-again risk) and the free Rider card was mislabelled "Your current plan" for any non-free member. Added TIER_RANK and derived heldRank/hasPaidTier from membership.tier directly (restored from storage before authReady, so suppression holds through the pre-hydration flash; the affirmative YOUR TIER/Active badge still gates on isLoggedIn). The hero founding button renders only when !hasPaidTier; a tier card's purchase CTA renders only for a tier strictly above the held rank (never a re-purchase or downgrade, upgrades still show); handleCta bails before checkout on a held/downgrade tier; the free card "Your current plan" shows only when tier === "free". Client render guards only, no migration. tsc clean; verified logged-out baseline + founding/annual stubs locally; signed-in badge smoke owed on Vercel preview per brief. Offer-matrix (gift/upgrade) is a separate feature session.

## 2026-06-22 - Brand-link 404 + worked_at bucketing + boards Back nav (bug)
- type: bug
- pr: #118 (4810507)
- branch: bugfix/brand-link-404-nav-083
- ids: BUG-083, BUG-092, BUG-082
- migration: none
- status: merged
- tsc: clean

The Linestry.com brand-entity cluster plus the boards Back papercut. BUG-083: the brand [slug] resolver compared the inbound slug to orgSlug(o) case-sensitively; orgSlug() is case-preserving ("Linestry.com" -> "Linestry_com") and all brand links already route through orgSlug, so the canonical link resolves, but a lowercased/shared/legacy URL 404s (repro confirmed: exact-case resolves, lowercase 404s). Fix = case-insensitive compare; useCanonicalPath already canonicalises the bar. The brief's "orgSlug lower-cases" mechanism was inaccurate, noted in the PR. BUG-092: the person-timeline filter mapped worked_at to Places by predicate alone; added claimCategory() that disambiguates worked_at by object_type (org -> Brands, else Places), used by BOTH the filter and the chip counts so they agree. Verified on cory_yip: Places 3 -> 2, Brands 0 -> 1. BUG-082: drill-down is URL-driven but used router.replace for every transition, so entering a brand was not a distinct history entry; openBrand now pushes (Back from a board -> drill-down, Back from drill-down -> brand index), lateral switches stay replace so the nav reset still works. tsc clean. BUG-083/092 verified in preview; BUG-082 Back needs real-device verification (preview cannot dispatch click-driven router nav), flagged for Jay per the human-run designation.

## 2026-06-22 - Token feedback follow-up: visit toast + earned-by-type breakdown (feature)
- type: feature
- pr: #119 (54152d0)
- branch: feat/token-feedback-followup
- ids: none
- scope: token-game-feel
- migration: none
- status: merged
- tsc: clean

Follow-up to #115 (merged 743d4c3) from Jay's live feedback on linestry.com: #115 is deployed, but visiting still felt silent and the expanded chip showed the earning rules, not the user's own earnings. No change to award amounts or the cap. (1) /api/me now returns daily_visit_awarded (true only on the load that wins today's reward); CatalogLoader fires a reward toast ("Welcome back. +1 token for showing up today.") at most once per UTC day and bumps the chip refetch tick. The daily +1 earning itself was already running (award_daily_visit, unchanged), it just had no client signal. (2) GET /api/me/tokens-today now returns by_source (today's token_events summed per source); the DailyTokenChip expanded panel ("Today's breakdown") leads with a TODAY section showing earnings by type in emerald (Timeline entries, Sources cited, Story connections, Catalog adds, Showing up), with the HOW EARNING WORKS rules below. (3) New "reward" toast variant (emerald border + diamond mark) so the earn moment reads distinctly from a neutral info or error; used by every earn toast (actions, connections, daily visit). Verified: tsc clean; chip breakdown screenshotted at desktop + 375px (0px overflow) and the reward toast confirmed in the DOM (emerald-500/60 border + mark) via a throwaway demo route removed before commit. Authed end-to-end (real visit toast on login, live numbers) needs a logged-in session, smoke after deploy. Did NOT stage the pre-existing working-tree edits to .gitignore / CLAUDE.md (not mine).

## 2026-06-22 - PENDING auto-stub (feat/brand-page-redesign-phase1)
- type: feature
- pr: (open PR)
- branch: feat/brand-page-redesign-phase1
- commit: 54152d0
- ids: none
- status: pending
- tsc: n/a

_Auto-stub from the SessionEnd hook (agent did not log this session). Expand to a one-line summary and flip status to merged during the daily reconcile._

## 2026-06-22 - Brand page redesign Phase 1: baseline lift (feature)
- type: feature
- pr: #120 (33bd717)
- branch: feat/brand-page-redesign-phase1
- ids: none
- scope: brand-page-redesign-phase1
- migration: 20260622000001_brand_page_phase1.sql (APPLIED)
- status: merged
- tsc: clean

Phase 1 of the two-phase brand-page brief (Operations/brand-page-redesign-brief.md): the baseline lift on every brand page. Redesigned the org header in src/app/(community)/[community]/brands/[slug]/page.tsx: logo_url (or initials in the wordmark font), a 5px brand-color accent bar (orgs.brand_color, fallback --accent #3B82F6), an uppercase type/est/country kicker, the wordmark name, description and website link; a CTA row led by a brand-filled "Contribute a story" as the primary action (opens AddStoryModal pre-linked via the already-shipped linkedOrgId default for members, routes signed-out visitors through signInHref and back), plus Add a claim and Visit website; a five-stat row (connected riders, board models, events, places, stories); and a brand-tinted invite strip. Removed the redundant tabs-row Add-claim button. New brand-color helpers in utils.ts (resolveBrandColor + whiteReadableOn + brandButtonColor) keep white button text legible, falling back to --accent on a too-light brand color. Migration 20260622000001 adds orgs.brand_color + orgs.banner_url (both nullable/additive, not sent by the member create path, migrate-then-merge safe; orgs load via select("*") so the new Org fields reach the page with no select change). banner_url is seeded for Phase 2's curated hero. Verified in preview: desktop + dark-mode header, 0px overflow at 375px, blue fallback color path (accent bar + Contribute button resolve to #3B82F6 when brand_color null), console clean. Localhost reads the real DB, so mock brand_color injection was inert (reverted); live brand_color render is a smoke check once a value is set (e.g. update orgs set brand_color='#D72638' where name='Westbeach'). Contribute click-flow (modal open / anon redirect) is code-wired but not preview-exercisable (Next 16 iframe click limitation), needs a real-device click post-deploy. Phase 2 (curated/partner layer gated by curation_tier + /admin/brand/[id] manage surface) is the follow-up PR, pairs with the NEXT-FEATURE lead story-connections-brands. Did NOT stage the pre-existing working-tree edits to .gitignore / CLAUDE.md (not mine).

## 2026-06-23 - RLS enable on 5 advisor-flagged public tables (feature)
- type: feature
- pr: #121 (f46bf05)
- branch: fix/rls-flagged-tables
- ids: none
- scope: rls-flagged-tables
- migration: 20260623000001_rls_enable_flagged_tables.sql (APPLIED)
- status: merged
- tsc: n/a (SQL-only, no TS touched)

Resolved the Supabase Security Advisor rls_disabled_in_public ERRORs (flagged 22 Jun 2026) on five public-schema tables: people, token_events, gift_codes, distributions, event_series. With RLS off, the public anon key (shipped in the client bundle) could read/insert/update/delete these directly via PostgREST, bypassing every API-route auth check; notably the full token_events ledger was readable and gift_codes were readable and redeemable by anyone with the project URL. Migration 20260623000001 enables RLS on all five with behavior-preserving policies verified against the code: people gets public select (catalog browse + /claim page) plus authenticated insert (matches the addUserPerson store path, store ~739), event_series gets public select (writes are service-role via /api/catalog/entity), and token_events + gift_codes + distributions get RLS with no policies (server-only; the service role has BYPASSRLS so every API route is unaffected; distributions is unreferenced anywhere in the app). Policies are created before RLS is enabled inside one transaction so reads never break mid-apply. No application code changed, so the SQL is safe to apply independently of the merge (no write-path coupling). Committed on a throwaway worktree off origin/main so it ships independently of the in-progress brand-page Phase 2 branch; did NOT stage the pre-existing working-tree edits to .gitignore / CLAUDE.md (not mine). Migration applied and verified by Jay (3 testing sets passed) and #121 merged (squash f46bf05); RLS now enabled on all five tables and the advisor errors are cleared.

## 2026-06-23 - PENDING auto-stub (feat/brand-page-redesign-phase2)
- type: feature
- pr: (open PR)
- branch: feat/brand-page-redesign-phase2
- commit: 33bd717
- ids: none
- status: pending
- tsc: n/a

_Auto-stub from the SessionEnd hook (agent did not log this session). Expand to a one-line summary and flip status to merged during the daily reconcile._

## 2026-06-23 - Brand page redesign Phase 2: curated / partner layer (feature)
- type: feature
- pr: #122 (6ff0e85)
- branch: feat/brand-page-redesign-phase2
- ids: none
- scope: brand-page-redesign-phase2
- migration: 20260623000001_brand_page_phase2.sql (APPLIED)
- status: merged
- tsc: clean

Phase 2 of the two-phase brand-page brief (Operations/brand-page-redesign-brief.md), following Phase 1 baseline lift (#120). Curated/partner layer gated by a new orgs.curation_tier ('standard' default | 'curated' | 'founding'). In src/app/(community)/[community]/brands/[slug]/page.tsx, when curated/founding the page renders, above the shared feed and in mockup order: a full-bleed hero (banner_url or brand-color gradient fallback) with logo lockup + verified badge + kicker + heritage-derived tagline (founding adds the partner_label ribbon), CTA row + 5 stats under the hero, a dark heritage_statement block, a brand_milestones timeline spine (brand-color nodes), a featured_rider_ids team rail (violet-ringed, skips unresolved or private profiles per privacy_level), a brand_media grid, a richer contribute module with prompt chips (story + AddBrandClaimModal claim presets via a new initial prop), a sidebar "From {brand}" brand_links card, and a provenance line. Empty curated fields hide their section; standard pages render zero curated sections; CTA buttons + stat blocks are shared consts across tiers so they never drift. New editor manage surface at src/app/admin/brand/[id]/page.tsx, inheriting the /admin requireEditorPage gate, sets every field incl. logo/banner uploads to the board-images bucket (mirrors /admin/community) and saves via the generic /api/admin update path through updateCatalogEntity (orgs whitelisted there, passes arbitrary columns straight to .update, so NO new route). Editor-only "Manage page" link surfaced on the brand page (membership.is_editor || tier==='founding'). Migration 20260623000001 adds curation_tier + heritage_statement + brand_milestones(jsonb) + featured_rider_ids(uuid[]) + brand_media(jsonb) + brand_links(jsonb) + partner_label; all nullable/additive, not sent by the member create path, migrate-then-merge safe; orgs load via select("*") so the Org fields reach the page with no select change. tsc clean. Verified in preview: full curated render (hero/heritage/timeline/5-card team/media/contribute/brand-links/provenance) via a throwaway local injection on o25 (reverted before commit, since localhost reads the real DB and no curated data exists yet); 0px overflow at 375px on both tiers; standard tier unchanged (no regression after the shared-consts refactor); /admin/brand/[id] compiles and its inherited editor gate redirects anon to /auth/signin. Editor form + image upload + live curated data are a post-deploy smoke with an editor session (set a brand to curated/founding and populate; Westbeach is the intended first partner, seed content in Drive Brand/Westbeach-Page-Seed-Content.md). Reused the gotcha from Phase 1: localhost catalog reads real Supabase orgs even anon, so mock/data injection for verification must be a reverted code throwaway, not mock-data. Did NOT stage the pre-existing working-tree edits to .gitignore / CLAUDE.md (not mine).

## 2026-06-23 - Admin brand manage: slug resolve + /admin/brand index (fix)
- type: fix
- pr: #123 (8ccfcd6)
- branch: fix/admin-brand-slug-and-index
- ids: none
- scope: admin-brand-slug-index
- migration: none
- status: merged
- tsc: clean

Follow-up to brand-page Phase 2 (#122) from Jay's live use. (1) /admin/brand/[id] resolved the org by id only, so /admin/brand/westbeach (a slug) showed "No brand found"; now matches id OR case-insensitive orgSlug, mirroring the public brand page resolver (added orgSlug import). (2) New /admin/brand index page lists every brand (searchable, current curation-tier badge) linking to each manage page, links by id (resolver accepts both). (3) "Brand Pages" link added to the /admin dataset-editor header beside Community for discoverability. Reminder surfaced to Jay: curation is set via the "Page tier" toggle (Standard/Curated/Founding) at the top of the manage page, then Save (not the community setup). No migration. tsc clean; all three admin routes compile (no server errors) and the inherited requireEditorPage gate redirects anon to /auth/signin; slug resolver mirrors verified public-page logic, editor-session form load is Jay's post-deploy smoke. Did NOT stage the pre-existing working-tree edits to .gitignore / CLAUDE.md (not mine).

## 2026-06-23 - Admin brand: milestone row layout + Manage-page slug link (fix)
- type: fix
- pr: #124 (48af3d5)
- branch: fix/admin-brand-milestone-layout
- ids: none
- scope: admin-brand-milestone-layout
- migration: none
- status: merged
- tsc: clean

Two follow-ups to brand-page Phase 2 admin (#122/#123) from Jay's live use. (1) Milestone + brand-link editor rows string-concatenated a width class onto inputCls (e.g. `inputCls + " w-20 shrink-0"`), but inputCls already carries w-full; without twMerge both survive and w-full wins, so the year field stretched full width and collapsed the label to zero (Jay's screenshot). Fix = route the conflicting cases through cn(): year is fixed w-20 shrink-0, label/url are flex-1 min-w-0 so they fill the row. Lesson: never string-concat a width/competing Tailwind class onto a const that has one; use cn()/twMerge. (2) Brand page "Manage page" link pointed at /admin/brand/{id} (e.g. /admin/brand/o15, Westbeach's prod id); now /admin/brand/{orgSlug(org)} to match the address bar + public page (resolver accepts both since #123). No migration. tsc clean; twMerge dedup confirmed via node (w-full dropped when w-20 added, label keeps flex-1 min-w-0); edited admin route compiles and editor gate redirects anon to /auth/signin; form visual is Jay's editor-session smoke. Did NOT stage the pre-existing working-tree edits to .gitignore / CLAUDE.md (not mine).

## 2026-06-23 - Profile connections: add connections + add story from a person's page (feature)
- type: feature
- pr: #125 (e0451bd)
- branch: feature/profile-page-connections
- ids: none
- scope: profile-connections
- migration: none
- status: merged
- tsc: clean

Signed-in members can add to anyone's timeline directly on the public /people/[id] page, the person-page analog of Story Connections. New AddPersonConnectionsPopover writes one public claim per pick through store.addClaim (Places=rode_at, Brands=sponsored_by, Events=competed_at, Riders=rode_with, plus an "I rode with them" fast path with subject=viewer), inheriting the optimistic insert + can-tag precheck + rollback/reward toasts; inline entity create per section (brands default org_type=brand). AddStoryModal gained defaults.riderIds + defaults.onTimeline so "Add story about {name}" opens pre-tagged and off the viewer's own timeline. Both surfaces gated to signed-in members on someone else's profile; the OwnerTimelinePanel short-circuit keeps them off self. No migration/table/column/view/route: the POST /api/claims path + tag_events + claims_public already handle subject-is-other, and adds flow through the PB-009 pending pipeline so the tagged person can decline at /me/tags. tsc clean; no new eslint. Verified in preview: page renders 200 with no console errors, signed-out shows no add buttons. Auth-gated click flows (popover picks, story modal, mobile sheet) are code-verified, pending Jay's real-device smoke. Honest flag: undated popover claims bucket under the "Unknown" decade (D2 chose no date input). status pending = PR #125 open, merge-only (no migration), awaiting Jay's merge.

## 2026-06-23 - Working-tree cleanup for auto sessions: document feature-session workflow + gitignore /features/ (chore)
- type: chore
- pr: none (committed directly to main per Jay's choice; 96c521d, pushed)
- branch: main
- ids: none
- scope: feature-session-docs + tree-cleanup
- migration: none
- status: merged
- tsc: n/a (CLAUDE.md + .gitignore only, no TypeScript touched)

Pre-auto-session tree cleanup. Landed the two long-dangling working-tree edits the #124 session deliberately left unstaged ("not mine"): the "Feature sessions" section in CLAUDE.md (feature-side mirror of the bug-fix loop) and a /features/ line in .gitignore. The gitignore line is load-bearing for scripts/auto-bugfix.sh: its preflight aborts on a dirty tree (git status --porcelain non-empty), and an untracked features/ directory counts as dirty, so without the ignore the runner would abort even after the modified files were resolved. Both changes were absent from origin/main, so committed straight to main (96c521d) and pushed per Jay's choice, not via PR. Also: pruned 61 squash-merged local branches (classified against gh PR merged-state, not git branch --merged, which misses squash-merges), dropped 2 stale stashes (pre-PR-18 settings snapshot + equity-session auto-bugfix.sh WIP; SHAs a701a04a / f3c7a103 recoverable via reflog ~90d), and cleared a 5-hour-old stale .git/index.lock from a crashed git command. Repo left on main == origin/main, clean tree, 1 local branch, 0 stashes, 0 open auto PRs; verified against the auto-bugfix.sh preflight checks. No app code, no migration, nothing user-facing deploys.

## 2026-06-24 - Timeline player visual polish (bug)
- type: bug
- pr: #126 (ecb4277)
- branch: auto/bugfix-20260624-0500
- ids: BUG-097, BUG-098, BUG-102
- migration: none
- status: merged
- tsc: clean

Three client-only fixes on the shared timeline player (timeline-player.tsx). BUG-097: the final/outro slide BrandMark now passes an explicit light dotColor (#F6F6F5) so the contrast center dot reads white on the dark slide instead of falling back to var(--foreground) ink. BUG-102: the highlight-slide entityName resolver gained an object_type === "org" branch that looks the object up in catalog.orgs, so a worked_at claim against a brand/org (e.g. Cory's "Worked at Linestry") shows the brand name instead of "Unknown". BUG-098: the vignette overlay is now a fixed inset-0 full-bleed layer centered at 50% 50% (locked to the viewport rather than the flex containing block), keeping the radial symmetric on mobile; spread and opacity unchanged so desktop is unaffected. No migration, no _public view, no auth/payments.

## 2026-06-24 - Contribution-token claw-back on delete (BUG-103 token-farm) (bug)
- type: bug
- pr: #127
- branch: bugfix/bug-103-token-farm-clawback
- ids: BUG-103
- migration: applied 20260624000001_token_events_source_ref.sql (applied by Jay in-session)
- status: merged
- tsc: clean

Stops add/delete/re-add farming of equity-linked contribution tokens (surfaced by Cory). Jay chose claw-back over an idempotency guard: award on create as before, then reverse on delete so the cycle nets to zero. token_events gains a nullable source_ref tying each award to its entity (claim/story/entity/conn) + a clamped decrement_contribution_tokens RPC; new reverseContributionTokens in tokens.ts nets the ledger per source and decrements via the RPC (idempotent, best-effort, ledger-first ordering). Wired into DELETE claims/[id] (vs asserted_by), DELETE stories (author), DELETE story connections (the adder); all four capped award paths stamp source_ref, catalog entity stamped for the audit only (no member delete). Q2 retroactive audit (docs/bug103-cory-token-audit.sql) was built but NOT run: Jay's call is to let Cory keep his already-farmed tokens as a finder's reward, since the claw-back stops all future farming (one-time amnesty). Verification-denial claw-back deferred (the reported farm is self-claims with no tag_event; decline spans 4 routes with a many-to-one tag-to-entry mapping). Migration applied in-session; PR #127 merged 2026-06-24.

## 2026-06-24 - Story Connections: add Brands to the +Connect flow (feature)
- type: feature
- pr: #128
- branch: feat/story-connections-brands
- ids: none
- scope: story-connections-brands
- migration: applied 20260624000002_story_orgs.sql (applied by Jay in-session)
- status: merged
- tsc: clean

Adds Brands as the 4th Story Connections type (beside riders/places/events), implementing features/story-connections-brands-brief.md. Brands map to orgs and are not person-implicating, so it clones the place/event path: new story_orgs junction (org_id text, no tag_events, no moderation), org rides the existing place/event branch in the connections route POST/DELETE (inherits the BUG-103 token claw-back), GET /api/stories gains a community_orgs map + the org_id filter upgraded to the author-link-OR-junction union (surfaces brand-connected stories on /brands/[id]), popover gains a Brands picker over catalog.orgs + inline create, StoryCard renders cyan community brand chips with the x removal appendage. Extended beyond the brief's file list to keep brands a true peer: the public timeline /t/[slug] (read helper populates community_orgs + resolves org ids, PublicStoryCard renders cyan chips) and the community-landing connection count. Also corrected the StoryCard author brand chip from rose to cyan (matches the orgs tier docs + the public-timeline card + its already-cyan dot; Jay confirmed keep-cyan). Verified pre-migration: tsc clean, GET returns community_orgs and degrades to empty when story_orgs is absent (no 500), stories index + /t + /brands render clean, brand chips cyan (0 rose). Migration is a HARD pre-merge gate (POST writes story_orgs unconditionally). Migration applied + PR #128 merged 2026-06-24 in-session.

## 2026-06-24 - Editor/moderator delete-any-story takedown (feature)
- type: feature
- pr: #129
- branch: feat/moderator-delete-story
- ids: none
- scope: moderator-delete-story
- migration: none
- status: merged
- tsc: clean

Gives editors an in-app path to remove ANY story (abuse / illegal / duplicate). Previously DELETE /api/stories was owner-only (author_id === user.id) and the only takedown for someone else's story was hand-editing Supabase, which also skipped the app cleanup (tag_event disable, tag_report close, token claw-back). Server: DELETE /api/stories now authorizes author OR is_editor, matching the requireModerator() boundary (is_editor only, NOT founding tier) used by tag-queue / asserters. The BUG-103 contribution-token claw-back now reverses from existing.author_id rather than user.id, so a moderator takedown still nets the author's tokens to zero and never touches the moderator's ledger (owner case unchanged since author_id === user.id). The story_deleted analytics event records moderated + author_id for the /admin/activity audit. UI: StoryCard opens its menu to editors on non-owned stories, delete-only (no edit), labelled "Delete (moderator)" with confirm copy "Delete this member's story? It will be removed for everyone"; handleDelete now toasts on a non-2xx instead of optimistically dropping the card. Gated by membership.is_editor, the same flag the server checks. No migration. Decisions: boundary = is_editor not founding (moderation action, not a perk of tier); delete-only for moderators (editing another member's narrative was out of scope). Verification: tsc clean; the affordance is behind an authed editor session viewing a non-owned story, which the local preview cannot reach, so a real-device editor smoke is owed (menu shows on another member's story, takedown removes it for everyone, author token balance drops by what the story earned). Owner edit + delete path byte-compatible.

## 2026-06-24 - "Entry #N" celebration count reconciled to the timeline "All" pill (bug)
- type: bug
- pr: #130
- branch: bug-104-entry-count-mismatch
- ids: BUG-104
- migration: none
- status: merged
- tsc: clean

Fixes the post-add celebration reading "Entry #N on your timeline" higher than the timeline "All" pill (Cory: #8 vs All 6), which read like deletes were ignored. Root cause was a set mismatch, not a stale delete: the celebration used raw personClaims.length, while the "All" pill folds companion rode_with rows into their rode_at parent, drops boards (own shelf), and adds days + stories. getAllClaims already excludes deletedClaimIds, so deletes did shrink personClaims; the baseline was just inflated. Extracted the pill formula into one shared helper countTimelineEntries() in companion-grouping.ts, routed both the FeedView "All" pill (provably identical refactor) and the owner panel celebration through it; since FeedView is fed claims=personClaims / days=myDays / stories=stories, the two now evaluate the same expression and can't drift. A board add reads the distinct-board "Boards" pill count instead, so a 3rd+ board never reports "Entry #0" on an otherwise-empty timeline. Milestone celebrations (1/5/10 entries) intentionally stay on the raw in-session count (out of scope, once-ever, separate surface). Client-only, no migration. Verified by code analysis + tsc clean; the toast only fires after a click-driven Add Claim submit the local preview cannot exercise (Next 16 + iframe), so a real-device smoke of the count is owed. PR #130 merged 2026-06-24 in-session (squash 06a7651).

## 2026-06-24 - Curated brand page polish + curated list-card upgrade (feature)
- type: feature
- pr: #131
- branch: curated-brand-improvements
- squash: 9fdf661
- ids: none
- scope: curated-brand-page-improvements
- migration: none
- status: merged
- tsc: clean

Five improvements to the curated/partner brand page (Westbeach is the first brand using the curated tier). Detail page: dropped the heritage tagline that was layered over the hero banner (it duplicated the heritage statement's first line, which still renders in full in the Heritage section); collapsed the repeated "curated by the brand" language to short "Curated" tags on hero/heritage/timeline plus a single "Curated by Linestry" attribution at the page foot; the connected-riders headline now unions claim-connected riders with the curated team (featured_rider_ids) so a team member without a claim still counts (Westbeach went 3 to 10), with standard brands unaffected since their featured list is empty; and the brand feed now opens on the Stories tab instead of All. Brands list: curated/founding cards render the brand logo and a violet "Curated" tag in place of the plain initial block. No migration (curation_tier, logo_url, featured_rider_ids already exist in prod). Verified in local preview against real Westbeach (o15, founding) for the detail page; the list card was verified via a temporary curated-field injection screenshot then reverted, because localhost catalog.orgs intermittently falls back to mock data (real o15 loads fine in prod). tsc clean. PR #131 merged 2026-06-24 in-session (squash 9fdf661).

## 2026-06-25 - Launch UI polish batch: copy/format + toast stacking (bug)
- type: bug
- pr: #132
- branch: bugfix/2026-06-25-ui-polish-batch
- ids: BUG-105, BUG-110, BUG-111, BUG-112, BUG-107
- migration: none
- status: merged
- tsc: clean

Five small client-only launch-polish fixes. BUG-105: the Add-Story Links tab event picker rendered the year twice ("Baker Banked Slalom 2019 2019") because catalog event names already end in the year and getLabel appended it again; getLabel now appends the year only when the name does not already end in it. BUG-110: the brand-page event row showed "Contest 1997" (CSS capitalize + bullet) while the Events section shows "CONTEST 1997"; aligned the brand-page chip to the Events-section canonical (uppercase, tracking-widest, no bullet, space before the year). BUG-111: shortened the brand-page stat labels "connected riders" to "riders" and "board models" to "boards" so the stat row fits one line at 414px; the other three stats unchanged. BUG-112: the brands list breakdown line and the sort tooltip said "location"/"locations"; changed to the site "place"/"places" noun (kept lowercase to match the sibling "riders/boards/events" in the same line). BUG-107: the "+1 token earned" toast was covered by the bottom-right claim/celebration toast (CelebrationOverlay, higher z-index); the toast stack now lifts above the celebration card (bottom-36) when a Tier 1-2 celebration toast is present so both read. Client/render/copy only, no migration. tsc clean. Toasts and the celebration card are click-driven Add Claim surfaces the iframe preview cannot exercise (Next 16), so a real-device smoke of the stacking is owed.

## 2026-06-27 - PENDING auto-stub (feature/equity-membership-gate-comp)
- type: feature
- pr: #133
- branch: feature/equity-membership-gate-comp
- commit: dd70a63
- ids: none
- status: merged
- tsc: n/a

_Auto-stub from the SessionEnd hook. Superseded by the full "Equity offer membership gate + contributor comp (feature)" entry below; PR #133 merged as `b4d1928`. Flipped pending to merged in the June 28 daily reconcile._

## 2026-06-27 - Equity offer membership gate + contributor comp (feature)
- type: feature
- pr: #133
- branch: feature/equity-membership-gate-comp
- ids: none
- scope: equity-membership-gate-comp
- migration: applied 20260627000001_equity_membership_gate.sql
- status: merged
- tsc: clean

Gated the 100,000-share equity pool behind active membership and added a contributor comp. New shared isEquityEligible predicate (equity-offer.ts) counts non-free, non-lapsed tiers only; gifted memberships count (Jay's call: a gift is a real paid membership) and a comp passes as an active Annual. GET /api/equity/pool now sums only eligible members so free contributors stop inflating the denominator (verified live: 3 eligible). maybeGrantContributorComp (tokens.ts), wired into awardContributionTokens after a real grant, gives a free user crossing 100 contribution tokens a 12-month annual comp (membership_source='comp', one-time comp_earned_at latch, race-safe guarded update, no member tokens minted per D-Q2); a lazy revert in GET /api/me drops a past-expiry comp back to free while keeping the latch. membership_source='paid' is now stamped on every real acquisition (Stripe webhook, gift redeem, admin grant; cleared on admin downgrade) so the comp revert never touches a paid or gifted member. /account/membership gates the live estimate on eligibility and shows free riders a locked state plus progress toward the comp; /equity gained a "Who shares the pool" two-ways-in block and reworded earner phrasings so free users are not implied to receive equity. Migration 20260627000001 (additive membership_source + comp_earned_at columns + backfill of existing active memberships to 'paid') applied before merge. Auth-gated membership-page states are code-only (preview cannot drive a signed-in session), so a real-device smoke of the free locked state and an actual 100-token comp grant is owed. Pre-flight count of existing free profiles with >= 100 contribution tokens was surfaced for the retroactive-comp decision (out of scope; comp fires on next earn, not a backfill).

## 2026-06-28 - Launch UI polish batch 3: brand riders label + public-view Preview 404 (bug)
- type: bug
- pr: #134
- branch: auto/bugfix-20260628-0500
- ids: BUG-118, BUG-119
- migration: none
- status: merged
- sha: 2eec5f6
- tsc: clean

Two client-only polish fixes from one Cory session. BUG-118: the brand page filter tab labelled the riders metric "People" while the top stat tile said "riders"; renamed the tab label to "Riders" (key stays "people", filter logic untouched), matching the shipped BUG-016 / BUG-091 rename on a new surface. Tile and tab order already agreed (riders/boards/events/places/stories in both arrays), so no reorder. BUG-119: the "Preview" link on /me/public-view was gated on slug only, but slug is backfilled for every profile, so the link rendered even with the public timeline off and 404ed when /t/[slug] notFound()s; gated it on slug && enabled so it only shows when the timeline is on (the existing amber "turn it on" banner already covers the off state). No migration, render/copy only.

## 2026-06-28 - Onboarding state lost across the magic-link round trip (bug)
- type: bug
- pr: #135
- branch: bugfix/115-116-magic-link-onboarding-state
- ids: BUG-115, BUG-116
- migration: none
- status: merged
- tsc: clean

A new member finishing email signup via the magic link lost the typed name (BUG-115, it fell back to the email local-part) and the home-mountain / board-brand picks (BUG-116, empty timeline). One root cause: the onboarding selections live only in the persisted client store, which does not survive the link opening in a fresh context (the iOS Mail default), so /auth/complete read an empty store and fell back to email.split("@")[0] with zero claims to migrate. Fix carries the onboarding payload (display_name, birth_year, start_year, first_place_id, first_board_id, and the pending session claims) to the server at magic-link generate time and stashes it on the auth user's user_metadata via admin.updateUserById (D1, no migration); the OTP fallback stashes the same payload via signInWithOtp data. /auth/complete reads user_metadata as a fallback only when the client store is empty, so the same-browser happy path is byte-for-byte unchanged (D3); the stash is cleared after a successful complete so it cannot replay, and OAuth signup stays in-context and never reads it. HUMAN-RUN, auth-sensitive: a real-device smoke (open the link in a separate browser/window simulating iOS Mail and confirm the name + picks carry) is owed.

## 2026-06-28 - Private story owner visibility (bug)
- type: bug
- pr: #136
- branch: bugfix/bug-106-private-story-owner-visibility
- ids: BUG-106
- migration: none
- status: merged
- tsc: clean

A private ("Only Me") story the author added to their own timeline appeared optimistically, then dropped on reload. Root cause: GET /api/stories forced visibility=public on the list branch, so the owner timeline on /people/[id] (fetched by author_id) filtered out the author's own private story on refetch. Fix: in the list branch, when the requested author_id equals the authenticated viewer, include that author's own non-public stories (public OR author_id=viewer), narrowed by the existing author_id eq to all of the author's own stories regardless of visibility. Every other list, and any list not scoped to the viewer's own author_id, stays public-only, so no private story leaks to another viewer. No migration (stories has no _public view); read-path filter only. HUMAN-RUN: a prod smoke (add an Only Me story to your own timeline, refresh, confirm it stays for you and is invisible to others) is owed.

## 2026-06-28 - People In Your Timeline + Unclaimed Rider Job (feature)
- type: feature
- pr: #137
- branch: feature/people-in-timeline-unclaimed-job
- ids: none
- scope: people-in-timeline-and-unclaimed
- migration: none
- status: merged
- tsc: clean

Implements features/people-in-timeline-and-unclaimed-brief.md (Batches C + B). Reads existing claims_public + catalog only; no DB changes, no new routes, no migration. New PeopleInTimeline strip on My Timeline (OwnerTimelinePanel, between rider card and timeline): the viewer's rode_with partners, capped at 6 most-recent-first with a "See all {N}" link to /people?mine=1, each partner linking to "See our connection" and offering a single "Add a story" that opens AddStoryModal pre-tagged via defaults.riderIds; unclaimed partners get an inline "Not on Linestry yet" + "Help connect" treatment (delivers batch B item 7 inline). /people gains a sixth "Unclaimed" sort tab (invitable nodes grouped under the Unclaimed Profiles label, composes with search + My Riders), honors ?mine=1 to pre-enable My Riders, and shows a "You rode together" pill + "See connection" link on connected rows. /people/[id] gains a sparse-ghost empty state for an unclaimed profile with an empty feed. C-2 (AddStoryModal defaults.riderIds) and C12 (Compare pre-seed) were already shipped; BulkInvitePrompt kept as-is. Verified: tsc clean; /people renders with the new tab; ?mine=1 pre-enables My Riders; unclaimed profiles render; no console errors on touched pages. The owner strip + connected pill need an authed session the local preview cannot establish (known localhost-signin limitation), so those two were validated by types + code review rather than a live screenshot.

## 2026-06-29 - Node claim by admin invite (feature)
- type: feature
- pr: #138
- branch: feature/node-claim-admin-invite
- ids: none
- scope: node-claim-admin-invite
- migration: 20260629000001_node_claim_admin_invite.sql (applied 2026-06-29, before merge)
- status: merged
- tsc: clean

Implements Operations/node-claim-admin-invite-brief.md. A third claim path: a NOT-logged-in visitor on a claimable person node ("that's me") submits an email, the request lands in /admin/claims as claim_kind='public_invite', the admin confirms identity and approves, and approval sends an invite magic link that creates the account and folds the existing node into the new profile at signup. Works on /people/[id] (anonymous ClaimNodeSheet) and /t/[slug] (a "that's me" chip on claimable tagged riders). Key design: NO merge_person for public_invite (a brand-new signup has no people.claimed_by row, confirmed against the live merge_person body in pre-flight), so on approval we stamp the node's invite_email + flip catalog->unclaimed and send the invite; the fold-in runs via the shared promoteGhostToAccount() helper extracted from claim-complete (public path unchanged, keeps its 7-day hold; admin-invite path skips the hold via POST /api/public/admin-invite-complete, wired into /auth/complete before claim-complete). New: POST /api/public/claim-node (anonymous submit, public-tag rate limit scoped to node id, D6 one-open-claim-per-node+email guard), claimInviteHtml + claimRequestAdminHtml (admin notify D7, per-claim on submit, ADMIN_NOTIFY_EMAIL default jay@lineage.community), admin queue null-claimant safety + richer card (email/tier/added-by/claim-count) + protected verify-out-of-band banner, vouch surface excludes email-first claims (D5). Decisions: D1 approve-first all tiers + protected banner (no separate verify-only route); D7 per-claim notify. Migration was a hard pre-merge gate (new route reads/writes claim_kind + claimant_email). HUMAN-RUN: prod smoke owed per brief acceptance section 7 (anon submit on a claimable node -> admin approve -> invite link -> signup folds node in). Set ADMIN_NOTIFY_EMAIL in Vercel if a non-default reviewer is wanted.

## 2026-06-29 - FNRad Featured Timelines Phase 1 (feature)
- type: feature
- pr: #139
- branch: feature/fnrad-featured-timelines-phase1
- ids: none
- scope: event-featured-timelines
- migration: 20260629000002_fnrad_featured_timelines_phase1.sql (applied 2026-06-29, before merge)
- status: merged
- tsc: clean

Phase 1 (Foundation) of features/event-featured-timelines-build-brief.md. Data-layer + types only; no UI, no new API surface. Generalizes public_stack_entries owner from profile-only to {profile, event, org} via owner_type + owner_id (owner_profile_id relaxed to nullable, kept for the profile cascade, backfilled into owner_id, new index on (owner_type, owner_id, position)); /api/me/stack now writes owner_type='profile' + owner_id so new profile rows are forward-compatible while the read path stays keyed on owner_profile_id (existing profile stacks unchanged). Adds episode schema on events (show_org_id, media_url, episode_number) + the event_guests junction, and public chromeless link columns (public_slug, public_enabled) on orgs + events with partial-unique slug indexes; src/lib/public-slug.ts minter generalized to one shared /t/{slug} namespace across profiles+orgs+events (mint-on-first-enable in Phase 2/3, nothing to backfill since no FNRad org/episode exists yet). TS unions: OrgType += "media", EventType += "episode" (both text columns, no DB enum change); exhaustive event-type maps + the org-type label map learn the new values. Migration was a hard merge-before-migration gate (§5.1): apply-then-merge order held. Apply-time fix: show_org_id + event_guests.event_id are text (not uuid) because orgs.id / events.id are text catalog ids (caught by an FK type-mismatch on first apply, corrected before merge). Phases 2 to 4 (episode pages, show hub, editor curation surface, public links, community expansion) are the usable surfaces and remain to build. tsc clean.

## 2026-06-29 - FNRad Featured Timelines Phase 2 (feature)
- type: feature
- pr: #140
- branch: feature/fnrad-featured-timelines-phase2
- ids: none
- scope: event-featured-timelines
- migration: none (Phase 1 #139 added all schema; this PR is code-only)
- status: merged
- tsc: clean

Phase 2 of features/event-featured-timelines-build-brief.md: episode pages + editor curation + public episode link. An Event with event_type='episode' gets a curated featured set, an in-app page, and an editor-published public chromeless /t/[slug] link. Read layer: isolated event-owner stack read (readEventStack in public-timeline-read.ts) resolves owner_type='event' curated entries directly against the catalog + referenced public stories with NO claim aggregation, so the profile resolver is untouched (zero regression); extracted enrichStories/readStoriesByIds + added a seed param to resolveEntities; readEventOwner feeds the OG card. API: GET/PUT /api/events/[id]/stack (PUT requireEditor, delete-and-reinsert owner_type='event', validation mirrors /api/me/stack), GET/PATCH /api/events/[id]/public-link (editor enable + shared-namespace slug mint ensureUniquePublicSlug ownerType='event'), GET/PUT /api/events/[id]/guests (editor event_guests). Public render: /t/[slug] resolver order profile->episode; PublicEpisodeView reuses store-free StackView on the dark ground; opengraph-image resolves an event owner when the profile owner is null; disabled/unknown 404. In-app: events/[id]/page.tsx branches to EpisodeView for episodes (show link, episode number + date, guests, media embed, featured set in a dark panel, editor curate modal + publish toggle + copy-link); EpisodeCurateModal curates from a live catalog search (riders/places/events/boards) since an episode has no owner claim set, plus guest management; non-editors read-only, curation/publish editor-gated server-side. Build-time decision (brief §8): anonymous tag-to-claim on the public page kept OFF for the August launch (public page read-only). Verified: tsc + eslint clean (new files); runtime smoke of the new routes + the /t/[slug] episode branch 404 cleanly against the live Phase 1 columns/tables (queries valid, no error); non-episode events + profile /t path unchanged. HUMAN-RUN owed: full editor curate -> publish -> public render click-path needs a seeded FNRad episode + an editor session (FNRad rollout brief §9); local preview cannot establish an editor session (known localhost limitation), so that path was validated by types + route smoke + code review as with prior PB-010 phases. Phases 3 (FNRad show/hub org page) and 4 (in-app community expansion) remain.

## 2026-06-30 - Launch UI polish batch 2 (bug)
- type: bug
- pr: #141
- branch: auto/bugfix-20260630-0500
- commit: 9379f47
- ids: BUG-094, BUG-099, BUG-100, BUG-101
- migration: none
- status: merged
- tsc: clean

Four client-only launch-polish fixes in one PR. BUG-094: the brand-page Events tab now merges organized claims and brand-linked events into one list sorted ascending by event year (sortedBrandEvents memo), so a 1989 instance leads the 1990 to 1997 run instead of being appended (events without a year sort last). BUG-099: extracted a shared MemberBadge (src/components/ui/member-badge.tsx) carrying the membership-page colour and icon map (annual blue diamond, lifetime purple diamond, founding amber star) and routed both the Riders list and the avatar dropdown through it, so a lifetime member reads the same badge on /people, the dropdown, and /account/membership (was orange "Member" on the list, amber annual in the dropdown). BUG-100: the stack/timeline top-bar "Linestry" wordmark now uses var(--font-wordmark) (Calendula) to match the main nav, not var(--font-display). BUG-101: the collective subtitle reads "1979-present" to match the chart baseline, replacing the hardcoded "1983" (and its en dash). No migration, render and copy only. tsc clean.

## 2026-06-30 - FNRad Featured Timelines Phase 3 (feature)
- type: feature
- pr: #142
- branch: feature/fnrad-featured-timelines-phase3
- ids: none
- scope: event-featured-timelines
- migration: none (Phase 1 #139 added all schema; this PR is code-only)
- status: merged
- tsc: clean

Phase 3 of features/event-featured-timelines-build-brief.md: FNRad show/hub org page + canon curation + public show link. A media org (org_type='media') renders as a curated hub with a canon stack + episode list, an editor curation surface, and an editor-published public chromeless /t/[slug] link. Read layer: factored the shared owner-stack resolution out of readEventStack into loadOwnerStack (rows -> resolved cards + referenced stories/entities), reused by both episode and show reads; renamed resolveEventRow -> resolveCuratedRow (owner-agnostic, episode path unchanged); added readOrgStack (org header + canon entries + episode list newest-first; episode slug exposed only when published so the public show page links only to published episodes) + readOrgOwner for the OG card. API: GET/PUT /api/orgs/[id]/stack (PUT requireEditor, owner_type='org'), GET/PATCH /api/orgs/[id]/public-link (editor enable + shared-namespace slug mint ownerType='org'); extracted the stack-row validator into src/lib/stack-write.ts (buildStackRows) backing the org route. Public render: /t/[slug] resolver order profile->episode->show(org); PublicShowView reuses store-free StackView on the dark ground + published-episode list; opengraph-image falls through to readOrgOwner; disabled/unknown 404. In-app: brands/[slug]/page.tsx branches to ShowHubView when org_type='media' (after all hooks, rules-of-hooks stable; standard brand pages untouched); ShowHubView = header + canon dark panel + episode list + member CTA + editor curate/publish/copy-link. Generalized the Phase 2 EpisodeCurateModal into an owner-agnostic StackCurateModal (stackUrl + optional guestsUrl); episode page now uses it and the episode-specific modal was removed. Build-time decision (brief §8): anonymous tagging on the public page kept OFF (read-only) for the August launch. Verified: tsc clean; new files eslint-clean (pre-existing brands-page react-hooks v7 errors unrelated to the additive branch); runtime smoke of org stack/public-link routes + the /t/[slug] show branch 404 cleanly against the live Phase 1 columns/tables (queries valid, no error); Phase 2 episode route still 404s (loadOwnerStack refactor no regression); brands list + standard brand pages unchanged (200). HUMAN-RUN owed: full editor curate -> publish -> public render click-path for a real show needs a seeded FNRad media org + an editor session (FNRad rollout brief §9); local preview cannot establish an editor session (known localhost limitation), so validated by types + route smoke + code review as with prior PB-010 phases. Phase 4 (in-app community expansion junctions) remains.

## 2026-06-30 - FNRad Featured Timelines Phase 4 (feature)
- type: feature
- pr: #143
- branch: feature/fnrad-featured-timelines-phase4
- ids: none
- scope: event-featured-timelines
- migration: 20260630000001_fnrad_event_connection_junctions.sql (applied 2026-06-30, before merge)
- status: merged
- tsc: clean

FINAL phase of features/event-featured-timelines-build-brief.md: in-app community expansion. Signed-in members add the riders/places/related-events/brands/boards an episode covered that are not in the editor-curated featured set. Migration 20260630000001: five junction tables (event_people/event_places/event_events/event_orgs/event_boards), text catalog ids, event_id FK to events(id) cascade, added_by FK to profiles(id) set-null, PK (event_id, ref), index on event_id; hard merge-before-migration gate (applied before merge). Build-time decision (brief §5.4, confirmed with Jay via AskUserQuestion): member-added RIDERS use the SAME simple adder/editor-removal model as the other four types, NOT the PB-009 tag pipeline (no tag_events, no _public view, no consent gate) because these connections render in-app only (the public chromeless page stays the editor-curated stack); removal is adder-or-editor. API: GET/POST/DELETE /api/events/[id]/connections, one type-discriminated route across the five junctions; GET returns raw grouped rows (client resolves names from the store catalog, since the add picker only offers catalog entities), POST requireAuth + idempotent upsert, DELETE requireAuth with adder-or-editor removal enforced server-side. UI: EpisodeConnections section on the episode page below the featured set, grouped chips (riders/boards/places/events/brands) linking to entity pages with per-chip remove for adder/editor and a per-group "+ Add" affordance reusing the shared SearchPicker; hidden for logged-out visitors when empty. Verified: tsc + eslint clean; runtime smoke (GET returns the empty 5-key shape pre-migration without crashing, POST 401s without auth, events list unaffected 200). HUMAN-RUN owed: full add/remove flow needs the migration applied (now done) + an editor/member session (local preview cannot establish one, known localhost limitation), validated by types + route smoke + code review as with prior phases. This COMPLETES the FNRad Featured Timelines feature (Phases 1-4: #139, #140, #142, #143). Remaining product follow-up = the FNRad rollout seed (brief §9): create the FNRad media org + episodes, curate, publish.

## 2026-06-30 - FNRad show + episode authoring (feature)
- type: feature
- pr: #144
- branch: feature/fnrad-show-episode-authoring
- ids: none
- scope: fnrad-show-episode-authoring
- migration: none (reuses FNRad Phase 1 columns/unions; code-only)
- status: merged
- tsc: clean

Implements features/fnrad-show-episode-authoring-brief.md (the §8 fast-follow to the now-complete FNRad Featured Timelines feature). Closes the rollout gap where creating a media show (org_type='media') or an episode (event_type='episode') required direct SQL, because the member add forms whitelist the old org/event types and lack the episode-linkage fields. Editor route POST /api/admin/show-episode (requireEditor): kind='show' inserts a media org; kind='episode' inserts an episode event linked via show_org_id; both insert the matching community junction (community_orgs/community_events, community resolved from slug default snowboarding), dedup by name (409 + existing_id), server-generated text id. UI: CreateShowModal (editor "+ New show" on the brands list) + a browsable "Shows & Media" section there rendering media orgs (previously excluded from every bucket); EpisodeCreateModal (editor "+ Add episode" on the show hub) capturing title/date/episode_number/media_url/description; on create, full-nav to the new hub/episode so the freshly bootstrapped catalog resolves it and the editor lands ready to curate via the Phase 2/3 modals. Deferred (brief D4): EditEventModal episode fields (not clean: EpisodeView has no edit entry point + separate update path; create modal captures every field). Verified: tsc + eslint clean; runtime smoke (route 401s without auth, brands list renders, no errors); full create flow needs an editor session (local preview cannot establish one, known localhost limitation), validated by types + route smoke + code review. Unlocks the FNRad rollout (brief §9) fully in-app, no SQL. No migration.

## 2026-06-30 - PENDING auto-stub (feature/fnrad-media-brand-merge)
- type: feature
- pr: #145
- branch: feature/fnrad-media-brand-merge
- commit: e2a62a3
- ids: none
- status: pending
- tsc: n/a

_Auto-stub from the SessionEnd hook (agent did not log this session). Expand to a one-line summary and flip status to merged during the daily reconcile._

## 2026-06-30 - FNRad media/brand page merge (feature)
- type: feature
- pr: #145
- branch: feature/fnrad-media-brand-merge
- ids: none
- scope: fnrad-media-brand-merge
- migration: none (render-only)
- status: merged
- tsc: clean

Converting a brand to a media show (org_type='media') had early-returned the lean ShowHubView, hiding the brand page's stories feed + people/boards/events/places connection tabs + contribute. Now a media org renders the FULL brand page and gains a chrome-less "Show" block injected at the top (below the header, above curated sections/contribute/feed): episodes list (podcast-first, leads), curated canon below, and editor controls (Add episode, Curate canon, Public link toggle + Preview/Copy). New src/components/orgs/show-module.tsx reuses the same /api/orgs/[id]/stack + /public-link fetches and the Phase 2/3 modals; no Nav/header/breadcrumb (the brand page provides those); hidden for logged-out visitors when there are no episodes/canon yet. brands/[slug]/page.tsx: removed the early return, renders {org.org_type==='media' && <ShowModule org={org}/>} after the header; standard brand pages unchanged. Removed the now-unused full-page ShowHubView; the public chromeless /t/[slug] show page (PublicShowView) is separate and untouched. Layout ("Show block on top") chosen by Jay via AskUserQuestion. No migration. Verified: tsc clean; show-module.tsx eslint-clean (brand-page react-hooks v7 errors pre-exist); runtime smoke (FNRad media page /snowboarding/brands/FNRad_Podcast + brands list 200, no errors). Follow-on to the FNRad authoring work (#144); the FNRad org was converted in prod via a one-line org_type='media' update (not a migration).

## 2026-06-30 - FNRad episodes out of the Events list (feature)
- type: feature
- pr: #146
- branch: fix/fnrad-episode-polish
- ids: none
- scope: fnrad-episode-polish
- migration: none (render/filter only)
- status: merged
- tsc: clean

Live-testing polish on the FNRad feature. Episodes (event_type='episode') were appearing in the general /[community]/events index alongside contests/trips/gatherings; they are a media type that lives on the show hub + their own episode page, so allEvents in events/[id]/page.tsx now filters out event_type==='episode' (removes them from the decade groups, type filters, and My Events in one place). Episode pages + the show hub episode list are unaffected. Same-session reports handled separately: the episode->show link + hub listing not appearing is a DATA issue (the episode's show_org_id does not point at the converted FNRad org; the code renders both when show_org_id matches) resolved by a one-line repoint, no code; the brand-page connections "dividers by category" tweak was deferred by Jay. No migration. tsc clean.

## 2026-06-30 - PENDING auto-stub (fix/fnrad-stack-read-columns)
- type: feature
- pr: #147
- branch: fix/fnrad-stack-read-columns
- commit: 06abceb
- ids: none
- status: pending
- tsc: n/a

_Auto-stub from the SessionEnd hook (agent did not log this session). Expand to a one-line summary and flip status to merged during the daily reconcile._

## 2026-06-30 - FNRad stack reads 404 on non-existent columns (feature)
- type: feature
- pr: #147
- branch: fix/fnrad-stack-read-columns
- ids: none
- scope: fnrad-stack-read-columns
- migration: none (code-only select fix)
- status: merged
- tsc: clean

Live-testing bug on the FNRad show. Three symptoms (episode page had no back-to-show link; episode absent from the show hub; public /t/[slug] episode page 404'd) all traced to one code bug, NOT data (the episode's show_org_id correctly pointed at the FNRad Podcast media org). readOrgStack's ORG_STACK_COLS selected `region` (orgs has no region column; region lives on profiles/places) and readEventStack's EVENT_STACK_COLS selected `image_url` (events has no image_url column; event photos live in event_image_votes). PostgREST fails the whole select -> the initial org/event query returns null -> the read returns null -> the route 404s. Latent because every prior smoke test hit non-existent ids (404 for the right reason); only bit once a real media org + episode existed. Fix: drop the non-existent columns from both selects + their row types + header mappers; also dropped the same latent image_url from the shared resolveEntities events select, which had been silently dropping event cards from every curated stack (profile stacks included). Diagnosed by temporarily surfacing the swallowed maybeSingle() error via the app read path against live data, then reverted the logging. Verified against live FNRad data: GET /api/orgs/<FNRad>/stack now returns episodes[FNRad: Jay Balmer #21]; GET /api/events/<ep>/stack now returns meta.show=FNRad Podcast. No migration. tsc + eslint clean. Companion to #146 (episodes off the events list) this session; the deferred brand-page connections "dividers" tweak remains for Jay to revisit.

## 2026-06-30 - FNRad curation modal UX (feature)
- type: feature
- pr: #148
- branch: feature/fnrad-curation-ux
- ids: none
- scope: fnrad-curation-ux
- migration: none (client/UX only)
- status: merged
- tsc: clean

Four live-testing UX fixes to the episode/show featured-set curation flow (StackCurateModal + episode-page + show-module). A: "Curate featured set" no longer greys out until refresh -- buttons were disabled={!payload} and the #147 stack-read 404 kept payload null forever; now disabled={loading} and the modal renders on `curating` with payload?.entries ?? [] so it opens once the fetch settles (episode + show hub). B: new connectionsUrl prop -- the modal fetches /api/events/[id]/connections and surfaces the already-added riders/places/events/boards as a one-click "From this episode's connections" quick-pick above the catalog search (orgs omitted: no org entry type in the featured set). C: starter pre-seed -- when no saved set exists, seed up to 3 of each type from the connections with a "we drafted a starter" hint. D: discard guard -- modal tracks a dirty flag and confirms before closing (backdrop/x/Cancel) when there are unsaved changes; footer shows an "Unsaved changes" marker; Save clears dirty. Show hub reuses the modal without connectionsUrl (no quick-pick/starter) and gets the same button + guard behavior. Verified against live FNRad data: connections endpoint returns 8 riders/7 places/4 events (quick-pick + starter populate), stack payload 200, pages compile. tsc + eslint clean. No migration. Deferred still: brand-page connections-layout tweak (Issue 4, Jay to revisit).

## 2026-06-30 - FNRad curate row buttons consistency (feature)
- type: feature
- pr: #149
- branch: feature/fnrad-curate-button-consistency
- ids: none
- scope: fnrad-curate-button-consistency
- migration: none (CSS only)
- status: merged
- tsc: clean

CSS-only: the curate modal's featured-set (selected) rows used plain-text "Edit text"/"Remove" links while candidate rows used Guest/Add pill buttons. Restyled the selected-row actions to right-aligned pill buttons -- "Edit" (neutral border, active-blue when its inline fields are open) and "Remove" (red-tinted border) -- matching the candidate style. No behavior change. tsc + eslint clean. No migration.

## 2026-06-30 - stack owner_id uuid->text (feature)
- type: feature
- pr: #150
- branch: fix/stack-owner-id-text
- ids: none
- scope: stack-owner-id-text
- migration: 20260630000002_stack_owner_id_text.sql (applied 2026-06-30)
- status: merged
- tsc: clean

Blocking bug: saving an episode featured set or show canon threw "invalid input syntax for type uuid: evt_...". FNRad Phase 1 created public_stack_entries.owner_id as uuid, but event/org ids are text (mixed catalog ids), so no non-profile owner could be stored. Profiles were unaffected (uuid ids; read path keys on owner_profile_id). Fix migration widens owner_id to text (alter column type text using owner_id::text; existing profile rows convert cleanly; the (owner_type, owner_id, position) index rebuilds). No code change -- read/write paths already pass text ids. Idempotent. Applying the migration fixes prod immediately (no code dependency); merging records it. tsc clean.

## 2026-06-30 - FNRad episode link 404 + Listen primary CTA (feature)
- type: feature
- pr: #151
- branch: fix/fnrad-episode-link-and-listen
- ids: none
- scope: fnrad-episode-link-and-listen
- migration: none
- status: merged
- tsc: clean

Two episode fixes. (1) Show hub episode links 404'd: the hub linked /events/{public_slug} (fnrad_jay_balmer), but the in-app event route resolves by the name-derived slug (FNRad_Jay_Balmer), so the lowercased public slug never matched. Now links by event id; the event page canonicalizes to its name slug itself. The public /t show page still links episodes by public_slug (correct there). (2) "Listen to the episode" is now the feature action on an audio episode: a full-width primary blue CTA (was a small secondary outline button). tsc + eslint clean. No migration.

## 2026-07-01 - Visual consistency sweep (bug)
- type: bug
- pr: #152 (db84cac)
- branch: auto/bugfix-20260701-0500
- ids: BUG-018, BUG-050, BUG-051, BUG-068
- migration: none
- status: merged
- tsc: clean

Launch visual-consistency polish, render/copy only, no write path. BUG-018: fixed black-on-violet contrast (stories page Add-story button + filter chip and the feed-view active Stories chip now use text-white); brought the /brands page h1 down from text-2xl to text-xl to match the other browse-list headers (Riders, Events, Places, Connections, Stories); unified the /people sort tabs and /brands sort control onto the same outlined-pill treatment (idle border + hover, active bg-surface-active) and nudged the /people rider-card padding to p-4. BUG-050: swapped the ad-hoc uppercased "self-reported" label on the origin/StartCard for the shared ConfidenceBadge, so it reads title-case "Self-reported" at one size/color everywhere (matches the claim card). BUG-051: reordered the FeedView filter chips to Stories-first then the nav Row 3 category order. BUG-068: routed the low-contrast blue "shared moment" text on the connection detail card to text-accent-strong / text-muted so it meets AA on the light surface. Full shared FilterChips component extraction was deliberately left out to keep the unattended change low-risk; the visible divergences were converged inline instead. tsc clean.

## 2026-07-02 - Compare rendering pass: avatars black + entries "Unknown" (bug)
- type: bug
- pr: (open PR)
- branch: fix/compare-avatars-black-BUG-024-067
- ids: BUG-024, BUG-067
- migration: none
- status: pending
- tsc: clean

Read-side rendering pass on /compare, no write path. BUG-024: the pickers, dropdown results, and side-by-side timeline column headers rendered local avatars as bg-[#1C1917] with text-foreground, so in light theme the near-white foreground token resolved to dark ink and initials went dark-on-dark, reading as a solid black circle. Switched all three to the shared RiderAvatar (explicit inline bg/text colors, legible in both themes, matching /people). BUG-067: the compare name resolver only special-cased place/board/org/event and fell through to getEntityName for person objects, so ghost/catalog/duplicate person nodes (e.g. cy_2) that live in catalog.people but not in profiles or mock-data rendered as "Unknown". Added a person case (and untyped fallback) that resolves display_name from catalog.people before "Unknown". The compare-player overlay was left as-is: it uses a distinct semi-transparent treatment on a forced-dark surface and is not named in either bug. tsc clean.

## 2026-07-02 - FTUE Conversion Pass: invite + welcome + 3-stories + funnel telemetry (feature)
- type: feature
- pr: #153
- branch: feature/ftue-conversion-pass
- ids: none
- scope: ftue-conversion-pass
- migration: none
- status: merged
- tsc: clean

Onboarding conversion pass for the snowboard first-wave push (week of July 6), four tasks, no migration (PR #138's claim_requests/people columns already exist). T1 (headline): proactive editor invite-to-claim. New POST /api/admin/invite-node (requireEditor) inserts an already-approved public_invite claim and reuses the PR #138 email-first path so admin-invite-complete folds the node in at signup unchanged; the shared post-approval steps (stamp invite_email, flip catalog to unclaimed, send magic link) were extracted to src/lib/node-invite.ts and the visitor approval branch of PATCH /api/claim-requests/[id] now calls the same helper (reordered so a racing approver loses on the status guard and never double-sends). Surfaces: editor-only "Invite to claim" on /people/[id] (invited/re-send state from people.invite_email) and a search+invite panel on /admin/claims backed by GET /api/admin/invite-node?q=. T2: invited-arrival welcome moment. /auth/complete reads { claimed } from admin-invite-complete and sets claim_welcome_pending instead of the generic welcome explosion for folded-in claimants; OwnerTimelinePanel shows a one-time ClaimWelcomeOverlay ("your history is already here" + moment count + Add-first-story CTA), zero-moment degrades to "Your timeline starts now.". T3: first-3-stories loop. Owner-only "First stories: n/3" chip by the Add-story affordance (hidden at 3+) plus a once-only 3/3 milestone celebration gated on both story fetches so existing 3+ authors never false-fire; captures first_three_stories_completed. T4: funnel-cliff work. Land-step copy leads with the promise and the Start CTA is dominant (brand blue, larger); signup_failed telemetry (method + PII-free error class) on the OAuth dispatch and magic-link error paths. Bot-filtered June re-run was not possible (properties.$virt_is_bot is not materialized and these FTUE events are server-forwarded via posthog-node), so the raw June funnel stands: landed 34, land-step done 17, aha 11, signup_started 9, signup_succeeded 2. Both cliffs (land 34 to 17, auth gate 9 to 2) confirmed real. tsc clean; npm run build clean.

## 2026-07-03 - Remove unimplemented "Shared" profile visibility option (bug)
- type: bug
- pr: #154
- branch: fix/remove-shared-profile-visibility
- ids: none
- scope: profile-visibility-shared-trap
- migration: none (one-off data fix: set Cory Yip profile privacy_level='public', applied by Jay in-session)
- status: merged
- tsc: clean

A lifetime member (Cory Yip) was invisible on /people, 404'd on his own /people/[id] page, and was gone from /collective, yet /t/cory_yip and /admin still showed him. Root cause: his profile privacy_level was "shared", and "shared" is not implemented at the data layer. The profiles RLS SELECT policy only exposes "public" rows (plus self) to the browser client, so a shared profile never enters catalog.people (loaded via the browser client in src/store/lineage-store.ts), and /collective additionally filters .eq("privacy_level","public"); admin and /t/[slug] use service-role reads that bypass RLS. Removed the "Shared / Connections" button from the profile editor so members only pick Private or Public, both of which the app honors. The PrivacyLevel type keeps "shared" so existing rows and references stay valid. Cory's own row was corrected to public via SQL out of band. tsc clean.

## 2026-07-03 - Invited users skip the redundant "Save your linestry" step (feature)
- type: feature
- pr: #155
- branch: feat/invited-magic-link
- ids: BUG-132
- scope: invited-magic-link
- migration: none
- status: merged
- tsc: clean

Removes the second email an email-invited rider had to summon at the end of onboarding (SaveStep). POST /api/invite now mints an account-creating magic link (mirrors the PR #138 applyNodeInvite pattern) when the inviter supplies an email, and uses it as the primary "Claim my profile" CTA. The invitee clicks once, lands authenticated at /auth/complete, and their ghost folds in by verified session email (no token needs to survive the round-trip) so no onboarding wizard and no SaveStep. The plain /claim/[token] link stays in the email as a secondary "or claim your profile here" fallback for late clicks, and generateLink failure falls back to sending only that link so the invite always works. Fine-print copy corrected off the false "7 days" to "expires shortly". /auth/complete now captures the /api/invite/claim { claimed } result and gives a folded-in per-profile invitee the same claim_welcome_pending ClaimWelcomeOverlay ("your history is already here") as an admin invitee instead of the generic welcome explosion. No-email copy-link invites are unchanged (still land on /claim/[token] and run onboarding + SaveStep). No migration: reuses existing invites.email / people.invite_email and the Supabase auth generateLink API. Supabase Email OTP Expiration set to 43200s (12h) in-session, so the magic-link window is generous and the fallback link covers any later click. tsc clean.

## 2026-07-04 - Remove "Shared" visibility trap + fix add-claim modal on short viewports (bug)
- type: bug
- pr: #156
- branch: fix/shared-visibility-claim-modal-BUG-140-136
- ids: BUG-140, BUG-136
- migration: none
- status: merged
- tsc: clean

BUG-140: the add-claim and edit-claim modals still offered a "Shared / Connections" visibility choice, but "shared" is unimplemented at the data layer and silently drops a claim out of public reads (the same trap PR #154 removed from the profile editor). Removed the option from both pickers (add-claim-modal.tsx, edit-claim-modal.tsx), leaving Only Me + Public; the PrivacyLevel union keeps "shared" so existing rows and references stay valid. Flagged for Jay: an optional one-off "update claims set visibility='public' where visibility='shared'" would un-hide any claims already saved as Shared (not in this PR, data decision). BUG-136: the "Add to your linestry" claim modal was vertically centered with a vh-based max height, so when the mobile keyboard raised the viewport the title was pushed above the fold with no way to scroll to it; top-aligned the panel (items-start) and bounded its height with dvh (max-h-[calc(100dvh-2rem)]) so the title stays visible and the form scrolls inside the modal. Client-only, no migration. tsc clean.

## 2026-07-05 - Admin user archive (soft hide) (feature)
- type: feature
- pr: #157
- branch: feat/admin-user-archive
- ids: none
- scope: user-archive
- migration: 20260705000001_profiles_is_archived.sql (applied)
- status: merged
- tsc: clean

Reusable admin capability to archive (soft-hide) any user, fully reversible, no data deletion. Trigger was removing the test account Cy 3 without a raw SQL delete. Migration 20260705000001 adds profiles.is_archived boolean NOT NULL DEFAULT false plus archived_at / archived_by audit columns; additive, not a pre-merge gate, no _public view rebuild (the views select the claims / story_riders column lists, not profiles). Primary lever is the catalog: loadCatalog() drops is_archived rows from catalog.people, which removes an archived user from the people directory, compare, connections, entity chips/rosters, and community feed cards in one place. Owner-self view is unaffected because the people/[id] owner branch and /api/me read self-state rather than the anon catalog, so the archived holder still sees their own profile/timeline/claims/stories when logged in. GET /api/stories hides stories authored by an archived user on the PUBLIC list path only; the permalink (?id=) and ownAuthorList (author_id === viewer) branches are untouched so the author keeps their own view. New /admin/users page (search, Show-archived filter, per-row archive-with-confirm / un-archive) backed by GET /api/admin/users and PATCH /api/admin/users/[id]/archive (both requireEditor); nav link added to the Dataset Editor header. D3 handled by graceful degradation, not view filtering: getEntityName returns "Unknown", entityHref falls back to id, roster/partner components already skip unresolved ids (if (!person) continue), so no crash; accepted side effect is an archived person's own claims can still render as "Unknown" in the community feed rather than being hidden (flagged, not expanded). Cy 3 archived through the new UI as the acceptance proof. tsc clean.

## 2026-07-05 - Email deliverability + one-click unsubscribe (feature)
- type: feature
- pr: #158
- branch: feat/email-deliverability-hardening
- ids: none
- scope: email-deliverability
- migration: 20260705000001_email_suppressions.sql (applied)
- status: merged
- tsc: clean

Two layers in one PR. (1) Deliverability hardening across all eight Resend send sites: every resend.emails.send now carries a plaintext text: part (seven gained one; comment-emails already had it, long tokened URLs preserved verbatim) and replyTo: jay@linestry.com (noreply@ is unmonitored). (2) Hosted one-click unsubscribe replacing the mailto form, because Resend does not manage suppression for transactional emails.send. New email_suppressions table (email PK, RLS on with no policies, service-role only; keyed on raw lowercased email because recipients are a mix of members and non-members with no profiles row). GET/POST /api/unsubscribe?e=<b64url-email>&t=<hmac>: POST is RFC 8058 one-click for Gmail/Apple Mail, GET renders a confirmation page; token is an HMAC over the address (mirrors email-pref-token) so a link only unsubscribes the address it was minted for, no login by design. listUnsubscribeHeaders(email) builds the per-recipient https header (replaced the static mailto constant in shared-header). isEmailSuppressed(email) guards every notification send path (invite x2, claim member-facing, comment, tag-decision) and fails open on DB error so a hiccup never drops a real send; the internal admin claim notification passes listUnsubscribe: false so it keeps no unsubscribe link and is never suppressed. Security emails (magic-link, password reset) and the internal bug report are untouched (text + replyTo only). Note: migration shares the 20260705000001 numeric prefix with the same-day user-archive migration but is a distinct filename; both applied. Migration was not a hard 500 gate (the suppression check is a SELECT that fails open), applied migrate-then-merge. Reject paths verified locally (bad-token GET 400 + Invalid link page, no-params 400, bad-token POST 400 empty); green-path smoke (real unsubscribe click lands a row and skips the next send) is a post-deploy owner check needing the live signing secret. jay@linestry.com confirmed as the monitored Reply-To inbox; bug reports intentionally stay on jay@lineage.community. tsc clean.

## 2026-07-06 - BUG-141 + BUG-142: mobile overflow pass (bug)
- type: bug
- pr: #159
- branch: auto/bugfix-20260706-0500
- squash: dd8feb7
- ids: BUG-141, BUG-142
- scope: mobile-overflow
- migration: none
- status: merged
- tsc: clean

Client-only overflow-containment pass. BUG-141: on /snowboarding, a long unbroken string pasted into a story title or body (e.g. a raw URL) rendered in the StoryCard <h3> / body <p> with whitespace-pre-wrap but no wrap guard, so it forced the card past the mobile viewport and made the page horizontally scrollable (iOS Safari then zooms out and stays shrunken). Added break-words to both the title <h3> and body <p> in src/components/feed/story-card.tsx (the dedicated URL-link element already carried break-all). BUG-142: the flat comment <p> in src/components/feed/story-interactions.tsx had whitespace-pre-wrap but no break-words, so a long single-word comment overflowed the story frame with the same shrink-to-fit symptom; added break-words there too (its flex parent already has min-w-0 flex-1). Pure CSS, no data / migration / auth / _public view. tsc clean.

## 2026-07-06 - Language cleanup: remove "launch" framing (feature)
- type: feature
- pr: #160
- branch: feature/language-cleanup-launch-framing
- ids: none
- scope: language-cleanup
- migration: none
- status: merged
- tsc: clean

CMF-eligibility copy hygiene: reframed the "equity launch offer" as the "founding community equity offer" across all three user-facing surfaces (src/app/equity/page.tsx, src/app/membership/page.tsx, src/app/account/membership/page.tsx), so the product reads as a prototype in testing rather than a released commercial product. "12 months after launch" became "12 months after the founding community opens" in both spots. Copy only: no pricing, token math, share counts, the 100,000-share pool, or the Sept 30 2026 snapshot logic changed. Code comments and src/lib/equity-offer.ts (comments only, never rendered) left as-is per the brief. Verified in browser: zero user-visible "launch" on /membership and /equity. tsc clean.

## 2026-07-07 - FTUE intro slideshow (feature)
- type: feature
- pr: #161
- branch: feature/ftue-intro-slideshow
- ids: none
- scope: ftue-intro-slideshow
- migration: none
- status: merged
- tsc: clean

New public, chromeless 5-screen pre-signup slideshow at /intro (src/app/intro/page.tsx + intro-slideshow.tsx + intro-visuals.tsx) sitting in front of the /onboarding wizard, with hand-rolled tier-palette SVG scenes and manual-only navigation (dots, swipe, arrow keys, CTA). Homepage signed-out "Start Your Timeline" CTA repoints to /intro; the wizard reads ?from=intro to skip its land step and still fires ftue_landed with source intro. Screen 4 (equity) is gated on EQUITY_SNAPSHOT_DATE with a live contributor count from GET /api/equity/pool, hidden below 10 or on fetch failure (no fabricated number). Added the first ftue-intro-* keyframes to globals.css with a prefers-reduced-motion fallback, and ftue_intro_viewed/completed/skipped analytics. No migration, UI-only. tsc clean.

Ops follow-up (not code): prepend ftue_intro_viewed (screen=1) to the PostHog FTUE funnel so it measures the new true top.

## 2026-07-09 - Disable /intro slideshow (chore)
- type: chore
- pr: #162
- branch: chore/disable-intro-slideshow
- ids: none
- scope: ftue-intro-slideshow
- migration: none
- status: merged
- tsc: clean

Paused the /intro slideshow (shipped in #161) at Jay's request by repointing the signed-out "Start Your Timeline" CTA on src/app/page.tsx from /intro back to /onboarding, so nothing links to the slideshow. The /intro route and all slideshow code stay in place, dormant; re-enabling is the same one-line CTA change. The wizard's ?from=intro handling is left intact and harmless. One-line href change, no migration. tsc clean.

## 2026-07-10 - Launch UI polish batch 4 (bug)
- type: bug
- pr: (open PR)
- branch: auto/bugfix-20260710-0513
- ids: BUG-124, BUG-125, BUG-126, BUG-128
- migration: none
- status: pending
- tsc: clean

Four small mobile render/copy fixes from the July 3 iPhone sessions. BUG-124: the brand-page default Stories pill started scrolled off-screen, so the active tab now scrolls into view on mount (block:"nearest", no vertical jump) and pills carry shrink-0. BUG-125: the "People In Your Timeline" strip told users to browse the "People list" that does not exist, now "Riders list" in both states plus the header comment. BUG-126: a brand added in the same signup session resolved in the catalog but not in PostCard's entityName path, so the avatar initial fell back to "Unknown" and showed a stray "U"; EntityBlock graphics and PostCard's entityName now resolve non-person entities from the catalog first. BUG-128: /people rider cards hid the stats block below the sm breakpoint (every phone), now visible on mobile. Client-only, no migration, tsc clean. Ran unattended by the autonomous pipeline; git handled by the wrapper.

## 2026-07-11 - Launch UI polish batch 4 (bug)
- type: bug
- pr: (open PR)
- branch: auto/bugfix-20260711-0506
- ids: BUG-124, BUG-125, BUG-126, BUG-128
- migration: none
- status: pending
- tsc: clean

Four small mobile render/copy fixes from the July 3 iPhone sessions (fresh run; the July 10 attempt on auto/bugfix-20260710-0513 aborted uncommitted). BUG-124: the brand-page default Stories pill started scrolled off-screen in the horizontally scrollable tab row, so the active tab now scrolls into view once on mount (scrollIntoView inline:"nearest", block:"nearest", no vertical jump) and pills carry whitespace-nowrap. BUG-125: the "People In Your Timeline" strip told users to browse the "People list" that does not exist; both the linked and empty states plus the header comment now say "Riders list" (grep for "People list" in src returns nothing). BUG-126: a brand picked during signup can live only in the real catalog, which EntityBlock resolves for the name text but PostCard's entityName prop does not, so the avatar initial fell back to "Unknown" and rendered a stray "U"; the org and person graphics now derive their initial from EntityBlock's locally resolved displayName so the letter always matches the name shown. BUG-128: /people rider cards hid the stats block below the sm breakpoint (every phone) via hidden sm:block, now always visible so entry/place counts show on mobile. Client-only, no migration, tsc clean. Ran unattended by the autonomous pipeline; git handled by the wrapper.

## 2026-07-20 - Launch UI polish batch 4 (bug) - RECONCILES 07-10 + 07-11
- type: bug
- pr: 163
- branch: fix/launch-ui-polish-batch-4-BUG-124-125-126-128
- ids: BUG-124, BUG-125, BUG-126, BUG-128
- migration: none
- status: merged
- tsc: clean

Shipped the launch UI polish batch 4 that the autonomous pipeline attempted twice without landing. Squash merge c3a45aa, merged 2026-07-20 19:32 UTC.

BUG-124: the brand-page default Stories pill started scrolled off-screen in the horizontally scrollable tab row; the active tab now scrolls into view once on mount (scrollIntoView inline:"nearest", block:"nearest", no vertical jump) and pills carry whitespace-nowrap. BUG-125: the "People In Your Timeline" strip pointed at a "People list" that does not exist; both states plus the header comment now say "Riders list". BUG-126: a brand picked during signup can live only in the real catalog, which EntityBlock resolves for the name text but PostCard's entityName prop does not, so the avatar initial fell back to "Unknown" and rendered a stray "U"; org and person graphics now derive their initial from EntityBlock's locally resolved displayName. BUG-128: /people rider cards hid the stats block below the sm breakpoint via hidden sm:block, now always visible on mobile. Client-only, no migration, tsc clean.

Provenance / dedupe note for the reconcile: this same batch was logged twice as pending, on 2026-07-10 (branch auto/bugfix-20260710-0513) and 2026-07-11 (branch auto/bugfix-20260711-0506). Neither run reached a PR. The 07-11 run never committed at all, leaving the work uncommitted in the main working tree; the 07-10 run committed an earlier, superseded revision of the same four fixes. This entry is the single real ship for BUG-124/125/126/128; treat the two earlier entries as duplicates of this one, not as separate shipments. Both stale branches were deleted after verifying they carried nothing unique.

## 2026-07-21 - Curated Member Profile, Phases 1+2 (feature)
- type: feature
- pr: #164
- branch: feature/curated-member-profile
- commit: 30cd5c7
- ids: none
- scope: curated-member-profile
- migration: applied supabase/migrations/20260721000001_curated_member_profile.sql
- status: merged
- tsc: clean

Feature session built the queue lead `features/curated-member-profile-brief.md` Phases 1+2 (member marking + curated layer; one additive profiles migration adding profile_statement + profile_milestones). Phase 1: canonicalized the RiderCard tier pill through member-badge.tsx, added the member badge to story author + comment authors + the /t/[slug] owner header, and made a visitor's tier pill link to the public card. Phase 2: tier accent edge + founding number on the card, Statement block + Milestones spine + Featured rail (reusing the PB-010 curated stack) via the new MemberCuratedSections, a "Member page" editor section in the Edit Profile modal, a public GET /api/people/[id]/stack, and a tier-gated PATCH /api/me/profile-curation (free callers 403). Card theme picker was NOT re-introduced (per Jay); accent edge + statement only. Squash merge 6df8ab4, merged 2026-07-27; migration applied in Supabase in-session before merge. Flipped from the July 22 digest's pending entry (which itself corrected a SessionEnd auto-stub that had misread the session as type: bug, ids: BUG-099).

## 2026-07-27 - BUG-122 deleted-stories-reappear: no-store on GET /api/stories (bug)
- type: bug
- pr: #165
- branch: fix/stories-no-store-cache-BUG-122
- commit: 3f65f4a
- ids: BUG-122
- scope: stories-cache-control
- migration: none
- status: merged
- tsc: clean

Diagnosis-first data-integrity session. The reported "deleted stories reappeared on the author's timeline" was NOT latent DB rows: read-only prod queries verified the database is clean across all three of the reporter's accounts (CY 1 499deddd, Cy 2 3a467197, Cy 3 3f8ef433) - zero authored stories, no story matching the "Life in the 60's" title or "cold and foggy / we ride on" body text anywhere, no story tagging any of them as a rider. The original triage theory (pre-#129 silent-fail delete leaving latent rows, re-exposed by PR #136's own-author read branch) is disproven by the data; the client delete path was already guarded by PR #129 (June 24) and the DB shows no leftovers. Root cause is a stale client-side view on the reporter's phone (Safari bfcache or browser HTTP cache serving a /api/stories response captured before the delete). Fix: GET /api/stories returned viewer-specific, mutable data (own private stories via the ownAuthorList branch, plus viewer_reaction) with NO Cache-Control, so a browser/CDN could serve a stale list containing a since-deleted story; added Cache-Control: no-store, max-age=0. Closes the HTTP-cache path (does not affect Safari bfcache). No data cleanup (nothing to delete). No migration. PR #136 own-author branch intentionally untouched. tsc clean.

## 2026-07-30 - feat(stories): partial story dates + editor Fix date (feature)
- type: feature
- pr: #166
- branch: feature/story-date-precision
- commit: eda9b63
- ids: none
- scope: story-date-precision
- migration: applied 20260730000001_story_date_precision.sql (HARD PRE-MERGE GATE cleared: Jay applied it in Supabase before merge)
- status: merged
- tsc: clean

Feature session on the features/ queue lead. Partial story dates: new additive `stories.date_precision` ('day'|'month'|'year'), `story_date` stays a padded anchor, DateSelect gains opt-in partial mode, display unified through a shared `formatStoryDate` helper. Editor Fix date: date-only moderator branch in PATCH /api/stories mirroring the DELETE moderator boundary, short-circuiting before the junction logic so a date repair never wipes boards or rider tags. Existing rows grandfather as 'day', no backfill. Shipped in-session: migration applied in Supabase, then squash-merged to main as commit 4e81108. The pending entry was pre-expanded from the SessionEnd auto-stub by the July 30 daily triage and is flipped to merged here.

## 2026-07-30 - feat(podcast): episode-page quickfix cluster + equity offer to end of FNRad Season 12 (feature)
- type: feature
- pr: #167
- branch: feature/podcast-pass-quickfix
- commit: 0481461
- ids: none
- scope: podcast-pass-quickfix
- migration: none
- status: merged
- tsc: clean

Session A of the podcast pass (source: Jay's July 30 note drop, synthesis staged at features/podcast-episode-pass-notes.md). Five fixes, no migration. (1) Tab-title leak: entity-metadata gains GENERATED_ID_RE so genId-style ids ("evt_1782850803307_apuqit") fall back to the type label instead of being title-cased into the tab, and show-module links episodes by name slug (eventSlug param widened to Pick<Event, "name">). (2) Dead "I was there" on published episode/show /t/ pages: POST /api/public/tag now resolves the shared /t/ namespace profile-then-episode-then-show and validates the moment against the curated stack; story rode_with targets the story author on curated surfaces; tag_event subject stays person-keyed (profile owner, else implicated author, else the ghost). (3) Duplicate marks: accounted emails get a 409 "sign in instead" before any ghost write (verified live with Jay's email on his own episode, zero writes); anonymous repeat marks re-send the claim link (throttled) instead of stacking claims. (4) Pre-publish preview: /t/[slug] renders minted-but-unpublished episode/show pages for editors only with an amber banner (new isEditorSession in lib/auth.ts); PATCH public-link (events + orgs) accepts { mint: true }; Preview always visible to editors on episode-page + show-module. (5) Equity offer extended per Jay: EQUITY_SNAPSHOT_DATE = 2027-04-30T19:00:00Z (noon Pacific, end of FNRad Season 12), new EQUITY_SNAPSHOT_TIME_LABEL + EQUITY_SNAPSHOT_CONTEXT constants, all six hardcoded date strings replaced (equity hero/tile/mechanics, membership FAQ/banner, stale "April 2026" profile strip). Jay merged in-session (squash 0481461). Second-wave podcast scope (mentions model, auto-surfaced episode stories, scheduled release, transcript skill) stays staged in features/podcast-episode-pass-notes.md for Cowork briefing.

## 2026-07-31 - feat(podcast): mentions foundation (feature)
- type: feature
- pr: #168
- branch: feature/podcast-mentions-foundation
- commit: b78512e (squash of f2ae427 + 68c32b5)
- ids: none
- scope: podcast-mentions-foundation
- migration: applied 20260731000001_mentions.sql (applied in-session via the Supabase MCP at Jay's request; additive new table, NOT a hard pre-merge gate)
- status: merged
- tsc: clean

Session B of the podcast pass, building the queue lead features/podcast-mentions-foundation-brief.md. New editor-curated `mentions` table: an episode (events.id, event_type='episode') points at a subject entity with an optional timestamp_seconds + transcript excerpt and a draft/published status. Follows the event_guests conventions (FK on the episode side, no FK on the subject side, because catalog subject ids are mixed-type and people live across people + profiles); dedupe unique index on (episode_event_id, subject_type, subject_id, coalesce(timestamp_seconds, -1)) so one subject can be mentioned at two moments but never twice at the same one; RLS enabled with a published-only select policy as defense in depth. Routes: public GET /api/mentions (episode-side and subject-side, published only; include_drafts honored for editor sessions on the episode-side read ONLY so a draft can never reach a public timeline) plus editor-gated POST /api/admin/mentions (single or bulk, 23505 mapped to 409 carrying the existing row id) and PATCH/DELETE /api/admin/mentions/[id]. UI: a Mentions section on the episode page with an Add mentions editor modal (subject-type tabs, catalog search, mm:ss or raw-seconds timestamp, excerpt, draft toggle, Save + add another), and a shared MentionRow merged into FeedView so mentions land on /people/[id] and the owner's own timeline in the episode-date decade bucket, fuchsia spine node, expanding to the excerpt and "Watch at mm:ss". Two deliberate calls: the Mentions filter chip renders ONLY when the timeline holds mentions (satisfies A9 byte-identical zero-mention rendering and sidesteps the D5 375px chip-row concern), and mentions are kept OUT of the `all` count because countTimelineEntries also drives the owner's "Entry #N" celebration. One runtime bug caught during the browser smoke that tsc could not surface: lib/mentions.ts was pulling getServiceClient into a client component and dragging next/headers into the browser bundle, so the pure helpers were split into lib/mentions.ts (client-safe) with the service-client episode hydration moved to lib/mentions-server.ts. Verified: tsc clean, route validation 400 on missing args, unauthed admin POST 401, /people/jay_balmer renders identically with no Mentions chip. Migration applied in-session and the acceptance pass then RAN against prod with temporary rows on the one real episode (FNRad: Jay Balmer, ep 21), all removed after (0 rows remain). Verified: A1 all four indexes + RLS + 1 policy; A3 the MentionRow lands on /people/jay_balmer in the 2020s bucket reading "Mentioned on FNRad Podcast #21" with 754s formatted as 12:34 and the Mentions chip appearing only because a mention existed; A4 expand reveals the excerpt and the media link; A5 the draft row is absent from BOTH the anonymous episode-side and subject-side reads AND an anonymous caller passing include_drafts=1 still gets published-only; A6 a board subject renders as an entity chip linking to the board slug page and never reaches a timeline; A7's backing dedupe index rejects both an exact duplicate and a duplicate null-timestamp row with 23505 (the 409 maps from it); timestamp helpers round-trip across mm:ss, h:mm:ss, raw seconds, and the reject-vs-clear distinction. Second commit 68c32b5 fixes a real bug the smoke exposed: the row rendered "Watch at 12:34" on the Apple Podcasts media_url, a link that cannot seek, so watchLink now returns { href, seeks } and degrades to "Open episode" unless a parseable YouTube id and a timestamp are both present. STILL owed (needs an authed editor browser session): A2 and A8, the editor modal add + Save-and-add-another path; the API layer beneath them is smoked (401 unauthed, validation 400s, dedupe constraint proven). D7 landed: /profile (OwnerTimelinePanel) got the same fetch, it mirrored the person page cleanly. Session C scope (public /t/ surfaces, other entity pages, auto-surfaced episode stories, publish_at) and Session D (transcript-to-mentions skill) stay out of scope per brief section 8. POST-MERGE (same session): Jay merged as squash b78512e, and the episode's media_url was switched from the Apple Podcasts link to the YouTube link he supplied (https://www.youtube.com/watch?v=xpr2sqrPUHA) on evt_1782850803307_apuqit, which is what makes timestamped mentions seekable at all on that episode; prior value was https://podcasts.apple.com/ca/podcast/jay-balmer/id1069013869?i=1000514270963 if it ever needs reverting. Verified after the swap with one temporary row: the timeline row renders "Watch at 12:34" pointing at ...&t=754s, then deleted (0 rows remain). NEXT (not this session): populate real mentions for FNRad ep 21 from the YouTube transcript, guided by the 7-entity curated featured set Jay hand-edited on that episode page (Sean Balmer, Ken Achenbach, Ken Balmer, 1986 Snowboarding World Championships, Westbeach Classic 1990, Westbeach Classic 1992, Westbeach Vancouver); open questions parked with Jay are whitelist-vs-starting-point and one-row-per-entity vs one-row-per-moment. That hand pass is the shape the Session D transcript skill should generate.

## 2026-07-31 - PENDING auto-stub (feature/podcast-episode-destination)
- type: feature
- pr: #169
- branch: feature/podcast-episode-destination
- commit: 9c4b6cb
- ids: none
- status: merged
- tsc: n/a

_DUPLICATE auto-stub for PR #169: the full merged entry for this ship (scope: podcast-episode-destination, Session C, episode page as a public destination + scheduled release, migration `20260731000002_event_publish_at.sql` applied pre-merge) is the next entry below. Flipped pending to merged during the Aug 2 morning-digest reconcile so no stale pending remains for an already-shipped PR; kept in place per the append-only rule rather than deleted._

## 2026-07-31 - feat(podcast): episode page as a public destination + scheduled release (feature)
- type: feature
- pr: #169
- branch: feature/podcast-episode-destination
- commit: 52421e7 (squash of 9c4b6cb + 9242982 + 5d0fe95)
- ids: none
- scope: podcast-episode-destination
- migration: applied 20260731000002_event_publish_at.sql (HARD PRE-MERGE GATE cleared: Jay applied it in Supabase before merge, verified via information_schema, 0 rows scheduled)
- status: merged
- tsc: clean

Session C of the podcast pass, building the queue lead features/podcast-episode-destination-brief.md. Three things reach the public chromeless /t/[slug] episode page plus the first scheduling primitive in the codebase. (1) Published mentions: new readPublishedMentions() in mentions-server.ts is published-only with NO editor escape hatch (unlike GET /api/mentions, which honors include_drafts for editors on the episode-side read), so a draft cannot reach a public surface even inside an editor preview; a new store-free PublicMentionRow renders them on the dark ground with a server-resolved subject name, because the in-app MentionRow reads the Zustand catalog that the chromeless page deliberately does not load. Mention subject ids are seeded into the single existing resolveEntities pass rather than costing a second one. (2) Auto-surfaced linked stories (D1, locked yes): the linked_event_id + story_events union from GET /api/stories, replicated on the service client because the /t/ path never calls its own HTTP routes, visibility='public', newest first, capped at 12, curated-stack stories excluded so nothing renders twice, "See all N stories on the episode" past the cap linking to a server-resolved in-app path (bare /events/... 301s to the active community via the proxy, so the chromeless view needs no community context). No "I was there" on these cards (D7): POST /api/public/tag validates the moment against the CURATED stack, so a tag affordance on a non-curated card would be the same dead CTA Session A just fixed; a new allowTagging prop on StackView / StackEntryCard carries that. A shared storyStackEntry() helper was factored out of resolveCuratedRow so a curated story and a linked story can never drift into two different-looking cards. (3) events.publish_at scheduled release (D3): isEpisodeLive() gates readEventStack, readEventOwner (the OG route), and the show-page episode list; editors still reach a scheduled page through the existing /t/ preview branch, now with its own "Scheduled. Goes public on <date>." banner distinct from the never-published one. Render-time only, no cron, no queue, no vercel.json (confirmed none exists). PATCH /api/events/[id]/public-link accepts publish_at written ONLY when the key is present, so a plain publish toggle never clears a schedule by omission and a schedule-only body never flips the published flag; the editor datetime-local picker converts local wall-clock to an absolute instant at the edge. ONE REAL BUG CAUGHT BY THE ACCEPTANCE PASS (commit 9242982): PublicShowView filtered what it RENDERED, but PublicShowPayload.episodes is serialized into the page for the client component, so every unpublished and scheduled episode title was readable in the public show page source; readOrgStack now drops non-live episodes when requireEnabled is set (public read only, in-app read keeps the full list for editors). That leak predates Session C for public_enabled=false episodes, so the fix closes an existing hole as well as the new one. Acceptance A1 to A9 all ran against PROD with temporary rows on the one real episode (FNRad: Jay Balmer, ep 21) and all rows were removed after (0 mentions, 0 smoke stories, 0 junction rows, 0 scheduled events remain): A2 the published mention renders for an anonymous visitor with a 12:34 stamp expanding to the excerpt and a Watch at 12:34 link resolving to &t=754s; A3 the draft is absent from the rendered page AND from the serialized payload; A4 both a linked_event_id story and a story_events junction story surface newest-first while a private story does not, with zero "I was there" affordances; A5 publish_at two days out gives anonymous visitors a hard 404 and moving it into the past makes the page 200 with no deploy or cron; A6 clearing it restores manual behavior; A7 the public show page links only the live episode; A8 after cleanup the page is back to header + Featured only. Deliberate call flagged to Jay: brief D6 could be read as repointing the IN-APP show hub episode rows at /t/[slug]; they were kept in-app (the in-app episode page is the richer one: mentions, connections, editor controls) and a separate "Public page" link plus a Public/Scheduled state line was added to those rows instead. Out of scope per brief section 8 and untouched: member EpisodeConnections on the public page (D5), episodes in the general Events index (D4), the Session D transcript skill. NEXT: Session D (features/podcast-transcript-mentions-skill-brief.md), then delete and recreate the ep-21 page end to end as the real workflow test.

## 2026-07-31 - feat(podcast): transcript-to-mentions skill + idempotent seed import (feature)
- type: feature
- pr: #170
- branch: feature/podcast-transcript-mentions-skill
- commit: 70249a4 (squash of 3aae8f9)
- ids: none
- scope: podcast-transcript-mentions-skill
- migration: none (the mentions table shipped in Session B as 20260731000001_mentions.sql; ghost creation reuses people/places/orgs/boards/events)
- status: merged
- tsc: clean

Session D of the podcast pass, building the queue lead features/podcast-transcript-mentions-skill-brief.md. Tooling only: no migration, no route changes, no component changes. Three artifacts. (1) `.claude/skills/podcast-mentions/SKILL.md`, the authoring skill, greenfield because the repo had no `.claude/skills/` directory at all before this; it takes a transcript plus the episode identity and media URL, extracts candidates, writes the seed, hands the list back for review, and runs the importer only on an explicit go-ahead, with hard rules encoded (never invent a timestamp or excerpt, one row per moment rather than per entity, never publish). (2) `podcast-seeds/`, the seed format; real seeds are gitignored because a scrubbed seed carries proposed catalog data that has not been reviewed, so EXAMPLE.json + README.md ship as the format reference and the directory exists in a fresh clone. (3) `scripts/import-mentions.mjs`, following the backfill-public-slug.mjs pattern (.env.local bootstrap, service-role client, dry-run default, mirrored-rule note): dry run by default, `--resolve-only` writes resolutions back into the seed as the review surface, `--apply` creates ghosts and inserts draft mentions with skip-existing. Deliberate calls: direct DML rather than POST /api/admin/mentions, because that route fails an entire bulk insert on one 23505, only re-queries the first row, and cannot create ghost entities; person resolution spans BOTH `people` and `profiles`, because the app's people catalog is the union of the two and a mention against a member must carry the profile id (verified live, Sean Balmer resolves to the profile and Ken Achenbach to the unclaimed people row); created ghosts are linked into the episode's community, matching what /api/admin/show-episode does for a new show or episode (not in the brief, added so an imported ghost is not invisible in the community directory); import always lands `draft`, and a seed row saying `published` is downgraded with a warning. ONE BRIEF-SECTION-4 GAP SURFACED AND WAS FLAGGED RATHER THAN MIGRATED AROUND: `boards.model_year` and `events.start_date` are NOT NULL with no default, so a board or event ghost is REFUSED with a message naming the missing field unless the seed carries it in an optional `ghost` block; no value is invented. Acceptance ran against PROD on the one real episode (FNRad: Jay Balmer, ep 21) with temporary rows, all removed after (0 mentions, 0 smoke people/boards/events, no orphan junctions; the 3 remaining community_people rows without a `people` row are pre-existing member profiles). A2 dry run printed the plan and wrote nothing; A3 --apply created 3 ghosts and 8 drafts with the person ghost landing node_status='unclaimed' (NOT the 'catalog' default), community_status='unverified', added_by stamped, and community junctions present for person + board + event; A4's public half proven with 8 drafts live (anonymous episode-side read returned [] even with include_drafts=1, anonymous subject-side returned [], public /t/fnrad_jay_balmer rendered no mention section) while the editor-visible half rides on the Session B surface since the importer writes rows identical in shape to the editor modal; A5 re-running --apply gave 0 created, 0 inserted, 8 skipped; A6 a name matching two catalog people was refused as AMBIGUOUS with both candidate ids printed and inserted nothing; A7 the new_ghost rows re-resolved to the entities the first run created instead of duplicating; A8 no em dashes and the parseTimestampInput rule mirrored with a "change BOTH files" note in two places. Also covered: unreadable timestamps refused, resolution 'skip' excludes without deleting, mm:ss / h:mm:ss / raw-seconds all round-trip. A1 IS NOT RUN: it needs the ep-21 transcript, which is external input the app cannot fetch (brief D4) and is not in the repo; everything downstream of the transcript is proven with a hand-built seed against the real ep-21 catalog. NEXT: hand Jay's ep-21 transcript to the skill for the real A1 pass, then delete and recreate the ep-21 page end to end as the integrated workflow test. NOTE for the next session: the podcast-mentions skill will not appear in an already-running session's skill list; it registers on a fresh Claude Code session.

## 2026-08-01 - feat(podcast): scope mentions to snowboarding history, park the rest by activity (feature)
- type: feature
- pr: #171
- branch: feature/podcast-mentions-trim-parking
- commit: 925d04e (squash of f08cea2)
- ids: none
- scope: podcast-mentions-trim-parking
- migration: none (activity + skip_reason live in the seed file only and are never written to the database)
- status: merged
- tsc: clean

Follow-up to Session D (PR #170), driven by the FIRST REAL transcript pass rather than by a brief: Jay dropped the FNRad ep 21 transcript into the new podcast-mentions skill and the pass produced 91 candidates, only about two thirds of them snowboarding history. The rest were skate contests (all four Slam City Jam moments plus BC Place and the Pacific Coliseum as its venues), skateparks (China Creek, Seylynn, Millennium, New Line, the Vancouver Skateboard Coalition), and general-interest references (Lululemon, David Suzuki, a childhood hometown, the guest himself). Jay's instruction: focus the skill on snowboard-history specifics automatically, and SAVE the trimmed mentions by activity/community so the same episodes never have to be run again. That is the change: a trimmed candidate is no longer deleted from the seed, it stays as resolution 'skip' carrying two new fields, `activity` (skateboarding, business, general, ...) and `skip_reason` (one line), so when another activity or community goes live its mentions are already captured, timestamped and excerpted. SKILL.md gains a Scope section stating the snowboarding-history default, the never-delete-always-park rule, and the adjacent-but-in-scope cases (a skate shop that also sold snowboards, an indoor park that sponsored a mountain's terrain park, a person who crossed over) so the rule is not applied too bluntly; the review step now also surfaces every name INFERRED from context rather than read in the transcript, the count of new entities the import would create, and what was parked under which activity. The importer reports trimmed rows grouped by activity instead of one flat "excluded" count. Proven on the live ep-21 seed: 75 drafts to insert, 41 ghosts to create, 19 trimmed and kept (13 skateboarding, 5 general, 1 business), 0 refused. The new inferred-name surfacing earned its keep on the same pass: the transcript never names the guest's parents (only "Mom" and "Dad") and gives no surname for "Ross", "Devin" or "Sluggo", and Jay's corrections turned two of those into EXISTING catalog matches (Devun Walsh, Rob Boyce) instead of minting nodes literally named "Devon" and "Sluggo"; it also corrected The Snowboard Shop to The Snoboard Shop, which then matched an existing org, and identified Judy Hoad as the mother who ran the Alberta snowboard series. STATE AT WRAP: nothing imported yet. Prod still holds 0 mentions. The ep-21 seed is scrubbed, resolved and dry-run clean at podcast-seeds/fnrad-ep21.json (gitignored), waiting on Jay's go-ahead to run --apply; A1 of the Session D brief closes when it does. Open question parked with Jay: the three snowboard associations (Alberta, BC, Canadian) were typed org_type 'event-series' because Linestry has no 'association' org type, and Judy Hoad is currently on two moments (9:42 and 16:49) with her 17:44 Ontario-alderman mention left out as biographical.

## 2026-08-01 - feat(podcast): story-first mentions, one story with a cast (feature)
- type: feature
- pr: #172
- branch: feature/podcast-story-first-mentions
- commit: 136a03f (squash of d8f1706)
- ids: none
- scope: podcast-story-first-mentions
- migration: none (stories are a seed-file construct that expands to ordinary mention rows)
- status: merged
- tsc: clean

Third change in the podcast pass, driven by Jay reviewing the real ep-21 output rather than by a brief. The first pass produced 75 mentions and most were name-drops; Jay's call was that "I talked to Chip" at 2:19 is not worth a row on Chip Wilson's timeline while "I went to Chip and said I want to make the West Beach Classic better" is, and that the skill should be looking for stories worth reading or listening to, including stories that span several mentions from the same road trip or event. Two changes, one idea: a mention should carry a story. (1) THE BAR: SKILL.md step 1 is now "find the stories, not the names" with an explicit test (read the excerpt alone, does it tell you who was there, what they did, or how they were connected) plus the Chip name-drop-vs-story worked example and a stated target of 15 to 40 stories an episode, since eighty means the skill is indexing names. (2) STORIES HAVE A CAST: one passage usually establishes several entities at once (a road trip names the people in the van, the mountain and the contest), so the seed gains a `stories[]` array carrying a timestamp, a title, a longer excerpt and every subject in it, and the importer expands each story into one mention per subject all sharing the moment and the excerpt. That is the real payoff: the whole story lands on every participant's timeline rather than the sentence fragment that happens to name them, so Ken Achenbach's timeline reads the story about his 10th Street shop and where the family's first Barfoot came from. Excerpts grow from a one-line fragment to two to six sentences and may now be lightly cleaned of transcription noise (the auto-transcript is badly garbled) since they are what a reader actually reads; adding a fact, name or claim not in the transcript stays forbidden. Setting resolution 'skip' on a story trims its whole cast in one edit, which is what makes trimming a single checkbox on the review surface. Backward compatible: the flat mentions[] array still imports so pre-story seeds keep working, and --resolve-only writes back through a `_ref` reference so resolutions land inside the story block rather than on the throwaway expanded copy. Ep 21 re-extracted under the new bar: 37 stories, 92 mention rows, 40 ghosts, 0 refused (was 75 flat mentions), so more rows from far fewer and better moments because each story attaches to its whole cast. ALSO THIS SESSION, not in the PR (scratchpad + artifact, no repo change): a review surface published as a private Claude artifact, since Jay pushed back twice that raw JSON and chat tables are not readable. It renders every story in episode order with its cast as tier-coloured chips (Linestry's own entity colours, dashed border = node that does not exist yet), a click-to-timestamp link on each story that opens YouTube at that second for verification, filter chips, and a checkbox per story with a sticky summary bar and a "Copy trim list" button so Jay can trim by ticking boxes and paste the list back. NEXT: Jay reviews at the artifact, sends trims, then the --apply. Still 0 mentions in prod. Open question still parked: the three snowboard associations typed org_type 'event-series' because Linestry has no 'association' type. Follow-up worth doing: fold the review-page generator into the skill so every episode gets one automatically instead of it being hand-built per episode.

## 2026-08-01 - feat(podcast): bundle the seed review page generator into the skill (feature)
- type: feature
- pr: #173
- branch: feature/podcast-review-page
- commit: 592c48b (squash of 85f1f2e)
- ids: none
- scope: podcast-review-page
- migration: none
- status: merged
- tsc: clean

Follow-up to PR #172, closing the loop Jay opened by asking twice "is your output readable by me" and then "what do I get that is readable". The review surface had been hand-built per episode in the scratchpad, which does not survive contact with episode 22, so it ships as a bundled skill script. `.claude/skills/podcast-mentions/scripts/build-review.mjs` reads a seed and writes `<seed>-review.html` beside it: every story in episode order with its cast as tier-coloured chips using Linestry's own entity colours from CLAUDE.md (riders violet, places teal, events amber, brands cyan, boards emerald) with a dashed border marking any entity the catalog does not have yet, a timecode per story linking to the YouTube watch URL at that second so a story can be verified against the audio in one click, filter chips by type and by creates-something-new, a checkbox per story with a sticky bar that recounts stories and mentions live, and a Copy trim list button that puts the trimmed stories on the clipboard for the reviewer to paste back. It also renders a parked section (trimmed stories stay in the seed), handles the flat pre-story seed format so old seeds still get a page, and degrades without a parseable YouTube id. SKILL.md step 4 now runs the script and hands over the link INSTEAD of pasting a table into chat, stated as a rule since a seed file is JSON and a chat table is a wall of rows and neither is reviewable against audio. Title rule tightened on Jay's feedback that generated titles were not close enough to the actual story: name it in the plainest words that fit, like a caption, no colon stacking a second clause on the end, no listing the cast, no cleverness, with his own example encoded ("The first snowboard in the family" not "The first snowboard in the family: a Chuck Barfoot from Achenbach's shop"). Built review pages gitignored via /podcast-seeds/*.html. EP 21 AFTER JAY'S REVIEW: he trimmed 19 of the 37 stories via the checkboxes and pasted the list back, leaving 18 stories / 54 mentions / 21 ghosts / 18 distinct new nodes / 0 refused, all 37 titles rewritten plainer, and two content corrections applied that he caught: the 10:14 Shaun Palmer story is a SECOND story from the 1986 World Championships so that event joined its cast, and the 32:48 inverted-aerials story is about the 1992 Westbeach Classic so that event joined its cast. Trimmed stories are parked with activity 'snowboarding' and reason "trimmed at review, not surfaced individually", so they stay recoverable without re-transcribing. STILL 0 mentions in prod: the --apply has not been run and is the next step once Jay gives the go. Parked question unchanged: the three snowboard associations are typed org_type 'event-series' because Linestry has no 'association' org type.

## 2026-08-01 - fix(podcast): group episode mentions by moment (feature)
- type: feature
- pr: #174
- branch: feature/podcast-mention-grouping
- commit: 9e52a4d (squash of 293ec73)
- ids: none
- scope: podcast-mention-grouping
- migration: none
- status: merged
- tsc: clean

Caught by Jay asking, after PR #172, whether the episode page needed updating for the story format. It did, and this closes a display regression the format change introduced before any data was imported. The story-first format writes one mention row per subject, so a story with six subjects is six rows sharing a timestamp and a paragraph; that is correct for a person's timeline (they see the story once, whole) and wrong for the episode page, which shows every subject and would have printed the same paragraph six times. Ep 21 would have rendered 54 rows for 18 stories on both the in-app episode page (episode-page.tsx, flat mentions.map) and the public chromeless page (public-episode-view.tsx, same). New pure helper groupMentionsByMoment() in lib/mentions.ts folds rows sharing a timestamp AND an excerpt: both, deliberately, because two subjects that merely happen to share a timestamp are different mentions and must not merge, and a mention with NO excerpt is always its own group since there is no story text to duplicate and two blank mentions at one moment are far more likely to be unrelated hand-added rows than one story. Input order is preserved so the timestamp-ordered read stays ordered. Two new group components mirroring the existing MentionRow/PublicMentionRow split: MentionGroup (in-app, states the line once, cast as entity chips in tier colours, per-mention Edit/Remove kept in the expanded panel since each subject is still its own DB row) and PublicMentionGroup (chromeless /t/, store-free with server-resolved names, no editor affordances, dark ground). MentionRow is UNTOUCHED and still serves a person's timeline where subject-led is the right shape. A group of one renders as a single-chip card so Session B editor-modal mentions look exactly as before. VERIFIED on a local dev server against prod data with four temporary published rows on ep 21 (three sharing a moment at 567s, one solo at 3122s), all removed after (0 mentions remain): both the public /t/fnrad_jay_balmer page and the in-app episode page rendered 2 cards not 4, DOM-read as 9:27 with chips [1986 Snowboarding World Championships, Ken Balmer, Ken Achenbach] and one excerpt node, plus 52:02 with [Sean Balmer] and one excerpt node; the in-app chips carried their entity icons. Note the browser screenshot came back blank (the known Next 16 preview-iframe limitation), so the DOM query is the evidence of record. KNOWN GAP left for a follow-up, flagged in the PR: the Session B editor modal is still one subject per save, so hand-building a six-subject story means retyping the excerpt six times; a convenience gap not a correctness one, and the importer is the main authoring path. STILL 0 mentions in prod; ep 21 is reviewed down to 18 stories / 54 mentions / 21 ghosts / 0 refused and the --apply is the next step on Jay's go.

## 2026-08-01 - feat(podcast): story titles on episode mention cards (feature)
- type: feature
- pr: #175
- branch: feature/podcast-story-titles
- commit: a8b5394 (squash of 164dd83)
- ids: none
- scope: podcast-story-titles
- migration: applied 20260801000001_mention_story_title.sql (SAFE per the risk gate: additive ADD COLUMN, nullable, no default; applied by me via the Supabase MCP and verified in information_schema BEFORE merge, because the importer and the editor modal both send the key unconditionally)
- status: merged
- tsc: clean

Jay's call after asking how the story format would appear on the episode page. Grouping (PR #174) folded a story's cast into one card, but the card had no headline and led with a two-line clip of the excerpt, which does not scan across eighteen of them; the seed file already carried a per-story title for the human reviewing it and the review page proved that is what makes a long episode readable, so this is where that title lands. New nullable `mentions.story_title`, denormalized across a story's rows exactly like excerpt already is (a mention is the unit the schema stores; a story is a grouping over it), with groupMentionsByMoment taking the FIRST NON-EMPTY title in a group rather than requiring every row to agree. Rendered in three places: MentionGroup (in-app episode card, bold above the excerpt), PublicMentionGroup (same on the chromeless /t/[slug] page), and MentionRow on a person's timeline under "Mentioned on FNRad #21" so the timeline says what the story WAS and not merely that one exists. Null renders exactly as before, excerpt-first, so every pre-existing mention is untouched. Authoring both paths: the importer writes each story's title onto all of its rows (expandStories carries story.title), and the editor modal gains a Story title field; that modal's "Save + add another" now clears ONLY the subject and KEEPS the moment (title, timestamp, excerpt), because adding a story means entering its cast against one moment and clearing those made an editor retype the same paragraph once per person, which closes the convenience gap explicitly flagged in PR #174. Read paths needed no change: GET /api/mentions and readPublishedMentions both select("*"). PATCH /api/admin/mentions/[id] accepts story_title with the same present-key-only discipline as the other fields. VERIFIED on a local dev server against prod data with four temporary published rows on ep 21 (three sharing a titled moment at 567s, one deliberately UNTITLED at 3122s), all removed after (0 mentions remain): the public /t/fnrad_jay_balmer page rendered 2 cards with the titled one leading "Driving to the 1986 World Championships" then the excerpt then 3 chips; the in-app episode page matched with entity-icon chips; Ken Achenbach's timeline row read "Mentioned on FNRad Podcast #21 9:27" then the bold title then "FNRad: Jay Balmer 24 Mar 2021"; and the untitled row rendered excerpt-first with no headline, proving backward compatibility. STILL 0 mentions in prod. Ep 21 is reviewed and ready at 18 stories / 54 mentions / 18 distinct new catalog nodes (8 riders, 7 places, 3 orgs) / 0 refused, and the --apply is the next step on Jay's go.

## 2026-08-01 - data: FNRad ep 21 mentions imported as drafts (data op)
- type: data
- pr: none (pure DML via scripts/import-mentions.mjs --apply, no code change; follows the board-seed-merge precedent for one-off data operations)
- branch: none
- commit: none
- ids: none
- scope: podcast-ep21-mentions-import
- migration: none (20260801000001_mention_story_title.sql was already applied under PR #175)
- status: applied
- tsc: n/a

The first real run of the transcript-to-mentions workflow end to end, on Jay's explicit go. Command: `node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json --apply --actor 0394914d-6ffd-4a18-aa1f-1aafee7ce53a` against FNRad: Jay Balmer (evt_1782850803307_apuqit). RESULT: 18 ghosts created, 54 draft mentions inserted, 0 skipped, 40 rows trimmed-and-parked in the seed, 0 refused. VERIFIED IN PROD AFTER: all 54 rows are status='draft' with 0 published, spanning exactly 18 distinct story_titles across 18 distinct timestamps (cast sizes 1 to 6; the largest are "Driving to the 1986 World Championships" and "Devun Walsh's baggy pants" at 6 each). The 8 new person nodes all landed node_status='unclaimed' + community_status='unverified' (NOT the DB default 'catalog'), and all 18 new entities got their community junction rows (8 people, 7 places, 3 orgs). PUBLIC INVISIBILITY CONFIRMED against the live site: the anonymous episode-side read returns [] even with include_drafts=1, the anonymous subject-side read for Ken Achenbach returns [], and the public /t/fnrad_jay_balmer page contains no story title. The 18 new catalog nodes are 8 riders (Chuck Barfoot, Judy Hoad, Steve Edmonson, Ross Rebagliati, Jamie Lynn, Kevin Young, Chip Wilson, Craig Kelly), 7 places (Breckenridge, Vancouver, The Clubhouse, Mount Baker, Whistler, Blackcomb, Nakiska) and 3 orgs (Alberta Snowboard Association, Inside Edge, BC Snowboard Association); the other 18 subjects resolved to entities already in the catalog. Judy Hoad and Ken Balmer are named on Jay's identification, not from the transcript, which only ever says "Mom" and "Dad"; Ross Rebagliati and Devun Walsh and Rob Boyce likewise came from Jay's review (the transcript says only "Ross", "Devon" and "Sluggo"). NEXT (Jay's action, not code): publish the drafts from the episode page story by story, which is the only remaining step before they reach the public episode page and each subject's public timeline. Then the ep-21 delete-and-recreate end-to-end test. Still open and unrelated: the three snowboard associations are typed org_type 'event-series' because Linestry has no 'association' org type.

## 2026-08-01 - feat(podcast): drop the connections list from the episode page (feature)
- type: feature
- pr: #176
- branch: feature/episode-drop-connections
- commit: f894c86 (squash of 724798d)
- ids: none
- scope: podcast-episode-drop-connections
- migration: none (code removal only; GATED duplicate-place repair ran separately, see below)
- status: merged
- tsc: clean

Jay's call once ep 21's mentions were live: the story mentions carry the specifics, so the flat connections roster below them is redundant. The connections list (EpisodeConnections, FNRad Phase 4) showed every entity an episode touched in five buckets with NO context, just a name; a mention says what happened, when in the episode, and who else was in it, and the whole cast links out the same way the roster did, so keeping both meant the page named an entity twice and said less the second time. Ep 21 is the case: 18 titled stories with casts vs a roster of 21 names. RENDERING DECISION NOT A DELETION: the junction data (event_people / event_places / event_events / event_orgs / event_boards, 21 rows all on ep 21) and the GET|POST|DELETE /api/events/[id]/connections route are deliberately left intact so the rows survive and restoring is one import away; only the component file was deleted (git holds it) and a comment at the old render site records why and where the data still lives. KNOWN AND ACCEPTED by Jay (he picked option 1 over backfilling first): four connections had no mention behind them and no longer show on the episode page. Dano Pendygrasse is a GENUINE EXTRACTION MISS worth fixing later (the transcript names him at 11:00, "I think it's in Dano's book", and the skill did not catch it); John Stewart and Paul Culling came from Team Fun, a story Jay trimmed at review; Jay Balmer is the guest, already the subject of the page.

## 2026-08-01 - data: ep 21 duplicate-place repair (data op, GATED, Jay approved)
- type: data
- pr: none (manual SQL via the Supabase MCP)
- ids: none
- scope: podcast-ep21-duplicate-places
- migration: none (pure DML on existing rows)
- status: applied
- tsc: n/a

A defect in the ep-21 import, found only because Jay asked about removing the connections list and the roster query exposed it. The importer's name resolver is case-insensitive EXACT match then ghost (brief D6, chosen so a collision is never auto-picked), and the Linestry catalog uses fuller resort names, so five near-misses silently minted duplicate place nodes: Breckenridge vs the existing Breckenridge Ski Resort (p31), Mount Baker vs Mt. Baker Ski Area (p26), Nakiska vs Nakiska Ski Area (p18), Whistler vs Whistler Blackcomb (p1), and Blackcomb also vs Whistler Blackcomb (p1). GATED under the risk gate (UPDATE + DELETE of existing rows); the SQL was printed with the risk stated in one sentence and Jay gave an explicit okay before it ran. Applied: four UPDATEs repointing six mentions onto p31 / p26 / p18 / p1, one DELETE of the single Blackcomb mention (it would otherwise have put two mentions on Whistler Blackcomb inside the same 43:35 story), then DELETE of the five duplicates' community_places junction rows and the five places rows. VERIFIED AFTER: 0 duplicates remain, ep 21 holds 53 mentions (down from 54 by the one dropped Blackcomb row) across the SAME 18 story titles, 0 orphan place mentions, and every place now resolves to a canonical node (Breckenridge Ski Resort, Cypress Mountain, Fortress Mountain, Grouse Mountain x4, Mt. Baker Ski Area x2, Nakiska Ski Area, The Clubhouse, Vancouver, Whistler Blackcomb). Vancouver and The Clubhouse are legitimately new and were kept. FOLLOW-UP OWED, not built: make the resolver surface near-misses as candidates for review instead of silently creating a node, so episode 22 does not repeat this. Today it only flags EXACT-name collisions as ambiguous; a containment or token-overlap probe would have caught all five.

## 2026-08-01 - fix(podcast): near-miss detection in the mention resolver (feature)
- type: feature
- pr: #177
- branch: feature/import-near-miss-detection
- commit: ef81d94 (squash of 4307237)
- ids: none
- scope: podcast-import-near-miss
- migration: none
- status: merged
- tsc: clean

Closes the defect the first real ep-21 import exposed (see the duplicate-place repair entry above). The resolver matched names case-insensitively but EXACTLY (brief D6), and the Linestry catalog uses fuller resort names, so five near-misses silently minted twins: Mount Baker vs Mt. Baker Ski Area, Nakiska vs Nakiska Ski Area, Breckenridge vs Breckenridge Ski Resort, Whistler vs Whistler Blackcomb, Blackcomb vs Whistler Blackcomb. Exact matching stays as pass one (one hit resolves, several are 'ambiguous' and never auto-picked). NEW pass two runs only when nothing matched outright: it compares significant tokens after normalizing the abbreviations that actually collide (Mt. -> Mount, St. -> Saint, & -> and) and dropping words carrying no identity (ski, skiing, area, resort, mountain, mtn, hill, park, snowboard(s|ing), boards, co, inc, ltd, llc, the, a, an, and, of, at), with containment EITHER WAY counting, which catches abbreviation, generic suffixes and partial names ("Whistler" inside "Whistler Blackcomb"). A near miss lands the row as a new resolution value 'review' with its candidates and REFUSES it, on the reasoning that a wrong new node is worse than a stopped import because the mention still gets written, just against a twin nobody else links to. Escape hatch is "confirm_new": true on the subject. The check is deliberately loose: a false flag costs one decision, a missed one costs a permanent duplicate other people start linking to (Vancouver, for instance, now flags against Westbeach Vancouver, which is a correct thing to ask about). PERFORMANCE/CORRECTNESS side-effect: resolution now reads ONE table per type into an in-memory index rather than a query per row, which is what makes the token scan affordable at all, and rememberCreated() pushes a ghost created mid-run into that index so later rows in the same import match it instead of creating a second one (previously this worked only by accident of the DB round-trip). VERIFIED against the exact five that broke plus Mt. Seymour: all six now refuse with the right candidate listed; Grouse Mountain and Ken Achenbach still match exactly; an invented name still creates; confirm_new overrides. Docs updated in podcast-seeds/README.md (new "Near misses" section, resolution + confirm_new fields) and SKILL.md (step 3 lists 'review', step 4 says never wave one through). The review page marks a near miss with its own chip treatment plus a "need a decision" tile so it cannot be mistaken for a routine new node. HOUSEKEEPING: the ep-21 seed was repointed at the canonical ids the repair settled on (8 subject rows to p31/p26/p18/p1, and the collapsed Blackcomb subject dropped), so seed and prod now agree and a dry run reports 53 skipped / 0 created / 0 refused, proving idempotency survives the resolver change. STILL OWED, unchanged: the Dano Pendygrasse mention at 11:00 that the extraction missed ("I think it's in Dano's book"), now invisible on the episode page since PR #176 removed the connections list that carried him.

## 2026-08-01 - feat(podcast): publish a story of mentions in one click (feature)
- type: feature
- pr: #178
- branch: feature/mention-publish-button
- commit: ccabbd6 (squash of 6829e19)
- ids: none
- scope: podcast-mention-publish
- migration: none
- status: merged
- tsc: clean

Jay asked what publishing actually took once ep 21 was imported, and the honest answer was 53 round-trips through the edit modal (Edit, uncheck Draft, Save, one mention at a time), six of them for the same story on the 9:27 and 43:35 stories. That does not survive a season of episodes, so he asked for the button. THE SHAPE: publishing is a per-STORY act while the schema stores per-SUBJECT rows, so every row of a story must flip together or the episode page shows half a story. Three parts. (1) New PATCH /api/admin/mentions { ids, status } on the COLLECTION route: editor-gated bulk status change capped at MAX_BULK (200), deliberately status-only, with content edits staying on PATCH /api/admin/mentions/[id]. (2) Per-story Publish button on MentionGroup, becoming Unpublish once live, driven by anyDraft; the card already holds its whole cast so one click sends one request for all its rows, with a local busy state. (3) "Publish all N" on the Mentions section header while drafts remain, behind a confirm() since it is the outward-facing one. Shared setMentionStatus() on the episode page does the fetch and patches local state so the badge and button label update without a refetch. VERIFIED: unauthed PATCH 401s and the editor gate fires BEFORE body validation (a bad status still returns Unauthorized, correct order); the anonymous episode read still returns [] with 53 drafts present; the episode page renders 200. THE END STATE WAS PROVED DIRECTLY rather than asserted: one story ("The first snowboard in the family", 4 rows) was flipped to published in the DB and the public /t/fnrad_jay_balmer page then rendered exactly that one card, with its title and full cast (Chuck Barfoot, Sean Balmer, The Snoboard Shop, Ken Achenbach), while the other 17 stories stayed hidden; then reverted, leaving 53 draft / 0 published so the editorial choice stays Jay's. KNOWN GAP unchanged from Session B: the button CLICK needs an authed editor browser session to exercise, which this environment cannot easily get; the API beneath it is smoked and the render path verified. Ep 21 remains 53 drafts across 18 titled stories awaiting Jay's publish.

## 2026-08-01 - feat(podcast): mentions on place, brand, board and event pages (feature)
- type: feature
- pr: #179
- branch: feature/entity-page-mentions
- commit: 7ef33a3 (squash of 8c43ef9)
- ids: none
- scope: podcast-entity-page-mentions
- migration: none
- status: merged
- tsc: clean

Jay asked how the stories appear on the timelines for riders, places and brands; the honest answer was riders yes, everything else no. Session B folded mentions into FeedView for /people/[id] and the owner panel only, so a mention of Grouse Mountain rendered as a chip on the episode page and appeared NOWHERE on Grouse Mountain's own page. On ep 21 that was half the index invisible on the entities it is about: 13 place rows / 9 entities, 8 event rows / 5 entities, 6 org rows / 5 entities, against 26 rider rows / 16 entities. New src/components/feed/entity-mentions.tsx wired into places/[id], brands/[slug], boards/[id] and events/[id]; those pages have no FeedView to fold into so it is a standalone section using the existing MentionRow in context="timeline". It RETURNS NULL when there are no mentions, which is the common case across the catalog, so an entity nobody has discussed on a podcast renders byte-identically to before. The read is the existing PUBLIC subject-side GET /api/mentions path, which is published-only by design with no editor escape hatch, so a draft cannot reach these pages. Rows are re-sorted client-side newest-episode-first then in episode order, because the API orders by timestamp_seconds which is meaningless across episodes. PLACEMENT CALL, flagged in the PR for Jay to override: inside the Stories tab on the tabbed pages (places, brands) and above the Stories block on boards and events, on the reasoning that mentions are narrative content and belong with stories rather than in the catalog detail; the alternative is a dedicated tab with a count. VERIFIED on a local dev server against prod data with three stories temporarily published then reverted (back to 53 draft / 0 published): Grouse Mountain's place page rendered "Talked about on the podcast" above "Stories" with "Mentioned on FNRad Podcast #21 20:25" and the title "The Enchanted Kingdom park at Grouse"; The Snoboard Shop's brand page rendered the Alberta Snowboard Association story at 16:17; Westbeach Classic 1992's event page rendered "The 1992 obstacle course" at 13:48; and Cypress Mountain, whose mentions stayed draft, rendered NO section at all, proving both the published-only gate and the empty-case no-op. Ep 21 remains 53 drafts across 18 titled stories awaiting Jay's publish, which will now light up rider, place, brand and event pages together.

## 2026-08-01 - docs: ship sequence risk gate committed (chore)
- type: chore
- pr: #180
- branch: chore/ship-sequence-risk-gate
- commit: 470b7f2 (squash of 55ffe5f)
- ids: none
- scope: ship-sequence-risk-gate
- migration: none (docs + hook config only)
- status: merged
- tsc: n/a (no source change)

Housekeeping at Jay's request after he asked what the two uncommitted working-tree files were. CLAUDE.md and .claude/settings.json had both been edited BEFORE this session started and had sat uncommitted all day, which meant the policy the whole session ran under existed only on one machine and a git checkout would have discarded it. Committed as its own change rather than folded into a podcast PR, since it is policy and not feature work. WHAT IT CHANGES: the old Ship sequence had the agent surface each migration as copy-paste SQL, wait for Jay to apply it, then prompt him to merge, which left migrations as silent "outstanding" gates whenever he stepped away and recorded shipped work as pending. The agent now runs both steps itself behind an explicit risk gate: SAFE (CREATE TABLE, ADD COLUMN, CREATE INDEX, RLS on tables created that session, backfills of a column added that session) is done without asking; GATED (DROP, TRUNCATE, DELETE/UPDATE of existing rows, type changes, renames, RLS on pre-existing tables, anything touching profiles/memberships/Stripe) is printed with the risk stated and waits for Jay, with "when in doubt, GATED". Merging follows the same shape: merge once tsc is clean EXCEPT when the session touched payments/Stripe, auth flows or data-deletion paths, the migration was GATED, or there is real doubt. .claude/settings.json carries the matching Stop-hook reason text and is a TRACKED shared file (only settings.local.json and launch.json are gitignored), so committing it is what actually distributes the behaviour. VALIDATION IN PRACTICE: today's podcast session was the first run under this policy across ten PRs (#170-#179) and the gate drew the line correctly both times it mattered: story_title was an additive ADD COLUMN so it was classified SAFE, applied via the Supabase MCP, verified in information_schema, and #175 merged behind it; the ep-21 duplicate-place repair was UPDATE + DELETE of existing rows so it was printed with the risk stated and held until Jay's explicit okay. Working tree is now clean for the first time this session.

## 2026-08-01 - fix(stack): featured cards and guests link to their entity pages (bugfix)
- type: bugfix
- pr: #181
- branch: fix/featured-stack-links
- commit: bb27b89 (squash of 6a03003)
- ids: none (Jay reported in-session, no BUG-NNN assigned)
- scope: featured-stack-links
- migration: none
- status: merged
- tsc: clean

Jay reported that nothing in the featured list is clickable ("the whole point is to be able to browse the graph"), that events only offered the drop-down, and that the guest name should be clickable too. CONFIRMED: StackEntryCard contained NO Link and NO href anywhere; the only interaction was setExpanded, so the most prominent block on an episode page was a dead end on the one surface whose purpose is graph browsing, and guests rendered as plain spans. ROOT CAUSE: StackView is store-free BY DESIGN because the chromeless /t/[slug] page never loads the Zustand catalog, so the card cannot call entityHref(id, type, catalog) to build a link; the entries are resolved server-side, so that is where the path has to be resolved too. FIX: ResolvedStackEntry gains `href`, filled at ALL ELEVEN construction sites (the compiler found them) across resolveRow (profile stacks), resolveCuratedRow (episode + show stacks) and storyStackEntry, via a new stackHref() helper; null for story and category_summary, which have no entity page and expand instead. Paths are emitted BARE (/places/…, /events/…, /boards/…) so the proxy 301s them to the active community, reusing the Session C trick that already backed "See all N stories on the episode" (in_app_path at line ~1301); /people/[id] is already a global route. PERSON LINKS USE THE RAW ID, not a name slug, because the collision rule needs the whole people catalog to know a name is unique and this context holds only the referenced entities, while /people/[id] accepts both and canonicalizes to the slug on load via useCanonicalPath. ONLY THE TITLE is a link, with stopPropagation: wrapping the card would swallow the expand click and break story media expansion and the "I was there" affordance. Guest chips on the episode page became Links to /people/[id]. Side benefit: profile stacks and show stacks are fixed too, since they share the resolver. VERIFIED on a local dev server against prod data: all six ep-21 featured cards render an anchor on BOTH the in-app episode page and the public /t/fnrad_jay_balmer page (2 riders by id, 3 events by name slug, 1 rider), every destination returns 200 with the bare /events/… paths redirecting to /snowboarding/events/…, and the guest chip links to Jay's profile.

## 2026-08-02 - feat(podcast): mention seed import from the browser (feature)
- type: feature
- pr: #182
- branch: feature/podcast-import-page
- commit: 0697388 (squash of 771e5ae)
- ids: none
- scope: podcast-import-page
- migration: none
- status: merged
- tsc: clean

Delivers features/podcast-import-page-brief.md, the feature-queue lead. THE BOUNDARY THIS REMOVES: resolving a seed against the catalog and importing it both needed SUPABASE_SERVICE_ROLE_KEY from .env.local, so the back half of the transcript-to-mentions workflow ran only on Jay's Mac. His test of Claude Code on the web failed at exactly that point, and exporting a prod service-role key into an ephemeral container was correctly declined (it bypasses RLS on every table including profiles and memberships). The split shipped here: the AI half (transcript to seed) runs anywhere with no database and no keys, and the data half becomes an editor-gated page under a normal login, so the key never leaves the server. NO AI dependency was added to the codebase; there is none today and D8 said keep it that way. FOUR PARTS. (1) src/lib/mention-import.ts, the seed contract + name normalization + near-miss rule + ghost planning + dedupe key ported from the .mjs script to TypeScript, client-safe so the page shares its types (mentions.ts had exactly the service-client-in-a-client-bundle bug in Session B, so the executor is a separate module). (2) src/lib/mention-import-server.ts, the executor: ONE function, TWO modes, so the plan a person reviews is produced by the code that executes it; a separate preview implementation would be free to drift and the whole value of the review surface is that it is honest. (3) POST /api/admin/mentions/import, requireEditor then getServiceClient, deliberately NOT routed through POST /api/catalog/entity for ghost creation because that path awards contribution tokens and would pay the importer for every entity an episode happens to name. (4) /admin/podcast/import (page.tsx + import-client.tsx per the tag-queue convention): paste, review, import, with stories in episode order, tier-coloured casts, a timecode per story into the media, per-story trim, a live summary bar, and near-miss rows expanding to their candidates. Trims and decisions are edits to the SEED PAYLOAD (resolution skip / subject_id / confirm_new), which the server re-resolves on import, so nothing on the page is trusted client-side. TWO DELIBERATE CALLS, both flagged in the PR for Jay to override: apply is EXPLICIT (only dryRun:false writes, deviating from the brief's bare {seed}, so a truncated body can never import into prod by omission); and refusals do NOT block import (a board with no model_year or an event with no start_date cannot be created and no value may be invented, so those rows are listed in a red panel naming the missing field and skipped, since blocking would leave no way forward but trimming) while NEAR MISSES DO block per D7, that being the guard that stopped five duplicate places on the first real import. VERIFIED against prod on a local dev server with a real minted editor session, temporary rows written then removed, ep-21 left exactly as found (53 published, 0 draft, no leftover nodes): A1 ep-21 dry run gives 18 live stories / 19 parked / 0 new nodes / 0 decisions / 53 matched; A2 "Mount Baker" flags review offering p26 Mt. Baker Ski Area; A3 picking the candidate resolves to p26 and "create it anyway" plans a new place instead; A4 the created ghost carried node_status='unclaimed' (NOT the 'catalog' default) + community_status='unverified' + its community_people junction row; A5 both mentions landed draft, the anonymous episode read returned 53 rows none of them the test story, the anonymous subject-side read returned []; A6 the second apply created nothing (0 mentions, 0 ghosts, 2 skipped) and the run-1 ghost exact-matched rather than minting a twin; A7 board and event ghosts missing required columns both refused naming the field, nothing partial written; A8 unauthed page 307 to /auth/signin and unauthed POST 401, non-editor page 307 to / and non-editor POST 403; A9 a skipped story contributes nothing; A10 malformed JSON reports the parse error inline and never reaches the server; plus two rows naming the same new entity plan ONE node not two. npm run build clean with both new routes present. KNOWN GAP, unchanged in kind from Sessions B and D: the click-driven React interactions (trim checkbox, candidate buttons, Import button) could not be exercised, since this environment cannot drive an authed browser session against the Next 16 preview iframe; the route beneath them is smoked end to end and the page renders 200 with the expected content under a real editor session. scripts/import-mentions.mjs stays for local use and now carries an explicit CHANGE BOTH FILES mirror note; podcast-seeds/README.md and the podcast-mentions SKILL.md both gained a "two ways to finish" section pointing at the page when there is no checkout, with an explicit instruction never to ask for a service-role key to work around it. FOLLOW-UP not done here and out of scope by the brief: retiring the script, and storing seeds in the database so a half-finished review survives a reload.

## 2026-08-02 - chore(nav): avatar dropdown "Editor" renamed to "Admin" (chore)
- type: chore
- pr: #183
- branch: chore/dropdown-admin-label
- commit: 021d17d
- ids: none (Jay asked in-session, no BUG-NNN)
- scope: dropdown-admin-label
- migration: none
- status: merged
- tsc: clean

Jay asked for the avatar dropdown item to read "Admin" instead of "Editor". One label in src/components/ui/nav/avatar-dropdown.tsx (plus its comment). The item already pointed at /admin and every page it leads to is titled admin, so "Editor" was the odd one out and read like a separate, narrower surface. UNCHANGED: the href, the isEditor gate on the item, and the server-side authority behind it (requireEditorPage() in src/app/admin/layout.tsx, requireEditor()/requireModerator() per route). Wording only, no authority change. Checked that no other nav-level label points at /admin under a different name; the remaining /admin links are back-links inside the admin tree carrying their own text. NOT browser-verified: the dropdown renders only after a click on the avatar, so there is no server-rendered markup to fetch and this environment cannot fire the click against the Next 16 preview iframe; the diff and a clean tsc are the check for a one-word label.

## 2026-08-02 - fix(podcast): import page says it wants a seed, not a transcript (bugfix)
- type: bugfix
- pr: #184
- branch: fix/import-page-transcript-copy
- commit: bf5587a
- ids: none (Jay reported in-session on first use, no BUG-NNN assigned)
- scope: import-page-transcript-copy
- migration: none
- status: merged
- tsc: clean

Jay's first real visit to /admin/podcast/import, hours after it shipped in PR #182, was to paste the YouTube transcript, because that is what a person has in hand. Working as designed (extraction stays with Claude per D8: there is no AI dependency in this codebase and adding one would bill per episode instead of running free on the Max plan), but the page did a poor job of saying so. It DID name the podcast-mentions skill, in a footnote UNDER the box, below a JSON placeholder, which is the wrong place: what a box wants has to be said before the box, not after it. THREE CHANGES, all copy. (1) A callout above the textarea stating plainly that it takes a mention seed and not a transcript, that you hand the transcript to Claude anywhere (repo, claude.ai, phone) with the show name and episode number to get one back, and naming the split so the design reads as intentional rather than broken: extraction stays on your plan, this page does the catalog half. (2) A paste that does not start with { now reports "That looks like a transcript, not a seed" with what to do instead and an explicit "Nothing was sent anywhere", rather than a raw JSON parser message about an unexpected token, which names the symptom and not the fix. The guard is still local, so a transcript paste never reaches the server. (3) The footnote drops to just the seed-format reference now that it is not carrying the explanation. No behaviour, route or schema change. VERIFIED: the new copy renders under a real minted editor session on a local dev server against prod (page 200, every new string present in the HTML). NOT exercised: the transcript-shaped error branch needs a click on Resolve, which this environment cannot fire against the Next 16 preview iframe; it is a string swap on the existing parseError path that acceptance A10 already covered in #182. LESSON worth carrying: the empty state of a paste-a-blob tool is the whole onboarding, and the first thing a user reaches for is the artifact they already have, not the one the pipeline wants.

## 2026-08-03 - fix(compare): legible avatars + person name resolution (bugfix)
- type: bugfix
- pr: #185
- branch: fix/compare-avatars-black-BUG-024-067
- commit: a63d99a (squash of f47184b, rebased onto bf5587a)
- ids: BUG-024, BUG-067
- scope: compare-avatars-black
- migration: none
- status: merged
- tsc: clean

SHIP-FINISH, NOT A REBUILD. This was already built July 2 as local commit f47184b on a branch that was never pushed, and NEXT-SESSION.md has carried a standing "SHIP-FINISH FIRST, DO NOT REBUILD" flag on it since. Rebased onto current main (clean, one file), pushed, merged. BUG-024: three sites on /compare drew their own avatar as bg-[#1C1917] with text-foreground initials, and since --foreground is near-black in light theme the initials went dark-on-dark and each avatar read as a solid black disc: the picker button, the picker dropdown results, and the side-by-side column headers. All three now use the shared RiderAvatar, which carries explicit inline colors; the two duplicate local initials() helpers went with them. BUG-067: the compare name resolver had no person case, so person ids fell through to getEntityName, which only knows profiles and mock-data; ghost / catalog / duplicate person nodes live in the loaded catalog but in neither of those, so they rendered as "Unknown". Added a person case resolving display_name from catalog.people first, and made the default branch fall back the same way before "Unknown". VERIFIED IN-BROWSER, before and after on the same page: on unpatched code /compare in light mode rendered Kira Matsuda's avatar as a featureless black circle (screenshot), and on the fix the same avatar reads "KM"; a DOM sweep of the loaded page (?b=u2, both pickers plus both side-by-side column headers) found ZERO remaining rgb(28,25,23) discs and all four avatars at bg rgb(39,39,42) / text rgb(161,161,170). BUG-067 was not separately reproducible anonymously, since mock-data people all resolve through getEntityName; it is covered by tsc and the read of the resolver. Note for whoever takes BUG-120 + BUG-123 (the compare functional pass): its hard prerequisite was this ship, and it is now cleared.

## 2026-08-03 - fix(tags): /me/tags opens at the top of the page (bugfix)
- type: bugfix
- pr: #186
- branch: fix/tags-entry-scroll-BUG-150
- commit: c65f45e (squash of 6b9ad77)
- ids: BUG-150
- scope: tags-entry-scroll
- migration: none
- status: merged
- tsc: clean

Builds bugs/2026-07-07-tags-entry-scroll.md, the session lead, on both recommended defaults. Entering the tags inbox landed at a remembered scroll position, so the "Your tags" header, the four status chips and the MeSubNav row all sat above the viewport and the page read as headerless with only the sticky main nav showing. Fix is a mount-time window.scrollTo(0, 0) in MeTagsPage, placed ABOVE the render guards so it fires regardless of auth state; that covers every restoration mechanism at once (App Router back-nav restoration, iOS Safari bfcache, a stale body-scroll-lock restore carried from the previous page) without needing to tell them apart, and there are no anchor deep links into this page so nothing legitimate wants a non-top entry. Scope held to /me/tags per decision 2. Untouched per the brief: the MeSubNav horizontal-centering mount effect (PR #92, BUG-073), which sets scrollLeft only. THE OPTIONAL HARDENING WAS DECLINED but the finding is worth carrying: use-body-scroll-lock restores window.scrollTo(0, savedScrollY) on unlock, and several consumers contain navigation links (add-connections-popover, add-person-connections-popover, the modals), so tapping a link INSIDE an open overlay unmounts it on the DESTINATION page and replays the ORIGIN page's offset there, stranding the user mid-page on any destination rather than only this one. Ruled out as the reported path: the avatar dropdown does NOT take the lock. Left alone because it is a shared hook behind every modal sitewide and the brief scopes this pass to one page; if the same symptom is reported on another surface, a pathname guard on savedScrollY is the fix to reach for. NOT EXERCISED IN-BROWSER: /me/tags is proxy-gated and the scroll path needs a real client-side navigation under an authed session, which this environment cannot drive against the Next 16 preview iframe (same known gap as recent sessions); the brief names an iPhone Safari check as the close-out. RESIDUAL RISK for that check: the reset fires on mount while the page is still the !authReady "Loading…" shell and the document is short, so a restoration landing after the tag list renders and the document grows could still win. If it reproduces on device, the pathname guard above is the next move.

## 2026-08-03 - fix(tokens): contribution award must not outlive the subject's decline (bugfix)
- type: bugfix
- pr: #187
- branch: fix/connection-token-farm-BUG-151-148
- commit: ef27230 (squash of 1d38049)
- ids: BUG-151, BUG-148
- scope: connection-token-farm
- migration: none (no schema change). GATED one-off claw-back APPLIED in-session after Jay's go-ahead: 26 contribution tokens reversed on fully-declined third-party claims, CY 1 only, balance 104 -> 78, ledger sum now equals the stored balance (78 = 78).
- status: merged
- tsc: clean

ATTENDED P1 session, started after Jay corrected the session-start rule: a manually started bug session takes the highest open severity INCLUDING HUMAN-RUN items, because the "Build this" lead in NEXT-SESSION.md is the auto-merge-safe lead for the UNATTENDED pipeline and that constraint is void when he is present. Two P1s shipped together because the BUG-151 brief's July 28 cross-link proved they are the creation and removal sides of one cross-member connection model. DIAGNOSIS (read-only prod SQL) FOUND SOMETHING SHARPER THAN THE BRIEF: CY 1 wrote 28 third-party claims July 5-11 and earned 27 contribution tokens, and the subject DECLINED 27 of the 28, so 26 of the 27 tokens sit on claims the subject rejected; /api/me/tags never called reverseContributionTokens, so a decline hid the claim and left the reward and its equity weight standing. That reframes the bug: the farm is bounded by the same 20/day cap as honest work, so the real defect is that low-effort non-consensual writes earn as much as genuine contribution AND KEEP IT AFTER REJECTION. DECISION 1 WAS OVERRIDDEN AGAINST THE BRIEF, deliberately: the brief's default was award-on-approval, but prod says that would zero out most legitimate contributions (of 236 member tags, 135 = 57% still pending and only 18 = 8% ever approved, because the PB-009 permissive default makes pending tags publicly visible so subjects have no reason to act), which would gut the graph-weaving incentive BUG-058 wants to extend to brand and event pages. Jay chose reverse-on-decline. CODE: reverseClaimAwardOnDecline() + claimIdsForTagEvents() in src/lib/tag-events.ts, called from both the single and bulk decide routes; only CLAIM tags reverse (a declined story tag removes the tag, not the story, and the story is still the author's own contribution) and the reversal waits until no pending or approved tag_event remains on the claim, so one declining subject cannot erase an award that still stands for another person on the same row. BUG-148: DELETE /api/claims/[id] admitted only asserter-or-editor, so a subject removing a claim asserted ABOUT them got a 403 and the optimistic Remove bounced back; a hard delete would be the WRONG fix (it would let anyone tagged in a claim destroy another member's row), so a non-asserter caller now has their own tag_events on that claim declined instead, recorded as 'preference' with the subject as decider to match the /me/tags terminal state. Callers with no tag still 403. Also fixed the interaction that hid the farm from the person doing it: every SearchPicker was passed selected={[]} so a tap rendered no selected state and looked like a no-op while writing a token-earning claim (exactly the reporter's "tapping does not add the name like how it did before"). VERIFIED END TO END against prod on a local dev server with real minted sessions, staged rows written then removed, all balances restored (CY 1 104, Jay 255) and the throwaway probe auth user deleted: (A) decline via /me/tags claws the token back, ledger +1/-1 net 0, balance 106->105, control claim untouched; (B) non-editor SUBJECT DELETE returns 200 {declined:1} with the CLAIM PRESERVED, tag declined by subject, token reversed, action logged; (C) non-editor STRANGER DELETE still 403 with the claim intact; (D) claim implicating TWO people, award SURVIVES the first decline (net 1, statuses declined+pending) and reverses only on the second (net 0). The moment_ref->>claim_id PostgREST filter was verified directly against the live REST API before relying on it. FIRST PASS AT TEST B WAS INVALID AND RERUN: Jay's account is is_editor + founding so it took the pre-existing editor hard-delete branch and never reached the new code; repeated with a throwaway non-editor user. BOTH GATES CLEARED IN-SESSION on Jay's go-ahead. Claw-back applied source-derived and net-aware (a claim already at net <= 0 is skipped, so a re-run is a no-op) with negative mirror rows preserving the audit trail; pre-flight confirmed all 26 rows were contribution_entry with no contribution_source component, and post-verify showed zero farmed claims still holding a positive net plus ledger sum == stored balance (78), which is the stronger integrity check. Merge done with gh pr merge after the claw-back, per the Ship-sequence ordering (migrate first, then merge); it needed Jay because the exception list names data-deletion paths and this changes the authorization branch of DELETE /api/claims/[id]. NOTE FOR THE ECONOMY: CY 1 sat at 104, just over CONTRIBUTOR_COMP_THRESHOLD of 100, so 26 of the tokens carrying them past the free-membership line were farmed; it cost nothing here (comp_earned_at null, paid lifetime member) but on a real free account that threshold would have minted a 12-month comp off declined tags, and comp_earned_at is a one-way latch a claw-back does not undo. Worth a follow-up brief.

## 2026-08-04 - fix(profile,stories,tags): P1 batch, owner curated layer + own private stories + trust auto-approve (bugfix)
- type: bugfix
- pr: #188
- branch: fix/p1-owner-curated-private-stories-trust-BUG-154-157-138
- commit: 6156e2e (squash of 1ffb7aa)
- ids: BUG-154, BUG-157, BUG-138
- scope: p1-owner-curated-private-stories-trust
- migration: none (no schema change, no _public view touched, no data repair applied)
- status: merged
- tsc: clean

ATTENDED P1 session, three P1s in one PR, taken on the manual-session rule (an attended session takes the highest open severity including HUMAN-RUN items, not the auto-merge-safe pipeline lead). BUG-153 was NOT built: diagnosis closed it. The stuck feed claim is b5794cf6 (rode_at Whistler Blackcomb p1, asserted by CY 1, subject CY 2), and its tag_event is status='approved' with subject_id = CY 2, which is exactly the row PR #187's new declineOwnTagsForClaim branch moves, so the delete that used to 403 now returns 200 {declined:1} and the claim leaves CY 2's view. Recommend closing BUG-153 as fixed by #187 rather than scheduling it.

BUG-154, ROOT CAUSE DIFFERENT FROM THE BRIEF: the brief said OwnerTimelinePanel does not render MemberCuratedSections. It does (owner-timeline-panel.tsx:773). The real fault is the person object it hands over: built from getPersonById (mock, null for auth users) plus profileOverride, and NEITHER carries membership_tier, so the paid gate memberBadgeFor(person.membership_tier) resolved to free and the component returned null before rendering anything. The public branch merges the live tier explicitly at people/[id]/page.tsx:221; the owner branch never got that line. Fix is that same merge off the store, free stays absent so both branches gate identically. Confirmed membership.tier is reliably hydrated for the owner (CatalogLoader sets it from the profiles row and the store persists it, which is why the owner's founding badge on RiderCard already works).

BUG-157, THE ROW WAS NEVER LOST: prod shows stories.f79da9e5 intact with title NULL, body empty, 1 photo, 1 rider tag, visibility private, on_timeline true, story_date 2000-01-01. So the "edit story page is all blank" is the row itself, not a load failure: photo-only stories are allowed by design (add-story-modal.tsx:161 accepts an empty body when a photo is attached) and the edit modal does populate existing photos. What was genuinely broken is the disappearance: GET /api/stories carried an author's non-public rows only when the list was author-scoped (the BUG-106 carve-out), so the stories index, which is not author-scoped, dropped the author's own story silently. JAY OVERRODE the brief's Decision 2 (which said keep lists public-only): every list a signed-in viewer requests now includes their OWN non-public rows, author_id-pinned to the viewer, and StoryCard badges them "Only you". The archived-author exclusion now runs on both list paths with the viewer exempt, so an archived member still sees their own stories.

BUG-138: forward gap confirmed by reading the path. /me/tags toasts "Trusted. Future tags from this rider auto-approve", POST /api/me/trust approves only tags that already exist, and insertTagEvent never read tag_trust. insertTagEvent now checks trust for any tag that would otherwise wait and writes it approved with the subject as decision_by (trust IS their standing decision, so the asserter's approval rate and the editor rap sheet stay honest). Gated on defaultStatus === 'pending' so editor and system tags pay no extra read; both pair helpers route through insertTagEvent so claim tags and story tags are covered. No email side effect: nothing notifies on tag insert, the inbox is pull-based.

VERIFIED: tsc clean. Local dev server against prod, anonymous GET /api/stories?limit=100 returns 40 rows with ZERO non-public, matching the DB's 40 public stories exactly (no leak, no loss); anonymous author-scoped fetch for the reporter returns 0. Prod data confirms the delta is exactly one row for exactly one viewer (public OR author_id = reporter = 41 vs 40 public). /people/jay_balmer, /snowboarding/stories, /snowboarding/feed all 200, no console errors, story cards render. tag_trust filter shape validated against the live schema.

NOT EXERCISED: every signed-in surface (owner curated block, the "Only you" badge, a trusted rider's new tag). Minting a session for a real account was blocked by the environment's safety classifier, correctly, so those need a device check. Two residuals worth carrying. (1) prod holds ZERO tag_trust rows and ZERO tag_blocklist rows right now, so CY 2's July 4 trust row is gone with no cascade to explain it (no DB function references tag_trust; only /api/me/blocks deletes one, and the blocklist is empty), meaning either he removed it himself or the POST never landed: BUG-138's fix is unobservable until someone trusts a rider again, and if a fresh trust does not appear in /me/settings/trust the POST path is the next thing to look at. (2) CY 1's story carries story_date 2000-01-01 at date_precision 'day' on a story that reads like a year-only memory, which is worth a look at DateSelect's partial handling now that partial dates have shipped.

---

## 2026-08-04 - docs(claude): CLAUDE.md table list corrected against the live schema (chore)
- type: chore
- pr: #189
- branch: docs/claude-md-schema-accuracy
- ids: none
- scope: claude-md-schema-accuracy
- migration: none
- status: merged
- tsc: clean

CLAUDE.md's "Key tables" listed a `memberships` table that does not exist: an information_schema query on 2026-08-04 returns nothing matching '%member%', and no code in src/ selects from it. Membership state is columns on `profiles` (membership_tier, membership_status, membership_source, membership_expires_at, founding_badge, founding_member_number, token_founder, token_member, token_contribution, stripe_customer_id, stripe_subscription_id, pending_credit, comp_earned_at, is_editor), which is what catalog-loader.tsx and api/me/route.ts actually read.

Rewrote Key tables to cover the whole public schema (59 base tables plus the two _public views), verified name by name against the live database, adding everything the list had been missing: people (and that it is distinct from profiles), communities and the community_* junctions, the event_* and story_* junctions, the tag_* support tables, token_events, distributions, gift_codes, invites, claim_requests, merge_log, person_slug_aliases, person_invite_notifications, public_stack_entries, mentions, the *_image_votes tables, analytics_events, email_suppressions, board_links, board_stories. Flagged _backfill_visibility_20260617 as a leftover scratch table. Also fixed the three other places the phantom table leaked: the Membership System section now says the fields are profiles columns and the store's `membership` slice is a client-side shape hydrated from them; the Ship-sequence risk gate now gates on `profiles` (which carries the membership and Stripe columns) instead of a table that does not exist, so the gate is unchanged in effect; and the Project Structure api/ comment lists real route directories instead of a nonexistent memberships/ one.

Docs-only, no code touched. Verified by diffing every backticked identifier in the new section against the live table list in both directions: nothing named in the doc that is not a real table (the remainder are all verified profiles columns plus token_events.source_ref), and no live table missing from the doc.

## 2026-08-17 - Category page calls-to-action (feature)
- type: feature
- pr: #190
- branch: feature/category-page-cta
- ids: none
- scope: category-page-cta
- migration: none
- status: merged
- tsc: clean

Gave the Places, Events, Riders, and Brands catalog pages the same intro-card treatment the Boards page already shipped: a wordmark-font heading, a StoryBrand problem-then-plan copy block, and the page's existing add button moved into the card. Boards got a matching copy pass (and a stray em dash removed). Copy and layout only, no schema, no write paths, so no gate. Shipped ahead of the FNRad Season 12 sponsor announcement traffic so every catalog page a signed-out visitor lands on says what the community is building and asks them to add to it. Verified signed-out render, 0px overflow at 375 and 414, and dark-mode token flip across all five pages.

## 2026-08-17 - Stack slug sync on rename (bug)
- type: bug
- pr: #191
- branch: fix/stack-slug-sync-BUG-159
- ids: BUG-159
- migration: applied 20260817000001_public_slug_aliases.sql (SAFE additive); GATED cy_1 backfill applied in-session (Jay-approved)
- status: merged
- tsc: clean

profiles.public_slug was minted once and frozen while person timeline links derive from the live display_name, so a renamed member's Stack URL (/t/<slug>) read as a different person (cy_1 -> a Stack view of Cory_Yip). Added a server route PATCH /api/me/display-name that writes the name and re-mints public_slug via a new resyncPublicSlug helper; the outgoing slug is reserved in the additive public_slug_aliases table and the /t/[slug] resolver 308-redirects old links to the current slug (mirroring the /people person_slug_aliases pattern). slugTaken now treats an aliased slug as reserved so a re-minted slug is never handed to another owner. Verified end-to-end on prod: /t/cory_yip 308s to /t/cy_1, /t/cy_1 returns 200, and both post-deploy assertions (0 enabled-null-slug, 0 alias/live collisions) pass. Only cy_1 needed the backfill; Cy 2 was already in sync. One path not exercised headlessly: a live signed-in rename cannot fire the modal's React click events in the preview harness, so the save-triggered re-mint is verified by type-check and the resolver test rather than a live rename.

## 2026-08-18 - Signed-out catalog add + profile CTA gate (bug)
- type: bug
- pr: #192
- branch: fix/signed-out-catalog-add-gate-BUG-161-162
- ids: BUG-161, BUG-162
- migration: none
- status: merged
- tsc: clean

Signed-out visitors could press any catalog add button, fill the modal, and submit; the entity showed in the list but nothing was written (every addUser* bailed before the network call and returned true). Added a press-time SignInPrompt on all six catalog add buttons and hardened the six addUser* actions to return false with no optimistic insert when not signed in, so even a caller past the UI gate fails honestly. Onboarding keeps its local-only anonymous add via a new AddEntityModal allowAnonymous prop (smoke-verified: an anonymous add-a-place and add-a-brand still land on the timeline). BUG-162: the "+ Add to my profile" CTA on board and place detail pages, shown signed out and landing on the riders directory, now opens the same prompt. No migration, no schema, no change to /api/catalog/entity or ownProfilePath. Merged by Claude as squash ba4cb92 (#192).

## 2026-08-18 - Account-switch identity bleed + FTUE entry trap (bug)
- type: bug
- pr: #193
- branch: fix/account-switch-and-ftue-entry-BUG-168-166
- ids: BUG-168, BUG-166
- migration: none
- status: merged
- tsc: clean

BUG-168: the persisted store used one browser-wide key with no owner stamp and SIGNED_OUT cleared only two slices, so a second account inherited the first's membership tier, founding badge and tokens. Added storeOwnerId + resetPerUserState() and clear the per-user slices on owner mismatch, sign-out, and no-session mount. Pre-flight confirmed display-only (nothing written to jaylinestry). BUG-166: normalized the onboarding entry step against the hydrated store so returning visitors enter at the start (the land step, which is the context) with answers pre-filled, and added a "Back to browsing" exit on every step. Per Jay's in-session decision the /intro slideshow stays unlinked (revisited later); CTAs remain on /onboarding and the dormant ?from=intro handoff is kept for a later re-link. No migration. Merged by Claude as squash 30b7c1f (#193) with Jay's go-ahead (touches the auth state-change handler).

## 2026-08-18 - FTUE merged dark story (feature)
- type: feature
- pr: #194
- branch: feat/ftue-merged-dark-story
- ids: none
- scope: ftue-merged-dark-story
- migration: none
- status: merged
- tsc: clean

Merged /intro and /onboarding into one forced-dark seven-beat story (scatter, weave, name, year, era, welcome, save); /intro redirects to /onboarding?from=intro, pre-auth path is name + start year only, every number comes from the new additive public GET /api/stats/community and hides when unavailable. Branch built by Cowork (b5df83a + copy pass 9f5c257); this attended session verified against live prod data and shipped six follow-up commits (squash 9c4380a, merged with Jay's go-ahead on the auth funnel). Fixes this session: (1) mosaic now sources real photos from members' stories via a new additive public GET /api/stats/community-images (captioned by linked place, else event, else story title; board catalog photos backfill) after live data showed the catalog entity columns are almost all empty (1 image across prod); (2) woven grid threads recoloured to the Linestry brand blue; (3) no abstract-tile flash before photos load (empty slots are plain dark frames until the fetch settles); (4) the big count-up number no longer sticks at 0 (it snapped only on hidden pages; on a visible dev page a doneRef guard broke it under strict-mode double-invoke, so the guard was removed and the count now completes, still snapping when hidden/reduced-motion); (5) era beat and riders line hide a real zero instead of showing "0"; (6) mosaic no longer repeats one photo eight times or collides React keys when image-sparse; (7) the logo now exits the flow to browsing on every beat. Verified against prod: stats sane (113/65/32/143), no riders double-count, 8 distinct real story photos in the mosaic, no 320px overflow, .ftue-dark scoped to a wrapper (no leak). No migration. Jay confirmed the count-up lands on 113 on his visible browser before merge.

## 2026-08-19 - Category intro-card context gaps (bug-fix)
- type: bug-fix
- pr: #195
- branch: fix/category-context-cta-gaps-BUG-164-165
- ids: BUG-164, BUG-165
- migration: none
- status: merged
- tsc: clean

Closed the gap PR #190 left: the intro-card treatment (wordmark heading, StoryBrand context paragraph, add affordance) reached the five catalog category pages but missed three signed-out landing surfaces, and Boards was the only page carrying a banner band. BUG-164: added a "Firsthand Accounts" intro card to /[community]/stories matching the Boards structure, with the add-story invitation now shown signed out and routed through the existing SignInPrompt at press time (reusing the BUG-161/162 pattern) rather than hidden or no-opping; a context sentence under the community-landing hero shared across both hero variants; and a "The Collective Timeline" intro card on /[community]/collective (timeline, toggle and year selection untouched). BUG-165: removed the banner band from the Boards render, leaving communities.boards_banner_url and the admin field intact (unused, re-enablable in one line). Client-only, no migration, no API/route/_public change. Verified signed-out in browser preview on all four surfaces plus a 375px mobile pass; only console error is the known legacy FB CDN image 403. Merged by Claude as squash b9803ae (#195); pipeline-safe (no migration, no payments/auth/deletion paths).

## 2026-08-19 - Rider tab title fallback (bug-fix)
- type: bug-fix
- pr: #196
- branch: fix/person-tab-title-BUG-156
- ids: BUG-156
- migration: none
- status: merged
- tsc: clean

A person page reached by a UUID/generated-id link showed the browser tab "Rider profile · Linestry": generateMetadata humanizes the raw route param (null for a non-slug id, falls to TYPE_FALLBACK.person) and the client canonical rewrite never re-runs server metadata. Added a client useEffect keyed on resolvedPerson.display_name setting document.title = "<Name> · Linestry", placed with the other top-level hooks above the notFound() guard. Server fallback left intact as the no-JS/crawler default. Verified in preview: /people/theo_bellamy reads the name; /people/u3 server-renders "U3" then the effect overrides to "Theo Bellamy · Linestry" once resolved. Client-only, no migration. Merged by Claude as squash e0f14bb (#196); pipeline-safe.

## 2026-08-19 - Same-episode mention grouping on timelines (bug-fix)
- type: bug-fix
- pr: #197
- branch: fix/timeline-mention-grouping-BUG-172
- ids: BUG-172
- migration: none
- status: merged
- tsc: clean

A run of podcast mentions from one episode stacked as N near-identical rows with N fuchsia nodes on one date on a person's timeline (prod worst case: 5 on one episode, a place with 4). Added a pure groupMentionsByEpisode (episode_event_id key, order-preserving, solo rows isolated) beside groupMentionsByMoment; a new MentionEpisodeGroup card (header count + episode + date + link, 3-line collapsed preview with Show all N, Expand all / Collapse all that flips every line together); a nested prop on MentionRow (drops the episode-leading header and card chrome, syncs to the group's open signal during render) leaving un-nested and episode-page rendering byte-identical; and grouping in feed-view + entity-mentions (group of 1 stays a bare row, entity newest-episode-first order preserved). Counts untouched (filterCounts.mentions stays raw; mentions were never in filterCounts.all). Pre-flight confirmed the premise (top group 5); grouping unit-tested; verified live signed-out on /people/sean_spud_balmer (one card/one node, Expand all shows all excerpts + Watch links) and the episode page renders unchanged. Client-only, no migration. Merged by Claude as squash 7b11818 (#197); pipeline-safe.

## 2026-08-19 - Stack manage view discoverability (bug-fix)
- type: bugfix
- pr: #198
- branch: fix/stack-edit-discoverability-BUG-160
- ids: BUG-160
- migration: none
- status: merged
- tsc: clean

/me/public-view (the public-Stack manage surface) was linked from exactly one settings page and absent from the /me sub-nav despite rendering MeSubNav on every load. Added an owner-only link beside the Stack/Timeline toggle in owner-timeline-panel.tsx ("Edit my Stack" when enabled, "Set up my Stack" otherwise, both to /me/public-view, rendered outside the enabled-only toggle branch; breadcrumb truncates and the right block is shrink-0 so the toggle survives 414px), and a "Public view" tab in me-subnav.tsx before "Public timeline". Nothing enabled by default (no public_timeline_enabled write); enabling the Stack for everyone is out of scope (GATED, Jay decision). Client-only, no migration. tsc clean; both surfaces are behind sign-in so a signed-out preview cannot exercise them (owner-panel/subnav spacing worth an eyeball on a signed-in device). Merged by Claude as squash 0838ec3 (#198); pipeline-safe.

## 2026-08-19 - Landing mobile CTA + FTUE founding promise (bug-fix)
- type: bugfix
- pr: #199
- branch: fix/copy-scrub-batch-BUG-052-017
- ids: BUG-017, BUG-052
- migration: none
- status: merged
- tsc: clean

BUG-017: the landing primary CTA sat at ~1007px on a 414px viewport, below the 812px fold. Added a mobile-only (sm:hidden) auth-aware primary CTA + Browse link after the hero paragraph and lightly tightened mobile-only top spacing (sm: variants keep desktop identical); verified primary CTA now at top 723/bottom 763 and Browse bottom 795, both in-fold, zero overflow, desktop unchanged (only the card CTA renders at 1280px). BUG-052: the first-entry milestone thread in owner-timeline-panel.tsx promised "Add 4 more to unlock your founding rider badge"; founding is a paid/deliberate tier, so reworded to truthful encouragement with no founding-grant logic touched. Client-only, no migration. Merged by Claude as squash e05ebfe (#199); pipeline-safe.

Also triaged this session, no PR needed: BUG-020 (stale "200 tokens"/"Revenue share active" copy) is already fully scrubbed in the current tree (only a historical code comment in equity/page.tsx remains). BUG-053 ("My Timeline" landing lens) now lives in the shared PB-011 global lens row (lens-row.tsx) and needs a product re-look rather than a copy scrub; left for a fresh pass.

## 2026-08-19 - Stale celebration replay recency gate (bug-fix)
- type: bugfix
- pr: #200
- branch: fix/stale-celebration-replay-BUG-167
- ids: BUG-167
- migration: none
- status: merged
- tsc: clean

Opening your own /people/<you> fired celebration toasts for old stories because the seen-set is a localStorage high-water mark and any read-path change that surfaces previously hidden rows (PR #188 own non-public stories, trust auto-approve, limit=100 boundary) adds old ids that read as fresh. Added isRecentlyCreated + CELEBRATION_RECENCY_MS (10 min) to seen-celebrations.ts (compares created_at, never story_date; missing/garbage returns false) and gated the claim and story celebration queues on it in owner-timeline-panel.tsx; old unseen entries are still marked seen but queue no toast; the story path picks the newest-created among recently-created unseen rows; seen-set and FTUE prefs still fire; the 3-of-3 session milestone untouched. Pre-flight confirmed all of Jay's stories are weeks old (gate suppresses them); helper unit-tested (recent true, old/null/garbage false). created_at already on the types and selects, no migration. Owner-panel behaviour worth a signed-in device eyeball. Merged by Claude as squash 42768aa (#200); pipeline-safe.

## 2026-08-19 - Owner profile mobile card overlap (bug-fix)
- type: bugfix
- pr: #201
- branch: fix/profile-mobile-overlap-BUG-158-072
- ids: BUG-158, BUG-072
- migration: none
- status: merged
- tsc: clean

The reporter screenshot pinned the collision to the STORY card header (triage brief had guessed the claim card): the "Lifetime" MemberBadge overlapped the "Only you" visibility badge at 414px, because the right badge group is flex-shrink-0 and the un-truncated author name overflowed the min-w-0 left group. Fix in story-card.tsx: truncate the name, flex-shrink-0 the MemberBadge, flex-wrap the header so the metadata group drops to its own line. Verified at 414/375px including the crowded owner+private case reproduced via DOM injection (trueOverlap false; wraps to line 2), normal cards single-line, desktop unchanged, no overflow. Folded in (post-card.tsx): BUG-072 removed the dead owner-only "Add photo" div (non-interactive, stole ~56px and truncated the claim entity name, BUG-158 candidate 1), and switched the owner "..." options menu from opacity-0 group-hover to the (hover:hover)/(hover:none) variant so it is tappable on touch (BUG-044/084 pattern, missed here). Client-only, no migration. The overlap/placeholder/menu are owner-only paths; story overlap fully reproduced via injection, the two claim-card bits are a pure deletion + proven pattern copy, worth a phone eyeball on prod. Merged by Claude as squash 3e5c433 (#201).

## 2026-08-19 - Claim-card Edit event editor gate (bug-fix)
- type: bugfix
- pr: #202
- branch: fix/claim-edit-event-gating-BUG-155
- ids: BUG-155
- migration: none
- status: merged
- tsc: clean

CY 2 (is_editor=false, annual) saw an "Edit event" option on a claim card on their own timeline; it opens the shared catalog EditEventModal which saves via POST /api/admin (requireEditor), so a non-editor save 403s. Gated the button on is_editor OR founding to match the write permission. Two findings: (1) the brief named src/components/timeline/claim-card.tsx, but that ClaimCard is DEAD CODE (nothing imports it); the live timeline card is src/components/feed/post-card.tsx (PostCard via FeedView), where the fix was applied; (2) pre-flight (read-only) confirmed CY 2 is_editor=false and no "World Championships" event was renamed by them (all added_by a different profile, CY 2 cannot pass requireEditor), so no data revert. Server backstop (/api/admin requireEditor) confirmed and unchanged. Client-only, no migration. Non-editor-sees-no-button worth a signed-in eyeball. Merged by Claude as squash 74f7528 (#202). Follow-up flagged: delete the dead timeline/claim-card.tsx.

## 2026-08-19 - Curated Member Profile Phase 3 (feature)
- type: feature
- pr: #203
- branch: feat/curated-member-profile-phase3
- ids: none
- scope: curated-member-profile
- migration: none
- status: merged
- tsc: clean

Finished the paid differentiator (Phases 1+2 shipped as PR #164): OG images for the member card and the member profile, plus the /membership sell-copy pass. T13 adds a next/og card at /member/[username]/card carrying the tier (name hero, tier label, accent line, founding number, standing line); T14 adds one at /people/[id] where paid members unfurl with their tier line + accent and free riders / unclaimed nodes get the neutral brand treatment, resolving the id-or-slug param via a new best-effort readMemberOgTarget over the paid-member set. T15 added the curated page, member mark, and member card to the Member tier benefits (inherited by Lifetime/Founding), reworked the stale footer line, and put the curated-page line on the public card share copy. No migration: the Featured-rail stack endpoint (T16) shipped in Phase 2. Tier badge glyphs (◈ ◆ ✦) are omitted from OG copy because Geologica has no glyph for them, so the accent colour carries the tier. Verified all four OG variants render in dev against prod data (founding profile jay_balmer, neutral per_welinder, annual card cy_2, founding card jay_balmer #001) and the membership benefits inherit down the tiers. Merged by Claude as squash 416e676 (#203).

## 2026-08-19 - Claim-First Invite Flow (feature)
- type: feature
- pr: #204
- branch: feat/claim-first-invite-flow
- ids: none
- scope: claim-first-invite
- migration: none
- status: merged
- tsc: clean

Shifted the invite/tag/claim loop toward the consensual claim and away from the outbound email invite (young-domain deliverability). Three changes, no schema. (1) Hard bound-account guard, the previously flagged bug: a person can have a bound auth account while node_status still reads catalog/unclaimed and was still being offered/sent an invite. New client helpers hasBoundAccount / isInvitablePerson in src/lib/invite-tracking.ts (a profiles-sourced person carries membership_tier, which the people table has no column for, plus claimed_by / claimed|verified status) and a server-authoritative personHasBoundAccount in src/lib/invite-tracking-server.ts (checks both profiles and people). Wired into POST /api/invite (moved the service-client up, 409 before insert/send) and POST /api/admin/invite-node (409 after the node_status gate); applied on all three surfaces (HelpConnectCard/profile page, people-in-timeline, bulk-invite-prompt). (2) Claim-primary hierarchy on the unclaimed profile banner: "This is me" is now the filled primary CTA, the email invite a quieter secondary ("Invite them instead") that renders only when eligible; HelpConnectCard send button softened dark-filled -> secondary. (3) Consent line above the send button on both deliberate invite sheets (InviteRiderModal, editor InviteToClaimSheet). Decisions taken = brief defaults (D1 lighter demote, D2 keep member invites gated, D3 drafted consent copy, D4 keep BulkInvitePrompt). Verified: tsc clean; guard checked against prod (all 101 invitable ghosts stay invitable = 0 false positives, every registered-member id now rejected; 0 orphan rows exist today so the guard is preventive with no impact on the live warm-invite flow); heavily-edited /people/[id] renders with no console/SSR errors. Merged by Claude as squash e741342 (#204).

## 2026-08-19 - General Feedback Form (feature)
- type: feature
- pr: #205
- branch: feat/general-feedback-form
- ids: none
- scope: general-feedback-form
- migration: 20260819000001_feedback_kind.sql (SAFE additive, applied + verified in-session)
- status: merged
- tsc: clean

Generalized the in-app "Report a bug" widget into "Send feedback": one form takes a bug report OR a feature idea, sorted at the email-subject level so the [Linestry Bug] triage pipeline is byte-identical and ideas get a new [Linestry Idea] lane. No new route, modal, or mount point. Migration: additive bug_reports.kind text default 'bug' + CHECK (bug|idea), applied via Supabase MCP and verified (all 172 existing rows backfilled to 'bug'). Types: FeedbackKind + BugReport.kind. Route (path kept as /api/bug-report): whitelist-parse kind (public endpoint reaching a CHECK + email subject, anything != "idea" becomes "bug"), widened the existing PGRST204/42703 retry to also drop kind so a code-before-migration window degrades to "row saved, kind defaulted" instead of 500, subject prefix branches [Linestry Bug]/[Linestry Idea], email H1 + expected-heading + plaintext branch on kind, added a Type meta row. Modal renamed report-bug-modal.tsx -> feedback-modal.tsx, ReportBugModal -> FeedbackModal (identical props), two-chip toggle (Something's broken default / An idea) with type-driven copy, kind resets to bug on open and on send. Both menus (avatar dropdown, guest menu) relabelled "Send feedback"; grep sweep for ReportBugModal|report-bug-modal|Report a bug returns nothing. Decisions D1-D5 taken as written. Verified in-browser via the guest menu (logged out): label, heading, logged-out helper, chip toggle flipping both field copies, and a clean 375px layout. Server write/subject path is deterministic on the live-verified migration and was NOT exercised with a real submit (dev uses prod Supabase + a live Resend key, so a test submit would seed a real triage row and email Jay); post-deploy smoke owed = send one bug + one idea from prod, confirm the two prefixes and kind values. Jay-side companions (NOT in PR, brief §8): Gmail filter for [Linestry Idea] attachments; daily triage sweep already wired Aug 19; confirm auto-bugfix pipeline unaffected after first idea. Merged by Claude as squash 606ef24 (#205).

## 2026-08-19 - Feedback type-chip labels (feature)
- type: feature
- pr: #206
- branch: feat/feedback-direct-type-labels
- ids: none
- scope: general-feedback-form
- migration: none
- status: merged
- tsc: clean

Copy follow-up to PR #205 per Jay: be more direct about the two feedback types. Renamed the Send feedback modal type chips from "Something's broken" / "An idea" to "Report a Bug" / "Suggest an Idea". Copy-only, no behaviour change: kind values (bug|idea), email subject prefixes ([Linestry Bug]/[Linestry Idea]), and the write path are untouched. tsc clean, no migration. Merged by Claude as squash 7bc874e (#206).

## 2026-08-20 - Brand-page CTA consistency + claim-modal close X (bug)
- type: bug
- pr: #207
- branch: auto/bugfix-20260820-0500
- ids: BUG-144, BUG-145, BUG-146, BUG-147
- migration: none
- status: merged
- tsc: clean
- squash: fa60777 (merged to main 2026-08-20 05:03 by the autonomous pipeline; RUN-LOG row self-recorded)

Built `bugs/2026-08-19-brand-cta-consistency.md` end to end, taking all five recommended DECISIONS defaults. BUG-144: the CTA-row "+ Add a claim" on the brand page moved from `text-foreground border-border-default bg-background` (pure white in light mode) to `bg-foreground text-background border-transparent hover:opacity-90`, which renders near-black on light and inverts legibly on dark instead of the near-invisible literal `bg-[#1C1917]`; the quiet sidebar instance at the Community-profile card is deliberately untouched (D2). BUG-146: dropped the lone `✎` glyph from the CTA-row "Contribute a story" so all three instances read identically; the brand-colour system (`ctaColor = brandButtonColor(org.brand_color)`) is preserved on all three rather than forced to purple, per the D3 note that the July 5 call is now stale. The Alternative B rename to "Add Story" is a copy call and was left for Jay. BUG-145: the promoted "Visit website" CTA is now gated on the already-computed `isCurated`, so it shows only on curated/founding brands; the two plain weblink renders (header block, details rail) survive on every tier, so a standard brand still links out twice. BUG-147: both `add-claim-modal.tsx` and `edit-claim-modal.tsx` gained a persistent top-right `×` calling `onClose`, copying the `AddStoryModal` treatment (added `aria-label="Close"`); each header became a flex row rather than an absolutely positioned overlay, and in add-claim the header sits outside the scroll region so the X stays reachable with a soft keyboard up. Backdrop click and footer Cancel both still work. Client-only, no migration this session, no `_public` view, no auth or payments touched. Verified: tsc clean, and `/snowboarding/brands/Barfoot` renders 200 in dev after the change. Confirmed against prod data that both BUG-145 branches have a live example (Barfoot is `standard`, Westbeach is `founding`, both carry a website), so the gate is exercised in both directions; 23 other standard orgs with a website also lose the button, which is the intent of D4. Visual light/dark and 414px keyboard smoke NOT run: this was an unattended session with no browser tooling, so the two-theme check in the acceptance list is owed at review.

## 2026-08-22 - Podcast mention group collapses to its header (bug)
- type: bug
- pr: #209
- branch: auto/bugfix-20260822-0500
- ids: BUG-175
- migration: none
- status: merged
- tsc: clean
- squash: 300e030 (merged to main 2026-08-22 05:02 PDT by the autonomous pipeline; RUN-LOG row self-recorded; reconciled by the August 22 morning digest)

Built `bugs/2026-08-20-mention-group-collapsed-header.md` on all four recommended defaults. The BUG-172 episode-group card previewed 3 full MentionRow lines when collapsed, which Jay reported as still crowded; collapsed now renders header only (mic glyph, "Mentioned N times on <episode>", date chip, the open button, and the Episode page link), with zero mention titles. `PREVIEW_COUNT` and the `visible`/`hidden` slice are gone: the row list renders only under `showAll`, so the mentions mount on expand and unmount on collapse. The threshold inverted as the brief called out, the open button now renders for every group (the grouping helper only mounts this card for 2+ mentions, and a 2-mention group would otherwise be permanently sealed), and its label reads "Show the N mentions" / "Show less" with the "(N more)" suffix dropped. The group-level "Expand all" / "Collapse all" moved inside the expanded branch since it is meaningless with no rows on screen, and collapsing the list now also resets `allOpen` so the control never returns reading "Collapse all" against freshly remounted closed rows. Added `aria-expanded` on the open button. Change is confined to `src/components/feed/mention-episode-group.tsx`; `mention-row.tsx` and both call sites (`feed-view.tsx`, `entity-mentions.tsx`) are untouched, so lone ungrouped mentions are unchanged. Client-only, no migration this session, no `_public` view, no auth, payments or membership path touched. tsc clean. Unattended session with no browser tooling, so the on-screen check against Sean's timeline FNRad group and the 2-mention regression case are owed at review.

Session note: the NEXT-SESSION lead was BUG-174 (public Stack on by default), which the brief itself marks ATTENDED or HUMAN-REVIEWED and "not for the 05:00 auto slot" because it carries a GATED `profiles` backfill. This run took the pipeline-safe "Next after that" brief instead, which is the fall-through the Aug 21 and Aug 22 triage notes asked for. BUG-174 remains the lead and is untouched.

## 2026-08-24 - One tier word on every member-card surface + Annual card brand-mark dot (bug)
- type: bug
- pr: #210
- branch: auto/bugfix-20260824-0800
- ids: BUG-137, BUG-134
- migration: none
- status: merged
- tsc: clean
- squash: 44fb3c5 (merged to main 2026-08-24 05:07 PDT / 08:07 EDT by the autonomous pipeline; RUN-LOG row self-recorded; reconciled by the August 24 morning digest)

Built `bugs/2026-08-24-member-tier-label.md` on all four recommended DECISIONS defaults. New non-client canonical map `src/lib/tiers.ts` holds the tier label, colour and symbol for `annual` / `lifetime` / `founding` (still no `free` entry, per D3) and exports `TIER_META`, `tierMetaFor()` plus flat `TIER_LABEL` / `TIER_COLOR` / `TIER_SYMBOL` lookups. It carries no `"use client"` directive, which is what lets the two server-rendered OG routes share it (D2) instead of each keeping a local fork. `member-badge.tsx` now reads that map and keeps exporting `memberBadgeFor` / `TierBadgeMeta` unchanged, so the Riders list, the avatar dropdown, `rider-card.tsx`, `member-curated-sections.tsx` and `stack-header.tsx` are untouched at their call sites. Four surfaces repointed so `annual` prints "Annual" rather than "Member": `/account/membership` (`TIER_LABELS` now spreads the shared map over a local `free: "Rider"`, and the colour/symbol maps do the same so the three cannot drift apart again), `/member/[username]/card`, that route's `opengraph-image.tsx`, and `member-card-overlay.tsx` (which read "Annual member" / "Lifetime member" / "Founding member" and now reads the bare tier word). `/people/[id]/opengraph-image.tsx` was already correct and was repointed too, purely to delete the fifth copy of the map. BUG-137 mark: the `BrandMark` on the membership share card (`page.tsx:214`) now passes `dotColor="#ffffff"` per D4, because that card's ground is a hardcoded dark gradient in both themes and the default theme-reactive `var(--foreground)` dot disappeared into it in light mode; the second `BrandMark` on that page (line ~440, on the normal page surface) is deliberately untouched. BUG-134 is closed by verification, not by a build: both surfaces Cory compared already route through `memberBadgeFor()` (`people/page.tsx:109` renders `MemberBadge`, `rider-card.tsx:259` calls `memberBadgeFor`), the `annual: { text: "MEMBER" }` literal the July 4 brief found is gone, and both now resolve to the same "Annual" from the shared map. Client and display only: no migration this session, no `_public` view, no auth, no Stripe or membership write path, no tier is ever written. Verified: tsc clean; `grep -rn 'annual:.*"Member"\|"Annual member"' src` returns nothing; dev server renders `/account/membership` 200 and both OG routes 200 as PNGs after the import change, and the rendered member-card OG for the one live `annual` account now reads "Annual" where it read "Member" (the founding account correspondingly reads "Founding", not "Founding Member"). Owed at review, since this was an unattended run with no signed-in browser session: the on-screen light-and-dark look of the membership share card dot, and the `/member/[username]/card` page badge for an annual account. Noted but left alone: `KIND_META.paid.badge` in `people/page.tsx:42` still holds the dead string "◈ Member", unreachable because that branch renders only for `kind === "verified"`; it is outside the brief's four surfaces but worth deleting the next time that file is open.

## 2026-08-28 - Feed claim cards always name the rider (bug)
- type: bug
- pr: #211
- branch: auto/bugfix-20260828-0801
- ids: BUG-176
- migration: none
- status: merged
- tsc: clean
- squash: f6ec7f8 (merged to main 2026-08-28 08:12 EDT by the autonomous pipeline; RUN-LOG row self-recorded; reconciled by the August 28 morning digest)

Built `bugs/2026-08-27-feed-rider-name.md` on all four recommended DECISIONS defaults, in the one file the brief names (`src/app/(community)/[community]/feed/page.tsx`). D1/D2: the blank rider name was a catalog-load race, not missing data. `authorForClaim` resolves the name only from `catalog.people`, which is deliberately unpersisted and arrives async from `CatalogLoader`, while the feed fetched and painted its own entries independently and was the one public community surface with no `catalogLoaded` gate (every sibling detail page has one). The existing render gate now reads `loading || (!catalogLoaded && !catalogError)`, so the list stays behind the existing "Loading…" state until both the fetch and the catalog have landed. The `catalogError` half is the one deviation from the brief's literal wording and it is deliberate: `loadCatalog` sets `catalogError` and leaves `catalogLoaded` false forever on a failed fetch, so a bare `!catalogLoaded` gate would have turned a degraded feed into a permanent loader. On that path the gate drops and the D3 fallback carries the names. D3/D4: a claim whose `subject_id` resolves to nobody in a fully loaded catalog (an archived profile per PR #157, or a person outside the active community scope) now renders the neutral `UNKNOWN_RIDER` constant, `A rider`, unlinked and in the same `font-medium text-foreground` treatment, instead of leaving a bare action line. `href` is still emitted only when a real `display_name` resolves, so the fallback is never a link and an empty `display_name` no longer produces a `/people/` link to an empty slug. The story branch is untouched: it takes its name from the `/api/stories` payload (`entry.story.author?.display_name`), not the catalog, which is why stories never showed the symptom, and `ContextLine`'s three-way name branch is left intact because the `null` arm is still reachable from an author-less story. Client and display only: no migration this session, no `_public` view definition touched (the feed still reads through `claims_public` exactly as before), no write path, no auth, no payments or membership. Verified: `npx tsc --noEmit` clean, and `/snowboarding/feed` renders 200 in dev after the change. Owed at review, since this was an unattended run with no browser tooling: the Slow 3G hard-reload check and the explicit signed-out smoke at 414px. The signed-out path is sound by inspection (`loadCatalog()` runs unconditionally on mount with no session requirement, which is why the same gate already ships on the publicly browsable place, brand, board and event pages), but it is the stated regression risk of D2 and deserves a real look.

## 2026-08-30 - One "unverified" chip, and it now names what it is judging (bug)
- type: bug
- pr: (open PR)
- branch: auto/bugfix-20260830-2122
- ids: BUG-177, BUG-178
- migration: none
- status: pending
- tsc: clean

Built `bugs/2026-08-27-unverified-badge-consistency.md` on all five recommended DECISIONS defaults. BUG-177: `UnverifiedBadge` in `src/components/ui/badge.tsx` is rewritten to the D1 outline treatment (`text-amber-600` on a `border-amber-500/40` tint, no fill) and the D2 glyph is dropped, then made the only styled instance of the catalog-status chip. The old filled `bg-amber-950/60 text-amber-400` pill was dark-theme-tuned and its single feed appearance sits inside a `.postcard`, which forces light tokens even in dark mode (repo gotcha 7), so the one place it rendered in the feed was the one place its palette was guaranteed wrong. That is the reported difference. The unfilled amber-600 chip is deliberately theme-independent and carries a comment saying not to add a `dark:` variant, which would invert inside a postcard. Eight call sites now share it: `post-card.tsx:687`, `claim-card.tsx:102`, the five hand-rolled outline copies (`brands/page.tsx`, `places/page.tsx`, `events/page.tsx`, `boards/board-parts.tsx` twice) and the third palette on `claim/[token]/page.tsx:217` per D5. The grep sweep in the brief's step 5 turned up a fourth fork the brief had not listed, `add-claim-modal.tsx:1133` (`◎ unverified` on an unverified person in the companion picker), and it is repointed too so the acceptance criterion actually holds; the two `◎ new` chips in that same file are a different concept and are untouched. The board cover overlay keeps its `absolute top-2 left-2`, its `bg-background/80 backdrop-blur-sm` scrim and `pointer-events-none` through a new optional `className` passthrough, so it stays readable over a cover image. Widths are unchanged on the 414px catalog rows because the shared class string is character-for-character the outline chip those pages already rendered, minus nothing. BUG-178: an optional `entityType` prop maps `EntityType` to a noun (`place` / `brand` / `board` / `event`, and no noun for `person`), so a claim card now reads `unverified place` next to the untouched `ConfidenceBadge` "Self-reported". That one word is the whole fix: the two chips sat side by side judging different things, one the claim and one the catalog entity it points at, with nothing to tell them apart. Per the brief's acceptance criteria the catalog list pages keep the bare `unverified`, since the surrounding page already establishes the noun; the noun is passed only on the two claim-card surfaces. Confirmed the reporter's example against prod: `Lake Louise Ski Resort` is `community_status = verified` and `Lyon Mountain` is `unverified`, both `rode_at` places, so the behaviour was always correct and only the labelling failed. Presentational only: no migration, no `_public` view, no write path, no auth, no payments or membership. Verified: `npx tsc --noEmit` clean, and `grep -rn 'text-amber-600 border border-amber-500/40' src` now matches only the shared component definition. Deliberately out of scope per D4: the six `confidence === "self-reported" ? "unverified" : ...` renders on `brands/[slug]/page.tsx`, which share the word but mean claim confidence, not entity status. Owed at review, since this was an unattended run with no browser tooling: the two-theme look at 414px on the feed, a personal timeline and the Brands list, and specifically the chip inside a `.postcard` in dark mode, which is the bug itself. Note the working tree was left uncommitted: `.git/index.lock` was held by another process for the whole session, so every `git add` failed and the commit is left to the wrapper.

## 2026-09-02 - Facebook Login + public legal pages (feature)
- type: feature
- pr: #212
- branch: (not recorded, reconstructed by the September 4 morning digest)
- ids: none
- scope: facebook-login-legal-pages
- migration: none
- status: merged
- tsc: clean (assumed, session did not log)

Reconstructed entry, added by the September 4 morning-digest reconcile because the session that shipped this never wrote a SHIP-LOG line. Delivers `features/facebook-login-legal-pages-brief.md`, which was the feature-queue LEAD staged August 31. Part A: three public logged-out pages (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/data-deletion/page.tsx`), all three verified present on disk this run, plus `docs/facebook-login-setup.md` for the Meta App Review submission. Part B: "Continue with Facebook" on the OAuth surfaces. The OPS GATE (Meta App Dashboard + the Supabase Facebook provider) was Jay-side and sits outside this log. Reconciled to `merged` off `origin/main` at `91625fe`; the queue entry moved from LEAD to Shipped and `NEXT-FEATURE.md` repointed to PB-010 Phase 5 in the same run.

## 2026-09-02 - Landing copy tightening (chore)
- type: chore
- pr: #213
- branch: (not recorded, reconstructed by the September 4 morning digest)
- ids: none
- scope: landing-copy-tightening
- migration: none
- status: merged
- tsc: clean (assumed, session did not log)

Reconstructed entry. `src/app/page.tsx` copy pass (`edae043`, 5 insertions / 6 deletions): dropped the repeated "scattered", collapsed the triple "weave / woven / bring together", cut the repeated "our stories". Substantially answers BUG-135 (flagged verify-then-close in `bug-triage.md`) and the copy half of the landing-redundancy idea bullet in `features/feature-queue.md`. It removed no buttons, so the duplicated CTA pair that bullet is actually about is still on the page.

## 2026-09-02 - Track bugs/ and features/ in git (chore)
- type: chore
- pr: #214
- branch: (not recorded, reconstructed by the September 4 morning digest)
- ids: none
- scope: track-bugs-features-in-git
- migration: none
- status: merged
- tsc: n/a

Reconstructed entry. Replaced the blanket `/bugs/` and `/features/` gitignores with `/bugs/private/` and `/features/private/` and committed two READMEs. INCOMPLETE as shipped: every actual tracker (this file, `bug-triage.md`, `NEXT-SESSION.md`, `RUN-LOG.md`, the dated briefs, `archive/`, and the whole `features/` set) is now un-ignored but still untracked, so a cloud session cloning `main` still cannot read any of them. The missing half is `git add bugs/ features/` plus a commit. See the September 3 housekeeping block in `NEXT-SESSION.md` for the five scratch files to delete first.

## 2026-09-04 - PENDING auto-stub (claude/snowboard-catalog-v0.3-review)
- type: feature
- pr: (open PR)
- branch: claude/snowboard-catalog-v0.3-review
- commit: 56ab6df
- ids: none
- status: pending
- tsc: n/a

_Auto-stub from the SessionEnd hook (agent did not log this session). Expand to a one-line summary and flip status to merged during the daily reconcile._

## 2026-09-04 - catalog-refresh skill: require local session (chore)
- type: chore
- pr: #218
- branch: claude/catalog-refresh-skill-local-session
- ids: none
- scope: catalog-refresh-skill-local-session
- migration: none
- status: merged
- tsc: n/a

Added the catalog-refresh skill doc with a Step 0 that requires a local session and defines how to degrade when .env.local credentials are absent (never treat the committed CSV as current, report the export date, attach it to every number quoted). Isolated onto a fresh branch off main so it did not drag in the in-progress v0.3 catalog reconciliation commits.
