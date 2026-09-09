# Bug-fix brief: list-page label and count polish (BUG-016 + BUG-019 + BUG-021)

> Auto-drafted by the daily triage on 2026-06-14. Build-ready on the recommended defaults below.
> One PR. Name BUG-016, BUG-019, BUG-021 in the PR title. Small, launch-facing list-page copy fixes.

## Goal
Three small, independent label/count fixes on the People and Events list surfaces so copy stays stable and accurate.

## Scope
- **BUG-016** the category nav tab reads "Riders" until selected, then flips to "People".
- **BUG-019** the `/people` header says "25 riders in the community graph" but only 9 render.
- **BUG-021** event year labels render an uppercase trailing "S" ("1990S") instead of lowercase ("1990s").

## DECISIONS (review before building)
1. **Which noun for the tab (BUG-016).** Recommended default: keep the tab label constant as "Riders" in both idle and active states (do not let it swap to "People"). Alternative: standardize everything (tab, route header, page title) on "People". Note the standing product naming question (Riders vs People vs the deferred "Gear"-style rename); this fix only stops the label from changing on selection and does not settle that.
2. **How to reconcile the /people count (BUG-019).** Recommended default: make the header count match the number actually rendered in the graph (the stricter claimed/connected node set), so "N riders in the community graph" is truthful. Alternative: keep the full directory count but drop the "in the community graph" phrasing so the number is not claiming graph membership.

## Verified suspected files (grepped 2026-06-14)
- BUG-016: `src/components/ui/nav.tsx` Row 3 category tabs. The file already notes "the global defaults (People, not Riders)" around line 36 and has `onPeopleRoute` logic (lines 32-33); the active label is being derived from the route/page ("People") rather than the fixed nav label ("Riders"). Pin the rendered label to the constant nav label regardless of active state.
- BUG-019: `src/app/people/page.tsx` line ~315: `{totalCount} rider{totalCount !== 1 ? "s" : ""} in the community graph`. `totalCount` is the full directory length; the rendered graph node set is a smaller filtered list. Reconcile the displayed count to the graph node count (or reword per decision 2). (For reference, the brands page has the same "in the community graph" pattern at `src/app/(community)/[community]/brands/page.tsx:219`; out of scope unless trivially shared.)
- BUG-021: events surface decade/year-group labels. Most likely a CSS `text-transform: uppercase` (or a `.toUpperCase()`) applied to a header whose string already contains "1990s", rendering it "1990S". Shared decade grouping lives in `src/lib/timeline-grouping.ts` (`itemDecade` produces the decade string); the decade string itself is correct, so the fix is to stop uppercasing that specific label (preserve the trailing "s", or use small-caps), NOT to change the string. Check the events page group header component and any uppercase utility on decade labels.

## Acceptance
- BUG-016: the category tab shows the same label idle and active; selecting it no longer swaps "Riders" to "People".
- BUG-019: the rider count next to "community graph" matches the number of riders actually plotted (or the copy no longer implies a count the graph does not contain).
- BUG-021: plural-year labels on the events surface read "1990s" (lowercase trailing s), consistent with the rest of the site.

## Suggested order
1. BUG-021 (pure CSS/label, smallest).
2. BUG-016 (constant nav label).
3. BUG-019 (count reconcile per decision 2).

## Notes
No migration, no write path, no `_public` view. `npx tsc --noEmit` clean. One PR, BUG ids in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
