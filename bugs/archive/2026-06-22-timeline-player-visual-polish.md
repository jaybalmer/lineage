# Bug-fix brief: Timeline player pass (BUG-097 + BUG-098 + BUG-102)

> Self-contained, build-ready. Drafted June 22, 2026 by the daily triage; re-drafted June 23, 2026 to add BUG-102 (a `worked_at` claim against a brand/org renders as "Unknown" on a player slide). The live repo was grepped (`src/components/ui/timeline-player.tsx`). Three client-only fixes on the shared timeline player, bundled into one PR. Auto-merge eligible (no migration, no `_public` view, no auth/payments; render + client name-resolution only). LEAD cluster: the player is a prominent launch-facing surface shown to every visitor and is the spine of the "share my timeline" loop.

## Goal

Fix three papercuts on the timeline player: the final-slide brand mark shows a black center dot on the dark slide (should be white), the play-surface vignette is slightly off-center on mobile, and a "Worked at" claim whose object is a brand/org renders its entity name as "Unknown".

## Scope

- **BUG-097** (P2): the final slide renders `<BrandMark>` with a black (ink) center dot on the dark ground; the contrast dot should be white.
- **BUG-098** (P2): the vignette overlay is slightly off-center on a mobile viewport.
- **BUG-102** (P2): on Cory's timeline, the "Worked at Linestry" claim (a `worked_at` against the self-created brand/org entity) shows the entity name as "Unknown" on its player slide; it should show the brand name.

## DECISIONS (review before building)

1. **BUG-097 dot color.** Recommended default: pass an explicit light/contrast `dotColor` (near-white, `#F6F6F5`) to the final-slide `<BrandMark>` so the center dot reads white on the dark slide, rather than relying on `var(--foreground)` (which resolves to ink because the player slide is dark-painted but not `.dark`-scoped). Alternative: wrap the slide in a `.dark` scope so every `var(--foreground)` flips. Default = pass the explicit light `dotColor` on the mark only (smallest, no risk to other tokens on the slide).
2. **BUG-098 vignette center.** Recommended default: center the vignette radial gradient at 50% 50% on a full-bleed overlay layer so it is symmetric on any viewport. Default = center the existing vignette layer; do not change its opacity/spread.
3. **BUG-102 org name resolution.** Recommended default: add a brand/org branch to the highlight-slide `entityName` resolver so an object with `object_type === "org"` is looked up in `catalog.orgs` (by `o.id === claim.object_id`, using `o.name`), before the existing place/event fallbacks. Default = add the org lookup; keep the `getEntityName(...)` final fallback for genuinely-missing ids.

## Verified suspected files / symbols (grepped on live main)

### BUG-097 (final-slide mark dot)
- `src/components/ui/timeline-player.tsx`
  - Line ~571: `<BrandMark size={72} color="#3b82f6" />` on the final slide. It passes `color` (blue body) but NO `dotColor`, so the dot falls back to `var(--foreground)`. The final slide is painted dark but is not inside a `.dark` scope, so `var(--foreground)` resolves to the light-theme ink (dark), giving the black dot Cory saw.
  - `BrandMark` is imported at line 7 (`@/components/ui/brand-mark`). Per the codebase `CLAUDE.md`, `<BrandMark>` accepts `dotColor` (and a `knockout` variant); the dot is a CONTRAST dot meant to read white on dark, ink on light.
  - Fix: pass `dotColor="#F6F6F5"` to the final-slide `<BrandMark>`. The personal and community players share this component, so the one change covers both play surfaces.

### BUG-098 (vignette centering)
- `src/components/ui/timeline-player.tsx`
  - Line ~760: `{/* Subtle vignette overlay */}` marks the vignette layer. Inspect the element just below: confirm its radial gradient center (`background: radial-gradient(... at <x> <y> ...)`) and whether the layer is full-bleed (`absolute inset-0`). If the gradient center is offset, or the layer is not full-bleed on mobile, the darkening looks off-center.
  - Fix: center the radial at `50% 50%` on a full-bleed `absolute inset-0` layer. Do not change the spread/opacity, only the centering. Verify on a 414px viewport and on desktop.

### BUG-102 (worked_at-org renders "Unknown")
- `src/components/ui/timeline-player.tsx`, the highlight-slide builder (around lines 62 to 83).
  - Line ~63: `highlights` filters claims to `["owned_board","rode_at","competed_at","worked_at"]`.
  - Lines ~66 to 72: `entityName` is resolved by a ternary on `claim.object_type`: `"board"` looks up `catalog.boards`; `"place"` looks up `catalog.places`; the ELSE branch looks up `catalog.events`. A `worked_at` claim whose object is a brand/org has `object_type === "org"`, so it is neither board nor place and falls into the events branch, which cannot find it in `catalog.events`, so it falls to `getEntityName(claim.object_id, claim.object_type)` and renders "Unknown".
  - Fix: add a branch for `claim.object_type === "org"` that resolves `catalog.orgs.find(o => o.id === claim.object_id)?.name` (with the `getEntityName(...)` fallback). Place it alongside the board/place/event branches.
  - Secondary (note, not required for the reported symptom): the stat-slide buckets at lines ~32 and ~63 lump `worked_at` object_ids into the "places" set regardless of object type, the same object-type-vs-predicate confusion BUG-092 fixed for the person-timeline filter (shipped via PR #118 with a `claimCategory()` helper that disambiguates `worked_at` by object type). If low-cost, a `worked_at`-against-org could be excluded from the places stat too; if it widens scope, leave it and just fix the "Unknown" name (the reported bug).

## Implementation order (suggested)

1. BUG-097 (final-slide `dotColor`), single prop near line 571.
2. BUG-098 (vignette centering), single layer below line 760.
3. BUG-102 (org branch in the `entityName` resolver), a few lines near 66 to 72.
4. `npx tsc --noEmit` clean. Smoke: play the timeline to the final slide on a 414px viewport (dark) and confirm a white center dot; confirm the vignette is symmetric; play Cory's timeline (`/people/cory_yip`) and confirm the "Worked at" slide shows the brand name, not "Unknown"; verify a light-ground use of `<BrandMark>` elsewhere is unchanged.

## Acceptance criteria

- BUG-097: the player's final-slide mark shows a white (contrast) center dot on the dark slide; light-ground mark usages are unchanged.
- BUG-098: the player vignette is centered on the play surface on mobile and unchanged on desktop.
- BUG-102: a `worked_at` (or any highlighted) claim whose object is a brand/org shows the brand name on its player slide, not "Unknown"; board/place/event highlight slides are unchanged.
- `npx tsc --noEmit` clean.

## Notes / guardrails

- Auto-merge eligible: client-only, no migration, no `_public` view, no auth/payments. Shared by personal + community play, so verify both still look right.
- Name **BUG-097**, **BUG-098**, **BUG-102** in the PR title or commit message (the daily reconcile greps for the ids).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
