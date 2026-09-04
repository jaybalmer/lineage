# Bug-fix session brief: mobile overflow pass, content spilling past the frame (BUG-141 + BUG-142)

> Drafted by the July 5, 2026 daily triage. Self-contained.
> **P2, client-only, PIPELINE-SAFE.** Pure CSS/layout overflow guards; no data,
> no migration, no auth, no `_public` view. Safe for the unattended auto-merge
> pipeline. No open decisions.
> Name the BUG ids (BUG-141, BUG-142) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-141: On `/snowboarding`, long story links / content spill past their container, making the page horizontally scrollable; the viewport sometimes stays zoomed-out.** [P2] [reproducible]
- **BUG-142: Posting a long comment overflows the story frame, causing the same shrink-to-fit / stuck-shrunken viewport.** [P2] [reproducible]

One-line goal: no child element forces the page wider than the mobile viewport; long links and long unbroken comment text wrap or truncate inside their cards.

## No open decisions

Both are overflow-containment fixes with an obvious correct behaviour (wrap/contain). Ship the defaults.

## Reports (July 4, screenshots + a screen recording in Linestry Bug Attachments)

- BUG-141: 17:07 UTC, Cory (R1), iPhone Safari 414x463, `https://linestry.com/snowboarding`. "Story links are spilling past the frame and causing the page to be horizontally scrollable. Sometimes the page will stay in a shrunken view due to this issue." Screenshot `19f2e19a42dbfc4a__0__bug-screenshot.jpg`; screen recording also in the Drive folder. Replay `S-30`, offset 305s.
- BUG-142: 17:30 UTC, same Cory iPhone session, `https://linestry.com/snowboarding/stories`. "Posting long comments may go past the story frame cause site to shrink to fit. This play through shows the permanent page that stay shrunken a bit." Screenshot `19f2e2ef7c589deb__0__bug-screenshot.jpg`; play-through recording in the Drive folder. Replay `S-30`, offset 1712s.

## Verified facts (checked against the live repo July 5)

1. The story URL link in `src/components/feed/story-card.tsx` (~line 348-351) already carries `break-all`, so that specific element is guarded. The BUG-141 leak is therefore likely another element on the community page: the entity-chip rows (place/event/board/brand chips), the community-timeline card wrapper (`src/components/feed/community-timeline.tsx`), or a link inside the comment row. Grep the `/snowboarding` render tree for long-string containers missing `min-w-0` / `break-words` / `overflow-hidden`.
2. Comments render in `src/components/feed/story-interactions.tsx` (comment list). A long unbroken comment string (no spaces, e.g. a pasted URL) will not wrap without `break-words` / `overflow-wrap:anywhere`; a flex row needs `min-w-0` on the text child so it can shrink instead of pushing the row wide. This is the BUG-142 source.
3. Symptom "page stays shrunken" is iOS Safari's response to a child wider than the viewport: it zooms out to fit and does not zoom back. Fixing the overflow removes the zoom-out; no viewport meta change should be needed, but confirm `<meta name="viewport">` has `width=device-width` and no `maximum-scale` hack is masking it.

## Suggested order

1. Reproduce at 375px in devtools on `/snowboarding` and on a story with a very long single-word comment. Watch for the element that exceeds `100vw`.
2. Add `min-w-0` + `break-words` (or `break-all` for URL-like strings) to the offending flex children: the comment row (BUG-142) and whichever community-page row leaks (BUG-141, likely entity chips or a link).
3. Verify no horizontal scrollbar at 375px on `/snowboarding` and `/snowboarding/stories`.

## Acceptance

- BUG-141: at 375px, `/snowboarding` has no horizontal scroll; long links wrap or truncate; the page does not stay zoomed-out after scrolling.
- BUG-142: a very long single-word comment wraps inside the story card; no horizontal scroll; viewport stays at scale.
- `npx tsc --noEmit` clean. Client-only, no migration.

## Standing rules

One PR, both BUG ids in the title. No em dashes anywhere. Run the full Ship sequence before wrapping ("No migration this session" applies). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
