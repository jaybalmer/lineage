# Bug-fix brief: the intro-card context and CTA treatment stopped short of Stories, the community landing and the collective

**Date drafted:** August 18, 2026 (daily triage, evening intake)
**Scope:** BUG-164 + BUG-165
**Severity:** P2 (launch-facing, FNRad Season 12 announcement week)
**Run mode:** client-only, no migration, PIPELINE-SAFE on the defaults below.
**Estimated:** 1.5 to 2 hr, one PR.

---

## Goal

PR #190 gave the Boards, Places, Events, Riders and Brands pages a wordmark heading, a StoryBrand problem-then-plan paragraph and an add button in one intro card. Three landing surfaces a signed-out visitor actually arrives on were missed. Close the gap, and make the Boards banner consistent with its siblings.

---

## DECISIONS (review before building)

**D1. Which surfaces get an intro card.** Recommended default: all three named in the report. `/[community]/stories` (full intro card, matching the five siblings), `/[community]` community landing (a context paragraph under the hero, the CTAs already exist), `/[community]/collective` (a short intro card explaining what the collective timeline is and how to read it).
Alternative: Stories only, and treat the community landing and collective as a separate design pass. Cheaper but leaves the two highest-traffic signed-out surfaces unexplained.

**D2. The Boards banner.** Recommended default: keep the banner band but scope it as a general community-page banner rather than a boards-only quirk, by simply not rendering it on Boards unless `boards_banner_url` is set AND the page is the one place Jay wants it. Given he says it feels out of place, the simplest honest default is: **remove the banner band from the Boards page render**. Leave `communities.boards_banner_url` in the database and leave the admin field alone, so nothing is destroyed and it can be re-enabled in one line.
Alternative A: keep it on Boards and add a banner to the other four pages for consistency. More work, needs five images Jay does not have yet.
Alternative B: keep it exactly as is and close BUG-165 as intended behaviour.

**D3. Signed-out CTA on the Stories page.** Recommended default: show the add-story CTA to signed-out visitors too, routed to the sign-in or onboarding path, matching what BUG-161 and BUG-162 are fixing on the catalog pages. Do NOT open the add-story modal for an anonymous visitor. Today the button is hidden entirely behind `isAuth` (`stories/page.tsx:135`), so a signed-out visitor sees no invitation at all.
Alternative: keep it hidden when signed out. Consistent with today, but the whole point of the #190 treatment is to ask arriving visitors to contribute.
**Coordination note:** if the BUG-161 + BUG-162 session lands first, reuse whatever signed-out affordance it establishes rather than inventing a second pattern. If this brief runs first, keep the change to a plain link so there is nothing to unpick later.

**D4. Copy.** Drafted defaults below, override freely. Match the register of the shipped Boards card (plain, first-person-plural, no hype, no em dashes).

- **Stories** heading: `Firsthand Accounts`
  Body: `The stories that made this community are told in parking lots and on chairlifts and then they are gone. Write down the ones you were there for. What you remember is the record.`
- **Community landing** context line (under the existing hero, above the CTAs): `This is the snowboarding linestry. Members map their own timelines, and together those timelines become the history of the sport. Add yours, or browse what is here.`
- **Collective** heading: `The Collective Timeline`
  Body: `Every member's timeline, laid over one another by year. The more people who add theirs, the more the shape of the sport shows up. Pick a year to see who was where.`

**D5. Do not restructure the Stories page.** The intro card replaces the current header block only. Search, filters, pagination and the `?focus=` permalink behaviour stay exactly as they are.

---

## Reports (all August 18, one mobile review session, iPhone Safari 402x812, signed out)

- **15:33 UTC**, `https://linestry.com/people`: "There are titles and calls to action on all the main categories, except stories. Also boards is the only one with a banner image and it feels out of place." (Both BUG-164 and BUG-165 come from this one report.)
- **15:46 UTC**, `https://linestry.com/snowboarding`: "The community page is good with the photo, but I think it also is missing the context and called actions"
- **15:49 UTC**, `https://linestry.com/snowboarding/collective`: "The collective timeline also needs some contacts and introduction. It is a thought in progress that will take shape as the linestry as more info is added. Browse by year and category and then jump to that list."
- Session replay for all three: `posthog replay S-42 (link in bugs/private/session-ids.md)`
- No screenshots attached.

Note on the third report: the second sentence ("browse by year and category and then jump to that list") is a feature ask, not part of this fix. It is carried as a NOT-READY companion in the triage file. Build only the intro and context here.

