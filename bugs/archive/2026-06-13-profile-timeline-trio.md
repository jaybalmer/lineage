# Bug-fix Session: Profile + timeline trio (BUG-035, BUG-034, BUG-033)

> Status: BUILD-READY. Drafted June 13, 2026 from the BUG-033 / 034 / 035 entries in `bug-triage.md` plus a live code-path read of the repo. Self-contained: implement from this file.
> Full reporter context, screenshots, and replay links live under each BUG id in `bug-triage.md`.

All three are launch-facing polish on the member profile and timeline, reported together by Jay on June 12. They share one surface area (the profile summary card + timeline cards), which is why they are batched. BUG-035 is the lead.

## Two product decisions (locked by Jay, June 13)

1. **BUG-033 date rule: strip "present" entirely.** A claim with a start date but no end date renders only the start date. No synthesized "to present" anywhere. A range renders only when an explicit `end_date` exists. This is a global change to `formatDateRange` and intentionally changes every surface that calls it (see blast radius under BUG-033).
2. **BUG-035 location privacy: hide precise location for non-owners.** The public summary card shows avatar, background, identity, stat tiles, birth year, and riding-since, but NOT the city / region / country line. The owner still sees location on their own card.

## Standing rules

- `npx tsc --noEmit` clean before commit.
- One PR. Name the BUG ids in the PR title or commit message (for example "BUG-033, BUG-034, BUG-035"); the daily triage reconciles Shipped by reading them.
- Do NOT edit the Shipped section of `bug-triage.md`; the triage reconcile does that.
- No em dashes anywhere (code, comments, UI copy). Use periods, commas, parentheses, colons, or semicolons.
- `bugs/` is gitignored; do not stage it.

## Verified facts (provenance, current as of June 13)

- The owner profile `src/app/(community)/[community]/profile/page.tsx` renders the rich summary card via `<RiderCard ... isOwn />` at lines 544 to 556. The public person profile `src/app/people/[id]/page.tsx` does NOT use RiderCard; it renders its own leaner header (RiderAvatar + custom markup) starting around line 185.
- `RiderCard` (`src/components/ui/rider-card.tsx`) is self-contained and already gates every upload / edit / clear control on `isOwn` (background upload lines 286 to 330, avatar upload 359 to 377, "Edit profile" 485 to 492, "Add a bio" 449 to 456). With `isOwn={false}` it renders background, avatar, tier badge, name, sub-info, stat tiles, bio, links, My Timeline, and Share, and nothing editable.
- `RiderCard` only reads `membership.tier` (line 235, `TIER_LABEL[membership.tier]`). It does NOT read `token_balance` or `founding_member_number`. The tier badge block is conditional on `tier` existing (line 385), so a `free` tier renders no badge.
- The public page already resolves the viewed person's tier: `person.membership_tier` is used for its lean badge at `src/app/people/[id]/page.tsx:149`.
- The catalog people loader is the gap for BUG-035. The `profiles` select at `src/store/lineage-store.ts:181-182` is: `"id, display_name, birth_year, riding_since, privacy_level, bio, links, home_resort_id, membership_tier, node_status"`. It omits `avatar_url` and `card_bg_url`. The `profilePeople` mapping at lines 235 to 247 likewise does not set them. This is exactly why the public view shows a "JB" initials block with no photo and no background (BUG-035 report).
- The `Person` type already declares `avatar_url` (`src/types/index.ts:183`), `card_bg_url` (184), `city/region/country` (186 to 188), and `membership_tier` (205). No type changes are required.
- The stat tiles (Boards / Places / Events / Riding) are the `Stat` cells in `RiderCard` at lines 430 to 442. They are plain `div`s today, not interactive.
- The category filter is owned INSIDE `FeedView` as local state: `const [filter, setFilter] = useState<FilterType>("all")` at `src/components/feed/feed-view.tsx:150`. `FilterType` is `"all" | "places" | "gear" | "people" | "orgs" | "events" | "stories"` (line 34). The Boards pill maps to `gear` (label "Boards", line 48); Places maps to `places`; Events maps to `events`. The summary stat tiles live in a SIBLING component (RiderCard), so a tile click cannot reach FeedView's filter without lifting state.
- The timeline date label is `formatDateRange(claim.start_date, claim.end_date)` at `src/components/feed/post-card.tsx:608` and `src/components/timeline/claim-card.tsx:35`. `formatDateRange` (`src/lib/utils.ts:36-41`) returns `s` when start equals end, else `s – present` when end is absent. That open-ended default is the BUG-033 "to present" string.

