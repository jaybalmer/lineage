# Facebook Login + Public Legal Pages

> Cowork-authored feature brief, August 31 2026. Self-contained. ~2 to 3 hr, ONE PR,
> NO migration. Contains an OPS GATE (Jay in the Meta App Dashboard + Supabase) that
> sits between Part A and the Part B smoke test, handled the same way a migration gate is.
> Playbook subset run: checks 2, 7, 10, 11, 12, 20, 21, 22. Checks 1, 3, 4, 5, 6, 8, 9,
> 13, 14, 17, 19, 23, 24 are not applicable (no migration, no schema, no state model,
> no cross-user endpoint, no catalog operation).

---

## DECISIONS (review before building)

Every decision below has a shippable default. Build the defaults unless Jay says otherwise.

**D1. Three legal pages, not two. DEFAULT: yes.**
Meta App Review asks for a Privacy Policy URL, a Terms of Service URL, AND a User Data
Deletion entry which is satisfied by EITHER a callback URL or a human-readable
instructions URL. We ship the instructions URL. Building only the two Jay named risks a
round trip through review.
Alternative: skip `/data-deletion` and add it when review flags it.

**D2. Routes are flat: `/privacy`, `/terms`, `/data-deletion`. DEFAULT: yes.**
Flat routes are what people paste into third-party dashboards (Meta today, Stripe and the
app stores later) and what users guess. No `/legal/*` prefix, no `/legal` index page.
Alternative: `/legal/privacy` etc. with a `/legal` hub. Rejected as an extra hop for a
three-item list.

**D3. Shared page shell in `src/components/legal/`. DEFAULT: yes.**
Three pages with identical chrome. One shell component exporting the page wrapper, a
section component, and the entity/contact/effective-date constants, so a change of contact
email or effective date is one edit. Model it on `src/app/word/page.tsx`: minimal brand-mark
header, NOT the app `Nav`. These pages are read logged out by reviewers and crawlers, and
app chrome on them is noise.

**D4. Effective date is a single exported constant. DEFAULT: `LEGAL_EFFECTIVE = "August 31, 2026"`.**
Rendered under the H1 on all three pages. Any future edit to the policies bumps this one
constant.

**D5. Link the pages from three surfaces. DEFAULT: home footer, community footer, and a
consent line under the auth buttons on BOTH auth surfaces.**
See the surface-pairing table in section 7. Meta reviewers look for the policy link to be
reachable from the app itself, not only from the dashboard field.

**D6. Facebook sign-in ships in the same PR, on BOTH auth surfaces. DEFAULT: yes.**
There are two OAuth entry points, not one (see verified facts F5). Shipping the button on
only `/auth/signin` would leave the primary signup path (the FTUE save step) Google-only,
which is the opposite of the point.

**D7. Scopes are `email` and `public_profile` only. DEFAULT: yes.**
Both are granted without App Review or Business Verification. Adding anything else
(`user_friends`, `user_photos`) pulls the app into full review. The privacy copy in
Appendix A states this explicitly, so widening scopes later means editing the policy too.

