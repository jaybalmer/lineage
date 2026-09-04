# Bug-fix brief: collective timeline default frame omits the viewer's own year

Date: 2026-06-27
Pipeline-safe auto-merge lead: no (diagnosis-first; the default-frame mechanism must be understood before the fix shape is known). Client-only, no migration, but verify on a real device.
BUG ids in scope: BUG-117
Run type: diagnosis-first (prefer a human-run session)
Estimated: ~1-1.5 hr incl. diagnosis

## Goal
On the collective timeline, a signed-in member's own year ("your years") is not within the default frame on load, and toggling 10Y/1Y does not bring it into view. Anchor the default frame (or scrub position) to the viewer's earliest year when they have one.

## DECISIONS (review before building; recommended defaults shown)
- D1 (anchor target): when the viewer has at least one "your year", anchor the default view to their EARLIEST year. Recommended default: earliest year (so their whole arc reads from the start). Alternative: most recent year.
- D2 (no-years fallback): members with no "your years" keep the current default frame unchanged. Recommended default: yes, unchanged.
Ship on the defaults; Jay can override before the session.

## Diagnosis first (do this before writing the fix)
Surface: `src/app/(community)/[community]/collective/page.tsx` (786 lines). Relevant state already in the file:
- `const [mode, setMode] = useState<"year" | "decade">("year")` (line ~217) drives the 1Y / 10Y toggle.
- `const [myYears, setMyYears] = useState<Set<number>>(new Set())` (line ~221) is the viewer's "your years" set, rendered with the "your years" label at line ~671.
- Scrub state `activeIdx` / `scrubX` (lines ~218-219) and the scrub handler around lines ~358-368.
- The chart is drawn as a scaled SVG (the `DATA_YEARS` baseline includes 1979; year ticks '79 '83 ... render across the width).

Open questions to resolve from the code + a real-device look (replay `S-24`, offset 2133s; screenshot `19f0732cefbb30cd__0__bug-screenshot.jpg`):
1. Is the chart fully scaled to fit the viewport (no scroll), or is it horizontally scrollable / windowed? The fix mechanism depends on this:
   - If fully scaled: every year is already on screen, so "not in the timeline view by default" likely means the viewer's year markers ("your years") are not visually emphasised or the scrub/active position does not start on their year. The fix is to set the initial `activeIdx`/`scrubX` (or highlight) to the earliest `myYears` value.
   - If scrollable/windowed: the default scroll offset starts at the dataset baseline; the fix is to set the initial scroll/frame so the earliest `myYears` value is in view.
2. When is `myYears` populated relative to first paint? If it loads async (after the catalog), the default-frame effect must run (or re-run) once `myYears` is non-empty, not only on mount.
3. Does the 10Y/1Y (`mode`) toggle reset or preserve the frame? The reporter says toggling does not fix it, which is consistent with the default anchor never being set to the viewer's year in either mode.

## Fix direction (after diagnosis)
- Add an effect that, once `myYears` is populated, sets the default frame/scrub/scroll to the earliest `Math.min(...myYears)` (D1), guarded so it runs once and only when the viewer has years (D2). Keep the manual 1Y/10Y toggle and scrub fully working afterward (the anchor is just the initial position).
- Do not change the data, the year range, or the "your years / community" toggle behaviour.

## Acceptance
- A signed-in member with at least one "your year" sees their earliest year within the default collective frame on load (visible / in-view / scrubbed-to, per the mechanism the diagnosis settles on).
- A member with no "your years" sees the unchanged default frame.
- The 1Y / 10Y toggle and the drag/tap scrub still work after the change.
- Verified on a 414px-wide device (the report is iPhone Safari), no 0px overflow regression.

## Pre-flight
- Read the whole `collective/page.tsx` before editing (24-check playbook); it is one large client component with interleaved SVG render and interaction state.
- Confirm the scaled-vs-scrollable question (open question 1) before choosing the mechanism; do not assume.
- No em dashes in any copy you touch (standing rule).

## Ship
- One PR, branch `bugfix/2026-06-27-collective-default-frame`. Name BUG-117 in the title or commit message.
- No migration (state explicitly). `npx tsc --noEmit` clean before commit.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-117`, `migration: none`).
