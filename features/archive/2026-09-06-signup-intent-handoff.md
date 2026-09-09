# Signup Intent Handoff

> Cowork-authored feature brief, September 4 2026. Self-contained. ~3.5 to 4.5 hr, ONE PR,
> NO migration, no schema change, no new endpoint.
> **EPISODE 1 DEADLINE: the FNRad sponsorship is announced and episode 1 drops in ONE TO
> TWO WEEKS.** Its community challenge asks listeners to add a story about that episode's
> guest, which is an authenticated action. Today that listener signs up and lands on their
> own empty profile with no memory of the guest, so the challenge is structurally broken
> before it airs. This brief is the critical path for that campaign.
> Playbook subset run: checks 2, 6, 7, 8, 10, 11, 12, 16, 20, 21, 22. Checks 1, 3, 4, 5, 9,
> 13, 14, 15, 17, 18, 19, 23, 24 are not applicable (no migration, no schema, no backfill,
> no Postgres view, no plpgsql function, no catalog operation, no owner/editor moderation
> terminology, no cross-user write path, no new SQL assertion).

---

## DECISIONS (review before building)

Every decision has a shippable default. Build the defaults unless Jay says otherwise.
Nothing here blocks on an answer.

**D1. The intent rides inside `returnTo` as reserved query params on the destination path,
not as a second parameter alongside it. DEFAULT: yes.**

The wire format is a plain internal URL: `/people/<personId>?intent=add-story&subject=<personId>`.
That whole string is what gets URL-encoded into `?returnTo=`. There is no second transport
to plumb, no base64, no JSON in a URL.

This is the smallest design that meets the requirement, and it is small because
`safeReturnTo` already permits query strings: it rejects non-root-relative paths,
protocol-relative targets, backslash variants and control characters, and passes everything
else through verbatim (F1). A destination with params is already a legal `returnTo` today.
Every hop in the chain that carries `returnTo` therefore carries the intent for free, and
`/auth/complete` already does `router.replace(returnTo)` (F8), which means the intent
arrives on the destination page with no change to the landing code at all.

There is still an intent OBJECT: `src/lib/intent.ts` (T1) defines the type, the encoder and
the validating reader. The URL is its wire format, the same way `returnTo` is the wire
format for a destination today.

Alternative A: a separate `?intent=<base64 JSON>` param carried beside `returnTo`. Rejected
because it doubles the plumbing (six surfaces would each need to forward two params instead
of one), it needs its own validator, and the base64 blob is unreadable in a Vercel log, in a
PostHog URL property and in an emailed magic link, which is exactly where we will debug this
during episode 1 week.

Alternative B: a server-side intent record keyed by a token. Rejected outright: a table, a
migration, a cleanup job and an endpoint, for a value that is three fields long and dies in
five minutes.

**D2. Action types are a hard allowlist, and there is exactly one of them in v1.
DEFAULT: `INTENT_ACTIONS = ["add-story"] as const`.**

An intent that fires something on arrival is a new class of thing in this app, so the reader
is closed by construction rather than open by construction. An unrecognised `intent` value is
dropped silently and the `returnTo` is still honoured as a plain destination, so a stale link
from a future or reverted build degrades to a normal navigation instead of an error. Adding
an action later is one array entry plus one replay handler, and section 10 is the checklist
that entry has to pass.

Alternative: accept any action string and let each page decide. Rejected: that makes the
security review per-page and permanent, instead of one allowlist read once.

**D3. The intent lives in the URL and never in the Zustand store. DEFAULT: yes.**

This is a lifecycle decision, not a plumbing one (playbook check 8). `lineage-store-v2`
partializes by EXCLUSION, not inclusion: it strips a named list and persists everything else
(F11). So a new top-level store field would be written to localStorage automatically and
would then need explicit reset, expiry and owner-scoping rules, or a listener who abandoned
signup in March would have a composer pop open in June. A URL-held intent has a free
lifecycle: it exists while the URL says so and it is gone the moment the URL changes.

Alternative: a `pendingIntent` slice with a timestamp and a TTL. Rejected because it is more
code and more failure modes to buy a property the URL already has.

**D4. The replay is read on the destination page and cleared with `router.replace` BEFORE
the composer opens. DEFAULT: yes, plus a `useRef` fire-once latch.**

`router.replace(pathname)` with the intent params stripped rewrites history in place, so:
the composer cannot re-fire on reload, it cannot re-fire on browser Back into the same entry,
and the URL the member copies out of the address bar to send to a friend is clean. The ref
latch is there because React Strict Mode double-invokes effects in development and would
otherwise open two modals.

Alternative: clear on modal close. Rejected: a member who closes the tab mid-compose and
returns from history gets the modal again, which reads as the app nagging them.

**D5. The signed-out person page gets a direct link CTA, not a `SignInPrompt` modal.
DEFAULT: a `<Link>` styled exactly like today's signed-in button, pointing at
`/auth/signin?returnTo=<encoded intent url>`.**

