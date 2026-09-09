# Bug-fix brief: remove "My Timeline" from the community-landing lens row (BUG-053)

> Drafted from the June 16 Cowork decision session. Build-ready on the decision below.
> One PR. Name BUG-053 in the PR title. Client/UI, auto-merge eligible.

## Goal
Stop the "My Timeline" lens entry from confusing first-time visitors on the `/snowboarding` community landing, without removing the member's own timeline-management surface.

## Scope
- **BUG-053**: the community landing surfaces a "My Timeline" entry that reads as confusing to a first-time visitor. Jay asked to remove it for soft launch.

## DECISION (made by Jay, June 16)
Remove the "My Timeline" entry from the lens row (Row 2 nav: Community / Feed / My Timeline) in the community-landing context. Keep "My Timeline" where a signed-in member manages their own timeline (do not remove the member's access to their own timeline elsewhere). This is the lens-row element, not a separate CTA card.

## Verified suspected files (from CLAUDE.md + session log)
- `src/components/ui/nav.tsx` Row 2 (the lens row: Timeline / Compare / Connects / Feed / Collective; "My Timeline" lens as it appears on the community landing).
- Confirm the exact condition: hide the "My Timeline" lens entry when rendering the community-landing context, while a signed-in member's own timeline route and its access points remain intact.

## Acceptance
- "My Timeline" no longer appears in the lens row on the `/snowboarding` community landing.
- A signed-in member can still reach and manage their own timeline through their normal surfaces (no loss of access).
- No layout gap or misaligned row left behind.

## Suggested order
1. Reproduce on `/snowboarding`; confirm the lens-row "My Timeline" element.
2. Gate it out of the community-landing context only.
3. Verify the member's own-timeline access is unaffected elsewhere.

## Notes
No migration, client/UI only. `npx tsc --noEmit` clean. One PR, BUG-053 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
