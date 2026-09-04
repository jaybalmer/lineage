# Bug-fix brief: Board drill-down tiles do not show the large cover image (BUG-095)

> Self-contained, diagnosis-first. Drafted June 22, 2026 by the daily triage; the live repo was grepped. HUMAN-RUN recommended: the most likely root cause may be a missing Vercel env var (`SERPER_API_KEY`) rather than a code defect, so diagnose before changing code, and the fix may be an ops change plus a small fallback improvement.

## Goal

On a brand drill-down (e.g. `/snowboarding/boards?brand=Arbor`) the large product-tile cover images do not render, even though the smaller brand-index card thumbnail (and the board detail page) do show an image. Make the large tiles resolve the same cover the other surfaces resolve.

## Scope

- **BUG-095** (P2): large board cover images are missing on the brand drill-down product tiles; the smaller brand-card thumbnail and the board detail page show the image.

## DECISIONS (review before building)

1. **Config vs code first.** Recommended default: DIAGNOSE before editing. Confirm whether `SERPER_API_KEY` is set in the Vercel production environment. If the drill-down tiles depend on the auto-cover (Serper) path and the key is unset in prod, the tiles fall back to the grey mark while community/stored images (used by the brand index card) still resolve. If that is the cause, the fix is setting the env var (ops, no code) plus optionally widening the tiles to use the same community-image source the brand index uses. Default = diagnose first; do not blind-edit the cover component.
2. **Cover-source parity.** If it is a code path divergence (the tiles are not fed the bulk community-image map the brand index uses), recommended default: feed the drill-down tiles the same `GET /api/board-image/list` community-image map (the `overrideUrl` path) the brand index card uses, so a community/stored image resolves on the large tile too. Default = unify the tile cover source with the brand-index source.

## Verified suspected files / symbols (grepped on live main)

- `src/app/(community)/[community]/boards/page.tsx` (the boards catalog + brand drill-down; renders the large product tiles).
- `src/app/(community)/[community]/boards/board-parts.tsx` (extracted presentational pieces incl. `BoardCover` and the brand index card; per PR #99/#103/#104 history).
- `src/hooks/use-board-image.ts` (`useBoardImage` per-board cover probe; localStorage-cached 7 days; `clearBoardImageCache`).
- `src/app/api/board-image/list/route.ts` (`GET /api/board-image/list`: fresh board_id -> community image map for the whole catalog, loaded once per mount, NOT localStorage-cached; this is the source the brand index card uses per PR #104).
- `src/app/(community)/[community]/boards/[id]/page.tsx` (board detail page; resolves its own `displayImageUrl` and can fetch `/api/board-image` live with the source/credit per PR #106).

### Diagnosis steps (do these first)
1. Confirm the failing surface: the brand drill-down LARGE tiles (not the brand index card strip). Reproduce on Arbor.
2. Determine each surface's cover source:
   - Brand index card strip and the bulk map: `GET /api/board-image/list` (community/stored images), loaded once per mount, ranked curated-first (PR #104). This is the "smaller thumbnail" that works.
   - Board detail page: live `/api/board-image` (Serper) with credit, OR the stored/community image (PR #106/#107).
   - Brand drill-down large tiles: confirm whether they use `useBoardImage` (per-board, localStorage-cached, leans on Serper auto-cover) or the bulk community map. If they rely on the Serper auto-cover, they need `SERPER_API_KEY`.
3. Check `SERPER_API_KEY` in Vercel prod (PR #108 note: "auto covers + watermark only appear where SERPER_API_KEY is set (localhost today; needs the Vercel env var)"). If unset, that is the likely cause for boards with no community/stored image.

### Fix (after diagnosis)
- If env: set `SERPER_API_KEY` in Vercel prod (ops; Jay), and confirm the tiles populate. Optionally also feed the tiles the bulk community-image map so community uploads show regardless of the Serper key.
- If code: pass the `GET /api/board-image/list` `overrideUrl` map into the large tiles' `BoardCover` (mirroring the brand index card), so a community/stored image resolves on the large tile; keep the grey-mark fallback for genuinely image-less boards.

## Acceptance criteria

- BUG-095: the large board cover renders on the brand drill-down product tiles wherever it renders on the brand index card / board detail page (same source); boards with no image anywhere still fall back to the grey mark; no broken-image icon.
- If the resolution is an env change, note it in the PR / SHIP-LOG and confirm in prod; if code, `npx tsc --noEmit` clean.

## Notes / guardrails

- HUMAN-RUN / diagnosis-first: the root cause may be a missing Vercel env var, not a code defect. Do not blind-edit `BoardCover`; confirm the cover source per surface first.
- No migration, no `_public` view, no auth/payments expected.
- Name **BUG-095** in the PR title or commit message (the daily reconcile greps for the id). If the fix is env-only with no PR, note it under the BUG-095 Shipped/closed line so the reconcile can record it.
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end if a PR ships. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
