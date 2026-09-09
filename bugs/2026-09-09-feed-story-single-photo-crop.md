# Bug-fix brief: single vertical story photo is cropped in the feed card

**Date:** September 9, 2026
**BUG ids in scope:** BUG-191 (P2)
**One-line goal:** A story with a single photo should show the whole image in the feed card, including tall/portrait photos, instead of being cropped to a landscape box.

---

## DECISIONS (review before building)

1. **Single-photo layout = natural aspect capped by a max height (recommended default).** For the one-photo case, drop the fixed `aspect-[16/9]` box and let the image render at its own aspect ratio, capped with a max height (for example `max-h-[560px]`) and centered, so portrait photos show in full and very tall photos do not dominate the feed. Keep `object-cover` only for the multi-photo grid tiles (those are an intentional collage and should stay square).
   - Alternative A: keep the fixed box but switch the single image to `object-contain` with a neutral background. Shows the whole image but adds letterbox bars on portrait photos. Acceptable, less clean.
   - Alternative B: cap height and use `object-cover` with a taller portrait aspect. Still crops wide images. Not recommended.

2. **Scope to the feed/timeline story card only (recommended default).** Fix `src/components/feed/story-card.tsx`. Do not touch the multi-photo grid, the lightbox (which already shows the full image), or the YouTube embed block.

---

## Background and verified root cause

Report (BUG-191): "The story picture is cropped in the timeline card, and I expected to be able to see the whole picture. Image is a vertical image, so expected to see all of it." From OWNER, on `https://linestry.com/snowboarding/feed`, viewport 1566x895 (desktop Chrome on macOS). Screenshot attached.

Screenshot reviewed (Drive: `1a081fede97af06b__0__bug-screenshot.jpg`, in "Linestry Bug Attachments"). It shows the feed story card "1996: The Air by Ingemar Backman" (the Backman backside air shot), a tall vertical photo, clipped top and bottom inside a landscape card image area.

Cause is verified, no diagnosis needed:

- `src/components/feed/story-card.tsx` renders story photos in a grid (block starts ~line 444).
- For the single-photo case the tile is forced to `aspect-[16/9]` (story-card.tsx:459: `photos.length === 1 ? "aspect-[16/9]" : "aspect-square"`).
- The `<img>` uses `object-cover` (story-card.tsx:466: `className="w-full h-full object-cover ..."`).
- `aspect-[16/9]` + `object-cover` on a portrait source crops the top and bottom to fill the landscape box, which is exactly what the reporter saw.

## Severity

P2. Cosmetic / presentational. The whole image is still reachable via the lightbox (tap opens `setLightboxIdx`), so nothing is lost, but vertical photos look wrong in the card and this is a launch-facing surface members see constantly.

---

## Suspected files (verified against tip f0cc660)

- `src/components/feed/story-card.tsx`: photo grid block ~lines 444-472. The single-photo branch at line 459 (`aspect-[16/9]`) and the `object-cover` at line 466 are the two lines to change. ONLY surface in scope.
- Note the deliberate patterns nearby to preserve: the multi-photo grid counts (BUG-080 comment at lines 447-452) and the `+N` overflow badge (line 468) must stay as-is. The lightbox (`photos[lightboxIdx]`, ~line 744) already shows the full image; do not change it.

---

## Acceptance criteria (BUG-191)

1. A story with a single portrait (vertical) photo shows the entire image in the feed card, not cropped top/bottom.
2. A story with a single landscape photo still looks correct (no awkward stretching; natural aspect within the max-height cap).
3. Very tall images are capped at a sensible max height so one photo does not fill the whole viewport.
4. Multi-photo stories (2, 3, 4, 5+) are unchanged: square grid tiles, same counts, same `+N` overflow badge.
5. The lightbox still opens on click and shows the full image.
6. `npx tsc --noEmit` clean. No layout overflow at 375px or at desktop width.

---

## Suggested implementation order

1. In the single-photo branch, replace the fixed `aspect-[16/9]` wrapper with a container that allows natural height and applies a max height (for example `max-h-[560px]`), keeping `overflow-hidden` and the rounded corners.
2. For the single image, use `object-contain` (or render the natural image height with `w-full h-auto` and `object-cover` removed) so the full frame shows; keep the hover scale transition if it still looks right, or drop it for the single case if it causes clipping.
3. Leave the multi-photo tiles on `aspect-square object-cover`.
4. `npx tsc --noEmit`, then eyeball one portrait story and one landscape story in the feed at desktop and at 375px.

---

## Wrap reminders

- Name BUG-191 in the PR title / commit message so the daily triage reconcile can close it.
- Append a `bugs/SHIP-LOG.md` entry: `type: bugfix`, `ids: BUG-191`, the PR number, `migration: none`, `status:` per what shipped.
- PIPELINE-SAFE: one client file, no data, no migration, no auth. Auto-merge eligible.
- No em dashes anywhere.
