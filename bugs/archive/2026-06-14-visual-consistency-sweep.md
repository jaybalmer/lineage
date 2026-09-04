# Bug-fix brief: visual consistency sweep (BUG-018, BUG-050, BUG-051, BUG-068)

> Auto-drafted by the daily triage on 2026-06-14, re-drafted 2026-06-15 to add BUG-050 and BUG-051, and 2026-06-17 PM to add BUG-068. Build-ready on the recommended defaults below.
> One PR. Name BUG-018, BUG-050, BUG-051, BUG-068 in the PR title. One design-consistency pass across list pages, headers, chips, badges, buttons, and link-text contrast.

## Goal
Converge a set of small visual-consistency gaps Cory found across launch testing into a single polish pass, so chips, headers, spacing, button contrast, the self-reported badge, and the filter order all match across the app.

## Scope (one cluster, six sub-items)
- (a) Rider card spacing on `/people` is tight and does not match spacing elsewhere.
- (b) In-section filter chips differ area to area (plain text vs outlined box vs shaded grouping box).
- (c) Section header text on `/snowboarding/brands` is larger than other sections.
- (d) On `/snowboarding/stories`, black text on a darker violet button fails contrast.
- (e) **BUG-050:** the "self-reported" indicator renders inconsistently. Screenshot `19ec7d2ce940bdc1__0__bug-screenshot.jpg` shows the same profile rendering it as all-caps "SELF-REPORTED" on a FIRST SEASON / origin card and as title-case "Self-reported" on a RODE AT claim card. Casing, size, and color drift because it is rendered ad hoc per card.
- (f) **BUG-051:** the in-section sub-filter chip order does not match the header (category) section order. Reporter wants them aligned, stories first.
- (g) **BUG-068:** the blue text under "shared moment" on the connection detail page (`/snowboarding/connections/<id>`) is hard to read on the grey background (fails contrast). Screenshot `19ed3cee54cb0b38__0__bug-screenshot.jpg`.

## DECISIONS (review before building)
1. **One chip treatment (b).** Recommended default: adopt the most common existing treatment as the single FilterChips style (pill, outlined when idle, filled accent when active) and apply it to every list filter row. Alternative: Cory specifies the exact chip spec first.
2. **Button-on-violet text color (d).** Recommended default: set white text on the solid violet buttons (violet is the riders/people/stories tier color `bg-violet-500/10` / `border-violet-700`; a solid violet fill with default dark text fails contrast). Alternative: route those buttons through `--accent` per the styling rules instead of a violet fill.
3. **Header type scale (c).** Recommended default: pick the prevailing section-header size used on most list pages and bring `/snowboarding/brands` down to match.
4. **Self-reported badge (e, BUG-050).** Recommended default: extract one shared self-reported badge component (one casing, one size, one color token) and use it everywhere. Use title-case "Self-reported" (the gentler of the two observed) at a small muted size. Alternative: Cory picks the casing/size.
5. **Filter order (f, BUG-051).** Recommended default: reorder the FeedView filter chips to match the nav Row 3 category order, with Stories first per the reporter, then the rest. Confirm "stories first" with Cory if unsure; the safe default is to mirror the header order exactly.
6. **Blue link contrast (g, BUG-068).** Recommended default: swap the low-contrast blue text under "shared moment" on the connection detail card to `--accent-strong` (#2563EB, meets AA on a light/grey surface) per the codebase CLAUDE.md styling rule (raw #3b82f6 / `--accent` is for fills and large display type only, not body link text on light). Alternative: use a `text-foreground` / muted token if the blue is not meant to read as a link.

## Verified suspected surfaces (from codebase CLAUDE.md + grep 2026-06-14)
- `/people` (`src/app/people/page.tsx`), `/snowboarding/brands` (`src/app/(community)/[community]/brands/page.tsx`), `/snowboarding/stories` (the community stories list). Each list page appears to implement its own filter chips and section header rather than sharing a component, which is why styles drift.
- Likely the cleanest fix is a shared `FilterChips` component plus a shared section-header treatment and spacing tokens in `src/app/globals.css`. Tier colors and the accent rule are documented in the codebase CLAUDE.md "Styling" section (violet = riders/people/stories; generic accent = `--accent` #3B82F6).
- Screenshots reviewed (in the Linestry Bug Attachments folder): `19eaefb69b8e952f__0__bug-screenshot.jpg` (a, spacing), `19eaef463e84b4e9__0__bug-screenshot.jpg` (b, chips), `19eaedcb76614d51__0__bug-screenshot.jpg` (c, header), `19eaed747675e5f2__0__bug-screenshot.jpg` (d, button contrast), `19ec7d2ce940bdc1__0__bug-screenshot.jpg` (e, self-reported badge casing), `19ec7e0602e088bd__0__bug-screenshot.jpg` (f, filter order).
- (e, BUG-050) self-reported badge: the string appears ad hoc across claim-card variants and modals. Verified grep hits: `src/components/timeline/claim-card.tsx` (the main claim card), the origin/start card (`src/components/feed/start-card.tsx`), and the badge also appears in `add-claim-modal.tsx`, `edit-claim-modal.tsx`, `quick-claim-popover.tsx`, and the brands/events detail pages. Extract one shared badge and replace each ad-hoc render.
- (f, BUG-051) filter order: the FeedView filter label map is at `src/components/feed/feed-view.tsx` (lines 48 to 53: `places`, `gear`/Boards, `people`/Riders, `orgs`/Brands, `events`, `stories`). The nav Row 3 order is Riders, Events, Boards, Brands, Places, Stories (`src/components/ui/nav.tsx`). Reorder the FeedView filter keys to match the header (Stories first per the reporter).
- (g, BUG-068) blue link contrast: `src/app/(community)/[community]/connections/[id]/page.tsx` (the connection detail card). The list page `connections/page.tsx` uses light `text-blue-300` style tokens (lines ~90/114); the detail page likely repeats the pattern for the "shared moment" descriptor text. Route that blue text to `--accent-strong` (or `text-foreground`/muted). Token change only.

## Acceptance
- Filter chips share one treatment across sections; section header sizes are uniform; rider card spacing on `/people` matches the rest of the app; no dark text on a dark violet button fails contrast (white text or accent per decision 2).
- (BUG-050) the self-reported indicator uses one casing, size, and color everywhere it appears (no "SELF-REPORTED" vs "Self-reported" split on the same screen).
- (BUG-051) the sub-filter chip order matches the header section order (Stories first per decision 5).
- (BUG-068) the blue text on the connection detail card meets AA contrast against its grey background (uses `--accent-strong` or a darker token).
- Optional: run the accessibility-review skill on the stories buttons and the connection detail card to confirm AA contrast.

## Suggested order
1. (d) button contrast (fastest, highest visible impact).
2. (e) extract the shared self-reported badge and swap it in everywhere.
3. (f) reorder the FeedView filter chips to match the header.
4. (g) swap the connection-detail blue text to `--accent-strong` (one-line token change).
5. (b) extract/standardize FilterChips and apply across list pages.
6. (c) header type scale, then (a) card spacing, both via shared tokens.

## Notes
No migration, no write path. `npx tsc --noEmit` clean. One PR, BUG-018, BUG-050, BUG-051, BUG-068 in the title. Append a `status: pending` SHIP-LOG entry naming all four ids. No em dashes anywhere (including any new UI copy).