`SignInPrompt` is a press-time interstitial for buttons whose label is generic ("+ Add to my
profile", catalog adds). It earns its place there by explaining what the button was going to
do. The person page button already says "Add your story about Nick", so the modal would only
repeat the sentence the visitor just read, and it would put a click between the listener and
the signup page. The page also has no `SignInPrompt` import today (F10), so the direct link
is additionally the smaller diff.

Destination is `/auth/signin`, not `/onboarding`, and that choice is load-bearing:
`/auth/signin` serves BOTH audiences from one href (a returning member signs in there, a
first-timer takes its "Create your timeline" link) whereas the FTUE save step has no
sign-in affordance at all (F6), so sending everyone to `/onboarding` would strand every
returning listener. This is precisely why D6 is not optional.

Alternative: import and use `SignInPrompt` here for consistency with the other eight pages.
Rejected for the reasons above, but note the fix in T2.1 makes `SignInPrompt` carry intents
correctly anyway, so a future surface can go either way.

**D6. `/auth/signin`'s "No account yet? Create your timeline" link carries `returnTo`.
DEFAULT: yes. This is the single most important line in the PR.**

Every other method on that page already preserves the destination: Google (F4), Facebook
(F4), magic link (F4) and password (F4). The one method that drops it is the bare
`<Link href="/onboarding">` at line 335, and that is the link the ENTIRE target audience
clicks, because a podcast listener has no account. A first-time listener currently loses the
guest on their very first click, before any of the rest of the chain gets a chance to fail.

Because the link is rendered (not fired from a handler), it cannot use the page's action-time
`currentReturnTo()` helper without forcing a dynamic render. Build the href in a
`useState` initialiser or a mount effect reading `window.location.search`, matching the
pattern `onboarding-flow.tsx:173` already uses for `?from=intro`.

**D7. The magic-link signup path stashes `returnTo` inside the existing
`pending_onboarding` payload as a second channel. DEFAULT: yes.**

The primary channel for a magic link is the link itself: the route bakes `returnTo` into the
`redirectTo` it hands `generateLink`, so the emailed URL points at
`/auth/complete?returnTo=...` and is device-independent (F7). A link opened on a phone
already carries the intent. That corrects a common assumption: `pending_onboarding` exists
because the FTUE ANSWERS live in device-bound localStorage, not because `returnTo` cannot
cross devices.

The stash is still worth adding, for one specific documented failure: when the sending origin
is not in Supabase's Redirect URLs, Supabase silently discards `redirect_to` and falls back to
Site URL, which strips the intent from the link. `features/funnel-drop-off-repairs-brief.md`
D8 documents exactly this happening on preview deploys. Nesting `returnTo` INSIDE the
`onboarding` object rather than adding a sibling key also means the route needs zero changes:
it stashes whatever object the client posts (F7), and `admin.updateUserById` writes
`user_metadata` wholesale, so a sibling key would have been a new way to clobber the payload.

Alternative: skip the stash. Rejected: it is four lines and it covers the one case where the
listener has already done the hard part (typed their email, opened the link) and would land
nowhere.

**D8. The composer names the person and pins the tag above the tab bar. DEFAULT: a read-only
chip row under the header, visible on BOTH tabs; the default tab stays Details.**

Today the modal opens on Details while the pre-tagged rider sits in the Tag riders picker on
the hidden Links tab (F13), and the header says "Add a Story" (F12). A listener who clicked
"Add your story about Nick" therefore sees a blank generic form and no evidence the tag took.
When `defaults.riderIds` is non-empty and the modal is not editing, the header becomes
"Add a story about {First}" and a small non-interactive chip row under it reads
"Tagging: Nick Perata" with a text button to the Links tab for edits.

The name is resolved from the catalog, never from the URL. See section 10.

Alternative: default the tab to Links when riders are pre-tagged. Rejected: it hides the
title and body fields, which are the actual contribution, behind a tab switch. The pinned row
gives the same reassurance without moving the work.

**D9. A first-time author's profile-originated story defaults ON to their own timeline.
DEFAULT: yes, flip `onTimeline` to true when the author has zero stories.**

`src/app/people/[id]/page.tsx:778` forces `onTimeline: false` (F14). The rule is right in
general: documenting someone else's history should not silently fill your own timeline. It is
wrong for exactly one story, the first one. Linestry's whole promise to a new member is
"build your timeline", and the episode-1 path ends with that member's first contribution
landing nowhere they can see it. A timeline with one entry beats an empty profile and a
confirmation toast.

Implementation is contained to `add-story-modal.tsx`: when not editing and
`defaults?.onTimeline === false`, fire one `GET /api/stories?author_id=<activePersonId>&limit=1`
on mount; if it returns zero rows, set `onTimeline` true and render one muted line under the
toggle saying this first story starts your timeline. Any fetch failure leaves the existing
false default, so the failure mode is today's behaviour.

Alternative: always default true from the person page. Rejected: it breaks the documenting
case for established members, which is the reason the flag exists.

**D10. The FTUE exit button returns to the `returnTo` destination when one is present.
DEFAULT: yes.**

`onboarding-flow.tsx:262` pushes to `/${activeCommunitySlug}` and drops everything (F9). A
listener who backs out of signup should land back on the guest's page they came from, not on
a community home page they have never seen. One line, and the intent params can ride along
verbatim: the replay is gated on an authenticated viewer, so a signed-out arrival simply sees
the page with a dead param.

**D11. This brief ABSORBS repair R4 of `features/funnel-drop-off-repairs-brief.md` in full,
and absorbs one line of R7. DEFAULT: yes, and R4 is struck from that brief before either
ships.** Detail in section 4. Two briefs must not both build the proxy hop.

---

## 1. Why this, why now

The FNRad sponsorship is announced. Episode 1 lands in one to two weeks and its community
challenge asks listeners to add a story about that episode's guest.

Adding a story requires an account. So the challenge is a chain: hear the name, open the
guest's page, press a button, sign up, write. Today that chain has a hole in every link
except the last one. A logged-out visitor on a person page does not even see the button
(F10). If they find their way to signup another way, the sign-in page throws the destination
away the instant they click "Create your timeline" (F5). If they get past that, the proxy,
the FTUE OAuth call and the FTUE magic-link call each drop it again (F3, F6). And
`/auth/complete` ends with `router.replace(returnTo ?? "/{community}/profile")` (F8), so with
`returnTo` null the listener lands on their own brand new empty profile, with no trace of the
guest they came for, one minute after hearing a podcast ask them to write about that guest.

This is not a funnel inefficiency. It is a challenge that cannot be completed by following
its own instructions.

Jay has already made the strategic call: sign up first, then write. Not an anonymous draft
held across signup. So the job is narrow and it is not a writes-while-logged-out feature. The
job is to carry one small piece of state through the signup chain and spend it once on
arrival.

Build it general. `features/fnrad-listener-landing-brief.md` D7 routes a rider challenge to
`/people/{id}` and stops there; this brief is what makes that landing do something for a
listener without an account. The next campaign will want a place, a board or an event, and
the mechanism should already work.

---

## 2. Prerequisites

- **P1.** Pull `main`. Line numbers below were verified against `39f169d` (September 4 2026).
  **Re-verified against `b7713e0` on September 6:** ten PRs have merged since (#223 to #232,
  the catalog provenance layer, the Issuu merge, the shared unverified badge, and the
  three-phase duplicate-person prevention work). Of the twelve files this brief touches,
  **eleven are byte-identical** to the drafting baseline. The one exception is
  `src/components/ui/add-story-modal.tsx`, changed by PR #227 (+3 / -1): the component now
  pulls `catalogLoaded` from the store and passes `loading={!catalogLoaded}` plus
  `loadingLabel="Loading riders..."` to the rider picker in the Tag riders block. That is
  additive and helpful (T6 wants that block anyway, and a pre-tagged chip arriving before
  the catalog loads is exactly the race it guards), but **everything cited below line 580 in
  that one file shifts by +2**. Re-grep that file; the other eleven you can trust as written.
- **P2.** `npm run dev` runs from the repo root you are building in (`$HOME/lineage` on Jay's
  machine). Stop any pre-existing dev server first so port 3000 binds to the right instance
  (playbook check 20). Cowork cannot render this: its bridge shell is linux/arm64 against
  darwin-arm64 SWC binaries, so every visual criterion in section 8 is unverified until this
  session runs it.
- **P3.** For the magic-link criteria (A6, A7), `.env.local` must carry
  `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY`, or the route short-circuits to
  `{ fallback: true }` at `route.ts:87-89` and you will be exercising the client OTP path
  instead of the branded link. Both paths must pass, but know which one you are on.
- **P4.** If you smoke-test on a Vercel preview deployment, that host must be in Supabase
  Authentication then URL Configuration then Redirect URLs, or Supabase discards `redirect_to`
  and the magic-link criteria fail for a reason that is not in this diff. See D7 and
  section 11.
- **P5.** ~~`git status` before you start: the working tree carries a stranded badge diff and
  may carry a stale `.git/index.lock`.~~ **CLEARED September 6 2026.** That diff shipped as
  PR #226 (BUG-177, BUG-178), there is no `.git/index.lock`, and the tree is clean apart from
  one unrelated modified line in `bugs/README.md`. `npx tsc --noEmit` was run on `b7713e0` and
  exits clean, so you are starting from a green baseline. Still run `git status` out of habit.
- **P6.** ~~Confirm with Jay that R4 is struck from `funnel-drop-off-repairs-brief.md`.~~
  **DONE September 4 2026.** R4 in that brief now carries an ABSORBED banner pointing here and
  its original text is retained for reference only; R7 carries a PARTIALLY ABSORBED banner
  naming the one line that moved (the `returnTo` construction in `sign-in-prompt.tsx`). Neither
  has shipped, so T2.1 and T3.1 below are edits, not rebases. Read both banners before starting
  so you do not build either repair twice.

---

## 3. Scope

Six tasks, one PR, in build order.

1. **T1.** `src/lib/intent.ts`: the intent type, encoder, validating reader and action
   allowlist.
2. **T2.** Press time: `SignInPrompt` carries path plus search, and the person page renders a
   signed-out CTA carrying the intent.
3. **T3.** The signin-to-onboarding hop: the "Create your timeline" link carries `returnTo`,
   and the two `/auth/callback` error bounces stop discarding it.
4. **T4.** The signup chain: `proxy.ts`, `OnboardingFlow`, `SaveStep` (both OAuth providers,
   the magic-link POST body and the OTP fallback), plus the `pending_onboarding` fallback read
   at `/auth/complete`.
5. **T5.** Replay: the person page opens the composer once from an arriving intent and clears
   it.
6. **T6.** Composer polish: named header, pinned tag chip, first-story timeline default.

**Size honesty.** T1 to T5 are the mechanism and are roughly 2.5 to 3 hours. T6 is roughly
45 minutes and is the trim line: if the session runs long, T6.3 (the timeline default) can be
dropped without breaking anything else, and T6.1 and T6.2 are cosmetic enough to follow in a
second small PR. T1 to T5 must ship together or nothing works.

---

## 4. Out of scope (hard list)

Do not build these in this session.

- **Anonymous writes of any kind.** No write-then-signup, no draft held across the signup
  chain, no local composer state restored after auth. Jay decided sign up first, then write.
  The intent carries a POINTER, never content.
- **Any change to the tag pipeline.** The pre-tagged rider goes through the same
  `story_riders` write the composer already does, with the same pending-tag consent rules.
  Nothing about approvals, notifications or `/me/tags` changes.
- **Any new analytics.** No new event names, no new properties, no taxonomy. The existing
  `signin_started`, `signup_started`, `signup_succeeded` and `ftue_completed` calls are
  untouched. The measurement work is
  `features/funnel-event-completion-brief.md` and `features/funnel-attribution-brief.md`.
- **A second action type.** `add-story` only (D2). Do not add `add-claim`, `open-invite` or
  anything else "while you are in there".
- **The FNRad hub, the episode page and the challenge card.** All of that is
  `features/fnrad-listener-landing-brief.md`. This brief touches no `/fnrad` surface.
- **Any server-side intent storage.** No table, no token, no endpoint.
- **The `/auth/signin` layout redesign and the `SignInPrompt` copy rewrite.** Those are R7 and
  they stay in the other brief (see below).
- **`/api/auth/magic-link/route.ts`.** It already accepts and validates `returnTo` and already
  stashes whatever `onboarding` object the client posts (F7). It needs ZERO changes. If you
  find yourself editing it, stop and re-read D7.

### What this brief absorbs from `features/funnel-drop-off-repairs-brief.md`

Say this out loud before building, because both briefs are live and overlapping work would be
built twice.

| Item there | Status here |
|---|---|
| **R4, all three parts** (proxy stamps `returnTo`; `OnboardingFlow` reads and passes it; `SaveStep` appends it to both OAuth `redirectTo` values and to the magic-link POST body) | **ABSORBED IN FULL** by T4. R4 should be deleted from that brief, and its D5 with it. This brief does everything R4 did and adds the OTP-fallback `emailRedirectTo`, the `pending_onboarding` fallback and the FTUE exit path, which R4 did not cover. |
| **R7 step 1, the `returnTo` construction in `sign-in-prompt.tsx:26`** | **ABSORBED** by T2.1. That line currently uses `usePathname()` only, so it drops search params. This brief makes it path plus search. |
| **R7 step 1, the three-action signup-first redesign of `SignInPrompt`** (D10 and Appendix A4 there: "Create your timeline" primary, "I already have an account" secondary) | **LEFT THERE.** This brief does not touch that component's copy or button hierarchy. |
| **R7 step 3, promoting the `/auth/signin` signup affordance from a 10px inline link to a full-width button** (Appendix A5 there) | **LEFT THERE**, with a collision warning: T3.1 here changes the HREF of the same element (line 335) and R7 changes its SHAPE. Ship this brief first and R7 rebases by keeping the href logic when it restyles. If R7 ships first, T3.1 applies to whatever that element became. Either way the href change must survive. |
| **R1, R2, R3, R5, R6, R8** | **LEFT THERE.** Untouched by this brief. |

Net effect on the other brief: its PR 2 loses R4 entirely and R7 shrinks to a copy and layout
change, which brings that brief down by roughly an hour.

---

## 5. Verified facts (checked against `main` at `39f169d`, September 4 2026)

Provenance so the session does not re-derive these. Anything tagged **AUDIT** was not
verifiable from the repo on disk.

- **F1. `safeReturnTo` is a same-origin path guard, not a route allowlist.**
  `src/lib/safe-redirect.ts:17-24`. It returns the raw string unchanged when it starts with
  `/`, and returns null when: the value is empty or not a string; it does not start with `/`;
  it starts with `//` or `/\`; it contains any backslash; it contains any character in
  `/[\x00-\x1f\x7f]/` (defined at `:9`). It does NOT decode, normalise, strip query strings or
  fragments, or check that the path resolves to a real route. **A query string is legal and
  passes through untouched, which is what makes D1 possible.** The same file exports
  `signInHref(currentPathWithSearch, existingReturnTo)` at `:31-38`, which prefers an existing
  validated `returnTo` over the current path so values never nest; it is used at
  `src/components/ui/nav/guest-menu.tsx:40` and
  `src/app/(community)/[community]/brands/[slug]/page.tsx:428`.
  `currentReturnTo()` is a separate local helper at `src/app/auth/signin/page.tsx:16-19` that
  reads this page's own `?returnTo` from `window.location.search` at action time (deliberately
  not `useSearchParams`, to avoid forcing a dynamic render).

- **F2. `SignInPrompt` builds `returnTo` from the pathname only.**
  `src/components/ui/sign-in-prompt.tsx:25-26`:
  `const pathname = usePathname()` then
  `` const returnTo = pathname ? `?returnTo=${encodeURIComponent(pathname)}` : "" ``. Search
  params, and therefore any intent, are lost. It renders one link to `/auth/signin${returnTo}`
  at `:42-47`.

- **F3. `SignInPrompt` is imported on EIGHT pages, not seven.**
  `src/app/(community)/[community]/brands/page.tsx:9`,
  `src/app/(community)/[community]/places/page.tsx:8`,
  `src/app/(community)/[community]/places/[id]/page.tsx:21`,
  `src/app/(community)/[community]/boards/page.tsx:8`,
  `src/app/(community)/[community]/boards/[id]/page.tsx:20`,
  `src/app/(community)/[community]/events/page.tsx:8`,
  `src/app/(community)/[community]/stories/page.tsx:8`,
  `src/app/people/page.tsx:10`. Seven pass no props;
  `stories/page.tsx:265-268` passes a `message` override, so any signature change must keep
  that prop working.

- **F4. Every auth method on `/auth/signin` preserves `returnTo` except one.** Google at
  `:59-60`, Facebook at `:71-72`, magic-link POST at `:93`
  (`returnTo: currentReturnTo()` in the body), the OTP fallback's `emailRedirectTo` at `:115`,
  and password at `:162` (`router.push(currentReturnTo() ?? "/")`). All five read
  `currentReturnTo()`.

- **F5. The exception is the signup link, and it is the worst one.**
  `src/app/auth/signin/page.tsx:332-338` renders
  `` <Link href="/onboarding">Create your timeline</Link> `` inside a `fontSize: 10` row
  beside a Back button. It is a bare string href with no `returnTo`. This is the link a
  first-time podcast listener clicks.

- **F6. The FTUE save step carries no destination anywhere.**
  `src/components/onboarding/save-step.tsx`: Google `redirectTo` at `:89` and Facebook
  `redirectTo` at `:109` are both a bare `` `${window.location.origin}/auth/callback` ``; the
  magic-link POST body at `:134-138` is `{ email: e, onboarding: onboardingPayload }` with no
  `returnTo` and no `intent`; the OTP fallback's `emailRedirectTo` at `:157` is a bare
  `` `${window.location.origin}/auth/complete` ``. `buildOnboardingPayload()` at `:15-25`
  returns `display_name`, `birth_year`, `start_year`, `first_place_id`, `first_board_id` and
  `sessionClaims` and takes no arguments. The step also has NO sign-in affordance for a
  returning member (its only links, at `:285` and `:287`, are Terms and Privacy), which is why
  D5 routes to `/auth/signin` rather than `/onboarding`.

- **F7. `/api/auth/magic-link` already accepts everything this brief needs.**
  `src/app/api/auth/magic-link/route.ts:65-72` destructures `{ email, intent, returnTo,
  onboarding }` from the body. Note that its `intent` field is `"signin" | "signup"` and is
  UNRELATED to this brief's intent object; do not overload it. `:79` validates with
  `safeReturnTo`. `:124-127` builds
  `` completeRedirect = `${origin}/auth/complete?returnTo=<encoded>` `` from an origin
  allowlist (`https://linestry.com`, `https://lineage.wtf`, `https://lineage.community`,
  `http://localhost:3000`, else rewritten to production), and `:128-134` passes it to
  `admin.generateLink` as `redirectTo`. **So `returnTo` already survives a link opened on a
  different device: it is baked into the emailed URL, not into localStorage.** Separately,
  `:149-156` stashes the posted `onboarding` object verbatim into
  `user_metadata.pending_onboarding` via `admin.updateUserById`, which writes `user_metadata`
  wholesale. The route needs no change for this brief.

