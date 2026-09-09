# Bug-fix session brief: remove the "Shared" visibility trap + fix the add-claim popup on short viewports (BUG-140 + BUG-136)

> Drafted by the July 4, 2026 daily triage. Self-contained.
> **P2, client-only, PIPELINE-SAFE (auto-merge eligible on the defaults below):** no
> migration, no `_public` view, no auth/payments/memberships/backfill. Render, copy, and layout only.
> Name the BUG ids (BUG-140, BUG-136) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-140: The "Shared / Connections" visibility option still exists in the add-claim and edit-claim modals.** [P2] [reproducible] [root cause verified]. PR #154 removed this option from the profile editor because "shared" is unimplemented at the data layer and silently hides the item; two claim pickers still offer it.
- **BUG-136: The "Add to Your Linestry" claim popup sits too high, clips its title, and cannot be scrolled on a short viewport.** [P2] [reproducible] [overlay-positioning family].

One-line goal: stop the add-claim/edit-claim modals from offering the invisibility-causing "Shared" option, and make the add-claim modal usable (title visible, scrollable) at short mobile heights.

## DECISIONS (review before building)

1. BUG-140 scope. Recommended: remove the "shared" entry from the visibility picker in BOTH `add-claim-modal.tsx` and `edit-claim-modal.tsx`, leaving Only Me + Public (mirrors PR #154 on the profile editor). Keep the `PrivacyLevel` type value `"shared"` so existing rows and type references stay valid. Alternative: also implement "shared" properly; out of scope, much larger.
2. BUG-140 existing rows. Recommended: do NOT backfill this session (no migration, keep it pipeline-safe). Flag for Jay: a one-off `update claims set visibility='public' where visibility='shared'` could un-hide any claims already set to shared, but that is a data decision, not required to stop new traps. Leave it as a note in the SHIP-LOG/PR body.
3. BUG-136 mechanism. Recommended: give the add-claim modal container a viewport-bounded height (`max-h-[100dvh]` / `max-h-[90vh]` on the panel) with an internal `overflow-y-auto` scroll region and top alignment (`items-start` + small top padding) so the "Add to Your Linestry" header stays on-screen when the keyboard raises. Alternative: only reduce the top offset; does not fix the no-scroll case, so not preferred.

## Reports (July 4, iPhone Safari, screenshots in Linestry Bug Attachments, not opened this run)

- BUG-140: 04:40 UTC, Cory (R1), 414x750, `https://linestry.com/people/cory_yip`. "Here is another place that has the Shared option button that may cause issues." Screenshot `19f2b6dd1ad05e79__0__bug-screenshot.jpg`. Replay session `S-28`, offset 5834s.
- BUG-136: 03:58 UTC, Cory, 414x485, `https://linestry.com/people/cory_yip`. "Make a claim popup is sitting too high in the make a claim screen and the title cannot be seen which is Add To Your Linestry. Popup cannot be scrolled." Screenshot `19f2b46baa97dd57__0__bug-screenshot.jpg`. Replay session `019f2b13-...`, offset 3208s. The 414x485 viewport indicates the on-screen keyboard was raised.

## Verified facts (checked against the live repo July 4)

1. BUG-140: the "shared" option is still listed in two pickers:
   - `src/components/ui/add-claim-modal.tsx:1175` renders a visibility choice `{ v: "shared", icon: "👥" }` in the options array.
   - `src/components/ui/edit-claim-modal.tsx:21` defines `{ value: "shared", label: "Shared", icon: "👥" }` in its options list.
   Both write `claims.visibility`. The read side treats `visibility === "shared"` as a distinct (unimplemented) state: `src/components/timeline/claim-card.tsx:119` and `src/components/feed/post-card.tsx:698` branch on it, and `claims_public` does not surface shared rows the way public rows are surfaced, so a claim set to Shared silently drops out of public reads (the same trap PR #154 fixed on profiles). Removing the option from the two pickers is the fix; leave the type value intact.
2. PR #154 precedent: it removed the "Shared / Connections" button from the profile editor and kept the `PrivacyLevel` union member `"shared"` so existing rows/refs stayed valid, correcting Cory's row to public out of band. Mirror that approach here (minus the out-of-band data fix, which is decision 2).
3. BUG-136: the modal is `src/components/ui/add-claim-modal.tsx` (title copy "Add to Your Linestry"). It is the same overlay-positioning class as the shipped pass BUG-047/048/049 (archived `2026-06-15-overlay-positioning-pass.md`): confirm the panel is not vertically centered without a max-height (which pushes the header above the fold when the content is tall or the keyboard shrinks the viewport) and that there is no inner scroll region. Fix with a bounded-height + `overflow-y-auto` panel, top-aligned.

## Suggested order

1. BUG-140 (delete two option entries; verify no other picker lists "shared" via `grep -rn '"shared"' src/components/ui/*claim*`).
2. BUG-136 (panel height + scroll region on the add-claim modal; test at 414x485 with the keyboard up).

## Acceptance

- BUG-140: neither the add-claim nor the edit-claim modal offers a Shared/Connections choice; both show Only Me + Public; `grep -rn "value: \"shared\"\|v: \"shared\"" src/components/ui` returns nothing; existing rows and the `PrivacyLevel` type are unchanged; `tsc` clean.
- BUG-136: at 414x485 (and with the on-screen keyboard raised) the add-claim modal shows its "Add to Your Linestry" title and the whole form is reachable by scrolling inside the modal; desktop/tall-viewport behavior unchanged.
- `npx tsc --noEmit` clean. Client-only, no migration, no DB touch.

## Standing rules

One PR, both BUG ids in the title. No em dashes anywhere (including any copy you write). Run the full Ship sequence before wrapping ("No migration this session" applies; note the optional `visibility='shared'` backfill for Jay in the PR body). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
