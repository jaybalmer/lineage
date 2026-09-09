# Brand Page Redesign Brief (two-tier: baseline lift + curated partner pages)

Status: build-ready draft for Claude Code. Drafted June 22, 2026.
Companion mockup: `Brand/Westbeach-Brand-Page-Mockup.html` (toggle between Standard and Premium / curated).
Route in scope: `src/app/(community)/[community]/brands/[slug]/page.tsx` (the org / brand page).

---

## 0. Framing and size

Two phases, shippable independently:

- **Phase 1 (Baseline lift)** applies to every brand page. It is a redesign of the existing header plus a clearer primary engagement action. Small schema (two optional, additive columns), no gating, no new tables. Roughly a 3 to 4 hr session.
- **Phase 2 (Curated / partner layer)** is additive content that only appears when a brand is marked as a curated partner. It introduces a partner flag, a heritage statement, a curated brand timeline, featured riders, featured media, brand outbound links, and an editor-facing manage surface. Roughly a 5 to 7 hr session, splittable.

The product reason for the split: the baseline lift improves all 40-plus brand pages immediately and is the right default for launch. The curated layer is the on-page expression of the Brand Heritage / Founding Partner proposals (see `uploads` drafts), and is the artifact a brand pays for. Phase 1 does not block launch; Phase 2 can follow the first signed partner.

Primary engagement goal for both tiers: **Contribute a story.** Every other action (add a claim, claim a connection, visit site) is secondary.

Content note: the Westbeach page will be **populated manually** with real stories, people, places, events, and milestones entered into the database, not auto-generated. The curated render path (Phase 2) just displays whatever is in the new fields. A sourced seed-content list for the first manual pass lives at `Brand/Westbeach-Page-Seed-Content.md`. This brief is about the page mechanics only; data entry is a separate task.

---

## 1. What we are building

A brand page that reflects the brand and invites engagement, in two tiers that share one feed:

1. **Standard** (every brand): a redesigned header with brand color accent and logo, a prominent "Contribute a story" CTA, a refreshed stats row, a one-line invite strip, and the existing tabbed feed.
2. **Curated** (partners): the same page with curated sections inserted above the feed: a full-bleed hero banner with verified / partner badging, a brand-authored heritage statement, a curated timeline spine, a featured-riders rail, a media and artifacts grid, a richer contribute module, and outbound brand links. A provenance line makes clear the page is curated by the brand and expanded by the community.

The mockup is the visual source of truth. Match its structure, not its exact placeholder copy.

---

## 2. Decisions (review before building; recommended defaults in place)

