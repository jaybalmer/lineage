# Bug-fix brief: Linestry.com brand-entity cluster + boards Back nav (BUG-083 + BUG-092 + BUG-082)

> Self-contained, build-ready, DIAGNOSIS-FIRST. Drafted June 19, 2026 by the daily triage with the live repo grepped; BUG-092 added June 20. Three navigation/surfacing issues. BUG-083 (P1) and BUG-092 (P2) both stem from the self-created "Linestry.com" org/brand entity behaving wrong on brand surfaces; BUG-082 is the paired boards Back-button papercut. Human-run recommended (verify the real link source, the category bucketing, and Back behaviour before changing routing); NOT auto-merge, because a wrong routing/categorisation change is easy to make and hard to catch in a screenshot. No migration expected.

## Goal

A brand link should open the brand detail page (not a 404), a brand `worked_at` claim should be filed under Brands (not Places) on the person timeline, and pressing browser Back after viewing a board should return to where the user came from.

## Scope

- **BUG-083** (P1): clicking a brand link 404s, e.g. "Linestry.com" goes to `/snowboarding/brands/Linestry_com` and errors.
- **BUG-092** (P2): a `worked_at` claim whose object is the "Linestry.com" brand is bucketed under the Places filter on the person timeline, not Brands.
- **BUG-082** (P2): browser Back does not return to the right page after viewing a board from the Boards area.

## DECISIONS (review before building)

1. **BUG-083 fix locus.** Recommended default: fix BOTH ends. (a) Route every brand link through the canonical helper so it emits the lowercase `orgSlug`, and (b) make the `[slug]` resolver tolerant of legacy/capitalised slugs (case-insensitive compare) so existing links and shared URLs still resolve. Alternative: fix only the link generator (leaves capitalised shared URLs broken). Default = fix both.
2. **BUG-092 bucket basis.** Recommended default: bucket a claim by the OBJECT entity type, not the predicate alone, so a `worked_at` whose object is an org/brand counts under Brands and a `worked_at` whose object is a place/resort/shop stays under Places. Alternative: leave it predicate-based (simpler, but mis-files every brand worked-at). Default = object-type-aware bucketing.
3. **BUG-082 Back target.** Recommended default: pressing Back from a board detail returns to the brand drill-down / list state the user was on. If the boards drill-down is pure component state (no history entry), the lightest fix is to reflect the drill-down level in the URL (a query param the page already reads, e.g. `?brand=`) so it becomes a real history entry. Alternative: intercept Back. Default = make the drill-down a URL state so native Back works.

## BUG-083: diagnosis pointers (verified on live main)

- The route that 404s: `src/app/(community)/[community]/brands/[slug]/page.tsx`.
  - Line 379: `const { community, slug } = use(params)`.
  - Line 385: `const org = allOrgs.find((o) => o.id === slug || orgSlug(o) === slug)`.
  - Line 387: `if (!org) notFound()`.
  - `orgSlug` is imported from `@/lib/mock-data` (line 8) and lower-cases + slugifies, so "Linestry.com" resolves to `linestry_com`. The inbound slug is `Linestry_com` (capital L), so neither branch matches and the page 404s.
- The bug is upstream in the LINK that produced `/brands/Linestry_com`. Grep the boards/brands catalog for an href built from the raw brand display name rather than the canonical helper:
  - `src/app/(community)/[community]/boards/page.tsx` and `board-parts.tsx`: the #99 redesign added a brand drill-down "View brand page" button / "link to /brands/[slug] when an org matches" (per the SHIP-LOG #99 entry). Find where that href is constructed. (Note: #105 changed the boards-page brand crumb to point at the boards list `?brand=`, but the "View brand page" link to the org page remains.)
  - `src/app/(community)/[community]/brands/page.tsx`: the brand cards link out too.
  - The canonical helper is `entityHref(org.id, "org", catalog)` from `src/lib/entity-links.ts` (which uses `orgSlug` and returns a community-unprefixed path to wrap in `<CommunityLink>`), or `orgSlug(org)` directly. Any link using `board.brand` (the display name) or a local name-to-slug with different casing is the culprit.
- Fix:
  - Route the offending link(s) through `entityHref` / `orgSlug` so they emit the lowercase canonical slug.
  - Add a case-insensitive fallback in the resolver, e.g. compare `orgSlug(o).toLowerCase() === slug.toLowerCase()` (and `o.id === slug`), so capitalised or legacy links still resolve. `useCanonicalPath` (line 386) already rewrites the address bar to the canonical slug once resolved.
