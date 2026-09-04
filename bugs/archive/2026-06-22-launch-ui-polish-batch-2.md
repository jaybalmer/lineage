# Bug-fix brief: Launch UI polish batch 2 (BUG-094 + BUG-099 + BUG-100 + BUG-101)

> Self-contained, build-ready. Drafted June 22, 2026 by the daily triage; re-drafted June 23, 2026 to add BUG-100 (stack top-bar wordmark font) and BUG-101 (collective subtitle year). The live repo was grepped for every named file/symbol. Four unrelated client-only UI fixes bundled into one PR. Auto-merge eligible on the recommended defaults (no migration, no `_public` view, no auth/payments; render/component/copy only).

## Goal

Four launch-facing polish items: sort the brand-page events list fully chronologically (1989 currently appended at the bottom), make the member/tier badge on the Riders list match the membership page (icon, colour, label), render the stack/timeline top-bar "Linestry" wordmark in the canonical Calendula wordmark font (it is in Geologica), and correct the collective-timeline subtitle so its start year matches the graph (says 1983, graph starts 1979).

## Scope

- **BUG-094** (P2): the brand-page events list is mis-sorted; a 1989 instance sits below the ascending 1990 to 1997 run.
- **BUG-099** (P2): the member badge on `/people` (and the avatar dropdown) is inconsistent with the membership page (single diamond vs outlined diamond, orange vs purple, "Member" vs "Lifetime").
- **BUG-100** (P2): on the stack / timeline top bar (the public-profile view shown on `/people/[id]`), the "Linestry" wordmark renders in the display font (Geologica), not the canonical Calendula wordmark font used in the main nav, so it looks off-brand next to the rest of the site.
- **BUG-101** (P2): the collective-timeline subtitle reads "1983-present" but the graph (and its pre-dataset baseline) starts at 1979, so the year range is wrong.

## DECISIONS (review before building)

