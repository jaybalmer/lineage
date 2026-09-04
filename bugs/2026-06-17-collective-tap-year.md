# Bug-fix brief: tap-to-select-year breaks after scrolling on the collective timeline (BUG-063)

> Drafted by the June 17 daily triage from a June 17 report by Cory (R1), iPhone Safari, 414x750, no screenshot.
> DIAGNOSIS-FIRST: trace the scroll/tap interaction before changing code. One PR. Name BUG-063 in the PR title.
> Pure client interaction logic (no migration/auth/payments), but verify on a real device, so recommend a HUMAN-RUN session rather than a blind auto-merge.

## Goal
On `/snowboarding/collective`, tapping the timeline to select a year should keep working after the user scrolls. Today the selection drifts and the tap interaction breaks once you scroll.

## Scope
- **BUG-063** (P2, reproducible): tapping on the collective timeline to select a year works at first, but after scrolling, "the selected year moves forward" on its own and tapping to select a year becomes unreliable.

## Repro (from the report)
Signed in, iPhone Safari (414x750), on `/snowboarding/collective`: tap a year on the timeline (works), then scroll the page; the selected year advances forward without a tap, and subsequent taps to pick a year no longer land correctly. Replay anchor: PostHog session `S-09`, offset 892 seconds. No screenshot provided.

## Diagnosis-first (do NOT ship a blind fix)
The collective page renders a custom year/decade scrubber, not the shared timeline player. Verified structure in `src/app/(community)/[community]/collective/page.tsx`:
- `mode` state `"year" | "decade"` (line ~217), `scrollRef` (line ~237), per-year data built by `buildYearData` / `buildDecadeData`.
- An "auto-select best year/decade when panel is empty" effect (comment at line ~287): "Priority: year/decade with most user claims, then fall back to most riders overall."
Lead hypothesis: a scroll-driven effect (an `onScroll` handler or an IntersectionObserver that sets the active year as the user scrolls) competes with the explicit tap-to-select, so after a scroll the scroll-sync overwrites the tapped year (the "moves forward" symptom) and leaves the tap handler out of sync. Secondary suspects: (1) the auto-select effect re-runs on a dependency that changes during scroll and resets the selection; (2) a stale closure in the tap handler reads an outdated active index after the scroll position changes; (3) touch/scroll event interplay (a tap being interpreted relative to a shifted scroll offset).

Step 1 diagnostic: instrument or read the handlers that set the active year (the tap `onClick`/`onPointer` and any `onScroll`/observer) and confirm which one fires during a plain scroll. Establish whether the scroll path is meant to change the selection at all, then make tap authoritative (e.g. the scroll path should not override an explicit user selection, or debounce/guard it so it does not advance the year on its own).

## Suspected files
- `src/app/(community)/[community]/collective/page.tsx` (the scrubber, `scrollRef`, the auto-select effect, the year/decade selection state and its tap + scroll handlers).

## Acceptance
- On `/snowboarding/collective` (414px), tapping a year selects that year and the selection stays put while scrolling; the selected year does not advance on its own.
- Tapping to select a year remains reliable after one or more scrolls.
- Decade mode unaffected; desktop unaffected. `npx tsc --noEmit` clean.

## Suggested order
1. Reproduce on `/snowboarding/collective` at 414px; watch the active-year state while scrolling.
2. Identify the scroll-sync vs tap-select conflict (confirm which handler advances the year on scroll).
3. Make the explicit tap authoritative / guard the scroll path so it does not override the user's selection.
4. Verify tap-after-scroll reliability and that decade mode + desktop are unchanged.

## Notes
No migration. Client interaction logic only, but it needs real-device verification, so route to a human-run session (not an unattended auto-merge). `npx tsc --noEmit` clean. One PR, BUG-063 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