- **F8. `/auth/complete` reads both channels and then redirects.**
  `src/app/auth/complete/page.tsx:25` validates `returnTo` from its own search params; `:26`
  preserves it on the expiry bounce; `:51-64` reads `user.user_metadata.pending_onboarding`
  and merges it under the local store (store wins when present, stash only repairs the
  cross-context case), with a typed shape listing `display_name`, `birth_year`, `start_year`,
  `first_place_id`, `first_board_id` and `sessionClaims`; `:225` ends with
  `` router.replace(returnTo ?? `/${activeCommunitySlug}/profile`) ``. With `returnTo` null a
  brand new member lands on their own empty profile.

- **F9. Two more places the destination dies.** `src/proxy.ts:207-211`: when an unauthenticated
  request hits a protected path (`/[community]/timeline`, `/me`, `/me/*`) it clones the URL,
  sets `pathname = "/onboarding"` and redirects, with no `returnTo`. The clone preserves the
  INCOMING query string, so build the target URL explicitly rather than mutating the clone or
  the old query and the new `returnTo` both ride along.
  `src/components/onboarding/onboarding-flow.tsx:260-263`: the exit path is
  `` router.push(`/${activeCommunitySlug}`) `` and loses everything.

- **F10. The person page's add-story button is invisible to a logged-out visitor.**
  `src/app/people/[id]/page.tsx:415-430` gates the whole two-button row on
  `!isCurrentUser && isAuthUser(activePersonId)`; the "Add story about {First}" button is at
  `:423-428` and sets `showAddStory`. `isAuthUser` is
  `id.length > 8 && !id.startsWith("dev-")` (`src/store/lineage-store.ts:46-48`), so a
  signed-out visitor with an empty `activePersonId` fails it. The file's imports at `:1-35`
  contain NO `SignInPrompt`, unlike the eight pages in F3. The person id used for defaults is
  `resolvedId` (`:103`, `resolvedPerson?.id ?? id`).

