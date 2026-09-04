# Bug-fix brief: landing hero mobile CTA above the fold (BUG-017)

> Auto-drafted by the daily triage on 2026-06-14. Build-ready on the recommended default below.
> One PR. Name BUG-017 in the PR title. Mobile landing-page layout.

## Goal
Surface the primary "Start Your Timeline" CTA in the first mobile screen so a visitor sees the action without scrolling.

## Scope
- **BUG-017** on a 414px mobile viewport the "Start Your Timeline" CTA sits below the fold, hidden behind the wordmark, three nav rows, headline, two paragraphs, and the bordered snowboarding card. The CTA only appears after scrolling.

## DECISIONS (review before building)
1. **How to lift the CTA (mobile).** Recommended default: tighten the stacked hero copy on small viewports (reduce the paragraph block and/or the snowboarding card top margin) and move the primary "Start Your Timeline" + "Browse Snowboarding" actions up so they paint in the first screen at 414px. Keep the large Linestry wordmark. Alternative: add a compact sticky/primary CTA in the hero on mobile only, leaving the existing in-card buttons where they are.

## Verified suspected files (from CLAUDE.md + session log)
- `src/app/page.tsx` (landing hero, rewritten Session 19 / June 7 as the user-as-hero layout with the snowboarding card and the auth-aware primary CTA: "My Timeline" -> `/snowboarding/profile` when signed in, else "Start Your Timeline" -> `/onboarding`; secondary "Browse Snowboarding" -> `/snowboarding`).
- The fix is layout order / spacing on the mobile breakpoint only; do not change desktop. Preserve the auth-aware CTA target logic.
- Screenshots reviewed (Linestry Bug Attachments): `19ea8aa98fe1c9bc__0__image0.png` (first screen, no CTA visible) and `19ea8aa98fe1c9bc__1__image1.png` (scrolled, CTA + cards appear).

## Acceptance
- On a 414px mobile viewport the "Start Your Timeline" CTA is visible without scrolling (or otherwise surfaced prominently in the first hero screen). Desktop layout unchanged. Auth-aware CTA target preserved. 0px horizontal overflow at 375px and 414px.

## Suggested order
1. Reproduce at 414px, identify the blocks pushing the CTA down.
2. Tighten mobile spacing / reorder so the CTA paints in the first screen.
3. Verify desktop is byte-for-byte unchanged.

## Notes
No migration, no write path. `npx tsc --noEmit` clean. One PR, BUG-017 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
