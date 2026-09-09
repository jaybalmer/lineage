# Bug-fix session brief: launch UI polish batch 4 (BUG-124 + BUG-125 + BUG-126 + BUG-128)

> Drafted by the July 3, 2026 daily triage. Self-contained.
> **P2, client-only, PIPELINE-SAFE (auto-merge eligible on the defaults below):** no
> migration, no `_public` view, no auth/payments/memberships/backfill. Render and copy only.
> Name the BUG ids (BUG-124, BUG-125, BUG-126, BUG-128) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-124: Brand page default Stories filter pill sits partially off-screen on mobile.** [P2] [reproducible]
- **BUG-125: "People In Your Timeline" empty state tells the user to "Browse the People list", which does not exist (the surface is Riders).** [P2] [reproducible] [copy verified]
- **BUG-126: The brand "Linestry.com" renders a fallback avatar letter "U" (from an "Unknown" name fallback) on the FTUE preview timeline.** [P2] [reproducible] [diagnosis-light]
- **BUG-128: On mobile, rider cards on /people hide the contributions block, so entry counts are invisible.** [P2] [reproducible] [root cause verified]

One-line goal: four small mobile render/copy fixes from the July 3 Cory + Jay iPhone sessions.

## DECISIONS (review before building)

1. BUG-124 mechanism. Recommended: on mount, auto-scroll the active pill into view in the brand-page tab row (e.g. `scrollIntoView({ inline: "nearest", block: "nearest" })` on the active tab ref, guarded to run once). Alternative: reorder the tab array so Stories sits first; bigger visual change, touches the deliberate "feed opens on Stories" design comment.
2. BUG-125 copy. Recommended: say "Riders list" to match the live surface (the /people page heading and nav category are "Riders", per the shipped BUG-016/091/118 naming family). Both strings change (lines 65 and 66). Alternative: rename the /people surface to "People"; out of scope here.
3. BUG-128 layout. Recommended: replace the `hidden sm:block` on the right-side stats block with a compact mobile-visible variant (smaller type, inline under the name if needed) so entry/connection counts show at 402px. Alternative: keep it hidden and surface the count inside the card body line; less consistent with the wider view.
4. BUG-126 fallback. Recommended: fix name resolution so the just-added brand resolves (see below); while in there, make the letter fallback use the claim's display label rather than the "Unknown" literal when the entity lookup fails. No alternative flagged.

## Reports (all July 3, all iPhone Safari, screenshots reviewed in Linestry Bug Attachments)

- BUG-124: 03:26 UTC, Cory (R1), 414x383, `https://linestry.com/snowboarding/brands/Barfoot`. "The Story filter which it defaults to is partially off the screen. If this is the defaulted tab it is ideal the full tab can be seen." Screenshot `19f26032eee1779c__0__bug-screenshot.jpg`: brand page with the pill row reading "All | Riders 3 | Boards | Events 9 | Places" and the STORIES section below; the selected Stories pill is scrolled out of the visible row. Replay session `S-25`, offset 6327s.
- BUG-125: 03:47 UTC, Cory, 414x750, reported from `https://linestry.com/people/cory_yip`. "There is no People's List. There is only a Rider's List area." Screenshot `19f26169a4d649d0__0__bug-screenshot.jpg`: his own timeline showing the PEOPLE IN YOUR TIMELINE strip empty state: "You have not linked anyone to your timeline yet. Browse the People list to add the riders you rode with, or write a story and tag who was there." He went looking for a "People list" and found only Riders. Replay offset 7666s.
- BUG-126: 03:53 UTC, Cory, 414x750, `https://linestry.com/snowboarding/brands/Linestry_com`. "If you add the brand Linestry in the sign up flow. The temp logo for Linestry is a U and not an L." Screenshot `19f261c9e6f076b7__0__bug-screenshot.jpg`: the FTUE save screen ("Riding since 1999. 2 moments captured. Save it to keep building.") with a timeline row "Linestry.com, Brand, Media Est. 2026, FAN OF 1999 Self-reported" whose avatar letter is "U". Replay offset 8016s.
- BUG-128: 05:45 UTC, **Jay** (OWNER), 402x812, `https://linestry.com/people`. "On mobile the rider info cards are cut off compared to a wider view, so I can't see their contributions." Screenshot `19f26829bbbccdc4__0__bug-screenshot.jpg`: the Riders list (90 riders) where cards show name, badge, riding-since, bio, but no entry/connection counts. Replay session `S-26`, offset 84s.

## Verified facts (checked against the live repo July 3)

1. BUG-124: `src/app/(community)/[community]/brands/[slug]/page.tsx`. The tab list is built ~line 556 (`{ key: "stories", label: "Stories", count: orgStories.length }` sits at the END of the array); the comment at ~line 403 says the feed deliberately opens on Stories; the scrollable pill row is ~line 949 (`flex gap-1 overflow-x-auto`). So the DEFAULT tab is the LAST pill in a scrollable row: off-screen at 414px. The recommended auto-scroll keeps both the design intent and the visibility.
2. BUG-125: `src/components/timeline/people-in-timeline.tsx` lines 65-66 contain both "Browse the People list" strings (linked-state and empty-state). The component's own header comment (line 57) also says "browse the People list"; update it too. The action button beside it already says "Browse riders".
3. BUG-126: the "Unknown" literal fallbacks live in `src/lib/mock-data.ts` (~lines 493-500: entity name resolver returns "Unknown" when the entity lookup fails). The FTUE preview renders a claim for a brand the user just added in the signup flow; the freshly created org is evidently not in the array the resolver searches at render time, so the name falls to "Unknown" and the avatar initial to "U". Diagnose which resolver the FTUE preview path uses (grep the onboarding preview components for the name/initial derivation), then resolve from the session-created entity (or the claim's own label) before falling back. Related family: BUG-067 compare "Unknown" rows (same failure mode, different surface; its fix sits on the unpushed `fix/compare-avatars-black-BUG-024-067` branch, commit `f47184b`, which does NOT touch the onboarding path, so no collision expected; still pull latest main first).
4. BUG-128: `src/app/people/page.tsx` line ~137: `<div className="shrink-0 text-right hidden sm:block">` wraps the per-rider stats block; `hidden sm:block` removes it below the sm breakpoint (640px), which is every phone. Root cause verified.

## Suggested order

1. BUG-125 (pure copy, three strings).
2. BUG-128 (one className change plus a compact layout pass).
3. BUG-124 (ref + one effect).
4. BUG-126 (small diagnosis, then the resolver fix).

## Acceptance

- BUG-124: opening any brand page at 414px shows the selected Stories pill fully visible without a manual scroll; switching tabs still works; no layout shift on desktop.
- BUG-125: the People In Your Timeline strip (both linked and empty states) says "Riders list" (no "People list" string remains; `grep -rn "People list" src/` returns nothing).
- BUG-126: adding a brand during signup shows that brand's name and correct initial (L for Linestry.com) on the FTUE preview timeline; no "Unknown"/"U" for entities created in the same session.
- BUG-128: at 402px, /people rider cards show the entries/connections counts; desktop unchanged; no horizontal overflow at 375px.
- `npx tsc --noEmit` clean. Client-only, no migration, no DB touch.

## Standing rules

One PR, all four BUG ids in the title. No em dashes anywhere (including any copy you write). Run the full Ship sequence before wrapping ("No migration this session" applies). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