- **F11. `AddStoryModal`'s `defaults.riderIds` is a React prop and nothing else.**
  `src/components/ui/add-story-modal.tsx:20-36` declares the `defaults` prop
  (`linkedPlaceId`, `linkedEventId`, `linkedOrgId`, `boardId`, `riderIds?: string[]`,
  `onTimeline?: boolean`); `:107-109` seeds
  `selectedRiderIds` from `editStory?.rider_ids ?? defaults?.riderIds ?? []`. There is no query
  param, no store action and no URL that opens this modal. It has exactly TWO call sites:
  `src/app/people/[id]/page.tsx:776-786` and
  `src/components/timeline/people-in-timeline.tsx:142-151`. The modal calls `loadCatalog()` on
  mount (`:54-56`) and reads `catalog.people` at `:115`, so a name lookup inside it is free.

- **F12. `lineage-store-v2` partializes by exclusion.**
  `src/store/lineage-store.ts:1150-1157`. `name: "lineage-store-v2"`, and `partialize` strips
  exactly: `dbClaims`, `catalog`, `catalogLoaded`, `showMemberCard`, `authReady`,
  `communities`, `catalogError`, `toasts`, `tokenEarnTick`, `celebrationQueue`,
  `showWelcomeCelebration`, `pendingTagCount`, then spreads the rest. **Everything not on that
  list is persisted to localStorage**, so any new store field survives reloads by default and
  would need its own reset rules. There is also `storeOwnerId` (`:177`, `:1027`, `:1030`) which
  stamps the auth user a persisted slice belongs to, from BUG-168. This is the reason for D3.

- **F13. The pre-tagged rider is on a hidden tab.** `add-story-modal.tsx:77` sets
  `activeTab` to `"details"`; the tab bar is at `:287-300`; the "Tag riders" `SearchPicker`
  seeded by `selectedRiderIds` renders at `:570-584`, inside the `links` tab block. So the
  chip is real but invisible on open.

