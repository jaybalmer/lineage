# Bug-fix brief: UI elements overlap on the owner's profile timeline at 414px

**Date drafted:** August 17, 2026 (daily triage)
**Scope:** BUG-158
**Shape:** diagnosis-first mobile layout pass. Client-only, no migration. **HUMAN-RUN** (needs a signed-in narrow viewport to confirm the target before changing anything).
**Estimated size:** 1 to 2 hours, most of it diagnosis.

---

## Goal

Find and fix the element collision the reporter saw on their own profile timeline on an iPhone, and tighten the two narrow-width crowding points the triage pass verified in code while looking.

---

## The report (August 15, 23:19 UTC)

- Reporter: `R1` (the CY 1 account), viewing **their own** profile.
- URL: `https://linestry.com/people/cy_1`
- Viewport: **414x750**, iPhone, iOS 18.7, Safari 26.4.
- Text: "Some ui elements are overlapping each other." No expected-result given.
- Screenshot: **`1a007b94305ab994__0__bug-screenshot.jpg`** in the Drive folder "Linestry Bug Attachments". **Open it first.** The triage pass could only get an OCR text read of it, not geometry, so the exact colliding pair is not yet pinned.
- Session replay: `posthog replay S-40 (link in bugs/private/session-ids.md)`

OCR of that screenshot surfaced, in order: the nav rows (`Community / Feed / My Timeline`, then `Stories / Riders / Places / Events / Boards / Brands`), a `FIRST SEASON 2002 Self-reported` chip row, a `Grouse Mou... Resort / BC, Canada` card with `RODE AT 2002 Self-reported unverified`, then `CY 1 / Comment / ONLY YOU STORY / 1 Jan 2000 / + Connect / Add photo`.

---

## What the triage pass already ruled in and out

A live render of `https://linestry.com/people/cy_1` at 414px wide, **signed out**, showed **no overlap**: the RiderCard, the 4-up stat grid, the decade headings, and both claim cards laid out cleanly. So the collision is in the **owner-only** render path, not the public one. That narrows it a lot:

- The owner path is `src/components/profile/owner-timeline-panel.tsx` (returned from `src/app/people/[id]/page.tsx:209`), not the public fall-through.
- The claim card is `src/components/feed/post-card.tsx`. The owner render adds elements the signed-out render does not.

### Verified narrow-width crowding candidates (all in `post-card.tsx`)

1. **The header row loses ~68px on the owner view.** Lines 444 to 515: `flex items-center gap-3` holding the 56px entity graphic, a `flex-1 min-w-0` name column, and an optional 56px thumbnail. When the viewer is the owner and there is no image, line 511 renders a **dashed "Add photo" placeholder** at `w-14 h-14 flex-shrink-0`; signed-out viewers get `null`. That is exactly why the reporter's screenshot truncates "Grouse Mou..." while the signed-out render shows "Grouse Mountain" in full. Strongest suspect for the perceived overlap.
2. **The type badge is `shrink-0` next to a `truncate`d title.** Line 479: `text-[10px] uppercase tracking-widest font-medium shrink-0` sits beside the `min-w-0 flex-1` title column. `tracking-widest` adds trailing letter-space after the final character, so at very narrow widths the badge can visually run into the ellipsis or past the card padding.
3. **The metadata chip row gains a chip on the owner view.** Lines 669 to 700: the left group is `flex items-center gap-2 flex-wrap min-w-0` (predicate pill, date, `ConfidenceBadge`, then `UnverifiedBadge` when the entity is user-created) and the right group is `flex items-center gap-1.5 flex-shrink-0` (expand caret, privacy glyph, options menu). The reporter's OCR shows the extra `unverified` chip present. With the right group pinned `flex-shrink-0`, a long wrapped left group can push against it.

### One thing to check while you are in there

`post-card.tsx:720` gates the owner options button with `opacity-0 group-hover:opacity-100`. There is no hover on touch, so the `...` menu is invisible on mobile. This is the **same defect pattern already fixed twice**: BUG-084 (claim card) and BUG-044 (story card). It looks like `post-card.tsx` was missed. Confirm on device; if it reproduces, fold it into this PR and say so in the PR body (it does not have its own BUG id yet, so reference BUG-158).

### Known-adjacent, already logged, do not re-fix here

The dead "Add photo" placeholder itself is **BUG-072**, already queued with a recommended default of "remove it", inside `bugs/2026-06-17-community-profile-mobile-pass.md`. If you remove the placeholder there, candidate 1 above disappears with it. Check whether that brief has shipped before duplicating the work; if it has not, consider taking the two together and naming both ids.

---

## DECISIONS (review before building)

**D1. Fix scope.**
- **Recommended default:** fix only what the screenshot and a live 414px signed-in render actually show colliding, plus any of the three verified candidates that reproduce. Do not do a speculative sitewide mobile sweep.
- Alternative: full responsive audit of `post-card.tsx`. Larger, and BUG-142 already did a mobile overflow pass.

**D2. If candidate 1 is the cause.**
- **Recommended default:** let the title column win. Give the "Add photo" placeholder `hidden sm:flex` so it drops below 640px, keeping the name readable on a phone. Cheap, reversible, and consistent with BUG-072's direction of travel.
- Alternative: shrink the placeholder to `w-10 h-10` on mobile. Keeps the affordance but still costs width.

**D3. If the `...` menu hover gate reproduces.**
- **Recommended default:** drop the `opacity-0 group-hover:opacity-100` gating entirely, matching what BUG-084 and BUG-044 shipped for the sibling cards.
- Alternative: `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. Rejected: BUG-044's follow-up already showed that conditional variant caused a second round of confusion.

---

## Acceptance criteria

**BUG-158**
- [ ] The specific collision in `1a007b94305ab994__0__bug-screenshot.jpg` is identified in the PR body, in one sentence, naming the two elements.
- [ ] On a signed-in 414x750 viewport of the owner's own profile, no element overlaps another on any claim card or story card. Verify at 375px too (the narrower common iPhone width).
- [ ] The entity name on a claim card is legible and not truncated mid-word on the owner view where the signed-out view shows it in full.
- [ ] Nothing regresses on the signed-out `/people/cy_1` render at 414px (it is currently clean; keep it clean).
- [ ] Nothing regresses at desktop width.
- [ ] If the `...` hover gate reproduced: the owner options menu is tappable on touch.
- [ ] `npx tsc --noEmit` clean.

---

## Suggested order

1. Open the Drive screenshot and the PostHog replay. Pin the colliding pair before writing any CSS.
2. Reproduce on a real signed-in narrow viewport (the owner path cannot be reached signed out).
3. Fix the one confirmed collision.
4. Re-check the three verified candidates above; fix the ones that reproduce, per D2 / D3.
5. `npx tsc --noEmit`, push, open the PR, run the Ship sequence.

---

## Migration

**No migration this session.**

---

## Wrap-up

- Name **BUG-158** in the PR title or commit message.
- Append one `bugs/SHIP-LOG.md` entry: `type: bugfix`, `ids: BUG-158`, `migration: none`, `status: merged` once merged.
- If BUG-072 was folded in, name it too.
- Do not edit the Shipped section of `bugs/bug-triage.md`.
- No em dashes anywhere you write.
