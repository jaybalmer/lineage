# Bug-fix brief: mobile tab-row overflow + keep the active tab on screen (BUG-064, BUG-065, BUG-073)

> Drafted by the June 17 daily triage; updated the June 17 PM run to add BUG-073. Reports from Cory (R1), iPhone Safari, 414x750.
> One PR. Name BUG-064, BUG-065, and BUG-073 in the PR title. Pure client/CSS, no migration, auto-merge eligible.
> Same shape as the shipped BUG-049 community-switcher clipping fix: horizontal-overflow control on a 414px screen.

## Goal
On a 414px mobile viewport, horizontal tab rows must keep the active tab visible and must not let the whole page scroll/drag sideways.

## Scope
- **BUG-064** (P2): on `/me/settings/blocks`, selecting the "Blocked" tab resets the tab row's scroll position to the start, leaving the now-active tab scrolled off-screen to the right. The user cannot see which tab they are on.
- **BUG-065** (P2): on `/snowboarding/boards`, the boards tab row ("All / Brands / Models / Most entries" plus the Mine toggle) is clipped slightly off the right edge, which makes the whole page draggable left/right. Reporter notes most other pages avoid this.
- **BUG-073** (P2): same `me-subnav` root as BUG-064, reported on `/me/tags`. Selecting an off-screen tab resets the tab-row scroll to the start so the active tab is highlighted off screen. Fixing BUG-064 at the `MeSubNav` level fixes this too; additionally check the `/me/tags` source-filter chip row (All sources / Member / Embed / Editor) in case it resets its own scroll on filter change. Screenshot reviewed: `19ed41b0978a0dce__0__bug-screenshot.jpg`.

## DECISIONS (review before building; defaults are build-ready)
- **D1 (BUG-064): how to surface the active settings tab.** Default: on mount, scroll the active tab into view inside its `overflow-x-auto` container (e.g. `ref.scrollIntoView({ inline: "center", block: "nearest" })` on the active `<Link>`, guarded so it does not scroll the page vertically). Alternative: set the container `scrollLeft` so the active tab is fully visible (left-aligned) rather than centered.
- **D2 (BUG-065): how to contain the boards tab row.** Default: let the tab group scroll within its own `overflow-x-auto` box (`min-w-0`, `whitespace-nowrap`) so it never pushes the page wider than the viewport, and ensure no horizontal body scroll is possible on the boards page. Alternative: shorten the "Most entries" label to "Most" and/or allow the row to wrap so everything fits without a scroll region.

## Verified suspected files (grepped against the live repo June 17)
- **BUG-064:** `src/components/ui/me-subnav.tsx`. The tab row is a single horizontal scroller: line 20 `<div className="max-w-5xl mx-auto flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-none">` with five `<Link>` tabs (notifications, public-timeline, tag-privacy, trust, blocks). Each settings page (`src/app/me/settings/blocks/page.tsx` etc.) renders `<MeSubNav />`. Because each tab is a `<Link>` navigation, selecting the rightmost "Blocked" tab remounts the page and the subnav, so the scroller resets to `scrollLeft = 0` and the active (rightmost) tab sits off-screen. Fix in `me-subnav.tsx`: after mount, scroll the active tab into view (it already knows which path is active to apply the active style). No layout change to the other tabs.
- **BUG-065:** `src/app/(community)/[community]/boards/page.tsx`. The control row is line ~268 `<div className="flex items-center justify-between gap-3 mb-6">` wrapping the tab group (line ~269 `<div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1">` with All / Brands / Models / "Most entries") and the Mine toggle. On 414px the combined width exceeds the viewport with no overflow containment, so the page body scrolls horizontally. Contain the row (scroll the tab group within its own box, or wrap) and make sure the page root cannot scroll sideways. Cross-check `src/app/globals.css` for any existing `overflow-x` clamp pattern used elsewhere so this matches the rest of the app (reporter says other pages already avoid this).

## Acceptance
- **BUG-064 / BUG-073:** opening `/me/settings/blocks`, any settings tab, or `/me/tags` leaves the active tab fully visible in the tab row on a 414px screen; the row no longer resets the active tab off-screen. The `/me/tags` source-filter chips also keep the active chip in view (or do not reset on filter change).
- **BUG-065:** on `/snowboarding/boards` at 414px the page does not scroll or drag horizontally; the tab row and Mine toggle are reachable without the body moving sideways. 0px horizontal body overflow at 375px and 414px.
- No regression to the tab rows on desktop. `npx tsc --noEmit` clean.

## Suggested order
1. BUG-065 first (self-contained CSS/containment on one page); verify 0px horizontal body overflow at 375px and 414px.
2. BUG-064 + BUG-073: add the scroll-active-into-view on `MeSubNav` mount; verify on `/me/settings/blocks`, `/me/tags`, and one left-most tab that nothing scrolls vertically as a side effect. Check the `/me/tags` source-filter chip row too.
3. Spot-check all rows on desktop (no behavior change).

## Notes
No migration, no auth, no payments: pure client/CSS, auto-merge eligible. `npx tsc --noEmit` clean before commit. One PR, BUG-064, BUG-065, and BUG-073 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere you write (code, comments, copy).