1. **BUG-094 sort order.** Recommended default: sort the brand-page events strictly by event year ascending (oldest first), so 1989 leads 1990. The screenshot shows 1990 to 1997 ascending then 1989, i.e. the intended order is ascending and 1989 is the outlier. Default = full chronological ascending by event year.
2. **BUG-099 canonical badge.** Recommended default: the membership page is canonical (Cory's ask). Route the Riders-list row badge and the avatar-dropdown tier badge through one shared badge component that uses the membership-page icon set, the tier colour map, and the per-tier label (Founding, Lifetime, Annual, Free). Default = single shared badge, membership-page treatment; do not redesign the membership badge itself.
3. **BUG-100 wordmark font.** Recommended default: change the top-bar wordmark `fontFamily` from `var(--font-display)` to `var(--font-wordmark)` so it matches the nav wordmark (`src/components/ui/nav.tsx` line 56). The mark itself (`<BrandMark>`) is already correct. Default = swap the font token only; do not resize or recolour.
4. **BUG-101 subtitle year.** Recommended default: change the hardcoded "1983" in the subtitle to "1979" so it matches the chart baseline (`1979` is the pre-dataset baseline in `DATA_YEARS`). Alternative (Cory's suggestion): remove the year range from the subheader entirely. Default = correct the year to 1979 (keeps the context, smallest change); if Jay prefers, drop the range.

## Verified suspected files / symbols (grepped on live main)

### BUG-094 (brand-page events sort)
- `src/app/(community)/[community]/brands/[slug]/page.tsx` (the brand detail page; the same file resolves the org and renders its events/instances; the BUG-083 fix touched the org resolver near line ~385).
  - Find where the brand's events/instances array is built and ordered before render. Lead hypothesis: the list is ordered by insertion / `created_at` / a string year, or a comparator that places a year it cannot parse at the end, so the 1989 instance is appended rather than chronologically placed.
  - Fix: sort by the numeric event year ascending. Reuse the shared date helpers if the page imports them (`dateToSortNum` / partial-date handling from `timeline-grouping.ts`, BUG-010 single-sourced) rather than a fresh parse, so a partial/edge date sorts correctly. Confirm the events come from `catalog.events` filtered to this org and that every instance has a usable year before sorting.

### BUG-099 (member/tier badge consistency)
- Surfaces that render a member/tier badge, drifting because each is ad hoc:
  - Riders list rows: `src/app/people/page.tsx` (the screenshot shows "Sean Balmer + Founding", "Cory Yip ... Member").
  - Avatar dropdown tier badge: `src/components/ui/nav.tsx` (the dropdown shows "Cory Yip / LIFETIME").
  - Membership page badge (canonical): `src/app/account/membership/page.tsx`.
  - Confirm whether a shared badge already exists (grep for `Founding` / `Lifetime` badge JSX and any `member-badge` / `tier-badge` component). If one exists, point the Riders list + dropdown at it; if not, extract a small shared `MemberBadge` (props: tier) from the membership-page treatment and use it on all three surfaces.
  - The tier colour map should follow the existing tokens; do not invent new colours. Label per tier: Founding, Lifetime, Annual, Free (Free may render no badge, matching the membership page).

### BUG-100 (stack/timeline top-bar wordmark font)
- `src/components/public-timeline/public-profile-view.tsx` lines 40 to 42: the top-bar brand lockup renders `<BrandMark size={22} color={dark ? "#ffffff" : "#3b82f6"} />` then `<span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>Linestry</span>`. The wordmark uses `var(--font-display)` (Geologica) instead of `var(--font-wordmark)` (Calendula Bold).
  - Canonical reference: `src/components/ui/nav.tsx` line 56 renders the wordmark as `<span className="font-black text-xl text-foreground tracking-tight" style={{ fontFamily: "var(--font-wordmark)" }}>Linestry</span>`.
  - Fix: change line 41's `fontFamily: "var(--font-display)"` to `"var(--font-wordmark)"`. Leave the `<BrandMark>` and the sizing alone. Do NOT touch the other `var(--font-display)` usages in this folder (`stack-entry-card.tsx` line 70 year, `public-timeline.tsx` line 352 decade, `stack-header.tsx` line 91): those are heading/year display type, which is correctly Geologica; only the "Linestry" wordmark on line 41 (and, if present, the same wordmark on the "Powered by Linestry" footer at lines 80 to 81 / 140 to 141, which currently use no explicit font, leave as-is unless Jay wants them Calendula too) is in scope.

### BUG-101 (collective subtitle year)
- `src/app/(community)/[community]/collective/page.tsx` line 429: the subtitle renders `// snowboarding · 1983–present` (inside a `<div style={{ fontSize: 10, letterSpacing: 2, color: "#78716C" }}>`). The "1983" is hardcoded.
  - Chart baseline is 1979: `DATA_YEARS` includes `1979,  // pre-dataset baseline` (line 112) and the scrubber renders a `'79` tick, so the true earliest year on the graph is 1979, not 1983.
  - Fix (default): change the hardcoded `1983` to `1979` in the subtitle string. Note the existing string uses an en dash glyph (`1983–present`); when editing, render it as a hyphen (`1979-present`) to honour the no-em-dash / no-fancy-dash house rule. Alternative: remove the `1983–present` range from the subtitle entirely per Cory's suggestion.

## Implementation order (suggested)

1. BUG-101 (collective subtitle), single string on line 429. Smallest.
2. BUG-100 (top-bar wordmark font), single prop on `public-profile-view.tsx` line 41.
3. BUG-094 (brand events sort), single comparator on the brand page; verify with Westbeach (1989 should lead).
4. BUG-099 (shared badge), confirm/extract the shared badge, then repoint the Riders list + avatar dropdown; verify a lifetime member shows the same badge on `/people`, the dropdown, and `/account/membership`.
5. `npx tsc --noEmit` clean. Smoke at 414px: Westbeach events run 1989 -> 1997; the lifetime badge matches across the three surfaces; the stack top-bar "Linestry" wordmark matches the nav wordmark; the collective subtitle reads "1979-present".

## Acceptance criteria

- BUG-094: the brand-page events list is fully chronological (1989 sorts before 1990); no instance is appended out of order.
- BUG-099: the member/tier badge (icon, colour, label) is consistent across the Riders list, the avatar dropdown, and the membership page, following the membership-page treatment.
- BUG-100: the stack / timeline top-bar "Linestry" wordmark renders in `var(--font-wordmark)` (Calendula), matching the main nav wordmark; the brand mark and other display-type headings in the stack view are unchanged.
- BUG-101: the collective-timeline subtitle reads "1979-present" (or has the year range removed per the override); no hardcoded "1983" remains in the subtitle.
- `npx tsc --noEmit` clean.

## Notes / guardrails

- Auto-merge eligible: client-only, no migration, no `_public` view, no auth/payments. If BUG-099's badge turns out to be driven by membership data shapes that differ per surface (e.g. the dropdown reads `membership.tier` while the list reads a catalog flag), keep the visual treatment shared even if the data source differs, and note any data mismatch found.
- Name **BUG-094**, **BUG-099**, **BUG-100**, **BUG-101** in the PR title or commit message (the daily reconcile greps for the ids).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
