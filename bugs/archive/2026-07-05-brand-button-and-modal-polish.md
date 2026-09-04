# Bug-fix session brief: brand-page button consistency + Visit Site cleanup + modal close affordance (BUG-144 + BUG-145 + BUG-146 + BUG-147)

> Drafted by the July 5, 2026 daily triage. Self-contained.
> **P2, client-only.** Button styling, a redundant-CTA removal, and a modal close
> affordance; no data, no migration, no auth. Design decisions are LOCKED by Jay
> (July 5), so this is now build-ready with no open questions; run it HUMAN-REVIEWED
> since it touches the brand surface.
> Name the BUG ids (BUG-144, BUG-145, BUG-146, BUG-147) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-144: On a brand page in light mode, the "Add a claim" button renders white; other add buttons are dark (the purple Add-Story button excepted).** [P2] [reproducible]
- **BUG-145: The "Visit Site" button on NON-curated brand pages is redundant next to the blue weblink text.** [P2] [reproducible]
- **BUG-146: The brand "Contribute a story" CTAs are blue with a `✎` glyph; they should match the standard purple "Add Story" style/label. One of them also has its icon detached from the button box (a layout bug).** [P2] [reproducible]
- **BUG-147: The Add-Story modal has a top-right X close, but the add-claim / edit-claim modals do not; with the on-screen keyboard up the bottom Cancel is unreachable.** [P2] [enhancement]

One-line goal: brand-page add/contribute buttons match the rest of the app, non-curated brand pages drop the redundant Visit Site button, and every large modal can be closed from a persistent top-right X.

## DECISIONS (LOCKED by Jay, July 5, 2026)

1. **BUG-146 restyle target: LOCKED.** Restyle the brand "Contribute a story" CTAs to the standard **purple Add-Story** treatment (same colour token + icon) and **rename the label to "Add Story"** for full consistency with the Add-Story button used elsewhere. Also fix the detached-icon button so the glyph sits inside the button box.
2. **BUG-144 target colour: LOCKED.** Route the brand "Add a claim" button through the same **solid dark** add-button class the other add-a-claim buttons use, so it is dark in light mode and correct in dark mode.
3. **BUG-145 Visit Site button: LOCKED.** **Remove** the "Visit Site" button on **non-curated** brand pages (keep the blue weblink text link as the only link). **Keep** the Visit Site button on **curated** brand pages, where it is a promoted CTA. Gate on the brand's curated flag.
4. **BUG-147 scope: LOCKED.** Add the top-right X close to the **add-claim and edit-claim modals** (mirror `AddStoryModal`), the two the reporter is hitting behind the keyboard. Do not sweep every modal in this PR.

## Reports (July 4 to 5, screenshots in Linestry Bug Attachments)

- BUG-144: July 4 19:07 UTC, Cory (R1), iPhone 414x750, `https://linestry.com/snowboarding/brands/Barfoot`. "In a brand page. In light mode. This add a claim button is white. Mostly all add buttons are usually black (excluding the purple add a story)." Screenshot `19f2e874c23a48da__0__bug-screenshot.jpg`. Replay `S-31`, offset 1736s.
- BUG-145: July 4 19:11 UTC, same Cory iPhone session, `https://linestry.com/snowboarding/brands/Barfoot`. "For non curated brands the 'Visit Site' button is redundant as mostly throughout the site a blue text depicting web link is typically understood as a web link." Screenshot `19f2e8ae327c421f__0__bug-screenshot.jpg`. Replay `S-31`, offset 1937s.
- BUG-146: July 5 00:26 UTC, same Cory iPhone session, reported from `/snowboarding/stories`. "these buttons Contribute a Story ... are blue with a pencil icon ... make these ... purple ... change the text to Add Story ... Also the 2nd contribute button, the icon is separated from the button." Screenshot `19f2fab0edde484c__0__bug-screenshot.jpg`. Replay `S-32`, offset 2018s.
- BUG-147: July 5 00:35 UTC, same session, `/snowboarding/brands/Barfoot`. "this add a story popup has a X button in upper right corner to close whereas most all other popups do not have ... The keyboard covering the bottom makes access to the cancel button even more difficult." Screenshot `19f2fb3b8f8422db__0__bug-screenshot.jpg`. Replay `S-32`, offset 2640s.

## Verified facts (checked against the live repo July 5)

1. Brand page is `src/app/(community)/[community]/brands/[slug]/page.tsx`. "Contribute a story" CTAs are at ~lines 583-587 (`<span aria-hidden>✎</span> Contribute a story`), ~795-799, and ~937-941; `handleContribute` opens the story composer. These use a blue treatment, not the purple Add-Story style. The detached-icon report is likely one of these where the `✎` span wraps outside the button on a narrow width; check the flex/inline layout.
2. "+ Add a claim" buttons on the same page are at ~lines 593 and 1444; these are the BUG-144 white-in-light-mode buttons.
2a. The "Visit Site" button (BUG-145) is on the same brand page; find it near the brand header/weblink render. Gate its display on the brand's curated flag: show only when the brand is curated, otherwise render just the weblink text link. Confirm the exact curated flag on the brand/org record (e.g. an `is_curated` / curated-status field the page already reads to decide the curated layout) and reuse it, do not introduce a new one.
3. `AddStoryModal` (`src/components/ui/add-story-modal.tsx:281`) already renders a top-right `×` close button in its header (`<button onClick={onClose} ...>×</button>`). The add-claim and edit-claim modals (`src/components/ui/add-claim-modal.tsx`, `src/components/ui/edit-claim-modal.tsx`) do not; copy the same header X pattern. Note PR #156 (BUG-136) just top-aligned the add-claim modal with a `dvh` max-height, so the header is now reliably visible for the X to sit in.
4. The standard purple Add-Story button style is the shared treatment used elsewhere; match its colour token and icon rather than re-inventing.

## Suggested order

1. BUG-144: swap the brand Add-a-claim button class to the shared solid-dark add-button token.
2. BUG-146: restyle the three Contribute-a-story CTAs to the purple Add-Story treatment + label "Add Story"; fix the detached-icon button layout.
3. BUG-145: gate the Visit Site button on the curated flag (show on curated brands, hide on non-curated, keep the weblink text link).
4. BUG-147: add the top-right X close to add-claim and edit-claim modals, matching AddStoryModal.

## Acceptance

- BUG-144: the brand Add-a-claim button is a solid dark button in light mode and correct in dark mode.
- BUG-145: a non-curated brand page shows no Visit Site button (weblink text link remains); a curated brand page still shows the Visit Site button.
- BUG-146: the brand Contribute-a-story CTAs match the standard purple Add-Story button (colour, icon, label "Add Story"); no icon sits outside its button box.
- BUG-147: the add-claim and edit-claim modals show a persistent top-right X that closes them without scrolling past the keyboard.
- `npx tsc --noEmit` clean. Client-only, no migration.

## Standing rules

One PR, all four BUG ids in the title. No em dashes anywhere. Run the full Ship sequence before wrapping ("No migration this session" applies). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
