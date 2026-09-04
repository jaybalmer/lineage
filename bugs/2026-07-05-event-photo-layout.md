# Bug-fix session brief: adding a photo to an event breaks the info layout (BUG-143)

> Drafted by the July 5, 2026 daily triage. Self-contained. Diagnosis-first.
> **P2, client-only (expected).** Layout/reflow on the event detail page; no data,
> no migration, no auth expected. Review the replay/screenshot first to pin the
> exact breakage before coding.
> Name the BUG id (BUG-143) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-143: Adding a photo to an event makes the event info formatting go "wonky".** [P2] [reproducible] [diagnosis-first]

One-line goal: adding a photo to an event leaves the info/detail block laid out correctly.

## No open decisions (once the breakage is pinned)

The intended behaviour is obvious (correct layout with or without a photo); the work is diagnosing which element reflows.

## Report (July 4, screenshot in Linestry Bug Attachments)

- BUG-143: 18:52 UTC, Cory (R1), iPhone Safari 414x750, `https://linestry.com/snowboarding/events/King_Of_The_Hill_30`. "Trying to add a photo to an event can make the info formatting wonky." Screenshot `19f2e7a0d83a332b__0__bug-screenshot.jpg`. Replay `S-31`, offset 919s. Open the replay/screenshot to see the exact broken layout before coding.

## Diagnosis pointers (checked against the live repo July 5)

1. The event detail page is `src/app/(community)/[community]/events/[id]/page.tsx`. Per the codebase `CLAUDE.md` gotcha, this page has early returns (instance vs series) and the hook-in-conditional constraint: all `useState`/`useEffect` must sit above the first `return`. Be careful editing near the top of the component.
2. The report is that ADDING a photo reflows the info block, so inspect the header/info region layout when a photo is present vs absent: a photo may be inserted into a flex/grid that then squeezes the adjacent info column, or an image without a width/aspect cap pushes the layout. Look for a missing `max-w`/`aspect`/`min-w-0` on the newly added image container.
3. Confirm whether "add a photo" here is the event-page photo affordance or the Add-Story-with-linked-event path; the URL is the event page, so most likely the event page's own photo/info section.

## Suggested order

1. Open the session replay and screenshot; identify the specific element that goes "wonky" when a photo is present.
2. Add the missing layout constraint (image cap and/or `min-w-0` on the info column) so the info block holds its shape.
3. Verify at 375px with and without a photo.

## Acceptance

- Adding a photo to an event page leaves the event info block laid out correctly at 375px and desktop; no overlap, squeeze, or overflow.
- `npx tsc --noEmit` clean. Client-only, no migration.

## Standing rules

One PR, BUG-143 in the title. No em dashes anywhere. Run the full Ship sequence before wrapping ("No migration this session" applies). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