**D8. Self-serve account deletion is NOT in this session. DEFAULT: correct, but read the risk.**
`/data-deletion` commits to a 5-business-day confirmation and a 30-day deletion, handled
by Jay manually off an emailed request. There is no self-serve delete in the product
(`profiles.is_archived` exists but is admin-only, PR #157). That is an honest and legal
position at current volume. It becomes a liability at scale, so section 14 logs the
follow-up feature.

---

## 1. Why this, why now

Jay is registering a Meta app so members can sign in with Facebook. The Meta App Dashboard
will not accept the app configuration without a Privacy Policy URL and a Terms of Service
URL, and App Review flags apps with no User Data Deletion entry. Linestry has none of the
three today.

The legal pages are the blocking dependency. Facebook Login is the feature they unblock.
They ship together because splitting them means two PRs where the first one has no visible
outcome.

Second-order value beyond Meta: Stripe, the Apple and Google app stores, any future
partner integration, and every investor doing diligence will all ask for the same two URLs.
This is a debt Linestry pays once.

---

## 2. Scope

**In scope**

- A shared legal page shell plus three public, server-rendered, logged-out-readable pages:
  `/privacy`, `/terms`, `/data-deletion`.
- The full copy for all three pages. It is written and locked in Appendix A. Build from
  Appendix A verbatim. Do not paraphrase, re-order, or "improve" the legal copy.
- Legal links added to the home footer, the community footer, and a consent line on both
  auth surfaces.
- A "Continue with Facebook" button on `/auth/signin` and on the FTUE save step, wired to
  Supabase `signInWithOAuth({ provider: "facebook" })`, matching each surface's existing
  Google button in shape, telemetry, and error handling.
- Metadata (title, description, canonical, OpenGraph) on each page, matching the
  `src/app/word/page.tsx` pattern.

**Out of scope. Do not build these.**

- Any `/legal` index or hub page.
- A Meta data-deletion CALLBACK endpoint (`POST /api/auth/facebook/data-deletion` parsing a
  signed request). We use the instructions URL. Only build the callback if Meta explicitly
  rejects the instructions URL, and that would be its own session.
- Self-serve account deletion UI or API. See D8 and section 14.
- Any change to `/auth/callback`, `/auth/complete`, or the returnTo handling. Facebook uses
  the same hop Google already uses and needs nothing new there (verified, F4).
- Apple, X, or any other OAuth provider.
- A cookie consent banner. Linestry sets no advertising cookies; PostHog and Sentry are
  first-party-configured analytics. If GDPR banner work is wanted it is a separate brief.
- Refactoring the two duplicated `GoogleGlyph` components into a shared one. Tempting while
  you are in both files; it is scope creep and it puts a shared-component refactor in a PR
  whose diff should be readable by a non-engineer. Logged in section 14.

---

## 3. Verified facts (checked against `main` at `f6ec7f8`, August 31 2026)

Provenance given so the session does not re-derive these. Re-verify anything that looks
stale; the tree has moved since the last feature ship.

- **F1. No legal routes exist.** `find src -iname "*privacy*" -o -iname "*terms*" -o -iname
  "*legal*"` returns only `src/app/me/settings/tag-privacy/` and `src/app/api/me/tag-privacy/`.
  Nothing to remove, nothing to migrate, no redirect to preserve. (Playbook check 22: the
  premise "these pages do not exist" is confirmed, not assumed.)
- **F2. There is no `middleware.ts`** at the repo root or in `src/`. Public routes are public
  by default. `src/app/robots.ts` returns `allow: "/"` for all agents, so a Meta or Google
  crawler can reach the new pages with no allowlist edit.
- **F3. `next.config.ts` has two redirects** (`/revenue` and `/revenue/distributions` to
  `/equity`) and a global headers block including `X-Frame-Options: DENY`. Neither affects
  the new routes. No config change is needed.
- **F4. The OAuth hop already works generically.** `src/app/auth/callback/route.ts` handles
  the provider round trip and preserves `returnTo` (BUG-054); `src/app/auth/complete/page.tsx`
  line 203 already treats "magic-link or Google sign-in" as one path. Facebook joins it with
  no changes to either file.
- **F5. There are TWO `signInWithOAuth` call sites, not one.** This is the fact most likely to
  be missed:
  - `src/app/auth/signin/page.tsx:52`, the returning-member sign-in page. `GoogleGlyph`
    defined at line 24. Button at line 186. Fires `trackEvent("auth", "signin_started",
    { method: "google" })`. Buttons are `rounded-xl`, `fontSize: 13`, white background.
    Error handling: `if (oauthError) setError(...)`, no try/catch, no failure telemetry.
  - `src/components/onboarding/save-step.tsx:77`, the FTUE final step, which is the PRIMARY
    signup path. Its own copy of `GoogleGlyph` at line 44. Button at line 198. Fires
    `trackEvent("auth", "signup_started", ...)`, wraps the call in try/catch, and fires
    `signup_failed` with `signupErrorClass(...)` on both the returned error and a thrown
    dispatch. Buttons are `rounded-full`, `px-4 py-4`, `text-[15px]`, on the forced-dark
    FTUE background (PR #194).
  The two surfaces differ in shape, telemetry verb, and error handling. Mirror each one
  locally rather than making them match each other.
- **F6. CORRECTED September 1 2026. Supabase runs on a CUSTOM AUTH DOMAIN in the deployed
  environments: `auth.linestry.com`.** Local `.env.local` still carries the default
  `https://wwsbfmbmtypeujvjilai.supabase.co`, which is what the first draft of this brief
  wrongly used. The live OAuth dialog proves the real value: Supabase issues
  `redirect_uri=https://auth.linestry.com/auth/v1/callback`. That EXACT string, and no other,
  is what Meta's Valid OAuth Redirect URIs must contain. Verify the deployed value from the
  dialog URL rather than from `.env.local`, which reflects local only.
- **F7. There is no shared footer component.** `src/components/ui/` has no `footer`,
  `shell`, or `layout` file. The entity line is hand-rolled in at least two places:
  `src/app/page.tsx:136-141` and `src/app/(community)/[community]/page.tsx:320-325`. Do NOT
  create a shared footer component in this PR; add the links inline in both places and log
  the consolidation in section 14.
- **F8. `src/app/word/page.tsx` is the model for a minimal-chrome public page**: brand-mark
  header linking home, `max-w-2xl`, full `Metadata` export with canonical and OpenGraph,
  `displayFont` const reading `var(--font-display)`. `BrandMark` is exported from
  `src/components/ui/brand-mark.tsx:60`.
- **F9. Processor list for the privacy copy, verified in code, not assumed.** Supabase
  (`@supabase/supabase-js`, `@supabase/ssr`), Vercel (deploy + `@vercel/analytics`), Stripe,
  Resend, PostHog (`posthog-js` + `posthog-node`), Sentry (`@sentry/nextjs`). PostHog is
  initialised in `src/instrumentation-client.ts:23-32` with `capture_pageview: true`,
  `capture_pageleave: true`, `session_recording: { maskAllInputs: true }`, and
  `person_profiles: "identified_only"`. Sentry is initialised at the same file line 8 with
  `tracesSampleRate: 1.0` and NO replay integration. Appendix A's copy describes exactly
  this. If any of it changes, the copy changes.
- **F10. Storage buckets holding member-uploaded files**: `story-images`, `board-images`,
  `event-images`, `place-images`. Appendix A refers to them collectively as "our storage
  buckets" and does not enumerate them, so adding a bucket does not require a copy edit.
- **F11. Member-facing privacy controls that Appendix A points at all exist**:
  `src/app/me/settings/tag-privacy/`, `.../blocks/`, `.../public-timeline/`, `.../trust/`,
  `.../notifications/`. Playbook check 7: every "you can do X in settings" line in the copy
  has a real surface behind it today.
- **F12. Tier words are `Annual`, `Lifetime`, `Founding`** (`src/lib/tiers.ts:22-26`), with
  free riders called "Rider". Appendix A's Terms section 7 uses exactly these.
- **F13. There is no self-serve account deletion.** No `delete account` route, no
  `deleteAccount` handler. `profiles.is_archived` is the admin soft-archive from PR #157.
  This is the fact behind D8 and behind the manual promise in the deletion copy.

---

## 4. OPS GATE (Jay, mid-session)

Treat this exactly like a migration gate: Part A can be built and pushed before it, the
Part B smoke test cannot pass until it is done. Surface it to Jay and wait.

**4a. Meta App Dashboard, App Settings then Basic**

| Field | Value |
|---|---|
| Privacy Policy URL | `https://linestry.com/privacy` |
| Terms of Service URL | `https://linestry.com/terms` |
| User Data Deletion (choose "Data Deletion Instructions URL") | `https://linestry.com/data-deletion` |
| App Domains | `linestry.com` |
| Platform: Website, Site URL | `https://linestry.com` |
| Contact Email | `jay@lineage.community` |
| Category | Lifestyle |

**4b. Meta, Products then Facebook Login then Settings**

- Valid OAuth Redirect URIs: `https://auth.linestry.com/auth/v1/callback` (see F6; this is the
  custom Supabase auth domain, NOT the `*.supabase.co` default). Exact match, no trailing
  slash. A missing or mismatched entry here is what produces Facebook's "URL Blocked: This
  redirect failed because the redirect URI is not white-listed in the app's Client OAuth
  Settings" page.
- Client OAuth Login: On. Web OAuth Login: On. Enforce HTTPS: On.
- Login with the JavaScript SDK: Off. Linestry does not load the FB SDK and must not
  start now.
- Permissions: `email` and `public_profile` only (D7).

**4c. Supabase, Authentication then Providers then Facebook**

- Enable, paste App ID and App Secret from Meta.
- Confirm the callback URL Supabase displays matches what was pasted in 4b.
- Authentication then URL Configuration: `https://linestry.com/auth/callback` should already
  be in Redirect URLs from the Google setup. Confirm, do not duplicate.
- **If the smoke test runs against a Vercel PREVIEW deployment** (hostnames of the shape
  `lineage-<hash>-jaybalmers-projects.vercel.app`), that host must also be in Supabase's
  Redirect URLs or Supabase rejects the `redirect_to` after Facebook succeeds and silently
  falls back to Site URL. Preview hostnames are regenerated per deploy, so add a wildcard
  entry rather than one host: `https://lineage-*-jaybalmers-projects.vercel.app/**`. This is
  a SEPARATE gate from 4b: Meta blocks the `redirect_uri`, Supabase blocks the `redirect_to`,
  and fixing one does not fix the other.

**4d. Before the button works for anyone but Jay**

Meta apps start in Development mode, where only app admins, developers, and testers can
complete login. Flip App Mode to Live once the smoke test passes. Business Verification is
NOT required with only `email` and `public_profile`.

**4e. Reading the failure, so the right gate gets fixed**

Three different things fail at three different points in the hop. Match the symptom before
changing anything.

| What you see | Which gate | Fix |
|---|---|---|
| Facebook page reading "URL Blocked: this redirect failed because the redirect URI is not white-listed" | Meta, 4b | Add the exact `redirect_uri` from the dialog URL to Valid OAuth Redirect URIs |
| Facebook page reading "App not active" or "This app is in development mode" | Meta, 4d | Add the tester to the app, or flip App Mode to Live |
| Facebook login succeeds, then you land on linestry.com root or an error instead of where you started | Supabase, 4c | The `redirect_to` host is not in Supabase's Redirect URLs |
| Supabase returns "Unsupported provider: provider is not enabled" | Supabase, 4c | The Facebook provider is off, or the App ID/Secret were not saved |

To read the dialog URL yourself: the `redirect_uri` param is what Meta checks against 4b.
The `redirect_to` param is what Supabase checks against 4c. They are different values with
similar names, and confusing them costs an hour.

---

## 5. Build, Part A: the legal pages

**Step 0, housekeeping.** Two artifacts to clear before you start, both from a Cowork
session that overstepped:

- `features/_cowork-scratch/` holds draft `.tsx.txt` files and an ops note. Everything of
  value in them is in this brief. Delete the directory.
- `.git/index.lock` is present and stale (a Cowork `git status` created it and the sandbox
  could not unlink it). `rm -f .git/index.lock` before any git operation. Confirm with
  `git status` that the working tree shows only the pre-existing `auto/bugfix-20260830-2122`
  modifications, `.design-sync/`, and `docs/design-system.md`.

**Step 1.** `src/components/legal/legal-shell.tsx`. Server component, no `"use client"`.
Exports:
- `LEGAL_ENTITY = "Lineage Community Technologies Inc."`
- `LEGAL_CONTACT = "jay@lineage.community"`
- `LEGAL_EFFECTIVE = "August 31, 2026"`
- `LegalSection({ id, title, children })`: an `h2` plus a prose block. Set `scroll-mt` so
  in-page anchors clear the header.
- `LegalPage({ title, summary, current, children })`: brand-mark header linking home
  (copy the pattern from `src/app/word/page.tsx`), `h1`, effective-date line, a boxed
  one-paragraph plain-language summary, the body, and a footer nav cross-linking the other
  two legal pages plus a `mailto:` contact.

Token discipline: the class is `border-border-default`, generated from
`--color-border-default` in `globals.css`. The bare `border-default` used in about 45 places
across `src/` including `word/page.tsx` does NOT resolve to anything in Tailwind v4. Do not
copy it. (Logged as its own cleanup in section 14; do not fix it here.)

**Step 2.** Three pages, each a server component with a `Metadata` export following the
`word/page.tsx` shape (title, description, `alternates.canonical`, `openGraph` with
`type: "article"`, `url`, `siteName: "Linestry"`):
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/data-deletion/page.tsx`

Body copy comes verbatim from Appendix A. Section ids in Appendix A are the `LegalSection`
`id` values, so cross-page anchors work.

**Step 3.** Footer links.
- `src/app/page.tsx:136-141`: add a link row (Privacy, Terms, Data deletion) above the
  existing entity line.
- `src/app/(community)/[community]/page.tsx:320-325`: same row, same order, above the same
  entity line.
Inline in both. No shared component (F7).

---

## 6. Build, Part B: Facebook sign-in

**Step 4.** `src/app/auth/signin/page.tsx`.
- Add a `FacebookGlyph` beside the existing `GoogleGlyph` (line 24). The Facebook brand blue
  is `#1877F2`.
- Add `continueWithFacebook`, mirroring `continueWithGoogle` at line 47 exactly: same
  `currentReturnTo()` and `redirectTo` construction, `trackEvent("auth", "signin_started",
  { method: "facebook" })`, same `if (oauthError) setError(...)` handling.
- Add the button directly under the Google button (line 186 area), same `rounded-xl`,
  `fontSize: 13` shape. Label: `Continue with Facebook`.

**Step 5.** `src/components/onboarding/save-step.tsx`.
- Its own `FacebookGlyph` beside the local `GoogleGlyph` (line 44). Yes, this duplicates
  step 4; that is deliberate (see out-of-scope).
- Add `continueWithFacebook` mirroring `continueWithGoogle` at line 73 exactly, INCLUDING
  the try/catch and both `signup_failed` telemetry branches with
  `signupErrorClass(oauthError.message)` and `"dispatch_threw"`. Verb is `signup_started`,
  not `signin_started`.
- Button under the Google button (line 198 area), same `rounded-full`, `px-4 py-4`,
  `text-[15px]` shape. This step renders on a forced-dark background: check contrast on
  dark, not only in light mode.

**Step 6.** Consent line on both auth surfaces, under the button stack, above the existing
footer row. Copy, identical on both:

> By continuing you agree to our Terms of Service and Privacy Policy.

with "Terms of Service" linking `/terms` and "Privacy Policy" linking `/privacy`. Muted,
small (11px on `/auth/signin`, scale to that surface on the save step), underlined links.

---

## 7. Surface pairing (playbook check 12)

| Thing added | Where the user finds it | Affordance |
|---|---|---|
| `/privacy` | Home footer; community footer; consent line on both auth surfaces; footer nav of the other two legal pages; Meta App Dashboard | Text link |
| `/terms` | Same as above | Text link |
| `/data-deletion` | Home footer; community footer; linked from `/privacy` sections 6, 10, 11 and `/terms` section 10; Meta App Dashboard | Text link |
| Facebook OAuth | `/auth/signin` button stack; FTUE save step button stack | Primary-shaped button with glyph |
| Deletion request intake | `mailto:jay@lineage.community` from `/data-deletion` section 2 | Prefilled subject line |

---

## 8. Acceptance criteria

Each one is checkable, and each was validated against the codebase as "does this surface
exist today" before being written (playbook check 7).

1. `npx tsc --noEmit` is clean.
2. `/privacy`, `/terms`, `/data-deletion` all render at 200 in a private window with no
   session, on both light and dark themes, on mobile width.
3. Each page shows the effective date, and changing `LEGAL_EFFECTIVE` changes all three.
4. Each page's footer nav links to the other two and to the contact mailto.
5. Home page footer and community page footer both show Privacy, Terms, Data deletion above
   the entity line.
6. `/auth/signin` shows Continue with Facebook under Continue with Google, and the consent
   line under the button stack, with both links navigating correctly.
7. The FTUE save step shows the same, legible against the forced-dark background.
8. After the ops gate: clicking Continue with Facebook on `/auth/signin` completes the round
   trip and lands a signed-in session. A returnTo is preserved through the hop.
9. After the ops gate: the same from the FTUE save step, and the FTUE claims migrate at
   `/auth/complete` the way they do for Google.
10. PostHog shows `signin_started {method: "facebook"}` from the sign-in page and
    `signup_started {method: "facebook"}` from the save step.
11. Signing in with Facebook using the email address of an existing Google-created account
    lands on the existing profile rather than creating a duplicate. If it does not, STOP and
    report; that is a Supabase identity-linking setting, not a code fix, and Jay decides it.
12. View-source on `/privacy` shows the OpenGraph title and canonical.

---

## 9. Risks and gotchas

- **The Facebook button is inert until the ops gate is done.** Before Supabase has the
  provider enabled, clicking it returns a Supabase "provider is not enabled" error into the
  existing error state. That is acceptable mid-session but must not be what ships. Do not
  merge before criterion 8 passes.
- **Development mode.** Even after the gate, only Meta app admins/testers can log in until
  App Mode is Live. If Jay's own login works and a second tester's does not, that is the
  cause, not the code.
- **Account collision (criterion 11).** A member who signed up with Google using
  `x@gmail.com` and then uses Facebook with the same address: Supabase's behaviour depends on
  its identity-linking configuration. This is the single most likely surprise in the session.
  Test it deliberately with a plus-aliased address (see the standing test-account pattern),
  and report rather than patch.
- **`npm run dev` source (playbook check 20).** Run the dev server from the repo you are
  building in, and stop any pre-existing server first so port 3000 binds to the right
  instance. Cowork cannot verify rendering: its bridge shell is linux/arm64 while
  `node_modules` holds darwin-arm64 SWC binaries, so `npm run dev` fails there. Every visual
  acceptance criterion above is genuinely unverified until this session runs it.
- **Copy is locked (playbook check 21).** Appendix A contains NO em dashes, per the standing
  rule. If you rewrite any sentence, keep it that way.
- **These pages make promises the product must keep.** The 5-day / 30-day / 90-day deletion
  timelines and the 24-month analytics retention are commitments, not decoration. Do not
  soften or inflate them without telling Jay.

---

## 10. Rollback

Single flip point. The three pages and the shell are new files with no callers other than
the footer and consent links; the Facebook buttons are additive. Reverting the PR removes
everything with no data or schema state to unwind. If only the Facebook half is a problem,
delete the two buttons and their handlers and keep the legal pages, which stand alone and
are the part with external dependencies pointing at them.

---

## 11. Ship sequence

Per the repo `CLAUDE.md` standing rule. No migration this time, but there IS the ops gate,
so it takes the migration's place in the sequence:

1. Build Part A, push the branch, open the PR.
2. Surface the section 4 ops gate to Jay as a copy-paste checklist. Wait for him to confirm
   Meta and Supabase are configured.
3. Build Part B, or finish its smoke test if already built. Run acceptance criteria 8 to 11.
4. Prompt for the merge and wait.
5. Append one entry to `bugs/SHIP-LOG.md` with `type: feature`, `ids: none`,
   `scope: facebook-login-legal-pages`, `status: pending`.
6. After deploy, confirm the three URLs resolve on the real domain, then tell Jay to flip
   the Meta app to Live.

---

## 12. Questions for Jay (answer before code touches the repo)

1. **Contact address.** Appendix A uses `jay@lineage.community` throughout. `jay@linestry.com`
   forwards there. A `privacy@linestry.com` alias would be more durable but does not exist
   yet. Ship with `jay@lineage.community` unless Jay says otherwise.
2. **Deletion SLA.** Are 5 business days to confirm and 30 days to complete the numbers Jay
   wants to be held to, given it is manual today?
3. **Legal review.** Appendix A is not lawyer-reviewed. Ship as-is and review later, or hold
   the merge? Recommend ship: having no policy is the larger exposure.
4. **Terms section 8 (tokens and equity)** should be read against the actual SAFE and PLAY
   offer documents for consistency before merge. Jay owns that check.

---

## 13. Follow-ups, NOT this session

- **Self-serve account deletion** (D8). A `/me/settings/account` delete flow with
  confirmation, using or extending `profiles.is_archived`. Needed before volume makes the
  manual promise unkeepable. Deserves its own brief.
- **`border-default` cleanup.** The bare class appears in about 45 places in `src/` and
  resolves to nothing; only `border-border-default` is generated by Tailwind v4 from the
  token in `globals.css`. Cosmetic, widespread, unrelated to this feature. File as a bug.
- **Shared footer component.** The entity line is hand-rolled in at least two pages (F7);
  after this PR each will also carry a duplicated legal link row. Consolidate later.
- **Shared OAuth provider button.** `GoogleGlyph` is duplicated across two files and this PR
  adds a second duplicated glyph. A `ProviderButton` component would collapse four
  definitions into one. Do it when a third provider is added, not before.
- **Meta data-deletion CALLBACK endpoint**, only if Meta rejects the instructions URL.
- **Cookie consent banner**, if GDPR coverage is wanted beyond the policy text.

---

# Appendix A: copy of record

Build these verbatim. Headings map to `LegalSection` `title`; the bracketed slug is its
`id`. Curly quotes and apostrophes should be escaped as HTML entities in JSX the way
`word/page.tsx` does. No em dashes anywhere.

---

## A1. `/privacy`, the Privacy Policy

**Boxed summary under the H1:**

> Linestry is a community-authored record of snowboarding history. We collect the account
> details needed to sign you in, the history you choose to record, and a small amount of
> usage data to keep the service working. We do not sell personal information and we do not
> run advertising.

### 1. Who we are `[who-we-are]`

Linestry is operated by Lineage Community Technologies Inc. ("Linestry", "we", "us"), a
company incorporated in British Columbia, Canada. We are the organization responsible for
the personal information described in this policy.

Questions, access requests, and complaints go to jay@lineage.community.

### 2. Information we collect `[what-we-collect]`

**Account information.** When you create an account we collect your email address and
display name. If you sign in with Google or Facebook, that provider sends us your name,
email address, and profile picture URL. We do not receive your password, and we do not
receive your friend list, posts, photos, or any other content from those accounts.

**Profile information you add.** Username, avatar, home mountain, the year you started
riding, era, bio, profile statement, and milestones. All of it optional beyond what is
needed to create the account.

**History you record.** Timeline claims (where you rode, who you rode with, boards you
owned, events you entered), riding days, stories and their text, dates, photos, and any
YouTube links you attach. Photos are uploaded to our storage buckets and keep whatever
information is embedded in the file you upload.

**Information about other people.** Linestry is a shared graph, so members add catalog
records for riders, places, brands, boards, and events, and tag other people in their own
history. This means records about you may exist before you ever create an account. See
section 7.

**Payment information.** Memberships are processed by Stripe. Stripe handles your card
details directly; we never see or store a card number. We store the Stripe customer and
subscription identifiers, your tier, and its status.

**Usage and diagnostic data.** Page views, feature events (for example, starting onboarding
or publishing a story), approximate location inferred from IP address by our analytics
provider, browser and device type, and error reports when something breaks. Session replays
are recorded with all input fields masked, so typed content such as emails, names, story
bodies, and claim notes is not captured.

**Bug reports and support email.** Whatever you choose to include when you file an in-app
bug report or email us.

### 3. How we use it `[how-we-use]`

- To create and secure your account and sign you in.
- To build and display your timeline and the shared community graph.
- To send transactional email: sign-in links, tag notifications, comment notifications,
  claim decisions, and membership receipts.
- To process memberships and track token and equity-offer balances.
- To moderate contributions, review claim requests, and enforce our terms.
- To understand which parts of the product work, fix errors, and improve it.

We do not sell personal information, we do not share it with advertisers, and we do not use
your content to train third-party AI models.

### 4. Our basis for using it `[legal-basis]`

In Canada we rely on your consent, given when you create an account and when you choose to
publish content. Where the GDPR applies, we rely on: performance of a contract (running your
account and membership), legitimate interests (security, moderation, product analytics, and
maintaining an accurate historical record), consent (optional email and optional public
sharing), and legal obligation (tax and accounting records).

### 5. What is public and what is not `[visibility]`

Your timeline is private by default. Content becomes visible to others only when you choose
it: by setting an entry's visibility, by turning on a public timeline at a public link, or by
contributing a record to the shared catalog. Catalog entries (people, places, brands, boards,
and events) are community data and are visible to other members by design.

Anything you publish publicly can be seen, copied, indexed by search engines, and archived by
third parties. Turning public sharing off stops future access through Linestry but cannot
retrieve copies already made elsewhere.

### 6. Facebook Login and Google Sign-In `[facebook]`

If you choose "Continue with Facebook" or "Continue with Google", we request only the basic
profile fields listed in section 2 in order to create your Linestry account and match it to
an existing email address if you already have one. We do not post to your Facebook or Google
account, we do not read your friends, contacts, or feed, and we do not import content from
those services.

You can disconnect Linestry at any time from your Facebook settings (Settings and Privacy,
then Settings, then Apps and Websites) or your Google account permissions page. Disconnecting
stops future sign-ins with that provider; to remove data already stored on Linestry, follow
the data deletion instructions. [link "data deletion instructions" to /data-deletion]

### 7. Information about people who are not members `[about-others]`

Members can add a rider to the catalog and tag them in their own history. These unclaimed
records exist so that history can be recorded accurately, and they hold only what a member
contributed: a name, and the claims or stories that reference it.

If a record refers to you, you can claim it and take ownership of the profile, set tag
approval so that future tags need your consent, block specific members, or ask us to remove
the record entirely. Write to jay@lineage.community and we will act on it. You do not need an
account to make that request.

### 8. Service providers `[processors]`

We use a small set of processors, each bound to use the data only to provide their service to
us:

- **Supabase**: database, authentication, and file storage.
- **Vercel**: application hosting and request logs.
- **Stripe**: payment processing for memberships.
- **Resend**: delivery of transactional email.
- **PostHog**: product analytics and masked session replay.
- **Sentry**: error and performance monitoring.
- **Google** and **Meta Platforms**: only if you choose their sign-in button.

We also embed YouTube players when a member attaches a video. Loading an embedded player
contacts Google's servers and is subject to Google's privacy policy.

### 9. Where data is stored `[transfers]`

Linestry is a Canadian company, but our providers operate in the United States and other
countries, so your information is stored and processed outside Canada and may be accessible
to courts and authorities in those jurisdictions. Where the GDPR applies, transfers rely on
our providers' standard contractual clauses.

### 10. How long we keep it `[retention]`

We keep your account and the history you record for as long as your account is open.
Analytics and error data are kept for up to 24 months. Payment records are kept for seven
years as required for Canadian tax purposes. When you ask us to delete your account, we
follow the timelines set out in the data deletion instructions. [link to /data-deletion]

### 11. Your choices and rights `[rights]`

- **Access and correction.** You can edit your profile and entries in the app, and you can
  ask us for a copy of everything we hold about you.
- **Deletion.** See the data deletion instructions. [link to /data-deletion]
- **Email preferences.** Notification email can be turned off in your settings or through
  the unsubscribe link in any message. Sign-in and receipt emails are operational and cannot
  be turned off while your account is open.
- **Tagging.** You can require approval before other members tag you, and you can block
  individual members.
- **Public sharing.** You can turn your public timeline on or off at any time.

If you are in the EU or UK you also have rights to portability, restriction, objection, and
to complain to your supervisory authority. If you are a California resident you have the
rights to know, delete, correct, and to opt out of sale or sharing. We do not sell or share
personal information as those terms are defined. If you are in Canada and are not satisfied
with our response, you can contact the Office of the Privacy Commissioner of Canada or the
Office of the Information and Privacy Commissioner for British Columbia.

### 12. Security `[security]`

Access to the database is governed by row-level security, traffic is encrypted in transit,
and administrative access is limited to the people who need it. No service can promise
perfect security; if a breach creates a real risk of significant harm we will notify affected
members and the relevant regulator as the law requires.

### 13. Children `[children]`

Linestry is not directed at children under 13, and we do not knowingly collect their personal
information. If you believe a child has created an account, write to jay@lineage.community
and we will remove it.

### 14. Changes to this policy `[changes]`

We will update this page when our practices change and revise the effective date above. For
material changes affecting how we use information you have already given us, we will notify
members by email or in the app before the change takes effect.

---

## A2. `/terms`, the Terms of Service

**Boxed summary under the H1:**

> Linestry is a shared record of snowboarding history that members build together. You keep
> ownership of what you contribute and give us the licence we need to display it. In exchange,
> you agree to contribute honestly, to respect the people you record, and to accept that a
> community archive is edited by more than one hand.

### 1. The agreement `[agreement]`

These terms are a contract between you and Lineage Community Technologies Inc. ("Linestry",
"we", "us"), covering linestry.com and everything on it. By creating an account or using the
service you accept them. If you do not, do not use Linestry.

Our Privacy Policy and data deletion instructions are part of these terms. [link both]

### 2. Eligibility and your account `[eligibility]`

You must be at least 13 years old to use Linestry, and old enough to form a binding contract
where you live. You are responsible for what happens under your account and for keeping
access to your email or connected sign-in provider secure. One account per person; do not
impersonate anyone, and do not create an account on someone else's behalf without their
permission.

You can sign in with an email link, a password, or a connected Google or Facebook account. If
a connected provider changes or removes its service, we may need to change how sign-in works.

### 3. Your content `[your-content]`

You keep ownership of the stories, photos, claims, and other material you contribute. You
grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, adapt
for display, and publish that material for the purpose of operating and promoting Linestry,
and to allow other members to view it according to the visibility you set. This licence lasts
as long as your content is on Linestry and for a reasonable period after removal while
backups age out.

You confirm that you own or have the right to post what you upload, including photographs
taken by someone else. If you post a photo you did not take, credit the photographer and have
their permission.

**Community catalog records are different.** Entries you add to the shared catalog (people,
places, brands, boards, events, and the factual relationships between them) become part of a
collective record that other members can extend, correct, and build on. Facts about the
history of the sport are not owned by whoever typed them first. Deleting your account does
not withdraw those factual records from the graph, although we will disassociate them from
you on request.

### 4. Recording other people `[about-others]`

Linestry works because members record who they rode with. When you tag a person, add a rider
to the catalog, or name someone in a story, you are making a public-facing claim about a real
person. You agree to:

- record only what you believe to be true, and mark uncertainty honestly using the confidence
  and approximate-date fields rather than guessing with certainty;
- respect a member's tag-approval setting and any block they have placed;
- keep private details private. Home addresses, contact information, health, and personal
  circumstances do not belong in a riding history;
- remove or correct an entry when the person it names asks you to, or when we ask on their
  behalf.

Anyone named on Linestry can claim their profile, request corrections, or ask for removal by
writing to jay@lineage.community, whether or not they are a member.

### 5. Acceptable use `[conduct]`

Do not use Linestry to:

- post false history, fabricate results, or claim accomplishments that are not yours;
- harass, threaten, defame, or out anyone;
- post unlawful, hateful, or sexually explicit material, or material involving minors
  inappropriately;
- infringe copyright, trademark, or other rights;
- scrape, bulk-download, or resell the catalog, or use it to train a commercial model without
  our written permission;
- probe or interfere with the security of the service, or automate access in a way that
  degrades it for others.

### 6. Moderation and corrections `[moderation]`

Linestry is an edited archive. Editors and administrators may merge duplicate records,
correct dates and attributions, decline claim requests, resolve competing accounts of the
same event, hide or remove content that breaks these terms, and archive accounts. Where a
decision affects your own contributions we will tell you and explain why, and you can reply
to contest it.

If you believe content on Linestry infringes your copyright, send us the work, its location
on Linestry, your contact details, and a statement of your good-faith belief at
jay@lineage.community. We remove infringing material promptly and repeat infringers lose
their accounts.

### 7. Memberships and payment `[membership]`

Linestry is free to use. Paid memberships (Annual, Lifetime, and the launch Founding cohort)
unlock additional features and are billed through Stripe in the currency shown at checkout,
plus applicable taxes. Annual memberships renew automatically at the then-current price until
cancelled; you can cancel at any time from your membership settings and keep access until the
end of the paid period.

Prices and the features attached to each tier can change; we will give notice before a change
affects a renewal. Except where consumer law requires otherwise, payments are non-refundable,
though we would rather sort out a genuine problem than stand on that, so write to us.

### 8. Tokens and the equity offer `[tokens]`

Members earn tokens for contributing history. Tokens are a record of contribution inside
Linestry. They are not currency, not a cryptocurrency, have no cash value, cannot be bought,
sold, or transferred, and confer no rights on their own. We may adjust how tokens are earned
and weighted, and we reverse tokens earned through spam or fabricated entries.

Any equity offer described on Linestry is a separate, limited offer made by Lineage Community
Technologies Inc. and is governed by its own offer documents and by applicable securities
law. The pages describing it are explanatory, not an agreement, not a prospectus, and not an
offer to sell securities in any jurisdiction where that would be unlawful. Nothing on
Linestry is investment, tax, or legal advice; participation is subject to eligibility checks
and to signing the actual subscription documents.

### 9. Our intellectual property `[our-ip]`

The Linestry name, brand marks, interface, design system, and software are ours. These terms
do not give you any right to use them beyond using the service as intended.

### 10. Ending it `[termination]`

You can stop using Linestry at any time and ask us to delete your account through the data
deletion instructions. [link to /data-deletion] We can suspend or terminate an account that
breaks these terms, or that puts other members or the integrity of the archive at risk. If we
terminate your account without cause, we will refund the unused part of a paid membership.

### 11. Disclaimers and liability `[disclaimers]`

Linestry is provided "as is". It is a community-authored archive: entries are contributed by
members and are not verified by us, and we make no warranty that any record on it is
accurate, complete, or fit for any purpose. Snowboarding is a risk sport; nothing on Linestry
is safety or conditions advice.

To the fullest extent the law allows, we are not liable for indirect, incidental, special, or
consequential damages, or for lost data or lost profits. Our total liability for any claim
relating to Linestry is limited to the greater of the amount you paid us in the twelve months
before the claim, or CAD $100. Nothing here limits liability that cannot be limited by law,
including under consumer protection legislation in your province or country.

### 12. Governing law `[law]`

These terms are governed by the laws of the Province of British Columbia and the laws of
Canada that apply there. The courts of British Columbia have exclusive jurisdiction, except
that if you are a consumer resident elsewhere you keep the right to bring a claim in your own
local courts.

### 13. Changes `[changes]`

We will post updated terms here and revise the effective date. For material changes we will
notify members by email or in the app before they take effect. Continuing to use Linestry
after that means you accept the new terms.

Questions about any of this: jay@lineage.community.

---

## A3. `/data-deletion`, Deleting your data

Page H1 is "Deleting your data".

**Boxed summary under the H1:**

> You can remove individual entries yourself at any time. To delete your whole account and
> the personal information attached to it, email us and we will confirm within 5 business
> days and complete the deletion within 30 days.

### 1. Removing things yourself `[yourself]`

While your account is open you can delete any story, claim, riding day, or photo you have
added from the entry itself, edit or clear your profile fields, and switch your public
timeline off in Settings. Removing an entry takes it out of the app immediately.

### 2. Deleting your whole account `[account]`

Send an email to jay@lineage.community from the email address on your account, with the
subject **Delete my Linestry account**. Tell us your username if you have one.
[the mailto should carry `?subject=Delete%20my%20Linestry%20account`]

If you cannot send from that address (for example you signed up with Facebook or Google and
no longer have access to that mailbox), write to us anyway and we will verify your identity
another way before we delete anything.

What happens next:

- **Within 5 business days** we confirm the request and tell you exactly what will be removed.
- **Within 30 days** we delete your account, your profile, your stories and photos, your
  private claims and riding days, your tags, your notification and privacy settings, and your
  analytics profile.
- **Within 90 days** the deletion works through our encrypted backups, which are rotated on
  that cycle.

### 3. If you signed in with Facebook or Google `[facebook]`

Disconnecting Linestry from Facebook (Settings and Privacy, then Settings, then Apps and
Websites, then Linestry, then Remove) or from your Google account permissions page stops us
receiving anything further from that provider and stops that sign-in method working. It does
not by itself delete the account you built on Linestry. For that, send the email in section
2, and we will treat it as a deletion request covering the profile data the provider gave us.

### 4. What we keep, and why `[kept]`

A few things survive an account deletion, and it is fairer to say so plainly than to surprise
you later:

- **Shared catalog records.** Places, brands, boards, events, and riders you added to the
  community catalog stay in the graph as historical facts, disassociated from you. Ask us and
  we will remove your name from their attribution.
- **Other members' history.** If another member recorded that they rode with you, that is
  their entry about their own life. Ask us and we will remove the reference to you from it.
- **Payment records.** Invoices and transaction records are retained for seven years for
  Canadian tax and accounting purposes.
- **Suppression records.** We keep a minimal record of an unsubscribed or deleted email
  address so we do not email you again by mistake.
- **Moderation records.** Where an account was removed for abuse we keep enough to enforce
  that decision.

### 5. Getting a copy first `[export]`

If you would like an export of your timeline, stories, and photos before we delete anything,
ask for it in the same email and we will send it before the deletion runs.

### 6. Contact `[contact]`

Lineage Community Technologies Inc., British Columbia, Canada. jay@lineage.community. See
also our Privacy Policy. [link to /privacy]
