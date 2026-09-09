# Bug-fix brief: report-bug popup buttons unreliable on mobile (BUG-071)

> Auto-drafted by the June 17 PM daily triage from one June 17 report (Cory, R1, iPhone Safari 414x750, `/snowboarding/events`, 06:03 UTC). No image.
> DIAGNOSIS-FIRST. One PR. Name BUG-071 in the PR title. This is the in-app feedback channel, so worth a quick mobile-Safari touch pass.

## Goal
On mobile Safari, the report-bug popup's Cancel, Attach-screenshot, and Send buttons must respond reliably to a single tap.

## Symptom
The reporter says the bug-reporting popup "has some issues registering the cancel and send button and attach screen shot button" on mobile.

## Diagnosis-first
`src/components/ui/report-bug-modal.tsx`:
- Cancel: `onClick={onClose}` (line ~241), always enabled.
- Attach: `onClick={() => fileInputRef.current?.click()}` (line ~230), always enabled.
- Send: `onClick={handleSend}` (line ~248), `disabled={!canSend}` where `canSend = note.trim().length > 0` (line ~95).
- Note: Send is intentionally disabled until a note is typed, which can read as "not registering" if the user expects it live before typing. But Cancel and Attach are always enabled, so unreliable taps on THOSE point at a real touch/overlay issue, not the disabled state.

Lead hypotheses (verify on a real device / replay before changing code):
1. An overlay layer above the buttons intercepting taps (a backdrop with `pointer-events`, or a stacking/`z-index` issue). The overlay-positioning pass (BUG-047/048/049, PR #80) is adjacent; check the modal's backdrop/scroll-lock interaction.
2. Hit targets too small for touch on a 414px screen (the buttons are small `text-xs` / `text-sm` controls); iOS Safari needs adequately sized tap targets.
3. The file input / `fileInputRef.click()` not firing reliably in mobile Safari (a known iOS quirk if the input is `display:none` vs visually hidden, or if the click is not from a direct user gesture).

## Suspected files
- `src/components/ui/report-bug-modal.tsx` (the modal, its buttons, backdrop, and `fileInputRef`).
- Whatever renders/positions it (the overlay/portal wrapper). Cross-check the recent overlay-positioning work for the backdrop pattern.

## Recommended direction (after diagnosis)
- If overlay/pointer-events: ensure the modal's interactive layer sits above the backdrop and the backdrop does not capture taps meant for the buttons.
- If hit targets: enlarge the tap targets (min ~44px) and spacing for Cancel/Attach/Send on mobile.
- If the file input: make the hidden input visually-hidden (not `display:none`) and ensure the click is a direct gesture.

## Acceptance
- On mobile Safari, Cancel, Attach, and Send (once a note is entered) all respond to a single tap; hit targets are adequate; no overlay intercepts taps. Desktop unaffected. `npx tsc --noEmit` clean.

## Notes
No migration, no write path (client-only). Likely auto-merge-safe once diagnosed, but verify on a real device first, so human-run is recommended. One PR, BUG-071 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