## Items

### BUG-035: public summary card is owner-only (lead)

Goal: a public visitor and a non-owner member see the same profile summary card the owner sees (background, avatar, identity, stat tiles), with precise location hidden per the locked decision.

Two coordinated changes:

1. **Load the missing fields.** In `src/store/lineage-store.ts`:
   - Add `avatar_url, card_bg_url` to the `profiles` select string at line 182.
   - Set `avatar_url: row.avatar_url ?? undefined` and `card_bg_url: row.card_bg_url ?? undefined` in the `profilePeople` map (lines 235 to 247).
   - Note: catalog (non-profile) people from the `people`/`PEOPLE` source will not have these; that is fine, the card falls back to initials and the mountain illustration.

2. **Render RiderCard on the public profile.** In `src/app/people/[id]/page.tsx`, replace the lean custom header block (the `flex items-start gap-5` block around lines 186 to 273) with `<RiderCard person={person} claims={personClaims} membership={...} homeResort={...} isOwn={isCurrentUser} userId={isCurrentUser ? activePersonId : undefined} />`.
   - Build the membership prop from the VIEWED person, not the store viewer: pass an object whose `tier` is `person.membership_tier ?? "free"`. RiderCard reads only `.tier`, but `MembershipState` is a wider type, so construct a minimal conforming object (reuse the store's default membership shape with `tier` overridden, or cast a `{ tier }` literal to satisfy the prop). Do NOT pass the store `membership` (that is the viewer's tier and would mislabel the card).
   - `homeResort`: resolve the same way the owner page does (look up `person.home_resort_id` in `PLACES` / catalog places). If trivial to thread, do so; if not, pass `null` (the card handles null).
   - Keep the surrounding public-profile machinery intact: breadcrumb, the "claims" count action row, the invite / "This is me" / vouch / claim-request surfaces below the header all stay. Only the header card swaps.

3. **Hide precise location for non-owners (locked decision).** In `RiderCard` sub-info (lines 408 to 423): gate the city/region/country line on `isOwn`. For non-owners, do not render the location line; fall through to `birth_year` (and keep `riding_since`). Concretely, the `(person.city || person.region || person.country)` branch should require `isOwn`; otherwise use the `birth_year` branch.

Pseudocode (REAL until verified against the file):
```
{isOwn && (person.city || person.region || person.country) ? (
  <span>... location ...</span>
) : person.birth_year ? (
  <span>b. {person.birth_year}</span>
) : null}
```

Acceptance:
- Signed out, and signed in as a different member, the person profile shows the summary card (background, avatar photo if set, tier badge, name, stat tiles, birth year, riding-since) matching the owner's card.
- The city / region / country line does NOT appear for non-owners; it still appears for the owner on their own profile.
- No upload, "Edit profile", "Add a bio", or background-clear control appears for non-owners (already gated by `isOwn`; confirm after the swap).
- The owner's My Timeline (`/[community]/profile`) is unchanged.
- The stat-count difference between owner and public views (owner sees private/pending claims, public does not) is expected and is NOT part of this fix.

### BUG-034: profile summary stat tiles are not clickable

Goal: on the owner's My Timeline, clicking the Boards / Places / Events stat tile applies the same category filter as the matching pill. Scope to the OWNER profile only (that is where the report is and where a FeedView with filters sits directly below the card).

The tiles (RiderCard) and the filter (FeedView) are siblings under `src/app/(community)/[community]/profile/page.tsx`, so lift the filter state up:

1. **Make FeedView's filter optionally controlled.** In `src/components/feed/feed-view.tsx`, add optional props `filter?: FilterType` and `onFilterChange?: (f: FilterType) => void`. If `filter` is provided, use it instead of internal state; otherwise keep the existing `useState` default (backward compatible, so every other FeedView caller is untouched). Route the pill `onClick` (line 297, `setFilter(f)`) through `onFilterChange ?? setInternalFilter`. Export `FilterType` if it is not already exported.
2. **Lift state in the owner profile page.** Add `const [timelineFilter, setTimelineFilter] = useState<FilterType>("all")` in `page.tsx` and pass `filter={timelineFilter} onFilterChange={setTimelineFilter}` to the `<FeedView ... />` at lines 637 to 650.
3. **Wire the tiles.** Give RiderCard an optional `onStatClick?: (category: "gear" | "places" | "events") => void`. Map Boards tile to `"gear"`, Places to `"places"`, Events to `"events"`. Leave the Riding tile non-interactive (no matching filter). When `onStatClick` is present, render each mapped tile as a button (keyboard-focusable, `cursor-pointer`, hover affordance) and call it on click; when absent (for example the public card), render the tiles as the current static cells. In `page.tsx`, pass `onStatClick={(cat) => { setTimelineFilter(cat); /* scroll the timeline into view */ }}`.
4. **Scroll affordance.** After setting the filter, scroll the timeline section into view so the result is visible on mobile (the tiles sit above the fold of the list). A `ref` on the FeedView wrapper or the existing "Timeline" heading (`page.tsx` line 575) with `scrollIntoView({ behavior: "smooth", block: "start" })` is enough.

