# Bug-fix session brief: brand-page CTA consistency + redundant website button + modal close affordance (BUG-144 + BUG-145 + BUG-146 + BUG-147)

> Drafted by the August 19, 2026 EVENING daily triage. Self-contained.
> **Supersedes `bugs/archive/2026-07-05-brand-button-and-modal-polish.md`**, which was
> re-verified against current `main` today and found materially stale: every line number
> had moved, the "Visit Site" button no longer exists under that name, and the BUG-146
> premise (blue buttons with a pencil glyph) was overtaken by the brand-colour CTA system.
> That brief is archived. This one replaces it.
>
> **P2, client-only.** Button styling, a redundant-CTA removal, and a modal close
> affordance. No data, no migration, no auth, no `_public` view.
> Run this HUMAN-REVIEWED: it touches the brand surface, which is the partner-facing page.
> Name the BUG ids (BUG-144, BUG-145, BUG-146, BUG-147) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping, then run the full Ship sequence.

## Scope

- **BUG-144:** on a brand page in light mode the "+ Add a claim" button renders white; other add buttons across the app are near-black. [P2] [reproducible]
- **BUG-145:** the website button on non-curated brand pages is redundant next to the blue weblink text that already appears twice on the same page. [P2] [reproducible]
- **BUG-146:** the three brand "Contribute a story" CTAs are inconsistent with each other. [P2] [reproducible] **Premise changed since July 5, see DECISIONS 3.**
- **BUG-147:** the add-claim and edit-claim modals have no top-right X close; with the on-screen keyboard up the bottom Cancel is unreachable. [P2] [enhancement]

One-line goal: the brand page's three story CTAs agree with each other, the add-a-claim button stops reading as white-on-white in light mode, non-curated brands drop the duplicate website button, and both claim modals can be closed from a persistent top-right X.

## DECISIONS (review before building)

**1. BUG-144 target colour. Recommended default: theme-token dark, not the hardcoded hex.**
Use `bg-foreground text-background hover:opacity-90` on the CTA-row "+ Add a claim" button.
In light mode `--foreground` is `#1C1917`, so this renders the exact near-black the reporter
expects and matches `bg-[#1C1917] text-white` used on the auth and admin buttons. In dark mode
it inverts to `#F6F6F5` on `#161413` instead of going near-invisible, which the literal
`bg-[#1C1917]` would do. `bg-foreground` is already in use as a button treatment at
`src/app/compare/page.tsx:612`, so this is not a new pattern.
_Alternative:_ copy `bg-[#1C1917] text-white hover:bg-[#292524]` verbatim for exact parity with
the auth pages, accepting that it reads poorly in dark mode.

**2. BUG-144 second instance. Recommended default: leave it alone.**
There is a second "+ Add a claim" at `page.tsx:1455` in the sidebar empty-state card. It uses
`bg-surface-hover` (a quiet tertiary treatment) and was not what the reporter photographed.
Changing both would put two near-black buttons on one screen.
_Alternative:_ restyle both for strict consistency.

**3. BUG-146 has moved. Recommended default: drop the glyph, keep the label and the brand colour.**
The July 5 decision was "restyle the blue pencil buttons to the standard purple Add Story
treatment and rename to Add Story". **That decision is now wrong.** All three CTAs already share
`style={{ background: ctaColor }}` where `ctaColor = brandButtonColor(org.brand_color)`, a
deliberate brand-colour system added by the brand-page redesign. Forcing them to purple would
undo that. The residual real inconsistency is narrower: only the CTA-row instance
(`page.tsx:596`) carries the `✎` glyph; the other two (`808`, `950`) are text-only.
So: **remove the `✎` span at line 596** so all three read identically as "Contribute a story"
in the brand colour. The July 5 "detached icon" symptom is already gone (the glyph is inside
the button box in the current tree), so there is nothing to fix there.
_Alternative A:_ add the glyph to the other two instead of removing it from the first.
_Alternative B:_ rename all three to "Add Story" for cross-app label parity, keeping the brand
colour. This is a copy call, not a styling one; flag it to Jay rather than deciding in code.

