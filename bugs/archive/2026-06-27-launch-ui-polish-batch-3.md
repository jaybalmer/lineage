# Bug-fix brief: launch UI polish batch 3 (brand riders label + public-view Preview 404)

Date: 2026-06-27
Pipeline-safe auto-merge lead: yes on the defaults (both client-only, no migration, no _public view, no auth/payments mutation). NOTE: only the BUG-119 DEFAULT (hide the Preview link when disabled) is auto-merge-safe; the BUG-119 alternative (owner-preview bypass on the public route) is a larger human-run change, do not take it in an auto-merge run.
BUG ids in scope: BUG-118, BUG-119
Run type: auto-merge eligible (on defaults)
Estimated: ~30-45 min

## Goal
Two small client-only brand/public-view polish fixes from one Cory session: the brand page labels the riders tab "People" (should be "Riders"), and the "Preview" link on /me/public-view dead-ends in a 404 when the public timeline is not enabled.

## DECISIONS (review before building; recommended defaults shown)
- D1 (BUG-118 label): rename the brand-page filter tab label "People" -> "Riders" to match the top stat tile and the rest of the site. Recommended default: yes, rename (keep the tab `key: "people"`, change only the display label). This mirrors the shipped BUG-091 / BUG-016 fix on a new surface. Alternative: change the stat tile label "riders" to "People" instead (NOT recommended; the rest of the site uses "Riders").
- D2 (BUG-118 order): confirm on the live brand page whether the stat-tile order actually differs from the filter-tab order. Recommended default: in code both are riders/boards/events/places/stories, so if the rendered order already matches, the only real mismatch is the label (D1) and no order change is needed; if the tiles visually wrap into a different order than the tabs, reorder the tiles to match the tab sequence. Do not reorder the tabs.
- D3 (BUG-119 fix shape): when the public timeline is OFF, stop the Preview link 404ing. Recommended default: gate the "Preview" link to render only when `enabled` (mirror the existing amber "turn it on" banner), so it is simply absent until the timeline is on; the disabled state already explains the share link. This is the auto-merge-safe default. Alternative (human-run, do NOT auto-merge): add an owner-authenticated preview mode so `/t/[slug]` renders for the owner even when disabled, and keep the Preview link always visible.
Both bugs ship on the defaults; Jay can override any line before the session.

## Per-bug detail

### BUG-118: Brand page labels the riders tab "People"; confirm tile order matches tab order
- Verified (label): `src/app/(community)/[community]/brands/[slug]/page.tsx`. `tabs[]` (line ~535-542) defines `{ key: "people", label: "People", count: uniqueRiderIds.length }` while `statBlocks` (line ~598) labels the same metric `{ n: connectedRiderCount, l: "riders" }`. The two surfaces disagree on the word for the same thing.
- Fix (D1): change the `tabs[]` label "People" to "Riders" (leave `key: "people"` so the filter logic is untouched). This is the same rename shipped for `/people` (BUG-016) and `/me/*` (BUG-091).
- Fix (D2): both `tabs[]` and `statBlocks` are coded in the order riders/boards/events/places/stories. Open the live Barfoot page (screenshot `19f07224a3fd66f1__0__bug-screenshot.jpg`) and confirm whether the stat tiles (a wrapping grid) render in a different visual order than the single-row tabs. If they match, no order change is needed (the perceived mismatch was the label). If they differ, reorder the `statBlocks` array to match the `tabs[]` sequence. Do not reorder `tabs[]`.
- Acceptance: the brand page riders tab reads "Riders" (matching the stat tile and the rest of the site); the stat-tile order matches the filter-tab order. No other tab labels or counts change. Client-only.

### BUG-119: "Preview" link on /me/public-view 404s when the public timeline is off
- Verified: `src/app/me/public-view/page.tsx`. The Preview link at line ~478 is `{slug && (<a href={`/t/${slug}?view=stack`} target="_blank" rel="noopener noreferrer" ...>Preview</a>)}`. It is gated on `slug` only. `slug` is backfilled for every profile (PB-010 Phase 1), so it is present even when `public_timeline_enabled` is off. `/t/[slug]` calls `notFound()` for a disabled timeline, so the link 404s. The page already knows the state: there is an `enabled` flag driving the amber "Your public timeline is off ... Turn it on" banner at line ~371, and the save toast at line ~324 distinguishes `enabled`.
- Fix (D3 default): change the Preview link gate from `{slug && ...}` to `{slug && enabled && ...}` so the link only shows when the timeline is on (and therefore `/t/[slug]` resolves). The existing amber banner already tells the user to turn it on, so no new copy is strictly required; optionally add a one-line muted hint near the Save row when `!enabled` (e.g. "Turn on your public timeline to preview it."), no em dashes.
- Note: leave the "Your public link" copy block (line ~482, also `{slug && ...}`) as-is. It shows a copyable URL string, not a clickable dead-end, and the amber banner already covers the off-state. Only the Preview anchor actively 404s.
- Acceptance: with the public timeline OFF, there is no Preview affordance that lands on a 404 (the link is hidden, with the existing turn-it-on prompt visible); with it ON, "Preview" opens `/t/[slug]?view=stack` in a new tab as before. Client-only, no migration.

## Pre-flight
- Read each whole file before editing (24-check playbook): `src/app/(community)/[community]/brands/[slug]/page.tsx` and `src/app/me/public-view/page.tsx`.
- For BUG-118 D2, look at the live Barfoot brand page (or the screenshot) to decide whether any tile reorder is actually needed before touching the array.
- No em dashes in any copy you touch (standing rule).

## Ship
- One PR, branch `bugfix/2026-06-27-ui-polish-batch-3`. Name BUG-118 / BUG-119 in the title or commit message (the daily reconcile keys off the BUG ids).
- No migration (state explicitly). `npx tsc --noEmit` clean before commit.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-118, BUG-119`, `migration: none`).
