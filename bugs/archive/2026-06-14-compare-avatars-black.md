# Bug-fix brief: Compare rendering pass (BUG-024 avatars black, BUG-067 names "Unknown")

> Auto-drafted by the daily triage on 2026-06-14; updated the June 17 PM run to add BUG-067. Build-ready; no open decisions.
> One PR. Name BUG-024 and BUG-067 in the PR title. Same surface (`/compare`), two independent rendering fixes.

## Goal
On `/compare`, rider avatars must show the portrait or readable initials (matching `/people`), and compared timeline entries must resolve to a name instead of rendering as "Unknown".

## Scope
- **BUG-024** on the Compare riders screen, every rider portrait / initials avatar renders as a solid black circle, in both the picker results and the dropdown lists. Other pages render initials (CY, BK, DW) fine.
- **BUG-067** in the timeline comparison view, entries whose subject is a ghost / catalog / duplicate person node (e.g. `cy_2`) render as "Unknown 2026" instead of the person's name. Screenshot `19ed4151fcb64347__0__bug-screenshot.jpg` shows one resolved row ("Grouse Mountain 2002") then five "Cy 2 / Unknown 2026" rows. Related to BUG-066 (the duplicate Cory data feeding these rows); this brief only fixes the rendering, not the data.

## DECISIONS
No open decisions. BUG-024: make `/compare` use the shared avatar treatment that works elsewhere. BUG-067: extend the compare name resolver to fall back to `catalog.people` for ghost/catalog ids before showing "Unknown".

## Verified suspected files (grepped 2026-06-14)
- `src/app/compare/page.tsx` (the Compare page with the two rider pickers and dropdowns).
- `src/components/ui/rider-avatar.tsx` (the shared avatar with the PB-008 visual ring system that renders correctly on `/people`).
- Likely cause: `/compare` renders a local avatar (or an initials fallback) whose foreground text matches the circle fill, or it is missing the shared `rider-avatar.tsx` treatment, so initials are dark-on-dark and read as a black circle. The `.postcard` / dark-mode token mismatch is a candidate (a forced light surface with a dark fill). Compare against `/people` (`src/app/people/page.tsx`), where the same people render initials correctly.
- Fix direction: point the compare pickers/dropdowns at `rider-avatar.tsx` (or fix the local fallback's foreground color) so initials/portrait are visible.
- Screenshot reviewed (Linestry Bug Attachments): `19eb061bb50e7f23__0__bug-screenshot.jpg` (Compare screen; no readable initials next to picker entries).

### BUG-067 (names render as "Unknown")
- `src/app/compare/page.tsx`: the picker pulls people from `profiles` (line ~422 `.select("id, display_name, ...")`) and line ~384 already carries a comment "falling back to the static mock-data arrays. Fixes 'Unknown' for DB entity IDs". The remaining "Unknown" is for compared claim subjects/objects that are ghost or catalog people NOT in the `profiles` fetch and NOT in mock-data (e.g. `cy_2`). `src/components/ui/compare-player.tsx` reads `personA.display_name` / `personB.display_name`.
- Fix direction: extend the name resolver compare uses so it also resolves from `catalog.people` (the loaded catalog array, which includes ghost/catalog nodes) before falling back to "Unknown". Mirror how `/people` and the timeline resolve names. Read-side only.
- Screenshot reviewed: `19ed4151fcb64347__0__bug-screenshot.jpg`.

## Acceptance
- **BUG-024:** rider avatars on `/compare` (pickers and dropdowns) show the portrait or readable initials, matching the treatment on `/people`. Check both light and dark themes.
- **BUG-067:** compared timeline entries show the rider/place name (or a sensible label) for ghost/catalog subjects, not "Unknown"; matches `/people` name resolution.

## Suggested order
1. BUG-024: reproduce on `/compare` at mobile width; confirm whether it uses `rider-avatar.tsx` or a local avatar; switch to the shared avatar (or fix the fallback foreground); verify against `/people`.
2. BUG-067: extend the compare name resolver to fall back to `catalog.people`; verify the previously-"Unknown" rows now show names.

## Notes
No migration, no write path: read-side rendering, auto-merge eligible. `npx tsc --noEmit` clean. One PR, BUG-024 and BUG-067 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
