# Curated Member Profile: the paid differentiator (build brief)

**Project:** linestry.com
**Feature:** Member profile differentiation (curated personal page + membership marking + card surfacing + distribution)
**Prepared for:** Claude Code feature session
**Authored:** July 20, 2026 (Cowork, Jay live)
**Size:** ~6 to 8 hr total across 3 phases. Phase 1 alone is ~1.5 hr and shippable on its own. If the session runs long, ship Phases 1 + 2 as the PR and stage Phase 3 as a follow-up brief.
**Migration:** one additive migration (Phase 2). Migrate-then-merge is safe (no unconditional write path; see Deploy notes).

---

## 1. Why this exists

Today a paid member's profile renders identically to a free rider's. The only tier signals are a small pill on the RiderCard, the Riders directory grouping, and the avatar dropdown. Meanwhile brands got a real curated tier in June (PR #120/#122): hero, heritage statement, milestone spine, featured riders, media grid, all gated by `orgs.curation_tier`.

The product principle (membership brief, Section 8) is that membership is ownership, not a subscription, and free riders never get a crippled experience. So the paid differentiator is **presentation and standing, not access**: a member's page is a curated personal page, the way a partner brand's page is a curated brand page, and membership status is legible everywhere their name appears.

This maps directly to the revenue model: memberships are ~30% of the target mix and the $25 annual conversion is the backbone of the ARPU ladder. "Your page becomes a curated page" is a differentiator a rider can see in five seconds on someone else's profile.

**One-line pitch for the /membership page:** Members get the brand treatment: a curated page, their mark on every story, and a card worth sharing.

---

## 2. DECISIONS (review before building)

Recommended defaults are shippable as-is; Jay can override any of them before or during the session.

- **D1. Gate = live membership tier, no stored curation flag.** The curated layer renders when the viewed profile's `membership_tier` is `annual | lifetime | founding` (i.e. `getRiderTier()` returns `paid` or `founding`, plus `verified` nodes whose tier is paid). There is NO `profiles.curation_tier` column. If a membership lapses to `free`, the layer disappears automatically and the underlying data is preserved, exactly mirroring the token-freeze rule. Default: as stated.
- **D2. Composition: keep the RiderCard, add member sections around it.** Do not rebuild the profile as a brand-style hero page in v1. Member differentiation on `/people/[id]` = (a) upgraded card presentation (D3), (b) a Statement block, (c) a personal Milestones spine, (d) a Featured rail (D5), in that order below the card. This keeps `OwnerTimelinePanel` and the public page layout intact.
- **D3. Card presentation upgrade = theme unlock + tier accent edge.** Restore the existing 5-theme palette (`THEMES` in rider-card.tsx, currently hard-fixed to alpine with the picker removed per product direction) as a **member-only** choice stored in `profiles.profile_theme`. Free riders stay fixed on alpine. Add a 3px tier-colored accent line along the card's bottom edge for paid tiers (annual #3b82f6, lifetime #8b5cf6, founding #f59e0b), echoing the member card's accent-line motif. Founding additionally gets its founding number on the card face when available. Default: as stated; if Jay dislikes re-introducing themes, fall back to accent edge + statement only.
- **D4. Self-serve editing lives in the existing Edit Profile modal.** Add a "Member page" section (visible only to paid tiers) to `edit-profile-modal.tsx` with: theme picker, statement textarea, milestones editor (year + label rows, mirroring the brand milestones editor pattern). No new admin surface; editors do not curate member pages (unlike brands).
- **D5. Featured rail reuses the PB-010 stack, not a new column.** The "Featured" rail on the profile reads the owner's existing curated stack entries (`public_stack_entries`, `owner_type='profile'`), which members already curate at `/me/public-view`. Requires one new public read endpoint (Section 6). Render the rail only for paid tiers and only when at least 1 entry exists. This makes one curation surface power both `/t/[slug]` stack view and the profile rail. Default: as stated; alternative (rejected): a separate `featured_story_ids` column, which would create a second competing curation surface.
- **D6. Marking = canonical badge everywhere a member's name appears; avatar rings unchanged.** Route the RiderCard tier pill through `member-badge.tsx` (kill the local `TIER_LABEL` drift), and add the compact `MemberBadge` to: story card author header, story comment authors, and the `/t/[slug]` owner header. Do NOT change `rider-avatar.tsx` ring colors: those encode node status (paid=orange is deliberate PB-008 language) and repainting them is out of scope.
- **D7. Member card goes public-facing.** On the public profile of a paid member, the tier pill becomes a link to the existing public card page `/member/[slug]/card` (today `onMemberCard` is wired for the owner only, so visitors get a dead pill). Add an OG image route for the card page so a shared card link unfurls (the membership brief Section 12 spec'd `card.png`; it was never built).
- **D8. Server-side gate on curated writes.** The profile write path must reject `profile_theme` / `profile_statement` / `profile_milestones` for free-tier callers (check `membership_tier` server-side), so the perk is real and not merely hidden UI. Free riders' existing fields are untouched.
- **D9. Copy discipline.** Per the membership brief Section 8: "verified member", never "paid member" or "premium"; the curated layer is presentation and standing, never "unlocking features"; free riders are never described as limited. No em dashes in any copy or code comments.

---

## 3. Verified facts (provenance)

All verified July 20, 2026 against the working tree.

**Profile surfaces**
- `src/app/people/[id]/page.tsx:196-198`: owner viewing own profile short-circuits to `<OwnerTimelinePanel />`; everyone else gets the public render.
- `src/app/people/[id]/page.tsx:228-236`: public view builds a minimal `viewedMembership` from `person.membership_tier`; token balances are zeroed (private).
- `src/app/people/[id]/page.tsx:296-305`: public profile renders the same `RiderCard`; `onMemberCard` is passed **only when `isCurrentUser`**, so a visitor's tier pill does nothing.
- `src/components/ui/rider-card.tsx:14-40`: 5-theme `THEMES` map (alpine/forest/crimson/midnight/slate). Line 173: `const t = THEMES.alpine` with comment "tint picker removed per product direction".
- `src/components/ui/rider-card.tsx:42-46`: local `TIER_LABEL` map (annual/lifetime/founding), NOT routed through the canonical badge; pill rendered at :405-421.
- `src/components/ui/rider-card.tsx:212-253`: `card_bg_url` upload/clear writes `profiles` directly via the browser supabase client.
- `src/components/ui/edit-profile-modal.tsx:43-63`: current editable fields (name, birth year, riding since, bio, home resort, city/region/country, privacy, links, avatar). No member-only section exists.

**Marking**
- `src/components/ui/member-badge.tsx`: canonical tier badge (BUG-099), colors annual #3b82f6 / lifetime #8b5cf6 / founding #f59e0b, symbols ◈ ◆ ✦; free renders nothing. Used by the Riders directory (`src/app/people/page.tsx:13`), avatar dropdown, membership page.
- `src/components/feed/story-card.tsx:272-285`: author header renders avatar + display_name only; **no tier badge**. The denormalised `story.author` carries only `display_name` + `avatar_url` (`src/types/index.ts:639-640`), but the client can resolve tier from `catalog.people` by `author_id` (profiles are merged into the people catalog per CLAUDE.md).
- `src/components/ui/rider-avatar.tsx:60-67`: ring colors are node-status language (paid=orange #f97316, comment at :62); leave untouched (D6).

**Member card**
- `src/components/ui/member-card-overlay.tsx`: exports `MemberCardTile` + `MemberCardData`; three tier variants with accent-line motif.
- `src/app/member/[username]/card/page.tsx`: public card page exists; `notFound()` for free riders; token count deliberately 0 on the public card; slug resolved via `nameToSlug(display_name)`. No opengraph-image route exists for it (verified: no sibling files).
- Repo root `lineage_member_card_moment.html`: visual reference for the card aesthetic.

**Brand parity model (the template)**
- `src/types/index.ts:339-354`: Org curated fields (`curation_tier`, `heritage_statement`, `brand_milestones {year,label}[]`, `featured_rider_ids`, `brand_media`, `brand_links`, `partner_label`).
- `src/app/(community)/[community]/brands/[slug]/page.tsx`: `isCurated` gates one block of curated sections above the shared feed (hero, heritage dark block, milestone spine, team rail, media grid). See `features/curated-brand-page-primer.md` for the traps (localhost reads prod; screenshot approach; `textContent` not `innerText`).
- Drive `Brand/Westbeach-Brand-Page-Mockup.html`: the visual bar for "curated vs standard".

**Stack (Featured rail source)**
- `src/types/index.ts:140-155`: `PublicStackEntry` (owner_type `profile|event|org`, ordered by `position`, `custom_title`/`custom_summary`).
- Owner curation surface exists at `/me/public-view`; owner API `/api/me/stack`; public per-owner reads exist for orgs (`/api/orgs/[id]/stack`) and events (`/api/events/[id]/stack`) but **there is no `/api/people/[id]/stack`** (verified by ls). `/t/[slug]` reads the stack server-side via `src/lib/public-timeline-read.ts`.
- `/api/me/public-timeline/route.ts`: public timeline opt-in is `requireAuth` only, no tier gate. It stays free (D6 principle: no clawbacks from free riders).

**Schema**
- `profiles` columns confirmed via migrations: `avatar_url` (20260318000002), `card_bg_url` (20260318000003), location (20260319000001), `membership_tier` + tokens (membership system), `membership_source`/`comp_earned_at` (20260627000001), `public_slug`/`public_timeline_enabled` (20260615000003), `is_archived` (20260705000001).
- Profiles rows are merged into `catalog.people`, and `orgs` reach the page via `select("*")` so new columns need only the type update (brand primer). Verify the profiles catalog read is also `select("*")` before relying on it; if it is a column list, add the three new columns to it.

---

## 4. Phase 1: Membership marking everywhere (~1.5 hr, no migration)

The cheap, high-visibility half. Ships alone if needed.

- **T1. Canonicalize the RiderCard pill.** Replace the local `TIER_LABEL` map (rider-card.tsx:42-46) with `memberBadgeFor()` from `member-badge.tsx` for color/symbol/label, keeping the pill's current shape/size. One source of truth (this was the BUG-099 intent).
- **T2. Story author badge.** In `story-card.tsx` author header (:272-285), resolve the author from `catalog.people` by `story.author_id` and render `<MemberBadge tier={...} />` after the name (compact, `text-[10px]` scale). Free/unknown renders nothing (existing MemberBadge behaviour).
- **T3. Comment author badge.** Same treatment in `story-interactions.tsx` comment rows (same catalog lookup by `author_id`).
- **T4. Public timeline owner badge.** On `/t/[slug]` for profile owners, show the tier badge in the owner header. `PublicTimelineOwner` (src/lib/public-timeline-read.ts:71) likely does not carry `membership_tier`; add it to the server payload (profiles read already happens at :126). Tag: verify the exact select list before editing.
- **T5. Make the pill mean something to visitors.** On the public profile, wrap the tier pill in a link to `/member/[slug]/card` (slug via `nameToSlug(person.display_name)`), replacing the no-op. Owner keeps the existing overlay behaviour (`setShowMemberCard`).

Acceptance (Phase 1):
1. A story authored by a founding member shows ✦ Founding beside the author name in feed, profile, entity pages, and stories index (all render through StoryCard).
2. A comment by an annual member shows ◈ Annual.
3. The RiderCard pill and the Riders directory badge for the same person use identical color/symbol/label.
4. Visiting another member's profile and clicking their tier pill lands on their public card page.
5. Free riders: zero visual change anywhere.

---

## 5. Phase 2: The curated member layer (~3 to 4 hr, one migration)

### Migration (additive, migrate-then-merge)

```sql
-- Curated member profile (curated-member-profile brief, July 20 2026)
-- Additive; write path is member-gated and conditional, so no hard pre-merge gate.
alter table public.profiles add column if not exists profile_theme text;          -- 'alpine'|'forest'|'crimson'|'midnight'|'slate', null = alpine
alter table public.profiles add column if not exists profile_statement text;      -- rider statement; first line renders as the tagline
alter table public.profiles add column if not exists profile_milestones jsonb;    -- [{year int, label text}], owner-ordered
```

(Pseudocode status: column names are new and unambiguous; verify `profiles` is in the schema-qualified form used by the neighbouring migrations before running.)

### Build

- **T6. Types.** Extend `Person` in `src/types/index.ts` with `profile_theme?`, `profile_statement?`, `profile_milestones?: { year: number; label: string }[]` (mirrors the Org curated fields at :339-354).
- **T7. Theme unlock + accent edge (D3).** In `rider-card.tsx`: `const t = THEMES[person.profile_theme ?? "alpine"]` when the viewed person's tier is paid, else `THEMES.alpine`. Add the tier accent line along the card bottom edge for paid tiers. Founding: show `#N of 500` (from `founding_member_number` when the viewer is the owner; omit for visitors if not available in the public payload).
- **T8. Statement block.** Below the RiderCard on both the public profile and `OwnerTimelinePanel`: a dark block (mirror the brand heritage block styling) rendering `profile_statement`, first line as a bolder tagline. Members only; renders nothing when empty (owner sees an "Add your statement" affordance instead).
- **T9. Milestones spine.** Below the statement: a compact vertical year-spine of `profile_milestones` (mirror the brand milestone spine, person-scale). Members only; empty renders nothing (owner affordance to add).
- **T10. Featured rail (D5).** New public read endpoint (Section 6) returning the profile's stack entries; render a horizontal "Featured" rail of up to 6 entries (custom_title over resolved entity/story title) linking into the timeline/stories. Members only, and only when entries exist. Free riders' `/t/[slug]` stack behaviour is unchanged.
- **T11. Edit surface (D4).** "Member page" section in `edit-profile-modal.tsx`, visible when `membership.tier !== "free"`: theme picker (5 swatches), statement textarea, milestones editor (add/remove/edit year+label rows, sort by year on save). Non-members see a single quiet line: "Members can curate their page. Learn more" linking to `/membership` (matches trigger-moment tone rules; no other upsell).
- **T12. Server gate (D8).** In the profile write path used by the modal (verify: direct supabase update vs API route; the modal and RiderCard both write `profiles` directly today), enforce the member gate server-side. If writes are direct-from-client, add the three columns to an RLS policy or move these three fields through a small `PATCH /api/me/profile-curation` route with `requireAuth` + tier check (preferred; keeps the gate in one reviewable place).

Acceptance (Phase 2):
1. A paid member sets theme=crimson, a statement, and 2 milestones in Edit Profile; their public profile shows the crimson card, accent edge, statement block, and milestone spine to a signed-out visitor.
2. A free rider's profile and Edit Profile modal are pixel-identical to pre-change (except the single quiet member line in the modal).
3. Attempting the curated write as a free-tier user via the API path returns 403.
4. Simulating a lapse (set `membership_tier='free'` on a test row) hides the curated layer without deleting the stored fields; restoring the tier restores the render.
5. Featured rail shows the member's stack entries in `position` order and is absent when the stack is empty.

---

## 6. Phase 3: Card surfacing + distribution extras (~1.5 to 2 hr, no migration)

- **T13. Card OG image.** `opengraph-image.tsx` beside `src/app/member/[username]/card/page.tsx` rendering a static card (name, tier label, accent line, LINESTRY wordmark) via the `next/og` + `brandMarkSvgString` pattern used by `t/[slug]/opengraph-image.tsx`. 1200x630.
- **T14. Member profile OG image.** `opengraph-image.tsx` under `src/app/people/[id]/` (a layout.tsx already exists there): name + tier badge + accent color for paid tiers; the neutral brand treatment for everyone else. Same pattern source.
- **T15. Membership page sell.** Add the curated-page benefit to the `/membership` tier comparison and the member card share copy: "A curated page, like the brands get." Copy only, D9 rules apply.
- **T16. Public read endpoint.** `GET /api/people/[id]/stack` (public, no auth): mirror `/api/orgs/[id]/stack`, filtered to `owner_type='profile'`, respecting `is_archived` exclusion. (Built in Phase 2 if T10 lands there; listed here so the endpoint table is complete.)

Acceptance (Phase 3):
1. Pasting a member's card URL into a link preview tool unfurls the card image.
2. Pasting a paid member's profile URL unfurls with their name + tier treatment; a free rider's profile unfurls with the neutral treatment.
3. `/membership` lists the curated page as a member benefit in all paid tiers.

---

## 7. Endpoint -> UI map

| Endpoint | Method | Auth | UI trigger / consumer |
|---|---|---|---|
| `/api/people/[id]/stack` | GET | public | Featured rail on `/people/[id]` (paid tiers only) |
| `/api/me/profile-curation` (if D8 lands as a route) | PATCH | requireAuth + tier gate | Edit Profile modal "Member page" section save |
| `/member/[username]/card/opengraph-image` | GET | public | Link unfurls of shared card URLs |
| `/people/[id]/opengraph-image` | GET | public | Link unfurls of profile URLs |

---

## 8. Out of scope (hard list)

- No change to what free riders can DO. Public timeline opt-in, stack curation at `/me/public-view`, stories, claims, connections: all stay free. The stack rail *render on the profile* is the member perk; the stack itself is not.
- No `rider-avatar.tsx` ring color changes (node-status language).
- No new admin surface; editors do not curate member pages.
- No changes to brand pages, tokens, pricing, Stripe products, or the equity/comp gate.
- No verification-gate or trigger-moment changes (membership brief Section 6 stands).
- No custom accent hex input (fixed 5-theme palette only; brands have hex, members have themes).
- PB-010 Phase 5/6 untouched.

---

## 9. Deploy + rollback

- **Order:** migrate, then merge. The three new columns are written only by the new member-gated path, so there is no 500-window; the gate is soft (Group F check: pass).
- **Rollback:** the curated render is gated behind a single derived const per surface (`isMemberCurated`); reverting the PR removes all renders. Columns are additive and inert if orphaned.
- **Smoke:** the brand-page traps apply verbatim (localhost reads prod; to preview a curated render inject a page-level override on a known profile id, screenshot tall at scroll 0, revert; assert on `textContent`). Owner-authed surfaces (Edit Profile member section) smoke via Jay's session.
- Standing rules: `npx tsc --noEmit` clean; one PR per session; full Ship sequence (surface the migration SQL in chat, wait for apply, prompt the merge, log to `bugs/SHIP-LOG.md` with `type: feature`, `scope: curated-member-profile`); no em dashes anywhere.

---

## 10. Playbook subset applied (24-check)

Checks run at drafting: schema introspection via migrations (1), code-path existence for every named route/component with file:line (2, 7), whole-file reads of rider-card, member-badge, rider-avatar, people/[id], types, card page (11), component-capability checks for the pill/overlay wiring (10), premise verification that the theme picker was removed and the visitor pill is a no-op (22), migration-before-merge classification (23), terminology fixed at brief time (15, D9). Open items tagged inline as "verify" for the session: the profiles catalog select shape, the `PublicTimelineOwner` select list, and the modal's exact write path (T12).

*End of brief.*