- Data check: confirm the "Linestry.com" org actually exists in the catalog (it was self-created by Cory as a brand "Linestry.com Est. 2026"). If it exists, this is purely a slug-casing/link mismatch. If the org is somehow not in `allOrgs` for the brands route (community scoping), widen the lookup; note which it was in the PR.

## BUG-092: diagnosis pointers (verified on live main)

- Surface: the person timeline at `src/app/people/[id]/page.tsx`, the category filter chips (All / Riders / Places / Events / Boards / Brands) and their counts. Screenshot `19ee2ec0c93d01b9` shows "Linestry.com / Media Est. 2026 / WORKED AT 2026" rendering as a Brand card but counted under "Places 3" alongside the two real resorts.
- Lead hypothesis: the claim-to-category bucketing keys on the PREDICATE (`worked_at` maps to Places, which is right for resorts/shops) and does not look at the object entity type, so a `worked_at` against an org/brand falls under Places. Trace the predicate-to-category map / grouping used by the person-timeline filters; it may live in `src/app/people/[id]/page.tsx`, `src/components/feed/feed-view.tsx`, or a shared helper. Confirm where the filter count and the card grouping are computed (they should share one source).
- Fix (default): bucket by the resolved object entity type first (org/brand -> Brands, place -> Places, board -> Boards, event -> Events, person -> Riders), falling back to the predicate only when the object type is ambiguous. Verify a `worked_at` against a real resort/shop still counts under Places and the brand `worked_at` now counts under Brands. Read-side only, no migration.
- Note the entity-type label reads "Media" on the card (the org subtype) but the catalog type is an org/brand; make sure the bucket uses the org/brand classification, not the freeform subtype string.

## BUG-082: diagnosis pointers (verified on live main)

- `src/app/(community)/[community]/boards/page.tsx` holds the drill-down in component state: `selectedBrand` / `level` / the `?year=` seed, with `goAll` / `goBrands` handlers (lines ~264 to 316). The board detail is a separate route `/boards/[id]`. Note #105 already moved view/brand/year/search onto the URL for the nav-reset behaviour, so the drill-down may now be partly URL-driven; re-check current state before assuming it is pure component state.
- Lead hypothesis: when the user is in a brand drill-down and opens a board, Back returns to the boards ROOT (state reset to `level="all"`) rather than the brand drill-down, because the drill-down level was never a distinct history entry.
- Trace whether `goBrands` / brand selection do a `router.push`/`replace` (history entry) or just `setState`. If state-only, reflect the drill-down in the URL (a `?brand=<slug>` param the page reads on mount, mirroring the existing `?year=` seed at line 49) so each level is a real history entry and native Back restores it.
- Confirm on a real iPhone (the report is iPhone Safari): drill into a brand, open a board, press Back, and expect to land back in the brand drill-down.

## Implementation order (suggested)

1. BUG-083 first (the P1): find and fix the link source, add the case-insensitive resolver fallback, verify the "Linestry.com" brand now resolves and the address bar canonicalises.
2. BUG-092: make the person-timeline category bucket object-type-aware; verify the brand `worked_at` moves to Brands and real places stay under Places.
3. BUG-082: make the drill-down level a URL param so Back works; verify on mobile.
4. `npx tsc --noEmit` clean. Smoke: every brand card / "View brand page" link opens the brand detail (no 404), including self-created brands; the "Linestry.com" worked-at counts under Brands on `/people/cory_yip`; Back from a board returns to the brand drill-down.

## Acceptance criteria

- BUG-083: brand links (including self-created brands like "Linestry.com") resolve to the brand detail page, not a 404; capitalised/legacy slug shapes still resolve; the address bar shows the canonical slug.
- BUG-092: a `worked_at` (or any) claim whose object is an org/brand is counted and filtered under Brands, not Places, on the person timeline; genuine resort/shop places stay under Places.
- BUG-082: pressing Back after viewing a board returns to the brand drill-down / list the user came from.
- `npx tsc --noEmit` clean; no regression to the boards search, My Boards, or `?year=` seed.

## Notes / guardrails

- HUMAN-RUN recommended (routing + categorisation + real-device Back verification); NOT auto-merge.
- No migration expected. If diagnosis shows the org is missing from the brands-route catalog (a data/scoping issue rather than a slug mismatch), stop and note it; that is a different fix. Likewise if BUG-092 turns out to be a data issue (the claim object is genuinely typed as a place) rather than a bucketing rule, note it.
- Name **BUG-083**, **BUG-092**, and **BUG-082** in the PR title or commit message (the daily reconcile greps for the ids).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
