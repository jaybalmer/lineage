# Curated brand page — primer for an improvements session

Orientation for a new Claude Code session working on the **curated/partner brand page**.
Shipped over PRs #120 (Phase 1 baseline), #122 (Phase 2 curated layer), #123 + #124
(admin fixes), all merged. Both migrations applied to prod. Start by telling the
session what you want to improve; this is the file map + the traps.

## The files

- **`src/app/(community)/[community]/brands/[slug]/page.tsx`** — THE brand page (one
  client component, `BrandPageInner`). The curated render is gated by `isCurated`
  (`curation_tier` is `'curated'` or `'founding'`). Key computed consts live just
  above the `return`: `isCurated`, `isFounding`, `tagline` (first line of the
  heritage statement), `milestones`, `media`, `brandLinks`, `featuredRiders`
  (resolved + filters out `privacy_level === 'private'`), and the shared
  `ctaButtons` / `statBlocks` (reused by both tiers so they never drift).
  - Curated sections are one `{isCurated && (…)}` block above the shared feed, in
    mockup order: **hero** (banner_url or brand-color gradient), CTA+stats under
    hero, **heritage** (dark block), **brand timeline** (spine), **the team**
    (rail from `featured_rider_ids`), **media & artifacts** grid, **contribute
    module** (prompt chips). The shared tabs/feed/sidebar follow; the sidebar gains
    a **"From {brand}"** `brand_links` card and the page foot a **provenance** line.
  - `AddBrandClaimModal` (top of the file) takes an optional `initial` mode/predicate
    used by the contribute chips.
- **`src/app/admin/brand/[id]/page.tsx`** — editor manage surface (`BrandEditor`).
  Form for every curated field. Resolves the org by **id OR slug**. Saves via
  `updateCatalogEntity("orgs", id, patch)`. Image uploads go straight to the
  Supabase **`board-images`** bucket (mirrors `/admin/community`), path
  `orgs/{id}-{kind}-{ts}`.
- **`src/app/admin/brand/page.tsx`** — brand picker index (searchable list).
- **`src/types/index.ts`** — `Org` interface. Curated fields: `curation_tier`,
  `heritage_statement`, `brand_milestones` (jsonb `{year,label}[]`),
  `featured_rider_ids` (`uuid[]`), `brand_media` (jsonb), `brand_links` (jsonb),
  `partner_label`, plus Phase 1's `brand_color`, `banner_url`.
- **`src/lib/utils.ts`** — `resolveBrandColor` (hex or `--accent` fallback),
  `whiteReadableOn` (white-text legibility), `brandButtonColor`.
- **Visual source of truth**: Drive `Brand/Westbeach-Brand-Page-Mockup.html`
  (toggle Standard vs Premium/curated). Seed content: `Brand/Westbeach-Page-Seed-Content.md`.

## Data model + how curation is set

- `curation_tier`: `'standard'` (default) renders only the Phase 1 header;
  `'curated'`/`'founding'` add the curated sections; `'founding'` adds the
  partner ribbon (`partner_label`).
- An editor sets it on **`/admin/brand/[id]` → "Page tier" toggle → Save** (not the
  community setup). Reach it from the editor-only "Manage page" link on a brand
  page, or `/admin/brand`.
- **Save path**: the generic `/api/admin` `update` op is `requireEditor`-gated,
  whitelists `orgs`, and passes arbitrary columns straight to `.update()`, so there
  is **no dedicated orgs route**. `orgs` load via `select("*")`, so a NEW column only
  needs to be added to the `Org` type to reach the page.

## Traps (these cost time if you rediscover them)

1. **Localhost reads the REAL prod DB even when signed out.** To verify a curated
   render locally you must inject curated fields via a **reverted page-level override**
   near the `[slug]` resolver (`org.id === '<id>' ? {…curated fields…} : org`), screenshot,
   then revert. Editing `mock-data.ts` is INERT (the page uses DB orgs).
2. **Preview screenshots of scrolled positions come back blank.** Resize the viewport
   tall (e.g. 1280x2360) and shoot at scroll 0 to capture the whole page.
3. **`innerText` uppercases section headers** (CSS `text-transform`). Assert on
   `textContent` in `preview_eval` checks, not `innerText`.
4. **Admin pages are editor-gated** (`requireEditorPage` via `src/app/admin/layout.tsx`).
   Anon redirects to `/auth/signin`, so the manage form can't be visually verified
   without an editor session (Jay has one — that is the smoke for editor write paths).
5. **Never string-concat a width Tailwind class onto `inputCls`** (it has `w-full`);
   use `cn()`/twMerge or the widths fight and `w-full` wins (the #124 milestone bug).
6. Standing rules: `npx tsc --noEmit` clean before commit; **no em dashes** anywhere;
   one PR per session; run the full Ship sequence (surface migration, wait for apply +
   merge, write `bugs/SHIP-LOG.md`).

## Recent ships (for `git log` context)
#120 Phase 1 (33bd717) · #122 Phase 2 (6ff0e85) · #123 slug+index (8ccfcd6) ·
#124 milestone layout + slug Manage link (48af3d5).