---

## Verified facts (grepped against the live repo this run, `main` at `7e400df`)

1. The five pages carrying the PR #190 treatment, confirmed by a `var(--font-wordmark)` grep: `(community)/[community]/boards/page.tsx`, `.../brands/page.tsx`, `.../events/page.tsx`, `.../places/page.tsx`, `app/people/page.tsx`. `(community)/[community]/stories/page.tsx` is absent from that list.
2. The reference implementation to copy is the Boards intro card at `boards/page.tsx:335` to `367` (line numbers refreshed August 19 after PR #192 shifted this file by about +5; the card starts at the `bg-surface border border-border-default rounded-xl p-5 mb-6` div and the wordmark `h1` "The Snowboard Catalog" is at line 338): `bg-surface border border-border-default rounded-xl p-5 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`, an `h1` at `text-2xl font-bold text-foreground` with `style={{ fontFamily: "var(--font-wordmark)" }}`, a `text-sm text-muted mt-1 max-w-md` body, and the page's add buttons on the right.
3. The Stories page header today is `stories/page.tsx:130` to `143`: a plain `<h1 className="text-xl font-bold text-foreground">Stories</h1>` plus the line "Firsthand accounts from the community", and the `✍ Add story` button wrapped in `{isAuth && ...}`.
4. The Boards banner band is `boards/page.tsx:322` to `332` (refreshed August 19 after PR #192; it opens at the `{/* Admin-set boards-page banner band (optional) */}` comment), gated on `bannerUrl` which comes from `community?.boards_banner_url` (read at line 121). No other category page renders a banner. The column and the admin field are untouched by D2's default; only the render is removed.
5. The community landing already has a hero with the community photo and a `ctas` block at `(community)/[community]/page.tsx:128` to `158` (Start Your Timeline / My Timeline, Collective Timeline, Play). What it lacks is the explanatory sentence, so the change is additive copy near the existing hero, not a restructure.
6. The Stories page body is wrapped in `max-w-2xl` (line 128), narrower than the `max-w-5xl` the catalog pages use. Keep `max-w-2xl` and let the intro card stack vertically at that width rather than forcing the two-column layout.
7. The community landing CTA is `href="/onboarding"` when signed out. If the BUG-166 brief has already landed, that target may now be `/intro`. Do not change it in this PR either way.

---

## Suggested order

1. Stories intro card first: it is the closest copy of an existing pattern and the clearest gap (D1, D3, D4, D5).
2. Boards banner removal (D2). One deletion plus removing the now-unused `bannerUrl` read if nothing else uses it. Check first: `community?.boards_banner_url` may be referenced elsewhere on the page.
3. Community landing context line (D1, D4).
4. Collective intro card (D1, D4).
5. `npx tsc --noEmit` plus lint.
6. Overflow and dark-mode check on all four touched surfaces.

## Acceptance criteria

**BUG-164**
1. `/[community]/stories` renders an intro card structurally matching the Boards card: wordmark-font heading, muted body paragraph, add affordance inside the card.
2. Signed out, the Stories page shows an add-story invitation that ends at sign-in or onboarding and never opens the add-story modal (D3).
3. Signed in, the add-story button still opens the modal and posting a story still works unchanged.
4. Search, the All/Mine filter, Load more, and the `?focus=<storyId>` permalink (including the pinned focused story and its auto-expanded comments) all behave exactly as before.
5. The community landing shows a context sentence near the hero, above or beside the existing CTA row, on mobile and desktop.
6. `/[community]/collective` shows an intro card explaining the surface, and the timeline itself, the 10Y/1Y toggle and year selection are untouched.

**BUG-165**
7. The Boards page no longer renders the banner band, and no other page gained one. `communities.boards_banner_url` still exists in the database and the admin field still saves (unused for now).

**Both**
8. Zero horizontal overflow at 375px, 402px and 414px on all four touched pages.
9. Both themes: the new cards use `bg-surface`, `border-border-default`, `text-foreground` and `text-muted` tokens only, no hardcoded colours, and flip correctly in dark mode.
10. `npx tsc --noEmit` and lint clean.

---

## Notes for the session

- No migration. No API route. No `_public` view. No write path.
- Name BUG-164 and BUG-165 in the PR title.
- Append one `bugs/SHIP-LOG.md` entry. Record `migration: none`.
- No em dashes anywhere you write, including in the shipped copy.
