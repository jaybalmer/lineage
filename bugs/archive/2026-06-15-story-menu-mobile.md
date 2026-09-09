# Bug-fix brief: Story owner edit/delete menu invisible on mobile (BUG-044)

> Build-ready. Self-contained. Drafted June 15, 2026 by the daily triage. Root cause verified. Name **BUG-044** in the PR title or commit message.

## Goal
On touch devices, the story owner's edit/delete affordance (the ⋯ menu trigger) must be visible on stories they own, so they know they can edit or delete. Desktop behavior stays the same (or also visible).

## DECISIONS (review before building)
One styling choice, with a recommended default:
- **How to reveal it on touch.** Recommended default: gate the hover-reveal behind `@media (hover: hover)` so pointer devices keep the on-hover reveal and touch devices always show the trigger (at a muted but visible opacity). Alternative: make the trigger always visible everywhere (drop the hover-reveal entirely). Either is acceptable; the default keeps the desktop look unchanged.

## Root cause (verified)
The ⋯ owner menu trigger in `src/components/feed/story-card.tsx:271` is styled:

```
className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all text-lg leading-none px-1"
```

`opacity-0 group-hover:opacity-100` means the trigger only appears on mouse hover. Touch devices have no hover state, so the control is permanently at opacity 0 and the owner can never open edit/delete on mobile. The ⋯ character renders at line 274.

## Suspected files (verified present)
- `src/components/feed/story-card.tsx` (line 271, the trigger button className).

## Implementation order
1. In `story-card.tsx`, change the trigger so it is visible on non-hover (touch) devices. Recommended: replace the unconditional `opacity-0 group-hover:opacity-100` with a hover-aware rule, for example a small utility or inline `@media (hover: hover)` so that:
   - on `hover: hover` (mouse): keep `opacity-0` idle and reveal on `group-hover`.
   - on `hover: none` (touch): render at a visible muted opacity (for example `opacity-60` or `opacity-100`).
   If a Tailwind-only approach is cleaner, use the `hover-hover:`/`hover-none:` pattern or a tiny CSS rule in `globals.css`; do not pull in new deps.
2. Verify the menu still opens on tap and the edit/delete actions work (they already exist; this is only about the trigger's visibility).

## Acceptance criteria
- On a touch viewport (414px), the ⋯ trigger is visible on a story the viewer owns, and tapping it opens the edit/delete menu.
- On desktop, the trigger behaves as before (hover-reveal) or is also visible; no regression to non-owner cards (no ⋯ shown to non-owners).
- `npx tsc --noEmit` clean.

## Notes
- Pure client/CSS. No migration, no API, no `_public` view.
- Cory reported this from `/snowboarding/profile`, iPhone Safari 414x750. Replay `S-04` offset 4497s. Screenshot `19ec792bcd900793__0__bug-screenshot.jpg`.
- No em dashes. Append a `status: pending` SHIP-LOG entry naming BUG-044 before closing.