- **F14. The header is generic and the timeline default is off.**
  `add-story-modal.tsx:282`: `{isEditing ? "Edit Story" : "Add a Story"}`.
  `src/app/people/[id]/page.tsx:778`: `defaults={{ riderIds: [resolvedId], onTimeline: false }}`,
  and `add-story-modal.tsx:69-73` shows `defaults.onTimeline` wins over the
  `startedFromEntity` rule. So a listener's first contribution does not land on their own
  timeline.

- **F15. The OAuth hop preserves `returnTo` but its error bounces do not.**
  `src/app/auth/callback/route.ts:12-13` validates and forwards `returnTo` to
  `/auth/complete`, but `:16` (`?error=no_code`) and `:40` (`?error=auth_failed`) both
  redirect to a bare `/onboarding` and discard it.

- **F16. `/api/stories` supports the first-story check.**
  `src/app/api/stories/route.ts:28-42` accepts `author_id`, `limit` and `offset`, and
  `:84-96` gives the author's own list the viewer-pinned visibility clause. There is no
  `story_count` column or cached count anywhere in `src/`, so a one-row fetch is the cheapest
  available check (D9).

- **F17. The FNRad brief hands off to exactly this surface.**
  `features/fnrad-listener-landing-brief.md` D7 routes a RIDER challenge to `/people/{id}`
  rather than giving it an anonymous mark, and its T5 renders the challenge prompt as a link
  to `entry.href`. That is the URL this brief makes work for a signed-out listener.

- **F18. AUDIT: the episode-1 guest's person record.** Whether that guest exists in `people`,
  whether their id is a real uuid or a legacy mock id, and whether their page renders, cannot
  be checked from the repo. Check it in Supabase before the acceptance pass. `people/[id]`
  guards with a uuid regex at `:146` and falls through to `notFound()` for unknown slugs, so a
  legacy id could make the whole path fail for a reason unrelated to this diff.

---

## 6. Task specs

### T1. `src/lib/intent.ts`, the intent object

New file, no dependencies beyond `safeReturnTo`. Everything else imports from here so there is
one definition of what an intent is and one place section 10 applies.

Exports:

- `export const INTENT_ACTIONS = ["add-story"] as const` and
  `export type IntentAction = typeof INTENT_ACTIONS[number]`.
- `export type Intent = { path: string; action?: IntentAction; subject?: string }`.
  `path` is the destination, root-relative, may carry its own unrelated query params.
- `export function encodeIntent(intent: Intent): string`. Returns the destination URL with
  `intent` and `subject` appended as query params (using `URLSearchParams` on the existing
  query so an unrelated param is preserved), then runs the result through `safeReturnTo` and
  returns it, or returns the bare `path` when the action is not in the allowlist. This is the
  value callers put in `?returnTo=`. Callers encode it once with `encodeURIComponent`.
- `export function readIntent(search: string | URLSearchParams): Intent | null`. Reads
  `intent` and `subject`. Returns null when `intent` is absent. Returns null when `intent` is
  not in `INTENT_ACTIONS`. Returns null when `subject` is absent or fails
  `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. No other param is read,
  and no free text is ever accepted.
- `export function stripIntent(search: string): string`. Returns the query string with
  `intent` and `subject` removed, for the clear step in T5.
- `export const INTENT_PARAMS = ["intent", "subject"] as const`, used by `stripIntent` and by
  anything that needs to know the reserved names.

Reserved param names are `intent` and `subject`. Grep before you commit to them: `intent` is
already a BODY field on `/api/auth/magic-link` with a different meaning (F7), which is fine
because it never appears as a query param there, but do not pass this brief's intent into that
field.

Write a short block comment at the top saying what an intent may and may not contain, pointing
at section 10 of this brief. The next person who wants to add an action type will read it.

### T2. Press time

**T2.1. `src/components/ui/sign-in-prompt.tsx`.** Replace the pathname-only construction at
`:25-26` with path plus search:

```
const pathname = usePathname()
const search = typeof window !== "undefined" ? window.location.search : ""
const target = safeReturnTo(`${pathname ?? ""}${search}`)
const returnTo = target ? `?returnTo=${encodeURIComponent(target)}` : ""
```

Guard the `window` read for SSR. Nothing else in the component changes: same single link,
same copy, same `message` prop (F3 requires that prop keeps working). This is the whole of
what this brief takes from R7.

**T2.2. `src/app/people/[id]/page.tsx`.** Split the button row at `:415-430`. The signed-in
branch is unchanged. Add a signed-out branch, `!isCurrentUser && !isAuthUser(activePersonId)`,
rendering ONE `<Link>` with the same classes as the existing add-story button at `:423-428`
and the label **"Add your story about {First}"** (note "your", which is the copy difference
from the signed-in button, and is what makes the invitation personal rather than
administrative).

Its href:

```
const intentHref = encodeIntent({ path: `/people/${resolvedId}`, action: "add-story", subject: resolvedId })
const signupHref = `/auth/signin?returnTo=${encodeURIComponent(intentHref)}`
```

Do NOT render the "+ Add connection" button in the signed-out branch. One affordance, one
sentence, one destination. Playbook check 16 (say WHY a conditional action is unavailable) is
satisfied differently here: the action is not hidden with an explanation, it is offered and
the explanation lives on the page it leads to.

Import `encodeIntent` from `@/lib/intent`. Do not import `SignInPrompt` (D5).

### T3. The signin-to-onboarding hop

**T3.1. `src/app/auth/signin/page.tsx:332-338`.** The bare `<Link href="/onboarding">` becomes
a link that carries `returnTo`. Because it renders rather than fires, compute it once on
mount:

```
const [onboardingHref, setOnboardingHref] = useState("/onboarding")
useEffect(() => {
  const rt = currentReturnTo()
  if (rt) setOnboardingHref(`/onboarding?returnTo=${encodeURIComponent(rt)}`)
}, [])
```

`currentReturnTo()` already exists on this page and already validates (F1). Keep the element's
shape exactly as it is; only the href changes. See D11 for the R7 collision.

**T3.2. `src/app/auth/callback/route.ts:16` and `:40`.** Both error bounces append the
validated `returnTo` to `/onboarding` when one is present, so a listener whose OAuth attempt
failed keeps the guest through the retry. Two lines. This is NOT R1 (that brief renders the
error message; this only stops throwing the destination away).

### T4. The signup chain

**T4.1. `src/proxy.ts:207-211`.** Build the redirect target explicitly rather than mutating the
clone (F9):

```
const target = safeReturnTo(`${path}${request.nextUrl.search}`)
const url = new URL("/onboarding", request.url)
if (target) url.searchParams.set("returnTo", target)
return NextResponse.redirect(url)
```

Import `safeReturnTo` from `@/lib/safe-redirect`. The value is derived from our own request
URL, but it goes through the same guard so there is one code path and one set of rules.

**T4.2. `src/components/onboarding/onboarding-flow.tsx`.** Read `returnTo` from this page's own
URL once, using the `window.location.search` pattern already used at `:173` for `?from=intro`
(do NOT introduce `useSearchParams`, it forces a dynamic render). Validate through
`safeReturnTo`. Hold it in a `useRef` or a lazily initialised `useState`, not in the Zustand
store (D3): it is per-visit.

Two consumers:
- Pass it to `<SaveStep>` at `:632` as a `returnTo` prop.
- Use it in `exitToBrowsing` at `:260-263`: push `returnTo` when present, otherwise the
  existing `/${activeCommunitySlug}` template,
  verbatim, intent params included (D10). Leave the `ftue_exited` event exactly as it is.

**T4.3. `src/components/onboarding/save-step.tsx`.** Accept `returnTo?: string | null` in the
props object at `:67-76`, defaulting to null. Then four edits:

1. `:89`, Google `redirectTo`, becomes
   `` `${window.location.origin}/auth/callback${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}` ``,
   the exact shape `signin/page.tsx:60` already uses.
2. `:109`, Facebook `redirectTo`, the same.
3. `:137`, the magic-link POST body, gains `returnTo`. Do NOT add an `intent` field: that name
   is taken on this route and means something else (F7).
4. `:157`, the OTP fallback `emailRedirectTo`, gains
   `` `?returnTo=${encodeURIComponent(returnTo)}` `` on `/auth/complete`. R4 in the other brief
   missed this one, and it is the path every local dev smoke test actually runs (P3).

Then D7's second channel: `buildOnboardingPayload()` at `:15-25` takes an optional
`returnTo` and includes it in the returned object when present. Both the server stash
(`:137` body) and the OTP fallback stash (`:161` `data.pending_onboarding`) then carry it with
no route change.

**T4.4. `src/app/auth/complete/page.tsx`.** Add `returnTo?: string` to the `pending` type at
`:51-58`, and after the existing `returnTo` read at `:25` fall back to the stash:

```
const effReturnTo = returnTo ?? safeReturnTo(pending?.returnTo ?? null)
```

placed where `pending` is in scope, and use `effReturnTo` at `:225`. **Re-validate through
`safeReturnTo` even though the value came back from our own server**: it originated in a
client POST body, and a value's storage location is not a warrant for its content (section 10).
Leave the expiry bounce at `:26` reading the URL value only; there is no session yet at that
point, so there is no stash to read.

### T5. Replay on arrival

**`src/app/people/[id]/page.tsx`.** One effect. Preconditions, all required:

- `catalogLoaded` is true (the composer's rider name lookup needs it, and the page already
  gates its own fetches on it at `:130`),
- `isAuthUser(activePersonId)` is true,
- a `useRef` latch is unset,
- `readIntent(window.location.search)` returns an intent whose `action === "add-story"` and
  whose `subject === resolvedId`.

That last clause matters and is not redundant: it means an intent can only ever open a
composer on the page it names. An intent for person A pasted onto person B's URL does nothing.

When all four hold, in this order:

1. Set the ref latch.
2. `router.replace(pathname + stripIntent(window.location.search))` to clear the intent from
   the URL and from history (D4).
3. `setShowAddStory(true)`.

The existing modal render at `:776-786` needs no change; it already passes
`riderIds: [resolvedId]`. Fire no new analytics event (out of scope).

If any precondition fails, do nothing at all: no toast, no error, no redirect. A signed-out
visitor arriving with an intent in the URL sees the ordinary page plus the T2.2 CTA, which is
the correct recovery.

### T6. Composer polish

**T6.1. Named header.** `add-story-modal.tsx:282`. When `!isEditing` and
`defaults?.riderIds?.length`, resolve the first id against the catalog and, when found, render
`Add a story about {firstName}`. The lookup must cover both catalog people and user-added
people, matching how the person page merges them (`people/[id]/page.tsx:40`):

```
const taggedPerson = !isEditing && defaults?.riderIds?.[0]
  ? [...catalog.people, ...(userEntities.people ?? [])].find((p) => p.id === defaults.riderIds![0])
  : undefined
