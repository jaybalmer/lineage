# Funnel Drop-Off Repairs

> Cowork-authored feature brief, September 4 2026. Self-contained. ~5.5 to 6.5 hr,
> TWO PRs (recommended split in section 12), NO migration. This is the UX half of the
> funnel push: it repairs the eight places where a first-time visitor falls out of the
> new-user funnel and nobody, including them, is told anything. The measurement half is
> a separate brief (`features/funnel-event-completion-brief.md` and
> `features/funnel-attribution-brief.md`); this brief adds almost no telemetry and
> defers the event taxonomy to those.
> Playbook subset run: checks 2, 6, 7, 10, 11, 12, 20, 21, 22. Checks 1, 3, 4, 5, 8, 9,
> 13, 14, 15, 16, 17, 18, 19, 23, 24 are not applicable (no migration, no schema, no
> backfill, no Postgres view, no plpgsql function, no catalog operation, no
> owner/editor moderation terminology, no cross-user endpoint).

---

## DECISIONS (review before building)

Every decision has a shippable default. Build the defaults unless Jay says otherwise.

**D1. Ship this as two PRs, not one. DEFAULT: yes.**
The eight repairs total roughly 5.5 to 6.5 hours, which is past the point where one
diff stays reviewable. PR 1 is R1, R2 and R6: the three a stranger arriving from a
podcast callout actually hits. PR 2 is R3, R4, R5, R7 and R8. PR 1 stands alone and
can merge without PR 2. See section 12 for the order.
Alternative: one PR. Rejected because it puts a magic-link state machine, a proxy
change, a claim-page redesign and five copy changes in one review.

