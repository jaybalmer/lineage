# FTUE: merge /intro and /onboarding into one dark story

> **Status: BUILT, NOT SHIPPED.** This is not a build-from-scratch brief. The code
> is written, typechecked, linted, production-built and committed on a branch in
> this repo. What is left is verification against live data, one deletion this
> session's tooling could not perform, and the full Ship sequence.
>
> **Branch:** `feat/ftue-merged-dark-story` (off `main` at `30b7c1f`)
> **Commit:** `b5df83a` plus a follow-up copy pass (see "Commits on the branch")
> **Size:** ~45 min to verify and ship. Not a build session.
> **Migration:** NONE. No schema change, no new column, no view rebuild.
> **Convention note:** this bypassed the normal Cowork-stages-a-brief-then-Claude-Code-builds
> loop. Jay was iterating on the design live in Cowork and approved the merged
> flow screen by screen, so the build happened in the same session. This brief is
> the retrospective handoff, written so the Ship sequence still runs properly.

---

## DECISIONS (review before building)

All five were taken live with Jay during the design session. They are recorded
here so Claude Code does not relitigate them, and so an override is cheap.

**D1. One merged flow, not two surfaces.** `/intro` folds into `/onboarding`.
Jay chose this over keeping a standalone pre-signup slideshow.
*Default taken:* `/intro` becomes a redirect to `/onboarding?from=intro`.
*Override cost:* high. Reverting means restoring two retired components.

**D2. Place and board stop being questions.** The pre-auth path is name plus
start year only. Place and board move to the welcome screen as things the rider
CAN add after signup.
*Default taken:* two questions, and the FTUE creates no session claims at all.
*Consequence to know:* `sessionClaims` is now always empty through the auth gate.
The `/auth/complete` migration path still runs and still handles an empty array,
but nothing exercises it from the organic flow any more. The invite-merge path
still does.
*Override cost:* low. The old `PlaceSelect` / `BrandSelect` code is in git history
at `30b7c1f:src/components/onboarding/onboarding-flow.tsx`.