**4. BUG-145 gate. Recommended default: hide the website button on non-curated brands.**
The page already computes `const isCurated = org.curation_tier === "curated" || org.curation_tier === "founding"`
at `page.tsx:569`. Wrap the CTA-row website link (`page.tsx:604-613`) in `isCurated &&` so it
shows only on curated and founding brand pages, where it is a promoted partner CTA. The two
plain weblink text renders (`761-768` in the header block, `1385-1394` in the details rail)
stay untouched on every tier, so a non-curated brand still has a working outbound link twice.
_Alternative:_ remove the button on all tiers, including curated.

**5. BUG-147 sweep width. Recommended default: two modals only.**
Add the header X to `add-claim-modal.tsx` and `edit-claim-modal.tsx`, mirroring `AddStoryModal`.
Do not sweep every modal in the app in this PR.
_Alternative:_ audit and fix all modals lacking a close X.

## Reports (July 4 to 5, screenshots in the Linestry Bug Attachments Drive folder)

- **BUG-144:** July 4, 19:07 UTC, Cory (R1), iPhone 414x750, `https://linestry.com/snowboarding/brands/Barfoot`. "In a brand page. In light mode. This add a claim button is white. Mostly all add buttons are usually black (excluding the purple add a story)." Screenshot `19f2e874c23a48da__0__bug-screenshot.jpg`. Replay `S-31`, offset 1736s.
- **BUG-145:** July 4, 19:11 UTC, same session, same page. "For non curated brands the 'Visit Site' button is redundant as mostly throughout the site a blue text depicting web link is typically understood as a web link." Screenshot `19f2e8ae327c421f__0__bug-screenshot.jpg`. Replay same, offset 1937s. Note the button is labelled "Visit website" in the current tree, not "Visit Site".
- **BUG-146:** July 5, 00:26 UTC, same reporter, from `/snowboarding/stories`. "these buttons Contribute a Story are blue with a pencil icon, make these purple, change the text to Add Story. Also the 2nd contribute button, the icon is separated from the button." Screenshot `19f2fab0edde484c__0__bug-screenshot.jpg`. Replay `S-32`.
- **BUG-147:** July 5, 00:35 UTC, same session, `/snowboarding/brands/Barfoot`. "this add a story popup has a X button in upper right corner to close whereas most all other popups do not have. The keyboard covering the bottom makes access to the cancel button even more difficult." Screenshot `19f2fb3b8f8422db__0__bug-screenshot.jpg`. Replay same, offset 2640s.

## Verified facts (re-grepped against the live repo August 19, 2026)

