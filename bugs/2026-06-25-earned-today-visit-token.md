# Bug-fix brief: "Earned Today" bar does not reflect the daily "Showing up" token

Date: 2026-06-25
BUG ids in scope: BUG-108
Run type: diagnosis-first (carries a small UX decision); HUMAN-RUN recommended (touches the token-feedback surface)
Estimated: ~30-45 min

## Goal
Resolve the mismatch a member sees on `/account/membership`: the "Earned Today" bar reads "0/20 tokens" while the expanded breakdown lists "Showing up +1 token". The daily visit token is earned but the headline number reads zero, which looks like the token did not register.

## DECISIONS (review before building; recommended default shown)
This is partly intended behaviour, so pick the presentation rather than a raw sum change:
- The daily "Showing up" (`daily_visit`) token is deliberately OUTSIDE the content cap (verified: `src/components/ui/daily-token-chip.tsx` line ~166 "Showing up and onboarding sit outside the cap", and line ~136 comment). So `total_earned_today` / the `X / cap` bar intentionally excludes it.
- D1 (recommended default): keep the cap bar fill driven by content tokens, but make the visit token legible at the headline level so "Earned Today" never reads 0 when a token was earned. Options, in order of preference: (a) show a small "+1 showing up" chip next to the "X / cap" number when `visit_awarded_today` is true; (b) relabel so the cap bar reads as a content-cap meter (e.g. keep "X / cap" but ensure the "Showing up today: +1 earned" line is always visible, not only in the expanded panel); (c) include the visit token in a separate "total today" figure shown above the cap meter.
- Alternative: fold the visit token into the `X / cap` number (simplest, but conflates the cap meter with out-of-cap earnings; not recommended).
Build on (a) unless Jay overrides.

## Verified facts
- `src/components/ui/daily-token-chip.tsx` renders the bar from `TokensToday` (`cap`, `visit_awarded_today`, `total_earned_today`, `visit_streak`). The bar shows `{earned} / {cap}` where `earned = data.total_earned_today`; `pct` fills off `earned / cap`.
- The breakdown row "Showing up" maps `source: "daily_visit"` (line ~35). The "Showing up today: +1 earned" status string is built at lines ~82-83.
- So when only the visit token was earned, `total_earned_today` is 0 (visit sits outside the cap) and the headline reads "0 / 20" while the breakdown still shows the +1. Confirm the data source (`/api/...tokens-today` or equivalent) returns `visit_awarded_today: true` with `total_earned_today: 0` in that state.

## Suspected files
- `src/components/ui/daily-token-chip.tsx` (headline number + label + breakdown visibility).
- The tokens-today data route that populates `TokensToday` (confirm field semantics; do not change the cap math).

## Acceptance criteria (BUG-108)
- On a day where only the "Showing up" visit token has been earned, the membership token surface does not read as "nothing earned": the +1 visit token is legible at the headline level per the chosen option, without expanding the breakdown.
- The content-cap meter (`X / cap`) still reflects content tokens only and the cap math is unchanged.
- No regression to the streak, the breakdown list, or the "outside the cap" copy.
- Client-only; `npx tsc --noEmit` clean; no migration.

## Ship
- One PR, branch `bugfix/bug-108-earned-today-visit-token`. Name BUG-108 in the title/commit.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-108`, `migration: none`).
