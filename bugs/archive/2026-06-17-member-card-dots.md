# Bug-fix brief: confusing non-functional dots on the member card popup (BUG-062)

> Drafted by the June 17 daily triage from a June 17 report by Cory (R1), iPhone Safari, 414x750, screenshot reviewed.
> One PR. Name BUG-062 in the PR title. Client/UI, auto-merge eligible on the default.

## Goal
Stop the member card popup from showing a row of dots that read like non-functional page-scroll / pagination indicators and confuse the viewer.

## Scope
- **BUG-062** (P2): on `/snowboarding/profile`, opening the member card popup shows a row of dots that "look like page scroll dots but do not function." They are partially filled, so the viewer cannot tell what they represent. Reported by Cory, who was unsure of their meaning.

## Visual review
Screenshot `19ed31f62cbb3548__0__bug-screenshot.jpg` (in the Linestry Bug Attachments Drive folder) shows the Cory Yip member card: LIFETIME MEMBER, "Mt. Seymour Since 2002", the permanence line, and the Tokens / Riding since / Equity pool stat trio. A short row of small circles sits near the top of the card; they are static and partially filled, with no label, so they read as a broken carousel/pagination control rather than a meaningful indicator.

## DECISION (review before building; default is build-ready)
- **D1: remove vs label the dots.** Default: REMOVE the decorative dot row from the member card. It carries no information the viewer can decode and reads as broken UI; the card's meaning comes from the stats and the permanence copy, not the dots. Alternative (if the dots are intended to encode something, e.g. a tier or progress indicator): keep them but add a visible label or legend so their meaning is clear, and make sure their filled-state actually maps to real data.

## Verified suspected files (grepped against the live repo June 17)
- Member card popup is `src/components/ui/member-card-overlay.tsx`, opened from `/snowboarding/profile` (the "Share your card" / member card affordance) via `src/app/(community)/[community]/profile/page.tsx` and surfaced through `src/components/ClientOverlays.tsx`.
- The dot row is the strongest candidate at `src/components/ui/member-card-overlay.tsx` line ~245: `<div style={{ display: "flex", gap: 4, marginBottom: 28 }}>{Array.from({ length: 5 }).map((_, i) => ( ... ))}</div>` (a fixed 5-element row of small circles). Confirm this is the element the reporter saw (5 partially-filled dots near the top of the card) before removing. Note: the `spawnBurst` dots elsewhere in the same file (lines ~98 to 138) are the celebration burst animation, NOT this row; do not touch the burst.
- The shareable card body is `src/components/ui/rider-card.tsx` (rendered inside the overlay). The decorative warp-thread dots there (line ~58, the six `[[30,18]...]` positioned dots) are background texture on the card art, not the reported control; confirm against the screenshot which row the reporter means before editing.

## Acceptance
- The member card popup no longer shows an unlabeled, non-functional row of dots that reads as a broken scroll/pagination control (default: the dot row is gone, with no layout gap left behind).
- If the dots are kept per the alternative, their meaning is labeled and their filled state reflects real data.
- No regression to the card's share/celebration flow. `npx tsc --noEmit` clean.

## Suggested order
1. Reproduce on `/snowboarding/profile`, open the member card, confirm the exact dot row against the screenshot.
2. Apply the default (remove the row) or the alternative (label it), per Jay.
3. Verify the share-card and burst animation still work.

## Notes
No migration, client/UI only, auto-merge eligible on the default. `npx tsc --noEmit` clean. One PR, BUG-062 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