1. Brand page: `src/app/(community)/[community]/brands/[slug]/page.tsx`, 1481 lines, last touched August 3.
2. `const ctaColor = brandButtonColor(org.brand_color)` at **line 425**. Applied at lines 593, 693, 792, 805, 947. The comment above it (line 420) states the intent: brand-filled buttons, null falls back to the Linestry accent.
3. The three "Contribute a story" CTAs: **line 596** (CTA row, carries `<span aria-hidden>✎</span>`), **line 808** (under-hero strip, text only), **line 950** (section CTA, text only). All three call `handleContribute` and all three are brand-coloured. The glyph at 596 is the only one, and it renders inside the button box.
4. The CTA-row "+ Add a claim" is at **line 602**, classed `text-foreground border border-border-default bg-background`. `--background` is `#FFFFFF` in light mode, which is the reported white button. The second instance at **line 1455** uses `bg-surface-hover`.
5. The website button is at **lines 604 to 613**, labelled `<span aria-hidden>↗</span> Visit website`, rendered under `{org.website && (`. It is an `<a>`, not a `<button>`.
6. `isCurated` is already computed at **line 569** as `org.curation_tier === "curated" || org.curation_tier === "founding"`. Reuse it; do not invent an `is_curated` field.
7. Duplicate weblink renders that must survive: **761-768** (header block, `{org.website.replace(...)} ↗`) and **1385-1394** (details rail, "Website" label plus link).
8. `AddStoryModal` renders its close X at `src/components/ui/add-story-modal.tsx:283`: `<button onClick={onClose} className="text-muted hover:text-foreground transition-colors text-xl leading-none">×</button>`. Copy this exact treatment.
9. `add-claim-modal.tsx`: header block at **lines 770 to 774** (`<h2>Add to your linestry</h2>` plus a subtitle `<p>`), no X. Backdrop close at line 766, footer Cancel at line 1213. The header is `px-6 pt-5 pb-4 border-b border-border-default flex-shrink-0`; make it a flex row with the X on the right rather than adding an absolutely positioned overlay.
10. `edit-claim-modal.tsx`: header block at **lines 83 to 91** inside a `p-6` card, no X. Backdrop close at line 79, footer Cancel at line 197. Same treatment.
11. **There is no shared `Button` component** in `src/components/ui/`. Every button is inline-classed. Do not create one in this PR; that is a design-system task tracked separately in `docs/design-system.md`.
12. `--foreground` is `#1C1917` (light) / `#F6F6F5` (dark); `--background` is `#FFFFFF` / `#161413`. Both are exposed to Tailwind via the `@theme inline` block in `src/app/globals.css`, so `bg-foreground` and `text-background` are valid classes.
13. None of these buttons sit inside a `.postcard`, so the forced-light-theme gotcha does not apply.

## Suggested order

1. **BUG-144** (one class swap at line 602). Smallest change, verifies the theme-token approach renders correctly in both themes before anything else moves.
2. **BUG-146** (remove the `✎` span at line 596). One-line deletion; confirm all three CTAs now read identically.
3. **BUG-145** (wrap lines 604-613 in `isCurated &&`). Test on a curated brand and a non-curated brand. Barfoot is the reporter's non-curated example.
4. **BUG-147** (X close on both claim modals). Largest of the four; two files, same pattern twice.

## Acceptance

- **BUG-144:** the CTA-row "+ Add a claim" on a brand page is near-black with light text in light mode, and legible (inverted, not near-invisible) in dark mode. The sidebar instance at line 1455 is unchanged.
- **BUG-146:** all three "Contribute a story" CTAs render identically: brand-coloured fill, no glyph, same label. `ctaColor` is still applied to all three (the brand-colour system is not undone).
- **BUG-145:** a non-curated brand page (Barfoot) shows no "Visit website" button in the CTA row, and still shows the weblink text in the header block and the details rail. A curated or founding brand page still shows the button.
- **BUG-147:** `add-claim-modal` and `edit-claim-modal` each show a persistent top-right X that calls `onClose`. Verified reachable at 414px with a soft keyboard raised, without scrolling to the footer. The existing backdrop-click and footer Cancel both still work.
- `npx tsc --noEmit` clean. Client-only. **No migration this session.**

## Pre-flight

- Pull `main` first: it advanced eight PRs today (#195 to #203) and one of them (#195) touched category-page intro cards. `git -C ~/lineage pull`.
- Run `npm run dev` from `~/lineage` for the smoke.
- Smoke URLs: `/snowboarding/brands/Barfoot` (non-curated), plus any brand with `curation_tier` of `curated` or `founding` for the BUG-145 positive case. Toggle light and dark for BUG-144.
- No SQL. No `_public` view rebuild. No column added, so the merge-before-migration gate does not apply.

## Standing rules

One PR, all four BUG ids in the title. No em dashes anywhere, including in any UI copy you write. Run the full Ship sequence before wrapping and state "No migration this session" explicitly. Append the SHIP-LOG entry with `status: merged` once you merge. The `bugs/` folder is gitignored; do not commit it.