- **D1. Gating mechanism.** Add `orgs.curation_tier text default 'standard'` with values `'standard' | 'curated' | 'founding'`. Recommended over a bare boolean so "Founding Brand Partner" badging and future tiers have a home. Phase 1 ignores it; Phase 2 reads it. `'founding'` renders the same as `'curated'` plus the Founding Partner ribbon.
- **D2. Who edits curated content.** Editor-only for v1, through a new `/admin/brand/[id]` manage surface gated by `requireEditorPage()`. A brand-facing self-serve dashboard is out of scope (see §6). Recommended: keep curation in-house while the program is concierge.
- **D3. Curated timeline storage.** Store milestones as a `jsonb` column on `orgs` (`brand_milestones`), an ordered array of `{ year, label }`. Recommended over a new table: milestones are brand-authored, low-volume, and never queried across brands. Do not reuse the `events` catalog for these (events are community-tagged instances, milestones are editorial).
- **D4. Featured riders.** `orgs.featured_rider_ids uuid[]` referencing `profiles` / person ids, owner-ordered. The rail falls back gracefully when an id is not visibility-safe (skip, do not error). Recommended over auto-selecting top riders so the brand controls the team it shows.
- **D5. Media and artifacts.** v1 stores them as `jsonb` on `orgs` (`brand_media`: array of `{ kind, title, subtitle, image_url, link_url }`). A dedicated `brand_media` table is a future upgrade if/when members can contribute artifacts. Recommended: jsonb keeps Phase 2 migration-free beyond the column adds.
- **D6. Brand color default.** When `brand_color` is null, fall back to the existing Linestry accent (`--accent`, #3B82F6) so untouched pages stay on-brand for Linestry. The Westbeach example uses a brand red (`#D72638`).
- **D7. Banner image.** `orgs.banner_url`. When null on a curated page, render the brand-color gradient treatment from the mockup hero rather than an empty box. Standard pages do not use a banner; they use a 5px brand-color accent bar on the header card.

If Jay does not override any of D1 through D7, build the recommended default.

---

## 3. Verified facts (checked against the live repo June 22)

- The brand page is `src/app/(community)/[community]/brands/[slug]/page.tsx`, a `"use client"` page wrapped in `CatalogGate`. 1155 lines today. Tabs: `all | people | boards | events | places | stories`.
- `Org` (`src/types/index.ts:290`) already has `description`, `founded_year`, `country`, `region`, `website`, `logo_url`, `community_status`, `added_by`, `community_slugs`. So logo and founded-year support already exist in the type; today's header just renders initials and a thin meta line instead of using them well.
- Member-allowed org create is `POST /api/catalog/entity` (`requireAuth`, service client, whitelisted fields: `org_type`, `brand_category`, `founded_year`, `website`, and similar). Broad editor updates go through `/api/admin` (`requireEditor`).
- Orgs reach the client through the catalog loader and `community_orgs` junction (`src/app/api/catalog/entity/route.ts`, `src/store/lineage-store.ts`, `src/lib/public-timeline-read.ts`). **Any new column that should appear on the page must be selected in the org-loading query and added to the `Org` type, or it will silently not appear** (Group F lesson, catalog-junctions variant).
- Orgs have **no `_public` view** (only `story_riders` and `claims` do), so the view-freeze gotcha does not apply here. No `_public` rebuild needed.
- "Contribute a story" is the existing `AddStoryModal` with `defaults` support. Opening it from the brand page should pass a brand default so the story links back. Confirm the modal accepts a brand / org default; if it only accepts `linkedPlaceId` / `linkedEventId` / `boardId` / `rider_ids` today, add an org link default as a small prerequisite (the brand page already filters stories linked to the org, so the linkage field exists on the read side).

---

## 4. Phase 1 — Baseline lift (all brands)

### 4a. Schema (one migration, additive, no write-path dependency)

```sql
alter table orgs add column if not exists brand_color text;   -- hex like '#D72638', nullable
alter table orgs add column if not exists banner_url  text;    -- curated hero image, nullable
```

Add both to the `Org` interface and select them wherever orgs are loaded (catalog loader plus `community_orgs` path). Neither is sent unconditionally by the member create path, so this is a plain additive change: migrate-then-merge is safe, no hard pre-merge gate. Still apply before the page reads the columns.

### 4b. Header redesign

Replace the current header card (initials block plus thin meta) with the mockup's Standard header:

- Logo block uses `logo_url` when present, initials fallback otherwise.
- A 5px brand-color accent bar across the top of the header card (`brand_color`, fallback `--accent`).
- Kicker line: type label, `est. {founded_year}`, `country` when present.
- Name in the wordmark font, description below, website link.
- CTA row, in priority order: **Contribute a story** (filled, brand color), Add a claim (outline, the existing flow), Visit website (outline, when `website` set).
- Stats row reworked to: connected riders, board models, events, places, stories. Keep the existing counts; add the stories count.

### 4c. Invite strip

Below the header on standard pages: a single brand-tinted strip, "Were you part of the {brand} story?", with a Contribute a story button. This is the engagement nudge that the current page lacks. Hidden on curated pages (the curated contribute module replaces it).

### 4d. Primary CTA wiring

Both Contribute buttons open `AddStoryModal` with the brand pre-linked. Add-a-claim keeps the existing `AddBrandClaimModal`. Verify the story, once saved, surfaces in the brand page Stories tab (it already filters stories linked to the org).

---

## 5. Phase 2 — Curated / partner layer (gated by `curation_tier`)

### 5a. Schema (additive)

```sql
alter table orgs add column if not exists curation_tier      text default 'standard';
alter table orgs add column if not exists heritage_statement text;
alter table orgs add column if not exists brand_milestones   jsonb;   -- [{ "year": 1979, "label": "Founded in Vancouver" }, ...]
alter table orgs add column if not exists featured_rider_ids uuid[];
alter table orgs add column if not exists brand_media        jsonb;   -- [{ "kind","title","subtitle","image_url","link_url" }]
alter table orgs add column if not exists brand_links        jsonb;   -- [{ "label","url" }] outbound brand links
alter table orgs add column if not exists partner_label      text;    -- e.g. 'Founding Brand Partner'
```

All nullable, none sent by the member create path, so additive and migrate-then-merge safe. Add to the `Org` type and the org-loading select.

### 5b. Curated sections (render only when `curation_tier != 'standard'`)

In page order, above the shared feed, matching the mockup:

1. **Hero banner.** Full-bleed `banner_url` (or brand-color gradient fallback), logo lockup, verified badge, founded / type / country kicker, tagline (first line of `heritage_statement` or a dedicated tagline; recommend deriving from `heritage_statement` to avoid another field). Founding tier adds the partner ribbon using `partner_label`.
2. **CTA row plus stats** sit directly under the hero (the curated page has no standard header card).
3. **Heritage statement.** Dark editorial block rendering `heritage_statement`. "Curated by the brand" tag.
4. **Brand timeline.** Horizontal spine from `brand_milestones`, brand-color nodes.
5. **The team.** Rail from `featured_rider_ids`, violet-ringed avatars, link to the full Riders tab. Skip ids that are not visibility-safe.
6. **Media and artifacts.** Grid from `brand_media`.
7. **Contribute module.** Richer "Were you part of the {brand} story?" block with prompt chips (Share a story, I rode for the team, I worked here, I was at a contest, I own a classic board). Every chip opens `AddStoryModal` (or `AddBrandClaimModal` for the claim-style prompts) brand-pre-linked.
8. **Sidebar** gains a "From {brand}" card of outbound `brand_links`.
9. **Provenance line** at page foot: curated by the brand, expanded by the community, with live story / rider counts.

### 5c. Editor manage surface (D2)

New `/admin/brand/[id]` page behind `requireEditorPage()`: set `curation_tier`, upload / set `banner_url` and `logo_url`, edit `brand_color`, write `heritage_statement`, add / reorder `brand_milestones`, pick / order `featured_rider_ids`, add `brand_media` and `brand_links`. Saves through a new `PATCH /api/admin/orgs/[id]` (or extend the existing `/api/admin` broad-update path), `requireEditor`-gated. Keep it utilitarian; this is an internal concierge tool, not a customer surface.

---

## 6. Out of scope (name so it is not invented)

- **Brand-facing dashboard** (the proposal's "who has connected, what is being added, where the network is growing"). Real surface, real value, but a separate authenticated brand-account project. Note it as the natural Phase 3.
- **Brand accounts / partner auth.** No brand login in this brief. Editors curate on the brand's behalf.
- **Equity / Founding Partner commercial flow.** The `'founding'` tier here is a display badge only. It does not touch memberships, the equity pool, or billing.
- **Member-contributed artifacts** to the media grid (jsonb is editor-authored for v1).
- **Alumni outreach automation** (the proposal's email campaign). Out of product scope.

---

## 7. Acceptance criteria

1. `npx tsc --noEmit` clean.
2. Every existing brand page renders the new Standard header with logo-or-initials, brand-color accent (or Linestry blue fallback), and the five-stat row.
3. Contribute a story is the visually primary action on both tiers and opens `AddStoryModal` with the brand pre-linked; the saved story appears in the Stories tab.
4. A brand with `curation_tier = 'standard'` shows zero curated sections (no empty hero, no empty timeline).
5. A brand with `curation_tier = 'curated'` and populated fields renders all curated sections in the mockup order; empty curated fields hide their section rather than render an empty shell.
6. `featured_rider_ids` containing a non-visibility-safe id skips that rider without erroring.
7. New columns appear in the org type and are selected by the catalog load path (verified: set a value, confirm it reaches the page).
8. No regression to the existing tabs, feed, add-claim flow, or `/brands` index.
9. 0px horizontal overflow at 375px on both tiers.
10. No em dashes in any shipped copy.

---

## 8. Suggested order

1. Phase 1 migration (4a), `Org` type, org-load select.
2. Standard header redesign plus CTA wiring (4b, 4d).
3. Invite strip (4c). Ship Phase 1 as its own PR.
4. Phase 2 migration (5a), type, select.
5. Curated render path, gated, section by section in mockup order (5b).
6. Editor manage surface plus save route (5c).
7. Verify acceptance, ship Phase 2 PR.

---

## 9. Pre-flight and migration notes

- Two migration files, one per phase. Both purely additive `add column if not exists`. Apply each before merging its PR so the page reads real columns (no hard write-path gate, but apply-first keeps the record clean per the Ship sequence).
- Probe before building the curated render: confirm `AddStoryModal` accepts an org / brand link default. If not, add it as the first Phase 2 commit (small) so every Contribute affordance links back to the brand.
- Confirm the org-loading query path (`community_orgs` junction in the catalog loader) selects `*` or an explicit column list; if explicit, add every new column or it will silently not appear on the page.
- No `_public` view rebuild (orgs have none).

---

## 10. Gotchas

1. Brand color must meet contrast when used as a text or button color. Use it for fills and the accent bar; keep body text on `--foreground`. For brand-colored buttons, white text is fine on a saturated brand color, but validate light brand colors (fall back to `--accent` if `brand_color` is too light to carry white text; a luminance check at render time is acceptable).
2. The curated hero is dark by design and works in both themes. The standard header follows the app theme. Do not add dark-mode overrides to the postcard-style feed cards (existing rule).
3. `brand_milestones` and `brand_media` are editor-authored jsonb. Validate shape on save; render defensively (skip malformed entries).
4. Keep the shared feed identical across tiers. The only difference between Standard and Curated is the curated content inserted above the feed plus the header treatment.
