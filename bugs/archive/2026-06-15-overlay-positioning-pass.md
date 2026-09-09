# Bug-fix brief: Overlay positioning and scroll-lock pass (BUG-047, BUG-048, BUG-049)

> Build-ready. Self-contained. Drafted June 15, 2026 by the daily triage. One session, one PR. Name **BUG-047, BUG-048, BUG-049** in the PR title or commit message.

## Goal
Make popovers and modals behave on mobile: open in view (not off-screen), lock the background page while open, and keep dropdowns inside the viewport. Three related reports, one overlay-behavior pass.

## DECISIONS (review before building)
- **BUG-047 popover style.** Recommended default: render the add-connections popover as a centered modal/portal overlay (same pattern as the bug-report modal the reporter referenced), rather than an inline-anchored popover. Alternative: keep it anchored but clamp it into the viewport. Default = centered modal, which also fixes the "below the comments" problem cleanly.
- **BUG-049 dropdown anchor.** Recommended default: right-align the community switcher menu to the trigger and clamp its width to the viewport with safe-area padding. Alternative: full-width sheet on mobile. Default = right-align + clamp.
- **BUG-048 scroll-lock scope.** Recommended default: a shared body scroll-lock applied by the modal/overlay shell while any overlay is open, plus stop-propagation on inner scroll containers. Applies to all pickers, not just the one reported.

## The three reports
- **BUG-047** (Jay, desktop 1348x909, `/snowboarding/feed`, replay `S-05` offset 1850s): the add-connections popover opens below the comments section and off-screen; user must scroll to find it. Expected a centered modal.
- **BUG-048** (Cory, iPhone 414x790, `/snowboarding/profile`, replay `S-06` offset 374s): popups with scrolling lists are hard to use because the inner list and the background page both scroll; the page behind the popup scrolls. Expected the background scroll locked while a popup is open.
- **BUG-049** (Cory, iPhone 414x750, `/snowboarding/profile`, replay `S-06` offset 2054s, screenshot `19ec7e74f0c719ca__0__bug-screenshot.jpg` shows entries clipped at the right edge): the community switcher pull-down is clipped off the right edge on mobile.

## Suspected files (verified present)
- `src/components/feed/add-connections-popover.tsx`: BUG-047. Rendered from `src/components/feed/story-card.tsx`.
- `src/components/ui/nav/community-switcher.tsx`: BUG-049 (also surfaced via `src/components/ui/nav.tsx`).
- The shared modal/overlay shell(s) under `src/components/ui/` (the pickers and modals such as `add-claim-modal.tsx`, `add-entity-modal.tsx`, `add-story-modal.tsx`): BUG-048 scroll-lock. Look for a common modal wrapper; if there is no shared shell, add a small `useBodyScrollLock` hook and apply it where overlays mount.

## Implementation order
1. **BUG-048 scroll-lock first (shared win).** Add a `useBodyScrollLock(open)` hook (set `document.body.style.overflow = 'hidden'` on mount/open, restore on unmount/close; guard for iOS with position handling if needed). Apply it in the shared modal shell, or in each overlay if no shell exists. Ensure inner scroll containers have their own `overflow-y:auto` and the page does not scroll behind. This also reduces the symptom in BUG-047 and BUG-049.
2. **BUG-047 popover to centered modal.** Convert `AddConnectionsPopover` to render through a centered overlay/portal (reuse the bug-report modal pattern) so it is always in view regardless of card length. Keep its content and the "I was there" fast path unchanged.
3. **BUG-049 dropdown clamp.** Right-align the community switcher menu to its trigger and clamp `max-width` to the viewport (with safe-area / horizontal padding) so entries are not clipped at the right edge on a 414px screen.

## Acceptance criteria
- BUG-047: the add-connections popover opens centered and fully in view on desktop and mobile, not below the comments.
- BUG-048: while any popup/modal is open, the background page does not scroll; the inner list scrolls normally.
- BUG-049: the community switcher dropdown opens fully within a 414px viewport with no right-edge clipping.
- No regression to existing modals (they still open, close, and submit). `npx tsc --noEmit` clean.

## Notes
- Pure client/CSS. No migration, no API, no `_public` view.
- No em dashes. Append a `status: pending` SHIP-LOG entry naming BUG-047, BUG-048, BUG-049 before closing.
