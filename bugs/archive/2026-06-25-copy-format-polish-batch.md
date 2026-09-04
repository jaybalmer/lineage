# Bug-fix brief: launch UI polish batch (copy / format + toast stacking)

Date: 2026-06-25
Pipeline-safe auto-merge lead: yes (all client-only, no migration, no _public view, no auth/payments)
BUG ids in scope: BUG-105, BUG-110, BUG-111, BUG-112, BUG-107
Run type: auto-merge eligible
Estimated: ~45-60 min

## Goal
Five small client-only launch-polish fixes: a doubled year in the Add-Story event picker, a contest label casing mismatch, two over-long brand stat labels, a "location" vs "Place(s)" wording fix, and a token toast that gets covered by the claim toast.

## DECISIONS (review before building; recommended defaults shown)
- D1 (BUG-110 casing direction): make the brand-page event chip match the Events-section style. Recommended default: use the Events-section casing as canonical and align the brand-page chip to it (confirm which reads better; the report only asks that they agree). Alternative: align the Events section to the brand-page chip.
- D2 (BUG-111 labels): shorten "connected riders" -> "riders" and "board models" -> "boards". Recommended default: yes, shorten both (keep "events", "places", "stories" as-is). Alternative: shorten only "board models" -> "boards".
- D3 (BUG-112 wording): "location"/"locations" -> "Place"/"Places" on the brands list. Recommended default: yes, match the rest of the site's "Places" noun.
All five ship on the defaults; Jay can override any line before the session.

## Per-bug detail

### BUG-105: Add-Story Links tab event picker shows the year twice
- Verified: `src/components/ui/add-story-modal.tsx` line ~517 sets `getLabel={(e) => `${e.name} ${e.year ?? ""}`}`. Catalog event names already end in the year (e.g. "Baker Banked Slalom 2019"), so the option renders "Baker Banked Slalom 2019 2019".
- Fix: render the event name once. Either drop the appended `${e.year}`, or only append the year when `e.name` does not already end in it. Match however the PLACE / BOARD pickers in the same modal render their labels for consistency.
- Acceptance: each event option in the Add-Story Links tab shows its name once with no duplicated trailing year; place/board/brand pickers unchanged.

### BUG-110: Brand-page event chip casing inconsistent with the Events section
- Reporter: brand page renders "Contest · 1997" (title case + bullet) while the Events section shows "CONTEST 1997" (uppercase). Source on the brand page: `src/app/(community)/[community]/brands/[slug]/page.tsx` builds event items with `kind: "event"` + `event.year` (~lines 469-492) and renders a type label near the timeline rows; the Events list/card uppercases the type. Grep the brand-page event row render and the Events `EventCard`/list type label to find the two formatters.
- Fix: make the two agree per D1 (one casing, same separator-or-none). Pure presentational.
- Acceptance: the event type label reads the same way on the brand page and in the Events section.

### BUG-111: Brand-page stat labels too long to fit one line
- Verified: `src/app/(community)/[community]/brands/[slug]/page.tsx` ~lines 598-600 `statBlocks` use labels `"connected riders"` and `"board models"`.
- Fix per D2: `"connected riders"` -> `"riders"`, `"board models"` -> `"boards"`. Leave the numbers and the other three stats (events, places, stories) unchanged.
- Acceptance: the brand-page stat row reads "riders / boards / events / places / stories" and fits without wrapping awkwardly at 414px.

### BUG-112: Brands list says "location" where the site says "Places"
- Verified: `src/app/(community)/[community]/brands/page.tsx` line ~50 pushes `${conn.places} location${conn.places !== 1 ? "s" : ""}` and line ~29 the sort title reads "Sort by riders, events & locations".
- Fix per D3: change "location"/"locations" to "Place"/"Places" in both spots (keep pluralisation logic).
- Acceptance: the brands list and its sort tooltip use the "Places" noun, matching the rest of the site.

### BUG-107: Token "+1" toast is covered by the claim / celebration toast
- Reporter: after adding a timeline claim, the claim confirmation popup at the bottom covers the "+1 token" toast, so the token message is hidden and dismissed before it can be read (`/people/cory_yip`). Screenshot `19efd1c0387f4feb__0__bug-screenshot.jpg` shows a celebration card present at the bottom.
- Suspected area: the celebration / "added to your crew / Entry #N" card (owner-timeline-panel celebration surface) and the daily-token "+1" toast occupy the same bottom region and overlap. Find the toast container(s) and the celebration card; either stack them (offset one above the other) or sequence them so both are readable.
- Fix: ensure the token toast and the claim-celebration toast do not occlude each other (stack with spacing, or show the token toast above the celebration, or delay one). Client-only positioning / timing; no data change.
- Acceptance: after adding a claim, both the celebration and the "+1 token" feedback are visible and readable (neither fully covers the other) on a 414px-wide screen.

## Pre-flight
- Read each whole file before editing (the 24-check playbook): `add-story-modal.tsx`, `brands/[slug]/page.tsx`, `brands/page.tsx`, the brand-page event row + Events `EventCard`, and the toast/celebration surfaces.
- No em dashes in any copy you touch (standing rule).

## Ship
- One PR, branch `bugfix/2026-06-25-ui-polish-batch`. Name BUG-105 / 110 / 111 / 112 / 107 in the title or commit.
- No migration (state explicitly). `npx tsc --noEmit` clean before commit.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-105, BUG-110, BUG-111, BUG-112, BUG-107`, `migration: none`).