```

`userEntities` comes from the same `useLineageStore()` destructure at `:41`. When the lookup
misses, fall back to the existing "Add a Story" string. **Never render an id, and never render
anything derived from the URL, in this header.** See section 10.

**T6.2. Pinned tag row.** Directly under the header block (after `:284`, before the tab nav at
`:287`), when `selectedRiderIds.length > 0` and not editing, render one muted row:
`Tagging: {names}` as non-interactive chips, plus a small text button reading `Edit tags` that
calls `setActiveTab("links")`. Names resolve the same way as T6.1. This renders on BOTH tabs,
so the tag is never invisible (F13), and it costs no layout in the common case because it only
appears when riders are pre-selected.

**T6.3. First-story timeline default.** In `add-story-modal.tsx`, when `!isEditing` and
`defaults?.onTimeline === false` and `isAuthUser(activePersonId)`, run one effect on mount:

```
fetch(`/api/stories?author_id=${activePersonId}&limit=1`)
  .then((r) => r.json())
  .then((rows) => { if (Array.isArray(rows) && rows.length === 0) setOnTimeline(true) })
  .catch(() => {})
```

When it flips, render one muted line under the existing timeline toggle:
`This is your first story, so it starts your timeline.` Any failure leaves the false default,
so the worst case is today's behaviour (D9). Do not change
`src/app/people/[id]/page.tsx:778`; the explicit `onTimeline: false` stays as the rule for
everyone who already has a story.

---

## 7. Surface pairing (playbook check 12)

No new endpoints, so this table pairs each mechanism part with where a person actually meets
it.

| Thing changed | Where the user meets it | Affordance |
|---|---|---|
| `src/lib/intent.ts` | Nowhere directly | Shared module, no UI |
| Signed-out person-page CTA (T2.2) | `/people/{id}` for any visitor without a session | Button-styled link, "Add your story about {First}" |
| `SignInPrompt` search-param fidelity (T2.1) | The eight pages in F3, unchanged visually | None, existing modal behaves correctly |
| Signup link carries `returnTo` (T3.1) | `/auth/signin` footer row, "Create your timeline" | Existing link, new href |
| OAuth error bounces keep `returnTo` (T3.2) | `/onboarding?error=...` after a failed provider hop | None visible, retry lands correctly |
| Proxy stamps `returnTo` (T4.1) | Any signed-out hit on `/[community]/timeline` or `/me/*` | None visible |
| FTUE carries and returns (T4.2, T4.3) | `/onboarding`, including its exit button | Exit button lands back on the guest page |
| Magic-link and OTP carry `returnTo` (T4.3) | The emailed sign-in link, on any device | Link lands on the destination, not the profile |
| `pending_onboarding.returnTo` fallback (T4.4) | Invisible; only fires when Supabase dropped `redirect_to` | None |
| Replay (T5) | `/people/{id}` immediately after `/auth/complete` | Composer opens by itself, pre-tagged |
| Named header and pinned chip (T6.1, T6.2) | The composer, whenever a rider is pre-tagged | Header names the guest, chip row under it |
| First-story timeline default (T6.3) | The composer's timeline toggle, first story only | Toggle pre-set on, one muted explanation line |

---

## 8. Acceptance criteria

- **A1. The episode-1 listener path, end to end, in a private window with no session.**
  Open `/people/{episode-1-guest-id}` cold. See "Add your story about {First}". Click it. Land
  on `/auth/signin` with the guest's page plus `intent=add-story&subject={id}` visible inside
  the `returnTo`. Click "No account yet? Create your timeline". Land on `/onboarding` with
  `returnTo` still on the URL. Complete the FTUE (name, start year). Sign up with Google. After
  `/auth/complete`, land on `/people/{guest-id}` with the composer ALREADY OPEN, its header
  reading "Add a story about {First}", the guest's chip visible without touching a tab, and the
  timeline toggle on. Write a sentence, save. The story appears on the guest's page AND on the
  new member's own timeline. The URL bar shows a clean `/people/{id}` with no intent params.
- **A2. Same as A1 but with the magic link.** The email arrives, the link opens in the same
  browser, and the landing is identical to A1.
- **A3. Same as A2 but CROSS DEVICE.** Start the FTUE on desktop, open the emailed link on a
  phone. The composer opens pre-tagged there. This is the criterion that proves the intent
  rides the link and not localStorage (F7, D7).
- **A4. Reload does not re-fire.** After A1's composer opens, close it without saving and
  reload the page. No composer. Press browser Back. No composer. (D4.)
- **A5. Replay never fires for a signed-out viewer.** Paste
  `/people/{id}?intent=add-story&subject={id}` into a private window. The page renders
  normally, the T2.2 CTA is present, no composer, no error, no redirect.
- **A6. Cross-page intents do nothing.** Take the intent params from person A's URL and paste
  them onto person B's page while signed in. No composer opens. (T5's subject-matches-page
  clause.)
- **A7. Unknown actions degrade to navigation.** `/people/{id}?intent=delete-everything&subject={id}`
  while signed in: the page renders, no composer, no error. Then the same as a `returnTo`
  through the whole signup chain: the member lands on the person page and nothing fires.
- **A8. Open-redirect attempts still die at the guard.** `returnTo=//evil.com`,
  `returnTo=https://evil.com`, `` returnTo=/\evil.com `` and a control-character variant each
  produce the default landing, from `/auth/signin`, from `/onboarding` and from the emailed
  link. (F1.)
- **A9. The proxy hop round-trips.** Signed out, open `/me/timeline?foo=1`. Land on
  `/onboarding?returnTo=%2Fme%2Ftimeline%3Ffoo%3D1` with no stray copy of the original query
  string on the onboarding URL itself (F9). Complete signup, land on `/me/timeline?foo=1`.
- **A10. The FTUE exit returns you.** Arrive at `/onboarding` from A1, press the exit
  affordance, land back on the guest's person page rather than the community home.
- **A11. Nothing regressed for a signed-in member.** On someone else's profile with an existing
  story to your name, press "Add story about {First}" the ordinary way. Header names them, chip
  row shows, and the timeline toggle is OFF (D9 only flips for a zero-story author).
- **A12. The eight `SignInPrompt` pages still work**, including
  `stories/page.tsx:265` with its `message` override, and a prompt fired from a page with a
  query string (for example `/people?mine=1`) now returns to that query string, not the bare
  path.
- **A13. `npx tsc --noEmit` is clean, and `npm run lint` shows no new warnings.**
- **A14. Both `AddStoryModal` call sites still compile and behave**: the person page
  (`:776-786`) and `people-in-timeline.tsx:142-151`. The latter passes `riderIds` with no
  `onTimeline`, so T6.3 must not fire for it (its `defaults?.onTimeline` is undefined, not
  false).

---

## 9. Migration

**None.** No schema change, no new column, no backfill, no Postgres view, no plpgsql function,
no `_public` view rebuild. Playbook checks 1, 3, 4, 5, 9, 19, 23 and 24 are not applicable for
that reason.

One data dependency, not a migration: F18. Confirm the episode-1 guest's person row exists and
its id is a real uuid before the A1 pass, because `people/[id]` regex-guards on uuid shape at
`:146`.

The only cross-request state this introduces is `user_metadata.pending_onboarding.returnTo`
(D7), which is written by the existing route on an existing key and is read once. It expires
with the magic link, and a stale value cannot do anything on its own: it is only read at
`/auth/complete`, only when the URL carries no `returnTo`, and only after `safeReturnTo` and
`readIntent` have both passed it (T4.4, section 10).

---

## 10. Security

An intent that fires an action on arrival is a new class of thing in this app, so state the
threat plainly rather than trusting the plumbing.

**What an attacker can craft.** Anything: the intent is a URL, and a URL is entirely under the
sender's control. A crafted link can name any action string, any subject id, any destination,
and it can be sent to someone who is about to sign up, which is a moment of low suspicion. So
the question is not whether a hostile intent can arrive. It will. The question is what the
worst thing it can cause is.

**What the design permits it to cause.** Exactly one thing: an authenticated member lands on an
internal page and a composer opens, pre-filled with a rider tag. That is it. Every other
outcome is closed:

1. **It cannot become an open redirect.** Every hop validates through `safeReturnTo`
   (F1): press time (T2.1, T2.2), the signin page (F4), the proxy (T4.1), the FTUE
   (T4.2), the magic-link route (F7), the OAuth callback (F15), and the landing (T4.4). A
   value that is not root-relative, or that carries a backslash, a protocol-relative prefix or
   a control character, is dropped and the default landing is used.
2. **It cannot submit anything.** The replay's only effect is `setShowAddStory(true)`. It never
   calls save, never touches `supabase.from(...)`, and never populates the title or body. The
   member sees an empty composer and must type and press Save. Every write on this path is a
   deliberate human action, and this is the invariant that must survive any future action type:
   **a replay may only ever OPEN a prefilled surface, never complete one.**
3. **It cannot run an action we did not design.** `readIntent` returns null for any `intent`
   value outside `INTENT_ACTIONS` (D2, T1). There is no dynamic dispatch, no string-to-handler
   map keyed on user input, and no default case that does something.
4. **It cannot inject content.** The intent has no free-text field. `subject` must match a uuid
   regex before it is used, so a crafted value cannot carry a name, a URL or markup. And the
   composer's header renders the name resolved from the CATALOG, never a string from the URL
   (T6.1), so a link cannot make the modal say "Add a story about Nick Perata (verify your
   account at ...)". If the subject does not resolve to a real person, the header falls back to
   the generic string. This is the specific phishing shape to keep closed: the composer is a
   trusted-looking surface, and everything it says must come from our data.
5. **It cannot act on a page it does not name.** T5 requires `subject === resolvedId`, so the
   only page an `add-story` intent can open a composer on is the person it points at.
6. **It cannot fire for the wrong person, or twice.** The replay requires
   `isAuthUser(activePersonId)`, and it clears itself from the URL and history before the modal
   opens (D4). A link forwarded to a third party opens their composer for the same guest, which
   is the intended behaviour of a shareable deep link and writes nothing.
7. **A value recovered from the server is re-validated.** `pending_onboarding.returnTo` came
   from a client POST body and was stored verbatim by the route (F7). T4.4 runs it through
   `safeReturnTo` on read. Storage location is not provenance.

**What is deliberately NOT defended, and why that is acceptable.** `safeReturnTo` is a path
guard, not a route allowlist (F1), so an intent can name any internal path, including
`/me/settings/...`. That is already true of every `returnTo` in the app today and this brief
does not widen it: navigating an authenticated member to a page they are already entitled to
see is not a capability. The intent params on such a path are simply never read, because only
pages that opt in call `readIntent`.

**The rule for the next action type.** Before adding an entry to `INTENT_ACTIONS`, it must pass
all seven points above. If a proposed action cannot satisfy point 2 (open only, never submit),
it does not belong in this mechanism and needs its own design and its own security review.

---

## 11. Risks and gotchas

- **The Supabase Redirect URLs allowlist, and it will bite on preview deploys.** If the host
  sending the magic link is not in Supabase Authentication then URL Configuration then Redirect
  URLs, Supabase discards `redirect_to` and falls back to Site URL, and A2, A3 and A9 fail with
  a symptom that looks exactly like this diff being wrong. The `pending_onboarding` fallback
  (D7) is what keeps the intent alive when that happens, so if A3 passes but the URL bar does
  not show the intent, you are on the fallback channel and the allowlist is the real problem.
  `features/funnel-drop-off-repairs-brief.md` D8 covers the origin allowlist fix; it is NOT in
  this brief.
- **`returnTo` nesting.** A visitor already on a page with `?returnTo=` who triggers another
  sign-in link can end up with a returnTo inside a returnTo. `signInHref` guards against this
  (F1) but `SignInPrompt` and T2.2 build their hrefs by hand. On the person page this cannot
  happen (the path is constructed, not read). If you add a third hand-built href, use
  `signInHref` instead.
- **Strict Mode double-fire.** Without the T5 ref latch, development opens two stacked modals
  and it will look like a state bug. It is not.
- **Catalog timing.** The replay is gated on `catalogLoaded` because the composer's name lookup
  needs it. If it fires earlier the composer opens with a correct tag and a generic header,
  which is not broken but is the exact regression T6.1 exists to prevent. Keep the gate.
- **The `intent` name collision.** `/api/auth/magic-link` already has a body field called
  `intent` meaning `"signin" | "signup"` (F7). Passing this brief's intent into it would change
  whether the route creates an account. Do not.
- **The R7 collision on `signin/page.tsx:335`.** Two live briefs edit the same element. D11 and
  section 4 say how; read them before you touch that line.
- **`userEntities.people` may be undefined.** The person page uses `?? []` at `:40`; T6.1 must
  do the same.
- **Line-number drift (P1), not a dirty tree.** The tree is clean as of September 6 and the
  diff P5 used to warn about shipped as PR #226. What is live instead: line numbers here are
  against `39f169d`, and on `b7713e0` every file this brief touches is byte-identical EXCEPT
  `src/components/ui/add-story-modal.tsx`, where PR #227 added two lines, so citations below
  line 580 in that one file shift by +2. Re-grep that file; trust the other eleven.
- **Copy rule.** No em dashes anywhere in this brief or in any string it adds (playbook check
  21). Use commas, colons, or "to" in ranges.

---

## 12. Rollback

Single flip point. Reverting the PR removes everything, because there is no persisted state to
unwind:

- No schema, no migration, no backfill.
- No new store field (D3), so nothing lingers in `lineage-store-v2` (F12).
- The only durable artifact is `returnTo` nested inside
  `user_metadata.pending_onboarding` on accounts created by magic link during the window. After
  a revert, `/auth/complete` simply stops reading that key. It is inert, it is scoped to that
  one nested field, and it does not need cleaning up.
- Live magic links minted before the revert still carry `?returnTo=` in their redirect. After a
  revert `/auth/complete` still honours a plain `returnTo` (that is pre-existing BUG-054
  behaviour, F8), so those members land on the person page. The composer just will not open,
  which is exactly today's behaviour.

Partial rollback: T6 (composer polish) can be reverted alone without touching the mechanism.
The reverse is not true. T1 to T5 are one unit.

---

## 13. Suggested order

Build in dependency order, and keep the activating change last so nothing is half-wired in the
tree.

1. **T1**, `src/lib/intent.ts`. Nothing imports it yet.
2. **T4**, the signup chain (proxy, `OnboardingFlow`, `SaveStep`, `/auth/complete`). This is
   pure `returnTo` plumbing and is independently testable with A9 before any intent exists.
3. **T3**, the signin-to-onboarding hop. Now A9 can start from `/auth/signin`.
4. **T5**, the replay. Testable by hand-typing an intent URL while signed in (A6, A7) before
   any CTA exists.
5. **T6**, composer polish. Testable from the existing signed-in button (A11).
6. **T2**, press time, LAST. T2.2 is the activating change: it is the first thing that mints an
   intent for a real visitor, and nothing above it should be discovered broken by a listener.
7. Full A1 to A3 pass.

---

## 14. Ship sequence

Per the repo `CLAUDE.md` standing rule. No migration and no ops gate this time, so it is the
short form.

1. `rm -f .git/index.lock` if present, confirm the working tree (P5), branch off `main`.
2. Build in the section 13 order.
3. `npx tsc --noEmit` and `npm run lint` clean (A13).
4. Run A4 to A14 locally.
5. Push the branch, open the PR.
6. Run A1, A2 and A3 against the deploy. A3 needs a real phone and a real email; do not sign it
   off from a desktop browser with a second profile, because the thing being tested is exactly
   that the intent is not in localStorage.
7. Prompt Jay for the merge and wait. Do not self-merge.
8. Append one entry to `bugs/SHIP-LOG.md` (see the line at the end of this brief).
9. After deploy, walk A1 once on production against the real episode-1 guest page (F18), on a
   phone, on cellular. That is the actual listener path and it is the only sign-off that counts
   for the campaign.

---

## 15. Follow-ups, NOT this session

- **A second action type**, when a campaign needs one: `add-claim` on a place or event page,
  or `open-invite`. Section 10's seven-point rule is the gate. Do not add one speculatively.
- **`SignInPrompt` on the person page**, if a future surface there needs a generic gate. The
  component will already carry intents correctly after T2.1.
- **R7's `SignInPrompt` copy and hierarchy rewrite**, and **R7's `/auth/signin` button
  promotion**. Both stay in `features/funnel-drop-off-repairs-brief.md`. See section 4.
- **Intent telemetry.** Knowing how many listeners minted an intent and how many replayed it is
  the single most useful number for judging episode 1, and it is deliberately not here because
  the event taxonomy belongs to `features/funnel-event-completion-brief.md`. Add it there, as
  two events on an existing taxonomy, not as a new one.
- **A shared `intentHref` helper for entity pages**, once a second entity type has a signed-out
  CTA. Two call sites do not justify an abstraction; four will.
- **An intent TTL.** Today an intent lives as long as its URL, which for a magic link is one
  hour and for a bookmarked signup link is forever. A member who bookmarks a signup URL in
  October and uses it in March gets a composer for a guest they have forgotten. Harmless, mildly
  odd, and not worth a timestamp until someone reports it.
- **The `/auth/signin` password default.** It is `currentReturnTo() ?? "/"` (F4), which sends a
  returning member with no destination to the marketing home page. That is R8 in the other
  brief, not this one.

---

SHIP-LOG: `type: feature`, `ids: none`, `scope: signup-intent-handoff`
