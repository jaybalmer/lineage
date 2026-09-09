# Build brief: /me/tags entry scroll reset (BUG-150)

> Drafted by the July 7, 2026 daily triage. Self-contained; start from this file.
> Scope: **BUG-150** only. P2, client-only, no migration, no `_public` view, no auth surface.
> PIPELINE-SAFE on the recommended default below (a mount-time scroll reset is deterministic and harmless), though a quick real-device check on iPhone Safari is the ideal close-out.

---

## DECISIONS (review before building)

1. **Fix mechanism.** RECOMMENDED DEFAULT: add an explicit scroll-to-top on `/me/tags` mount (`useEffect(() => { window.scrollTo(0, 0) }, [])` near the top of `MeTagsPage`). This fixes the symptom regardless of which restoration mechanism fires (bfcache, App Router back-nav restoration, or a stale body-scroll-lock restore). ALTERNATIVE: make the page header + status chips sticky under the main nav so a restored scroll position no longer hides them (larger change, affects layout, not recommended for this pass).
2. **Scope of the reset.** RECOMMENDED DEFAULT: `/me/tags` only (the reported surface). ALTERNATIVE: apply the same reset to the other `/me/settings/*` pages that share MeSubNav. Do NOT sweep sitewide in this session; if other pages get reports, they join a later batch.

No other open decisions.

---

## Bug in scope

### BUG-150: /me/tags opens at a remembered scroll position, sub-headers out of view (P2)
- Reported July 5, 22:54 UTC by Cory (R1), iPhone Safari 414x750, on `https://linestry.com/me/tags`.
- Symptom: "The Tag screen remembers the last scroll position so you can enter the page with the subheaders hidden and out of view." Entering the Tags inbox lands mid-page; the "Your tags" header, the status filter chips (Pending / Approved / Declined / Disabled), and the MeSubNav row sit above the viewport. Only the sticky main nav remains visible, so the page reads as headerless.
- Session replay: PostHog session `S-34`, offset 497 seconds. Screenshot in Drive: `19f347dc61cc93a8__0__bug-screenshot.jpg` (shows the correct top state for reference).

## Goal (one line)

Entering `/me/tags` always lands at the top of the page with the header and filter chips visible, without disturbing the MeSubNav horizontal-centering behavior.

## Verified facts (checked against the live repo July 7)

- `src/app/me/tags/page.tsx` is a `"use client"` page (`MeTagsPage`); it contains NO scroll handling of any kind.
- The only sticky chrome is the main nav: `src/components/ui/nav.tsx:136` (`sticky top-0 z-50`). The MeSubNav row and the page header are plain flow content and scroll away.
- `src/components/ui/me-subnav.tsx` has a mount effect that sets `scroller.scrollLeft` only (deliberately horizontal-only; its comment says it avoids vertical scroll side effects). Do not touch this; it is the PR #92 fix for BUG-073.
- `src/lib/use-body-scroll-lock.ts:42` runs `window.scrollTo(0, savedScrollY)` on unlock. `/me/tags` mounts `DeclineModal` and `ReportTagModal` (both imported in `page.tsx`), and the global bug-report widget also locks body scroll. A stale `savedScrollY` restore is one candidate mechanism; iOS Safari bfcache / App Router back-nav restoration is the other. The default fix does not require distinguishing them.
- There are no `#anchor` deep links into `/me/tags` (nothing to break with a mount-time reset). The comment-email permalink pattern (`?focus=`) targets the stories index, not this page.

## Suggested implementation

1. In `src/app/me/tags/page.tsx`, add a top-of-component mount effect:
   `useEffect(() => { window.scrollTo(0, 0) }, [])`
   (Pseudocode-honest note: exact placement is next to the existing `useEffect` imports already in the file; no new imports needed.)
2. If the replay (offset 497s) clearly shows the scroll jump happening AFTER a modal close rather than on navigation entry, ALSO guard `use-body-scroll-lock.ts` against restoring a `savedScrollY` captured on a different pathname (store the pathname alongside `savedScrollY`, skip the restore on mismatch). This is optional hardening; only do it if the replay confirms that mechanism, and keep it minimal.

## Acceptance criteria

- BUG-150: on iPhone Safari (or devtools mobile emulation), scroll down on `/me/tags`, navigate away, re-enter via the avatar-dropdown "Tags" link: the page opens at the top with "Your tags" and the status chips visible. Repeat via browser back-navigation: same result.
- The MeSubNav horizontal centering of the active tab still works (select an off-screen tab at 414px; the row centers it; no vertical jump).
- Opening and closing the Decline modal and the Report modal returns the user to the scroll position they were at (the body-scroll-lock restore still works for the in-page case).
- `npx tsc --noEmit` clean.

## Pre/post-deploy SQL

None. No migration, no DB reads or writes change.

## Session close-out

- One PR. Name **BUG-150** in the PR title or commit message (the daily reconcile matches on it).
- Append a `bugs/SHIP-LOG.md` entry per the schema at the top of that file (`type: bug`, `ids: BUG-150`, `migration: none`); follow the full Ship sequence in the repo CLAUDE.md before wrapping.
- No em dashes anywhere in code, comments, or copy.