Acceptance:
- On `/[community]/profile`, clicking the Boards tile selects the Boards (gear / BoardShelf) view, Places selects Places, Events selects Events, each matching the corresponding pill.
- The tiles are keyboard-focusable and show a pointer / hover affordance when interactive.
- Public profile tiles remain non-interactive (no `onStatClick` passed there).
- Every other FeedView caller (feed, collective, public profile) is unaffected because the new props are optional.

### BUG-033: single-date claims render a spurious "to present" range

Locked decision: strip "present" entirely. A claim with no `end_date` shows only the start date.

Fix at the helper so behavior is consistent everywhere:
- In `src/lib/utils.ts`, `formatDateRange` (lines 36 to 41): when `end` is absent, return the formatted start only instead of `s – present`.
```
export function formatDateRange(start?: string, end?: string): string {
  if (!start) return ""
  const s = formatSmartDate(start)
  if (!end) return s
  const e = formatSmartDate(end)
  return s === e ? s : `${s} – ${e}`
}
```

**Blast radius (intended, global).** `formatDateRange` has 16 call sites; all shift from "start to present" to "start" when no end is stored. Eyeball each at review:
- `src/components/feed/post-card.tsx:608` (timeline cards, the reported surface)
- `src/components/timeline/claim-card.tsx:35`
- `src/app/(community)/[community]/brands/[slug]/page.tsx:706, 788, 844, 1000`
- `src/app/(community)/[community]/places/[id]/page.tsx:536, 602, 749`
- `src/app/(community)/[community]/boards/[id]/page.tsx:658`
- `src/app/compare/page.tsx:165`

This is the global single-date behavior Jay asked for. Do not special-case predicates. Leave `formatEventDateRange`, `formatPartialDate`, and `formatSmartDate` unchanged (the event picker / header already use the precision-aware path from the shipped BUG-031 fix).

Acceptance:
- A claim with a start date and no end date shows only the start date on the timeline and on the brands / places / boards / compare surfaces. No "to present".
- A claim with an explicit end date still shows the "start to end" range.
- No "NaN" or "undefined" regressions (these came from a different formatter and are already fixed).

## Suggested order

1. BUG-033 first (smallest, isolated helper change, easy to eyeball the 16 call sites).
2. BUG-035 next (the lead; the store select + mapping change, then the RiderCard swap on the public page, then the location gate).
3. BUG-034 last (the FeedView controlled-filter refactor plus the tile wiring; it is the most cross-component, so land it after the card swap is stable).

## Pre-flight reads (open these before editing)

- `src/components/ui/rider-card.tsx` (whole file; you will touch the sub-info gate and add `onStatClick`).
- `src/app/people/[id]/page.tsx` lines 120 to 290 (the header block you are replacing and the surfaces that must survive).
- `src/app/(community)/[community]/profile/page.tsx` lines 490 to 655 (RiderCard + FeedView wiring).
- `src/components/feed/feed-view.tsx` lines 119 to 330 (props, filter state, pill row).
- `src/store/lineage-store.ts` lines 178 to 248 (the profiles select and profilePeople map).
- `src/lib/utils.ts` lines 14 to 82 (the date formatters; change only `formatDateRange`).

## Out of scope

- The BUG-035 stat-count difference between owner and public views (private / pending claims). Expected, not a bug.
- Public-profile stat tiles being clickable (BUG-034 is owner-only).
- Any predicate-aware date logic (Jay chose the global strip, not a predicate split).
- The token / equity UI on the profile (BUG-020, separate, pending product call).
- A broader per-field privacy system. This brief only hides the location line for non-owners; bio and links stay public as they are today.
