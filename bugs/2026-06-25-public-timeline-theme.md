# Bug-fix brief: public stack / timeline view renders light when it previously read dark

Date: 2026-06-25
BUG ids in scope: BUG-113
Run type: diagnosis-first; HUMAN-RUN recommended (could be intended behaviour)
Estimated: ~30-45 min

## Goal
On `/people/cory_yip` in the stack/timeline view, the surface now renders in a light theme; the reporter says it previously showed a dark theme and the layout/format changed. Determine whether this is a regression or intended, then either restore the prior treatment or close as intended.

## Verified facts / surfaces
- The public timeline / stack surface lives in `src/components/public-timeline/`: `public-profile-view.tsx`, `public-timeline.tsx`, `stack-view.tsx`, `stack-entry-card.tsx`, `stack-header.tsx`, `stack-timeline-toggle.tsx`.
- The app's card surfaces use the `.postcard` pattern, which intentionally forces light-theme tokens even in dark mode (documented in the codebase CLAUDE.md, "Postcard pattern" + gotcha 7). So a light card look on this surface may be by-design, not a regression.
- Screenshot `19efc41260234fba__0__bug-screenshot.jpg` shows Cory's public profile in stack/timeline mode rendering light ("Cory Yip / Snowboarding since 2002 / 2020s / WORKED AT 2026 / Powered by Linestry / Start your own timeline").

## Diagnosis steps (do before changing code)
1. Check git history on `src/components/public-timeline/*` for a recent change that flipped the surface (or its container) from dark to forced-light (e.g. a `.postcard` class added to the page wrapper, or a removed `dark` context). `git log -p --since="2026-06-10" -- src/components/public-timeline/` and the `/people/[id]` page wrapper.
2. Determine the intended treatment: is the chromeless public timeline meant to follow the viewer's theme (dark/light), or is it deliberately light (postcard / share-card aesthetic)? The `/t/[slug]` chromeless route is the design precedent; compare it.

## DECISIONS (recommended default)
- If a recent change unintentionally forced the whole surface light: restore the prior theme-aware behaviour (follow the viewer's dark/light), keeping individual `.postcard` cards as-is.
- If the light treatment is intended (postcard / share aesthetic): close BUG-113 as working-as-intended with a one-line note, and (optional) make sure the top chrome (header/wordmark) is consistent so it does not read as half-broken.
Recommended default: treat a full-surface flip to light as a regression and restore theme-awareness for the surface chrome, unless the diagnosis shows it was always light.

## Acceptance criteria (BUG-113)
- The public stack/timeline surface renders consistently with its intended theme (either restored dark-aware, or documented-intended light with consistent chrome); it does not read as a half-applied theme.
- No regression to `/t/[slug]` or the in-app person timeline.
- Client-only; `npx tsc --noEmit` clean; no migration.

## Ship
- One PR (if a code change results), branch `bugfix/bug-113-public-timeline-theme`. Name BUG-113 in the title/commit.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-113`, `migration: none`). If the outcome is wont-fix/intended, record the close in the triage instead.