**D3. Riders count is the headline number.** "N riders named in the stories so
far" counts `people` plus non-archived `profiles`, which is the population the
line is actually describing (mostly unclaimed ghost nodes riders get named as in
other people's stories).
*Default taken:* `people` + `profiles`, deduped by the fact that claiming merges
a person node rather than leaving both rows.
*Watch:* if `merge_log` shows claimed nodes are NOT being removed from `people`,
this over-counts. Worth one query before shipping (see "Verification", V4).

**D4. Forced dark for the FTUE only.** The app default stays light.
*Default taken:* a `.ftue-dark` token scope in `globals.css:179`, the same
mechanism as `.postcard`, rather than toggling `.dark` on `<html>`. No
first-paint flash, no write to the persisted theme, nothing to unwind on exit.
*Override cost:* trivial, it is one class on one wrapper div.

**D5. No invented attribution on the scatter screen.** The scattered tiles wear
generic post chrome (an avatar dot and a redacted bar) with no `@handle` and no
like count. Putting an invented name on a real photo of a real mountain would be
fabricating attribution.
*Override:* if Jay wants handles, they must come from real data, which means
resolving each image back to its adding member. That is a separate scope.

---

## Why this happened

The FTUE read as a survey on rails. Two surfaces, both weak in different ways:

* `/intro` pitched the product to a visitor who had already tapped "start my
  timeline", using abstract SVG scenes that showed nothing real.
* `/onboarding` then asked five questions (name, start year, place, brand, plus a
  land step) without ever explaining why it wanted them, and ended on an auth
  wall.

June PostHog data on the previous version of this funnel (recorded in the FTUE
Conversion Pass brief, `features/archive/2026-07-02-ftue-conversion-pass.md`):
34 landings to 17 land-step completions to 9 aha to 2 signups. The cliff is
between landing and finishing.

The reframe Jay set: tell the story of scattered stories being connected. Our
stories live in feeds, posts and group chats, unconnected and disappearing.
Linestry gives each piece a home and shows how it connects. You are joining a
community weaving our real stories together.

---

## What already exists on the branch (verified facts)

Every path below was read or written this session.

### New files

| File | Lines | What it is |
|---|---|---|
| `src/app/api/stats/community/route.ts` | 106 | Public counts endpoint behind every number in the flow |
| `src/components/onboarding/ftue-mosaic.tsx` | 294 | Real-catalog image mosaic, scatter and woven states |
| `src/components/onboarding/ftue-bits.tsx` | 154 | `BigNumber`, `StatTile`, `Eyebrow`, `SectionLabel`, `Callout` |
| `src/lib/eras.ts` | 55 | Shared era boundaries plus FTUE era copy |

### Modified files

| File | What changed |
|---|---|
| `src/components/onboarding/onboarding-flow.tsx` | Rewritten, 771 lines. The seven beats. |
| `src/components/onboarding/save-step.tsx` | Takes `firstName` / `startYear` / `ridersWaiting`, restated pitch, recap tiles, round CTAs |
| `src/app/intro/page.tsx` | Now a `redirect("/onboarding?from=intro")` |
| `src/app/api/stats/user/route.ts` | Era boundaries imported from `src/lib/eras.ts`; keeps its own rotating context lines |
| `src/app/globals.css` | `.ftue-dark` scope (`:179`), `ftue-tile-in` / `ftue-row-in` keyframes (`:216`), `.ftue-h1` / `.ftue-h2` / `.ftue-body` (`:245`) |
| `tsconfig.json`, `eslint.config.mjs`, `.gitignore` | Exclude and ignore `_to_delete/` |

### The seven beats

```
scatter   our stories are strewn across feeds, unconnected
weave     Linestry gives every piece a home (live catalog numbers)
name      "you're joining a community weaving our real stories together"
year      the one anchor the whole timeline hangs off
era       the reveal: your year, your seasons, your era, your peers
welcome   "Here is the start of your timeline" plus what you can add
save      the auth gate, restating what is waiting
```

### Facts worth knowing before you touch it

1. **The Started Riding card is not special-cased anywhere downstream.**
   `src/components/feed/feed-view.tsx:69` already builds a `riding_start` feed
   item and `:418` renders `StartCard` from it, driven by `profiles.riding_since`.
   `src/app/auth/complete/page.tsx:81` writes `riding_since: effStartYear`. So
   the card previewed at the end of the flow is the card the rider lands on. The
   FTUE welcome screen renders its own presentation of it, deliberately: it is a
   preview inside a dark scope, not a live `FeedView`.

2. **Every number is independently nullable.** `/api/stats/community` returns
   `{riders, places, brands, connections, year, peers, stories}` and each field
   comes back `null` on any failure, including a missing service-role key. The
   matching callout does not render when its value is null. Verified both paths
   with screenshots this session: with numbers, and with all-null (the weave
   screen simply drops the big number and the whole stat row and still reads).
   There is no zero state and no placeholder dash by design.

3. **The mosaic degrades.** It pulls `image_url` from `places`, `boards` and
   `events` in the loaded store catalog, interleaved so one dense category cannot
   fill the grid. Slots the catalog cannot fill get a generated abstract tile
   carrying no name. The offset into the list is derived from catalog size, NOT
   `Math.random()`: the store seeds mock entities before the live fetch lands, so
   a random offset would tear hydration.

4. **Funnel events are preserved.** `ftue_landed` (tagged `{source: "intro"}` on
   an `/intro` arrival), `ftue_intro_viewed`, `ftue_intro_skipped`,
   `ftue_step_completed`, `ftue_aha_shown`, `ftue_save_shown`, `ftue_exited`,
   `ftue_completed`. One new event: `ftue_timeline_shown` for the welcome beat.
   Each fires once per name per visit; back-navigation does not double count.

5. **BUG-166 and BUG-168 behaviour carries over.** The always-available exit is
   still on every step, the entry-step reset still runs against the hydrated
   store, and the invite prefill from `lineage_claim_prefill` still populates
   name and riding_since and shows the inviter card.

---

## Explicitly OUT of scope

* Any migration or schema change. There is none and there should be none.
* Post-signup surfaces. The rider lands on the normal timeline in their own theme.
* Turning the welcome screen's three "what you can add" cards into working
  add-flows. They are copy that sets expectation, not buttons. If Jay wants them
  live, that is a follow-up brief.
* Restoring handles or like counts on the scatter tiles (see D5).
* The `<img>` to `next/image` question. `<img>` is the house pattern
  (`community-timeline-player.tsx:33`, `add-story-modal.tsx:364`, and others);
  one lint warning, consistent with the repo.

---

## What is LEFT to do (acceptance criteria)

**A1. Delete the parked folder.** `rm -rf _to_delete`

  It holds three retired components (`intro-slideshow.tsx`, `intro-visuals.tsx`,
  `timeline-aha.tsx`), a source tarball, some parked git lock files, and a
  README. Nothing imports any of it. It exists only because the Cowork device
  sandbox refuses `rm`. It is gitignored, so it is not in the commit; this is
  local hygiene.

**A2. Run the flow against live catalog data.** The Cowork sandbox is firewalled
  off from Supabase, so the mosaic was only ever verified in its fallback state.
  With `npm run dev` from this repo root (playbook check 20), walk
  `/onboarding` and confirm:

  * the scatter tiles show REAL place / board / event photos, rotated, with post
    chrome and no handles;
  * the woven grid shows the same eight squared up, each captioned with its real
    entity name, threads drawn between them;
  * captions are not truncating badly at 320px width.

  If fewer than eight catalog entities carry an `image_url`, the scene fills the
  remainder with generated tiles. That is correct behaviour, but if it looks
  sparse, tell Jay the number rather than changing the component.

**A3. Confirm the live numbers are sane.** Hit `/api/stats/community?year=1994`
  against prod data and eyeball each field. Specifically check that `riders`
  is not absurdly larger than the community actually is (see D3 and V4 below).

**A4. Walk the null path once.** Temporarily break the fetch (devtools offline,
  or point the fetch at a 500) and confirm the weave screen renders with no big
  number and no stat row, the name screen renders with no callout, and the era
  screen renders with no stat tiles. Nothing should show a zero, a dash, or a
  layout hole.

**A5. Full keyboard and reduced-motion pass.** Tab through every beat. Confirm
  Enter advances from both text fields. Then set
  `prefers-reduced-motion: reduce` and confirm tiles, timeline rows and the
  big-number count-up all land immediately rather than animating.

**A6. Check the handoff out of the dark scope.** Complete a real signup and
  confirm the rider lands on `/[community]/timeline` in THEIR theme (light by
  default), with the Started Riding card present and carrying the right year.
  The `.ftue-dark` scope must not leak past the flow.

**A7. Ship sequence.** Push the branch, open the PR, no migration to surface,
  append one `bugs/SHIP-LOG.md` entry with `type: feature`, `ids: none`,
  `scope: ftue-merged-dark-story`, `status: pending`, then merge per the
  CLAUDE.md exception rules and log the ship.

---

## Suggested order

1. `rm -rf _to_delete` (A1). Thirty seconds, and it stops the folder leaking into
   any later `git add -A`.
2. `npx tsc --noEmit` to confirm the branch is still clean in your environment.
3. `npm run dev` from this repo root, then A2, A3, A4, A5 in one pass through the
   flow. This is the bulk of the work and it is all browser time.
4. A6 last, because completing a real signup ends the FTUE for that browser
   profile and you will want a fresh profile or a cleared store to re-walk it.
5. A7.

---

## Verification already done (do not repeat)

* `npx tsc --noEmit` clean.
* `npx eslint` clean on every touched file. One pre-existing-pattern warning
  (`@next/next/no-img-element`). The repo's other 78 lint errors are all in files
  this branch does not touch.
* Full `next build` green: compiled successfully, 99 static pages,
  `/api/stats/community` registered as a dynamic route. Run in a Linux container
  from a copy of this source, because the device sandbox is arm64 Linux and this
  repo's `node_modules` carries darwin-arm64 SWC binaries.
* All seven beats screenshotted from that production build, driven end to end by
  Playwright with no page errors. Both the populated-numbers path and the
  all-null path.

## Verification Cowork could NOT run

* **V1. Real catalog images.** Sandbox has no route to Supabase. This is A2 and
  it is the single most important check, because the mosaic is the beat Jay is
  waiting to see.
* **V2. Real stats numbers.** No service-role key in the sandbox, by design. A3.
* **V3. A real signup round trip.** A6.
* **V4. The riders-count double-count question.** Run this before shipping:

  ```sql
  -- pseudocode, verify before running: confirms a claimed person node does not
  -- also survive as a people row, which would double-count D3's headline number.
  select count(*) as claimed_people_still_in_people
  from people p
  join profiles pr on pr.id = p.claimed_by
  where p.claimed_by is not null;
  ```

  Expect 0. If it is non-zero, subtract that count in
  `src/app/api/stats/community/route.ts` and say so in a comment.

---

## Rollback

Single flip point. `git revert b5df83a` (plus the copy-pass commit) restores the
previous two-surface FTUE wholesale: the slideshow components come back from
git, `/intro` returns to rendering `IntroSlideshow`, and `/onboarding` returns
to the five-question wizard. No data written, no schema touched, so there is
nothing to unwind server side. `/api/stats/community` is additive and harmless
if left in place.

---

## Commits on the branch

1. `b5df83a` feat(ftue): merge /intro and /onboarding into one dark story
2. `9f5c257` style(ftue): drop em dashes from FTUE copy and comments, per the
   standing rule in NEXT-FEATURE.md. Note that commit 1's MESSAGE still contains
   them and cannot be rewritten cheaply from the Cowork sandbox; the squash-merge
   text is yours to set on the PR.

---

## Notes for the PR body

Worth calling out for review, because each is a judgement call rather than a
mechanical change:

* the `.ftue-dark` scope over an `<html class>` toggle (D4);
* the deliberate absence of handles and like counts on the scatter tiles (D5);
* the null-degradation contract on every number, which is what keeps the flow
  honest when the stats endpoint is unavailable;
* era boundaries moving to `src/lib/eras.ts` so signup and profile cannot
  disagree, with `/api/stats/user` keeping its own rotating copy.