**D2. All new user-facing auth messages come from one module. DEFAULT: yes, a new
`src/lib/auth-messages.ts` exporting `AUTH_ERROR_MESSAGES` keyed by the error code
already in the URL (`no_code`, `auth_failed`, `link_expired`).**
Three landings read the same set of codes and there will be more. One map means the
copy in Appendix A has exactly one home, and an unknown code falls back to a generic
sentence rather than rendering nothing (which is today's bug).
Alternative: inline strings per page. Rejected: it is how we got three landings that
each forgot to read the param.

**D3. The `/onboarding` signed-in guard redirects, and gates on `authReady`.
DEFAULT: redirect to `/me/timeline` when `authReady === true && isAuthUser(activePersonId)`.**
`authReady` only flips after `CatalogLoader` has done a server-validated
`supabase.auth.getUser()` (`src/components/catalog-loader.tsx:119-145`), so gating on
it is what stops the guard misfiring on a persisted-but-stale id. `/me/timeline`
server-resolves to the viewer's own profile via `ownProfilePath()`, so the guard needs
no community slug. Until `authReady` is true the flow renders its normal first step, so
a signed-out visitor sees no delay.
Alternative: a "you are already signed in, continue?" interstitial. Rejected: it is a
second decision for someone who did not ask to be here.

**D4. R3 keeps the step-0 reset and adds an opt-in resume, it does not restore the
stored step. DEFAULT: on the first step only, when the persisted answers are already
complete (name and start year both present), show a "Pick up where you left off"
button that jumps straight to the save step.**
BUG-166 D2 exists because entering mid-flow dropped a returning visitor onto a bare
question with no context (verified: commit `30b7c1f`). An opt-in button on the context
screen keeps the context and removes the re-read. The jump target is the save step
because with both answers filled there is nothing left to ask.
Alternative: resume to the exact stored step. Rejected because that is precisely
BUG-166 reintroduced.

**D5. The proxy stamps `returnTo` and `/onboarding` carries it all the way through
OAuth and magic link. DEFAULT: yes, end to end.**
Half a fix is worse than none here: stamping it in the proxy but not reading it in
`save-step.tsx` means the value rides along in the URL and is still dropped at the last
hop. Both halves are in R4.
Alternative: proxy only. Rejected for the reason above.

**D6. The claim-page dead ends get a signup path, not a message-the-inviter path.
DEFAULT: primary "Start your timeline" to `/onboarding`, secondary "Sign in" to
`/auth/signin`.**
There is no in-product way for a visitor holding a dead invite token to reach the
inviter: the client has the inviter's display name (`invites.inviter_name`) but not
their email, and exposing one would be a privacy change. The honest repair is to tell
them the inviter can resend, and to give them a way in that does not depend on it.
Alternative: a "let them know" button posting a notification to the inviter. Rejected
as a new cross-user write path, which is its own brief.

**D7. The magic-link sent state gets a resend with a 30 second cooldown. DEFAULT: yes.**
Without it the only recovery from a link that never arrives is to reload and retype the
address. The cooldown is client-side only and exists to stop double-taps, not to
enforce a rate limit; Supabase and Resend enforce the real ones and their errors surface
through the same failure state.
Alternative: no resend, just "try again" as today. Rejected: it is the single most
common failure in an email-link signup.

**D8. Fix the origin allowlist so a preview deployment stops emailing links into
production. DEFAULT: yes, extend `ALLOWED_ORIGINS` to accept the Vercel preview host
pattern, keeping the production rewrite as the fallback for anything else.**
This is contained (one predicate in one file) and it is what makes the acceptance
criteria testable on a preview deploy at all. It carries a prerequisite: the preview
host must also be in Supabase URL Configuration Redirect URLs, or Supabase rejects the
`redirect_to`. Section 10 states it.
Alternative: leave it and note it. Rejected because every acceptance criterion in R6
would then be untestable anywhere but production.

**D9. A failed onboarding-payload stash is recorded, not shown. DEFAULT: the route
returns `{ ok: true, warning: "stash_failed" }` and the client fires one
`trackEvent("error", "magic_link_stash_failed")`.**
The link still works when the stash fails, and the picks usually survive in the client
store anyway, so an error message would be a false alarm. But it is currently invisible
even to us, and it is the exact failure that BUG-115 and BUG-116 were about. One event,
no new taxonomy: the naming is deferred to `features/funnel-event-completion-brief.md`
if that ships first.
Alternative: show the user a warning. Rejected: nothing is broken from their side.

**D10. `SignInPrompt` leads with signup, keeps sign-in as the second action.
DEFAULT: primary "Create your timeline" to `/onboarding?returnTo=...`, secondary
"I already have an account" to `/auth/signin?returnTo=...`, tertiary "Not now".**
The prompt fires when someone tries to contribute for the first time, which strongly
implies no account. The returning member loses nothing: their action is one line down
and still carries `returnTo`.
Alternative: swap the whole prompt to signup only. Rejected: it strands a returning
member mid-contribution.

**D11. Password sign-in defaults to `/me/timeline`, matching every other method.
DEFAULT: `currentReturnTo() ?? "/me/timeline"`.**
`/me/timeline` needs no community slug and server-redirects to the viewer's own
profile, which is where Google, Facebook and magic link already land. This brief does
NOT decide whether a returning member should land on the Feed instead; that is an open
idea in `features/feature-queue.md` and is cross-referenced, not duplicated (F15).
Alternative: `/${activeCommunitySlug}/profile`. Equivalent destination, but it makes
the sign-in page read the store for no gain.

**D12. The fourth silent landing, `/auth/forgot-password?error=link_expired`, is
included in R1. DEFAULT: yes.**
It was not in the original list of three. It is the same defect on the same page family
and it costs one line once `AUTH_ERROR_MESSAGES` exists (F5).

---

## 1. Why this, why now

The funnel push has two halves. The other brief adds the measurement that tells us
where people leave. This one fixes the places we can already see them leaving, without
needing a single new event to prove it.

The eight defects below share one shape: at the exact moment a first-time visitor is
deciding whether to bother, the app does something and says nothing. A Google sign-in
fails and they are dropped back at the start of the signup wizard with no explanation.
A magic-link email does not arrive and there is no way to ask for another. An invite
link has expired and the only button goes to the marketing home page. Nobody files a
bug report about these, because from the outside they do not look like errors. They
look like the product not working.

The immediate forcing function is the podcast callout: strangers arriving cold, on
mobile, with no context and no patience. R1, R2 and R6 are the three they will actually
hit, which is why they are the must-ship core.

---

## 2. Prerequisites

- **P1.** Pull `main`. This brief is verified against `39f169d` (September 4 2026).
- **P2.** `npm run dev` runs from the repo root you are building in
  (`$HOME/lineage` on Jay's machine). Stop any pre-existing dev server first so port
  3000 binds to the right instance (playbook check 20).
- **P3.** `.env.local` must carry `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` to
  exercise the real magic-link path. Without either, the route short-circuits to
  `{ fallback: true }` at `src/app/api/auth/magic-link/route.ts:87-89` and you will be
  testing the OTP fallback, not the branded path. Half of R6's acceptance criteria are
  meaningless if you do not notice which path you are on.
- **P4.** For the D8 preview check, confirm the preview hostname is in Supabase
  Authentication then URL Configuration then Redirect URLs. See section 10.
- **P5.** `git status` before you start. As of drafting, the working tree on Jay's
  machine carries an unrelated uncommitted diff across nine files (the "stranded badge
  diff" named in `bugs/bug-triage.md`), two of which this brief cites:
  `src/app/claim/[token]/page.tsx` and `src/components/ui/badge.tsx`. **Every line
  number in section 5 and section 6 is against `main` at `39f169d`, not against that
  dirty tree**, so the claim-page citations sit one line off in either direction if you
  read the working copy. Decide with Jay whether that diff is committed, stashed or
  discarded before building; do not fold it into either PR. Also expect a stale
  `.git/index.lock` (a Cowork session created it and could not unlink it);
  `rm -f .git/index.lock` before any git operation.

---

## 3. Scope

Eight independent repairs, listed here in damage order (worst first for a stranger
arriving cold). Task specs are in section 6 in the same order the build should follow,
which is not the same order.

1. **R6.** The magic-link "check your email" state is unobservable and its failure is
   invisible.
2. **R1.** Four auth error landings render with no message at all.
3. **R2.** `/onboarding` has no signed-in guard.
4. **R7.** First-time contributors get a sign-in wall instead of the signup story.
5. **R4.** The proxy discards the destination.
6. **R3.** Abandon and return loses your place.
7. **R5.** `/claim/[token]` expired or not-found is a terminal dead end.
8. **R8.** Password sign-in sends returning members to the marketing landing page.

Plus one shared module (`src/lib/auth-messages.ts`, D2) that R1 depends on.

---

## 4. Out of scope (hard list)

Do not build these in this session.

- **The magic-link double-send architecture.** `generateLink` creates the auth user and
  mints a link, Resend sends it, and a Resend failure falls back to a client
  `signInWithOtp` that sends a *second*, unbranded link for a user who now already
  exists (F10). That is a real design problem. It is not a UX repair, it changes the
  account-creation path, and it needs its own brief. Section 14 logs it. R6 repairs what
  the visitor sees; it does not touch the send architecture beyond D8.
- **Any change to `/auth/complete`'s claim, invite or migration steps.** That file is
  six sequenced network calls deep in an invariant chain (BUG-115, BUG-116, BUG-132,
  PB-010 Phase 4b). R1 touches only where its expiry bounce points.
- **BUG-179**, the owner-profile claim flip. It shares a root cause family with R2
  (`authReady` not gating an auth-dependent branch) but it is a different surface, it is
  P1, it is diagnosis-first, and it already has a brief at
  `bugs/2026-09-01-owner-profile-claim-flip.md`. Cross-reference it, do not absorb it.
- **BUG-070**, the timeline player's "Start Your Timeline" CTA showing to signed-in
  viewers. Same theme as R2, different component, already queued.
- **BUG-149**, the magic-link email's fallback-font wordmark. Adjacent to R6 but it is
  about the email's HTML, not the app's state.
- **Dropping a returning member on the Feed** (F15). Open idea, needs a Jay decision,
  cross-referenced in D11.
- **Self-serve account deletion, a shared footer, a shared OAuth provider button.**
  Standing follow-ups from the legal-pages session, unrelated here.
- **New analytics events beyond the single one in D9.** The measurement briefs own the
  taxonomy.
- **Refactoring `save-step.tsx` and `signin/page.tsx` into a shared auth component.**
  They deliberately differ in shape, telemetry verb and error handling, and both are
  touched here. Tempting, out of scope.

---

## 5. Verified facts (checked against main at 39f169d, September 4 2026)

All eight claims in the request were checked. **Seven verified exactly as stated. One,
R1, is understated: there are four silent landings, not three** (F5). Nothing was found
to be false.

- **F1. `/auth/callback` emits two error landings and neither is read.**
  `src/app/auth/callback/route.ts:16` redirects to `/onboarding?error=no_code` when the
  code param is absent; line 40 redirects to `/onboarding?error=auth_failed` when
  `exchangeCodeForSession` returns an error.
- **F2. `/auth/complete` emits a third.** `src/app/auth/complete/page.tsx:26` builds
  `expiredUrl` as `/auth/signin?error=link_expired`, used at line 230 (the 10 second
  timeout), line 268 (nothing in the URL worked) and line 271 (`init()` threw).
- **F3. Nothing anywhere in `src/` reads an `error` query param.** Grepping
  `get("error")`, `searchParams` and `useSearchParams` across `src/app/auth`,
  `src/app/onboarding` and `src/components/onboarding` returns only `returnTo` reads
  (`auth/complete/page.tsx:25`, `auth/signin/page.tsx:18`), `code` reads
  (`auth/complete/page.tsx:237`, `auth/reset-password/page.tsx:35`) and one `from`
  read (`onboarding-flow.tsx:173`). Confirmed: all three landings render a completely
  normal page.
- **F4. `/auth/signin` has an error slot ready to use.** It holds `error` state
  (`src/app/auth/signin/page.tsx:54`) rendered at line 317-319. It is only ever set from
  in-page actions, never from the URL.
- **F5. There is a FOURTH silent landing, not in the original list.**
  `src/app/auth/reset-password/page.tsx:59` redirects to
  `/auth/forgot-password?error=link_expired`. `src/app/auth/forgot-password/page.tsx`
  has its own `error` state (line 12, rendered line 117-118) but never reads the URL
  param, so an expired recovery link lands on a blank reset-request form with no
  explanation. Same defect, same shape, one extra line to fix (D12).
- **F6. `/onboarding` has no auth guard.** `src/app/onboarding/page.tsx` is five lines
  and renders `<OnboardingFlow />` with no props. `OnboardingFlow`
  (`src/components/onboarding/onboarding-flow.tsx:107-694`) never references
  `activePersonId`, `authReady` or `isAuthUser`. Verified by grep over the whole file.
- **F7. Several paths send an authenticated-but-hiccuping visitor there.**
  `src/proxy.ts:207-211` redirects to `/onboarding` when `getUser()` returns no user on
  `/[community]/timeline/*` or `/me/*`. `src/app/claim/[token]/page.tsx` sends there
  from lines 105, 171 and 242.
- **F8. `authReady` is the correct gate for the R2 guard.**
  `src/components/catalog-loader.tsx:119` reads `user?.id` from a server-validated
  `supabase.auth.getUser()`; the no-session branch calls `setActivePersonId("")` at
  line 132 then `setAuthReady(true)` at line 134, and the session branch sets
  `authReady` at line 145. So `authReady === true && isAuthUser(activePersonId)` is a
  server-confirmed signal, not a persisted-store guess.
- **F9. The step-0 reset and what it is for.**
  `src/components/onboarding/onboarding-flow.tsx:166-190` is the BUG-166 D2 entry-step
  effect: it waits for Zustand persist hydration and then calls `setOnboardingStep(0)`
  if the hydrated step is not already 0 (line 186). The reason, from commit `30b7c1f`:
  *"'Start Your Timeline' dropped a returning visitor onto a bare mid-flow question with
  no context and no exit. Always enter the flow at the start (the land step, which is
  itself the context) with answers pre-filled."* The answers survive because
  `onboarding` is NOT excluded from `partialize`
  (`src/store/lineage-store.ts:1154-1157` excludes eleven slices; `onboarding` is not
  among them), so the position is the only thing lost. Confirmed as stated.
  Note for R3: `resetPerUserState()` (`src/store/lineage-store.ts:1031-1046`) does clear
  `onboarding`, but `catalog-loader.tsx:127-131` only calls it when `storeOwnerId` is
  set, so a visitor who has never signed in keeps their answers. That is exactly the
  visitor R3 is for.
- **F10. The magic-link route, all three sub-claims confirmed.**
  `src/app/api/auth/magic-link/route.ts`:
  - (a) **Yes.** `generateLink` runs at line 128 and creates the auth user when absent
    (its own comment at line 94-96 says so). Resend sends at line 161. On a Resend
    error, line 173-176 returns `{ fallback: true }` with **HTTP 200**. The client then
    calls `signInWithOtp` with `shouldCreateUser: true` from the FTUE
    (`src/components/onboarding/save-step.tsx:153-163`) or `false` from the sign-in page
    (`src/app/auth/signin/page.tsx:110-118`). On the signup path the user already exists
    by then, so Supabase sends its own generic template instead of the branded one. The
    catch-all at line 179-182 returns the same `{ fallback: true }` for *any* thrown
    exception, so a genuine server crash is indistinguishable from a missing key.
  - (b) **Yes.** `ALLOWED_ORIGINS` is hardcoded at line 124 as
    `["https://linestry.com", "https://lineage.wtf", "https://lineage.community", "http://localhost:3000"]`,
    and line 126 silently rewrites anything else to `https://linestry.com`. A Vercel
    preview deployment therefore emails a link that lands in production.
  - (c) **Yes.** The `pending_onboarding` stash at line 150-156 ends
    `if (metaErr) console.error(...)` and nothing else. The response is unchanged, so a
    failed stash is invisible to the client and to us.
- **F11. The sent state is a bare boolean with no recovery.**
  `src/components/onboarding/save-step.tsx:171` sets `sent`; the state renders at lines
  180-201 with a headline, the address, and one "Try again" button that only resets the
  form. No resend, no "if it does not arrive", no failure surface once `sent` is true.
  `src/app/auth/signin/page.tsx:183-201` is the same shape.
- **F12. The proxy drops the destination.** `src/proxy.ts:208-210` clones the URL, sets
  `pathname = "/onboarding"` and redirects. The clone preserves the original *query
  string* but the path is gone and no `returnTo` is added, so
  `/me/tags?filter=pending` becomes `/onboarding?filter=pending`. Both other hops
  already support `returnTo` through `safeReturnTo` (`src/lib/safe-redirect.ts:17-24`):
  `/auth/callback` at `route.ts:12-13` and `/auth/signin` at `page.tsx:16-19`. The proxy
  is the one hop that drops it.
- **F13. The FTUE drops it a second time.** Both OAuth calls in
  `src/components/onboarding/save-step.tsx` pass
  `redirectTo: \`${window.location.origin}/auth/callback\`` with no `returnTo`: Google at
  line 89, Facebook at line 109. The magic-link POST at line 134-138 sends `email` and
  `onboarding` and no `returnTo` either, though the route accepts one (`route.ts:65-72`).
- **F14. `/claim/[token]` dead ends and mislabels, all confirmed.**
  `src/app/claim/[token]/page.tsx`: the not-found state's only button goes to `/`
  (line 129); the expired state's only button goes to `/` (line 150); the
  already-claimed state's button is **labelled "Sign in" and routes to `/onboarding`**
  (line 171-174); the valid state's secondary is labelled **"I already have an account,
  sign in" and also routes to `/onboarding`** (line 242-245). Two mislabels, two dead
  ends. Note for R5: the invite token is written to `localStorage` at line 78 *before*
  the valid state renders, and `/auth/complete` forwards it to `/api/invite/claim`
  (lines 128-143), so repointing that secondary button at `/auth/signin` does not break
  the invite binding.
- **F15. `SignInPrompt` and the signup link's prominence.**
  `src/components/ui/sign-in-prompt.tsx:43` links to `/auth/signin?returnTo=<pathname>`
  with the single primary label "Sign in or start". It is used on nine surfaces:
  `(community)/[community]/brands/page.tsx:387`, `places/[id]/page.tsx:292`,
  `places/page.tsx:264`, `stories/page.tsx:265`, `boards/[id]/page.tsx:467`,
  `boards/page.tsx:615`, `events/page.tsx:491`, and `app/people/page.tsx:474`. On the
  destination, the only signup affordance is
  `src/app/auth/signin/page.tsx:332-338`: a `fontSize: 10` inline text link reading "No
  account yet? Create your timeline", sharing a flex row with a "Back" button, below the
  legal consent line. Confirmed as low prominence.
- **F16. Password sign-in diverges from every other method.**
  `src/app/auth/signin/page.tsx:162` does `router.push(currentReturnTo() ?? "/")`. Every
  other method routes through `/auth/callback` to `/auth/complete`, which ends at
  `router.replace(returnTo ?? \`/${activeCommunitySlug}/profile\`)`
  (`src/app/auth/complete/page.tsx:225`). So password lands on the marketing home page
  and the rest land on the member's own timeline. Confirmed.
- **F17. The Feed idea is open and unowned.** `features/feature-queue.md:82`, under
  "Needs a Jay decision": *"Drop a returning signed-in member on the Feed, not the
  landing page"*, from the in-app widget September 2 2026, lane-corrected from bug to
  idea, marked NEEDS A DRAFTING PASS. Its own note says the change is either a proxy
  redirect on `/` or a change in `src/app/page.tsx`, which is already auth-aware
  (`src/app/page.tsx:11-13` reads `activePersonId` and swaps the hero CTA) but never
  redirects. D11 does not touch it.
- **F18. Adjacent open bugs, for cross-reference not duplication.** BUG-179 (P1, owner
  profile flips to the anonymous claim view; root cause is a missing `authReady` gate,
  brief at `bugs/2026-09-01-owner-profile-claim-flip.md`), BUG-070 (P2, player CTA shows
  "Start Your Timeline" to a signed-in viewer), BUG-149 (P2, magic-link email wordmark),
  BUG-053 (P2, "My Timeline" element on the community landing page, marked NOT-READY).
  Next free bug id is BUG-180; **this brief opens no new BUG ids**, it is feature work.
- **F19. AUDIT: no live database or PostHog session was used.** This brief was drafted
  from the repo on disk. No SQL assertion was run, and no claim here depends on
  production data. Nothing in scope reads or writes a table, so playbook checks 1, 3, 9,
  13 and 14 have nothing to assert against.
- **F20. AUDIT: nothing here was verified in a browser.** Cowork cannot run
  `npm run dev` against this tree (linux/arm64 bridge shell against darwin-arm64 SWC
  binaries). Every rendering and interaction criterion in section 8 is genuinely
  unverified until the build session runs it.

---

## 6. Task specs

Ordered as the build should run, cheapest shared dependency first. Damage order is in
section 3.

### R0. The shared message module (prerequisite for R1)

**File:** `src/lib/auth-messages.ts` (new).

Export `AUTH_ERROR_MESSAGES: Record<string, string>` keyed by the codes already in the
URLs (`no_code`, `auth_failed`, `link_expired`) plus a `default`. Copy verbatim from
Appendix A. Export one helper:

```ts
export function authErrorMessage(code: string | null | undefined): string | null
```

It returns `null` for a null or empty code, the mapped string for a known code, and the
`default` string for an unknown one. Never return the raw code, and never render it.

### R1. Read the error param on all four landings

**Files:** `src/components/onboarding/onboarding-flow.tsx`,
`src/app/auth/signin/page.tsx`, `src/app/auth/forgot-password/page.tsx`.

Read the param the same way the existing code reads `returnTo` and `from`: from
`new URLSearchParams(window.location.search)` inside an effect, not `useSearchParams`,
so no page is forced dynamic (the comment at `signin/page.tsx:12-15` explains why this
matters and is the pattern to copy).

1. **`/onboarding`** (F1). In `OnboardingFlow`, add a `entryError` state set once in the
   existing entry effect (`onboarding-flow.tsx:167-190`), reading `error` alongside the
   `from` read at line 173. Render the message as a banner directly under `<Thread />`
   (line 335), above `<main>`, so it is visible on the first step regardless of which
   step renders. Use the same treatment as the save step's error banner
   (`save-step.tsx:277-281`): rounded, red-tinted, readable on the forced-dark
   `.ftue-dark` background. Include a dismiss affordance; the visitor should be able to
   clear it and carry on.
2. **`/auth/signin`** (F2). Set the existing `error` state (line 54) from
   `authErrorMessage(...)` in a mount effect. It already renders at line 317-319. One
   subtlety: the `sent` branch (line 183-201) returns early past that render, so set the
   state on mount when `sent` is false and let the existing conditional do the rest.
3. **`/auth/forgot-password`** (F5, D12). Identical to 2: set the existing `error` state
   (line 12) from the URL on mount; it renders at line 117-118.

Do not strip the param from the URL afterwards. A reload showing the same message is
correct, and `history.replaceState` here would fight the dismiss affordance.

### R2. Signed-in guard on `/onboarding`

**File:** `src/components/onboarding/onboarding-flow.tsx`.

At the top of `OnboardingFlow`, read `authReady` and `activePersonId` from the store and
add an effect:

```
if (authReady && isAuthUser(activePersonId)) router.replace("/me/timeline")
```

`isAuthUser` is exported from `src/store/lineage-store.ts`. While that condition holds,
render the same holding state `/auth/complete` uses (`auth/complete/page.tsx:274-281`:
pulsing `BrandMark` plus a status line) with the Appendix A copy, instead of the flow.
Do NOT render the FTUE and then redirect; that flashes a signup wizard at a member.

Order matters against R1: run the auth check before the entry-error banner so a
signed-in member bounced here by a session hiccup is sent to their timeline rather than
shown an auth error about it.

`authReady` is the whole point of the gate (F8, D3). Do not simplify it to
`isAuthUser(activePersonId)` alone: the store is persisted, so that reads true for a
stale id before the server has confirmed anything. This is the same failure family as
BUG-179 in the other direction, and that bug is the reason to be careful here rather
than a reason to fix it here.

### R6. The magic-link sent state, resend, and visible failure

**Files:** `src/components/onboarding/save-step.tsx`, `src/app/auth/signin/page.tsx`,
`src/app/api/auth/magic-link/route.ts`.

**6a. Client, both surfaces.** Rebuild the `sent` state (`save-step.tsx:180-201`,
`signin/page.tsx:183-201`) to carry three things instead of one:

- The confirmation, with the address, and how the link behaves. Copy in Appendix A.
- A "what if it does not arrive" line, followed by a **Send it again** button. On click,
  re-run the same send function. Disable it for 30 seconds after each send and label the
  disabled state with the remaining count (D7). Keep the cooldown in component state; do
  not persist it.
- A failure surface *inside* the sent state. Today `error` is only rendered on the form
  branch, so a resend that fails after `sent` is true fails silently, which is the same
  bug one level down. A failed resend must set the error and render it in the sent
  state, and it must not consume the cooldown.

Keep the existing "wrong address" escape, relabelled per Appendix A.

Copy honesty note: when the route returned `fallback: true` and the client OTP
succeeded, the email that arrives is Supabase's generic template, not the branded
Linestry one (F10a). Keep the sent-state copy provider-neutral. Do not write "check for
an email from Linestry".

**6b. Server, origin allowlist (D8).** In
`src/app/api/auth/magic-link/route.ts:124-126`, keep `ALLOWED_ORIGINS` and the
production fallback, and additionally accept an origin matching the Vercel preview host
shape (`https://<something>-jaybalmers-projects.vercel.app`). Match on the full origin
with an anchored test, not a substring `includes`, so a lookalike host cannot pass. The
production rewrite stays for everything else. See section 10 for the Supabase
prerequisite this depends on.

**6c. Server, stash failure (D9).** At `route.ts:150-156`, keep the `console.error` and
additionally carry the failure out: return `{ ok: true, warning: "stash_failed" }`. On
the client, when `warning === "stash_failed"`, fire
`trackEvent("error", "magic_link_stash_failed", { method: "magic_link" })` and change
nothing the user sees. `"error"` is an existing `AnalyticsCategory`
(`src/types/index.ts:813-820`); add no new category.

**6d. Do not touch** the `generateLink` and OTP fallback relationship. Section 14 logs
it.

### R7. Lead with signup on the contribution prompt

> **PARTIALLY ABSORBED, September 4 2026, evening.** One line of R7 moved to `features/signup-intent-handoff-brief.md`: the `returnTo` construction in `sign-in-prompt.tsx` (pathname-only becomes path plus search), because the intent rides in the query string. **What stays here:** the three-action signup-first copy and hierarchy redesign, and the promotion of the signup affordance on `/auth/signin`. **Collision warning:** the handoff brief changes the `href` of the "Create your timeline" link on `signin/page.tsx`; R7 changes its shape. Whichever ships second must preserve the other's change, and the handoff brief ships first.

#### R7 scope after the carve-out

**Files:** `src/components/ui/sign-in-prompt.tsx`, `src/app/auth/signin/page.tsx`.

1. `SignInPrompt` gets three stacked actions in place of the current two (D10): primary
   **Create your timeline** to `/onboarding${returnTo}`, secondary **I already have an
   account** to `/auth/signin${returnTo}`, tertiary **Not now** (unchanged close
   button). The existing `returnTo` construction at line 26 is reused verbatim for both
   links. Heading and body copy from Appendix A. The `message` prop override must keep
   working: `stories/page.tsx:265` passes one.
2. `/onboarding` must actually honour that `returnTo`. That is R4, which is why R4
   should land in the same PR as R7 (section 12). If R4 slips, R7's primary link still
   works, it just lands on the default timeline.
3. On `/auth/signin`, promote the signup affordance (F15) from the `fontSize: 10` inline
   link at line 332-338 to a full-width bordered button below the consent line, above
   the remaining "Back" row, with the Appendix A label. Keep a "Back" affordance. Do not
   remove the existing inline link's destination logic, just its shape.

### R4. Carry the destination through every hop

> **ABSORBED, DO NOT BUILD THIS HERE. September 4 2026, evening.** All three parts of R4 (the proxy, `OnboardingFlow`, and `SaveStep`) moved into `features/signup-intent-handoff-brief.md`, which ships FIRST as the critical path for the FNRad episode-1 challenge. That brief also covers three drops R4 missed: the OTP-fallback `emailRedirectTo` in `save-step.tsx`, a `pending_onboarding` fallback channel, and the FTUE exit path. **Strike R4 and its decision D5 from this brief's scope and acceptance criteria when you build it.** The text below is retained only so the reasoning is not lost. Roughly an hour comes off this brief's PR 2 as a result.

#### Original R4 text, retained for reference

**Files:** `src/proxy.ts`, `src/components/onboarding/onboarding-flow.tsx`,
`src/components/onboarding/save-step.tsx`.

1. **Proxy** (`src/proxy.ts:207-211`). Build the redirect so the original path plus
   search is stamped as `returnTo` on `/onboarding`. Validate it through
   `safeReturnTo` from `src/lib/safe-redirect.ts` before stamping, exactly as the other
   two hops do; the value is derived from the request URL, but running it through the
   same guard keeps one code path and one set of rules. Note the existing clone
   preserves the incoming query string (F12), so build the target URL explicitly rather
   than mutating `pathname` on the clone, or the old query and the new `returnTo` will
   both ride along.
2. **`OnboardingFlow`** reads `returnTo` from its own URL (same
   `URLSearchParams` pattern, validated through `safeReturnTo`) and passes it to
   `SaveStep` as a prop. Do not put it in the Zustand store; it is per-visit.
3. **`SaveStep`** appends it to both OAuth `redirectTo` values (line 89 Google, line 109
   Facebook) in the exact shape `/auth/callback?returnTo=<encoded>` that
   `signin/page.tsx:60` already uses, and adds `returnTo` to the magic-link POST body at
   line 137. The route already accepts and validates it (`route.ts:65-79`) and threads it
   to `/auth/complete`, which already honours it (`auth/complete/page.tsx:25, 225`). No
   server change is needed for this part.

### R3. Pick up where you left off

**File:** `src/components/onboarding/onboarding-flow.tsx`.

Keep the BUG-166 D2 reset at line 186 exactly as it is (F9, D4). Add, in the same
effect, a capture of whether the hydrated answers were already complete before the
reset ran:

```
const { onboarding } = useLineageStore.getState()
const complete = Boolean(onboarding.display_name?.trim()) && isUsableYear(onboarding.start_year ?? null)
```

`isUsableYear` already exists at the bottom of the file. Hold that in a
`canResume` state.

When `canResume` is true and `currentStepId === "scatter"` (the first step only), render
a resume affordance under the primary button in the footer block (line 656-688): a
secondary button with the Appendix A label plus the supporting line naming what is
already saved. Clicking it calls `setOnboardingStep(STEPS.indexOf("save"))`.

Constraints that keep this from being BUG-166 again:

- The affordance appears only on step 0, which is the context screen. Nobody is ever
  dropped onto a bare mid-flow question.
- It is opt-in. The default path is unchanged: a returning visitor still lands on
  "scatter" with their answers pre-filled.
- It never fires automatically, and it does not read or restore the stored step number.

### R5. Give the claim dead ends a way forward

**File:** `src/app/claim/[token]/page.tsx`.

1. **Not found** (line 121-137) and **expired** (line 140-158): replace the single
   "Go to Linestry" / "Visit Linestry" button with two actions (D6): primary **Start
   your timeline** to `/onboarding`, secondary **Sign in** to `/auth/signin`. Keep the
   expired state's existing sentence about the inviter being able to send a new one, and
   add the Appendix A line that makes the fallback explicit.
2. **Already claimed** (line 161-179): the button labelled "Sign in" routes to
   `/onboarding` (F14). Repoint it to `/auth/signin`. The label was right; the
   destination was wrong.
3. **Valid invite** (line 241-246): the secondary labelled "I already have an account,
   sign in" also routes to `/onboarding`. Repoint it to `/auth/signin` and take the em
   dash out of the label per Appendix A. This is safe: the invite token is already in
   `localStorage` by then (line 78) and `/auth/complete` forwards it to
   `/api/invite/claim` (lines 128-143), so the binding survives a sign-in that skips the
   wizard (F14).

Leave the primary "Claim my profile" flow at line 87-106 alone. It writes the prefill
and goes to `/onboarding` deliberately.

### R8. Password sign-in lands where every other method lands

**File:** `src/app/auth/signin/page.tsx`.

Line 162: change `router.push(currentReturnTo() ?? "/")` to
`router.push(currentReturnTo() ?? "/me/timeline")` (D11). Update the comment above it at
line 160-161, which currently states the home redirect as intentional; it should now say
the default matches the callback path.

Do not touch `src/app/page.tsx` or add a redirect on `/`. That is the open Feed idea
(F17), not this.

---

## 7. Surface pairing (playbook check 12)

| Change | Where the user meets it | Affordance |
|---|---|---|
| `authErrorMessage` on `no_code` / `auth_failed` | `/onboarding`, first step, banner under the progress thread | Dismissible inline banner |
| `authErrorMessage` on `link_expired` | `/auth/signin`, above the button stack | Inline error line (existing slot) |
| `authErrorMessage` on `link_expired` | `/auth/forgot-password`, above the send button | Inline error line (existing slot) |
| Signed-in guard | `/onboarding` for an authenticated visitor | Brand-mark holding state, then redirect to `/me/timeline` |
| Resend | `/onboarding` save step and `/auth/signin`, inside the sent state | Secondary button with a 30s cooldown label |
| Resend failure | Same two sent states | Inline error, cooldown not consumed |
| `stash_failed` warning | Nowhere visible | PostHog event only (D9) |
| Signup-first prompt | The nine `SignInPrompt` surfaces (F15) | Primary button, sign-in second |
| Promoted signup affordance | `/auth/signin`, below the consent line | Full-width bordered button |
| `returnTo` through the FTUE | Any proxy-gated route hit while signed out | Invisible; the visitor lands where they clicked |
| Resume | `/onboarding` step 0, only when both answers are saved | Secondary button under the primary |
| Claim dead-end exits | `/claim/[token]` not-found and expired states | Primary signup button plus sign-in |
| Password default destination | `/auth/signin` password submit | Invisible; different landing page |

---

## 8. Acceptance criteria

- **A1.** `npx tsc --noEmit` is clean.
- **A2.** Visiting `/onboarding?error=no_code` and `/onboarding?error=auth_failed`
  signed out shows the Appendix A message on the first step, legible on the forced-dark
  FTUE background, and the flow is still fully usable after dismissing it.
- **A3.** Visiting `/auth/signin?error=link_expired` shows the Appendix A message above
  the button stack. Same for `/auth/forgot-password?error=link_expired`.
- **A4.** An unknown code (`/onboarding?error=banana`) shows the generic default
  message and never renders the code itself.
- **A5.** A signed-in member visiting `/onboarding` lands on their own timeline. The
  FTUE never paints. A signed-out visitor sees no added delay on the first step.
- **A6.** With `authReady` still false (throttle the network and reload), `/onboarding`
  renders the flow, not the holding state, for a signed-out visitor.
- **A7.** From the FTUE save step, entering an address and sending shows the new sent
  state with a working **Send it again** button that disables for 30 seconds and shows
  the countdown. Same on `/auth/signin`.
- **A8.** Forcing a send failure on the resend (temporarily break the route, or send to
  an address the sign-in path rejects) shows a visible error *inside* the sent state,
  and the button is immediately available again.
- **A9.** On a preview deployment, a magic link sent from the preview host lands back on
  that same preview host, not on linestry.com. (Requires the section 10 Supabase
  prerequisite. If it is not in place, the link is rejected by Supabase, which is a
  different and equally visible failure; report which one you saw.)
- **A10.** Signed out, click a contribute affordance on `/snowboarding/boards`. The
  prompt leads with **Create your timeline**; that link goes to `/onboarding` carrying
  `returnTo`, and completing signup lands back on `/snowboarding/boards`, not on the
  generic profile.
- **A11.** Signed out, visit `/me/tags` directly. You are sent to `/onboarding` with a
  `returnTo` of `/me/tags`, and completing signup by Google, by Facebook, and by magic
  link each land on `/me/tags`. All three, not one.
- **A12.** Start the FTUE, answer name and year, leave at the era step, return to
  `/onboarding`. You land on the first step with answers intact and a **Pick up where
  you left off** button that jumps to the save step. Leaving at the *name* step (answers
  incomplete) shows no such button.
- **A13.** `/claim/<expired-token>` and `/claim/<garbage-token>` each offer a signup
  primary and a sign-in secondary, and neither routes to `/`.
- **A14.** On a valid invite, "I already have an account" goes to `/auth/signin`, and
  signing in there still binds the invite (the claimed profile shows the invited name,
  not the email local part).
- **A15.** Signing in with email and password lands on the member's own timeline. With
  a `?returnTo=` present, it still honours it.
- **A16.** Every screen touched renders correctly at 375px width and in both themes,
  with no horizontal overflow. The FTUE surfaces are forced-dark; check contrast there
  specifically, not only in light mode.
- **A17.** No new `BUG-NNN` ids were opened and no entry in `bugs/bug-triage.md` was
  edited. This is feature work (F18).

---

## 9. Migration

**No migration this session.** Nothing in scope creates, alters or backfills a table,
column, index, policy or view. No SQL of any kind. Playbook checks 1, 3, 4, 9, 13, 14,
19, 23 and 24 are all inapplicable for that reason.

Both PRs can therefore merge in either order with respect to the database. The only
sequencing constraint is between the two PRs themselves (section 12).

---

## 10. Risks and gotchas

- **The Supabase redirect allowlist gates A9 (D8).** Extending `ALLOWED_ORIGINS` makes
  the route *generate* a preview-host link. Supabase separately validates the
  `redirect_to` against Authentication then URL Configuration then Redirect URLs, and
  rejects anything not listed. Preview hostnames regenerate per deploy, so this needs a
  wildcard entry (`https://lineage-*-jaybalmers-projects.vercel.app/**`), the same one
  the Facebook Login session documented. If it is absent, A9 fails at Supabase rather
  than in our code. Read the failure before changing anything.
- **`{ fallback: true }` is HTTP 200 and means five different things** (F10a): missing
  service-role key, missing Resend key, `listUsers` error, `generateLink` error, Resend
  send error, or any uncaught exception. While testing R6 you cannot tell from the client
  which one fired. Watch the server console. This ambiguity is exactly the follow-up in
  section 14; do not try to fix it here, but do not let it fool you into thinking a
  branded send succeeded when it did not.
- **`authReady` misuse is a live P1 in the other direction.** BUG-179's second mechanism
  is `catalog-loader.tsx` setting `activePersonId` to `""` mid-session, which would make
  the R2 guard *stop* firing rather than misfire. R2 is safe against it (it fails open to
  the FTUE, which is the current behaviour). Do not "improve" the guard by reading
  `storeOwnerId` or the persisted id instead; that is what would make it misfire.
- **R3 must not become BUG-166.** The three constraints in the R3 spec are the whole
  point. If the implementation drifts toward restoring the stored step, stop.
- **The FTUE renders on `.ftue-dark`, a token scope, not `<html class="dark">**
  (`onboarding-flow.tsx:32-36`). Any new banner or button there needs to be checked on
  that background specifically. The save step's existing error banner
  (`save-step.tsx:277-281`) is the reference treatment.
- **`useSearchParams` would force a dynamic render** on pages that deliberately avoid
  it (`signin/page.tsx:12-15`). Use `window.location.search` inside an effect, as the
  existing code does.
- **`save-step.tsx` and `signin/page.tsx` are deliberately not the same component.**
  They differ in telemetry verb (`signup_started` versus `signin_started`), error
  handling (try/catch versus bare) and button shape. R6 and R7 touch both. Mirror each
  file's local conventions rather than making them converge.
- **The claim page's valid state writes the invite token to `localStorage` on load**
  (line 78). Any change to the ordering of that effect risks breaking invite binding for
  every path, not just the one R5 touches. Do not reorder it.
- **Copy is locked (playbook check 21).** Appendix A contains no em dashes and no en
  dashes. Two strings this brief replaces (`claim/[token]/page.tsx:245` and the
  surrounding invite copy) currently contain em dashes; the replacements must not.
- **A16 and every rendering criterion is unverified by Cowork** (F20). The build session
  is the first time any of this is seen in a browser.

---

## 11. Rollback

Two independent flip points, one per PR.

PR 1 (R1, R2, R6) reverts cleanly: `src/lib/auth-messages.ts` is a new file with no
other callers, the R2 guard is an added effect plus an added branch, and R6 is contained
to the sent-state render, one predicate in `ALLOWED_ORIGINS`, and one added response
field that the client tolerates being absent. No state is written anywhere, so nothing
needs unwinding.

PR 2 (R3, R4, R5, R7, R8) is the same story. The one thing to know: R4 stamps `returnTo`
into URLs. Reverting it while people have a stamped URL open is harmless because the
value is only ever read through `safeReturnTo` and an unread param is inert.

If only one repair is a problem, each is independently revertible; they share only
`auth-messages.ts` (R1) and the `returnTo` plumbing (R4 and R7, where R7 degrades to
landing on the default timeline rather than breaking).

---

## 12. Suggested order

**PR 1, the must-ship core. ~2.5 to 3 hr.**

1. **R0**, the shared message module. Ten minutes, and R1 depends on it.
2. **R1**, all four landings. Cheapest real repair, and it makes the R2 and R6 testing
   less confusing because failures start announcing themselves.
3. **R2**, the signed-in guard. Small, and it must land after R1 so the ordering note in
   the R2 spec is satisfiable in one file.
4. **R6**, the magic-link state. Largest single item in this PR and the one with an
   external dependency (section 10), so it goes last where it cannot block the rest.

**PR 2, the second tier. ~3 to 3.5 hr.**

5. **R7**, the contribution prompt. Highest-value of the remaining five.
6. **R4**, the `returnTo` plumbing. Immediately after R7 because R7's primary link is
   what makes R4 observable end to end (A10).
7. **R3**, resume. Self-contained in one file.
8. **R5**, the claim dead ends. Self-contained in one file.
9. **R8**, the password destination. One line plus a comment. Last because it is the
   smallest and the least likely to be hit by a first-time visitor.

Split rationale (D1): the total is past four hours, and the natural seam is exactly the
core-versus-second-tier line the request drew. PR 1 delivers the whole podcast-listener
repair on its own and does not depend on anything in PR 2.

---

## 13. Ship sequence

Per the repo `CLAUDE.md` standing rule.

1. Build PR 1, push the branch, open the PR. State the PR number.
2. **No migration this session** (section 9). Say so explicitly so the record is
   unambiguous; there is no gate to classify and nothing to apply.
3. `npx tsc --noEmit` clean, acceptance criteria A1 to A9 pass, then merge PR 1 yourself
   with `gh pr merge`. **Exception check before merging:** this session touches auth
   flows, which the `CLAUDE.md` ship sequence lists as a prompt-Jay case. So do not
   self-merge: surface PR 1 to Jay with the acceptance results and wait for his
   go-ahead. Confirm Vercel will auto-deploy `main`.
4. Build PR 2 on top of merged `main`, push, open. Run A10 to A17. Same auth-adjacency
   applies to R4, R5 and R8, so prompt Jay again rather than self-merging.
5. Append **one** entry to `bugs/SHIP-LOG.md` per PR, using the schema at the top of
   that file. `type: feature`, `ids: none`, `scope: funnel-drop-off-repairs`,
   `migration: none`, `status: merged` with the real PR number once Jay confirms the
   merge, `pending` only if he defers. Say which repairs (R1 to R8) each PR shipped in
   the summary line so the reconcile can tell the two apart.
6. Do NOT edit the Shipped section of `features/feature-queue.md` or
   `bugs/bug-triage.md`. Cowork reconciles both.

---

## 14. Follow-ups, NOT this session

- **The magic-link double-send architecture** (F10a, out-of-scope list). `generateLink`
  creates the user and mints a link before Resend is ever called, so a Resend failure
  falls back to an OTP send for a user who now exists, delivering an unbranded second
  link. And `{ fallback: true }` at HTTP 200 collapses six distinct server conditions
  into one client signal. This needs its own brief: probably a typed failure response,
  and a decision about whether `generateLink` should run before or after the send path
  is known to be healthy.
- **`/auth/complete`'s 10 second timeout** (`auth/complete/page.tsx:229-231`). On a slow
  connection a legitimate sign-in can lose the race and bounce to
  `?error=link_expired`, which after R1 will now tell the visitor their link expired when
  it did not. R1 makes this visible for the first time; sizing the timeout, or
  distinguishing "still working" from "expired", is separate work.
- **BUG-179**, the owner-profile claim flip. Already briefed at
  `bugs/2026-09-01-owner-profile-claim-flip.md`. Related to R2 by root cause family.
- **BUG-070**, the player CTA showing "Start Your Timeline" to signed-in viewers. Same
  theme as R2, different component.
- **BUG-149**, the magic-link email's fallback-font wordmark. Adjacent to R6.
- **Dropping a returning member on the Feed** (F17). Needs a Jay decision and a drafting
  pass. D11 deliberately leaves the destination question open.
- **A shared auth-surface component.** `save-step.tsx` and `signin/page.tsx` now share a
  sent state, a resend, a cooldown, and a consent line, in two copies. Worth collapsing
  once a third surface needs it, not before.
- **Telling the inviter their link died** (D6). Would need a cross-user write path and a
  notification. Its own brief if the invite flow proves lossy in practice.

---

# Appendix A: copy of record

Build these verbatim. Plain, warm, short. No error codes shown to anyone. No stacked
apologies: say what happened, then what to do. Curly apostrophes should be escaped as
HTML entities in JSX the way the surrounding files already do. No em dashes and no en
dashes anywhere.

---

## A1. `src/lib/auth-messages.ts`, the shared map (R1)

**`no_code`**

> That sign-in did not finish. Nothing you entered was lost. Try again below.

**`auth_failed`**

> We could not finish signing you in. The link may have already been used. Try again
> below and it should go through.

**`link_expired`**

> That link has expired. Links last one hour. Enter your email and we will send a fresh
> one.

**`default`** (any unrecognised code)

> Something interrupted that sign-in. Try again below.

Dismiss affordance on the `/onboarding` banner, as an accessible label:

> Dismiss

---

## A2. `/onboarding` signed-in holding state (R2)

Single line under the pulsing brand mark:

> Taking you to your timeline.

---

## A3. The magic-link sent state (R6)

Used on both the FTUE save step and `/auth/signin`. `{email}` is the lowercased address
the visitor typed, rendered in the emphasis style each surface already uses.

**Heading**

> Check your email

**Body**

> We sent a sign-in link to {email}. It works once and lasts an hour.

**Helper line above the resend button**

> Not there in a minute? Have a look in spam, then send it again.

**Resend button, ready**

> Send it again

**Resend button, cooling down** (`{n}` counts 30 down to 1)

> Send it again in {n}s

**Confirmation after a successful resend**

> Sent. Check your email again.

**Failure inside the sent state**

> We could not send that link just now. Try once more, or go back and use a different
> address.

**Wrong address escape**

> Use a different address

---

## A4. `SignInPrompt` (R7)

**Heading**

> Create your timeline to add this

**Body** (the default; the `message` prop still overrides it)

> Adding to Linestry needs an account so your contribution is credited to you. It takes
> about a minute.

**Primary action**

> Create your timeline

**Secondary action**

> I already have an account

**Tertiary action** (unchanged)

> Not now

---

## A5. `/auth/signin` promoted signup affordance (R7)

Full-width bordered button below the consent line:

> New here? Create your timeline

---

## A6. `/onboarding` resume affordance (R3)

**Button**

> Pick up where you left off

**Supporting line below the button**

> Your name and year are already saved.

---

## A7. `/claim/[token]` states (R5)

**Not found, heading** (unchanged)

> Invite not found

**Not found, body**

> This link may be incomplete, or the invite was removed. You can still start your own
> timeline from scratch.

**Expired, heading** (unchanged)

> This invite has expired

**Expired, body**

> {inviter} can send you a new one from their timeline. You do not have to wait for it,
> though. You can start your own now and connect up later.

**Primary action, both states**

> Start your timeline

**Secondary action, both states**

> Sign in

**Already claimed, body** (unchanged)

> Someone has already claimed this profile. If that was you, sign in to see your
> linestry.

**Already claimed, button label** (unchanged label, corrected destination)

> Sign in

**Valid invite, secondary action** (relabelled, em dash removed, corrected destination)

> I already have an account

---

## A8. SHIP-LOG entry

Append one per PR, newest at the bottom, following the schema at the top of
`bugs/SHIP-LOG.md`.

```
## 2026-09-XX - Funnel drop-off repairs, core (feature)
- type: feature
- pr: #NN
- branch: feat/funnel-drop-off-repairs-core
- ids: none
- scope: funnel-drop-off-repairs
- migration: none
- status: merged
- tsc: clean

Repaired the three silent drop-offs a first-time visitor actually hits: four auth error
landings now render a message instead of a normal page, /onboarding sends an already
signed-in member to their timeline instead of the signup wizard, and the magic-link
sent state gained a resend with a visible failure. No migration.
```

```
## 2026-09-XX - Funnel drop-off repairs, second tier (feature)
- type: feature
- pr: #NN
- branch: feat/funnel-drop-off-repairs-tier2
- ids: none
- scope: funnel-drop-off-repairs
- migration: none
- status: merged
- tsc: clean

Signup is now the lead action on the contribution prompt, the proxy carries the
destination through onboarding and both auth hops, a returning visitor can resume the
FTUE, the claim-link dead ends offer a way in, and password sign-in lands on the
member's own timeline like every other method. No migration.
```
