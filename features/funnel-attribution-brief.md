# First-Touch Acquisition Attribution

> Cowork-authored feature brief, September 4 2026. Self-contained. ~5 to 7 hr, ONE PR,
> WITH a migration: two additive CREATE TABLE statements (`ref_codes`, `acquisition`).
> Both are SAFE under the repo risk gate, and the brief deliberately adds NO column to
> `profiles`, so it never trips the "any SQL touching profiles is GATED" clause and can
> be applied in-session without waiting for Jay. Migrate first, then merge (section 9).
> Playbook subset run: checks 1, 2, 4, 6, 7, 8, 10, 11, 12, 18, 20, 21, 22, 23. Checks 5,
> 15, 16, 17, 19, 24 are not applicable (no Postgres views, no owner/editor terminology,
> no conditional-action UI, no prior-phase invariant conflict, no plpgsql function, no
> `_public` view column). Checks 3, 9, 13, 14 are tagged AUDIT in section 5: this brief
> was drafted from the repo on disk with no live database session, so no assertion was
> run against prod.

---

## DECISIONS (review before building)

Every decision below has a shippable default. Build the defaults unless Jay says
otherwise. Nothing here blocks on an answer.

**D1. Attribution is stored in a new one-row-per-member `acquisition` table, not as new
columns on `profiles` and not as event props alone. DEFAULT: the `acquisition` table.**

This is the load-bearing decision, and the reason is a deploy hazard, not taste. The only
place a new member's profile row is created is the upsert at
`src/app/auth/complete/page.tsx:74`, and it runs on the browser anon client. If
attribution lived on `profiles`, that upsert would send the new columns unconditionally on
every signup. In the window between the PR merging and the migration landing, PostgREST
returns PGRST204 for an unknown column and EVERY new signup's profile write fails. That is
exactly the Group F lesson from the Boards redesign (PR #58), and here it would land on the
single most important write path in the product. A separate table moves the risky write
off the signup path entirely: it is written by its own fire-and-forget server route, and
if the table is missing the route logs and returns, and the signup completes untouched.

Three supporting reasons. First, the repo risk gate treats any SQL touching `profiles` as
GATED, so a `profiles` migration waits for Jay while a CREATE TABLE does not. Second,
`profiles` is already very wide (membership, Stripe, tokens, public timeline, tag privacy,
curated profile, archival) and twelve attribution columns make it worse. Third, a separate
table can relax from one row per member to many rows per member later without a rewrite,
which is what a real multi-touch model eventually needs.

Alternative A: columns on `profiles`. Rejected because of the signup-path hazard above.
Alternative B: props only, no durable row. Rejected because requirement 4 is precisely that
cohort analysis must survive PostHog, and because `analytics_events` is an append-only
event log, so answering "where did this member come from" from it means scanning events by
actor and hoping the right one is still there.

**D2. First-touch lives in its own `localStorage` key, not in the Zustand store. DEFAULT:
`linestry_attribution_v1`.**

The store's `partialize` (`src/store/lineage-store.ts:1154`) persists everything it does
not explicitly strip, so attribution WOULD survive there. It should still not live there.
Capture has to happen before React hydrates (D3), and at that moment the store has not
rehydrated, so writing through the store means racing hydration for no benefit. A
standalone key is also untouched by `resetPerUserState()` on sign-out
(`src/components/catalog-loader.tsx:164`), which is correct: a first touch belongs to the
browser, not to whoever happens to be signed in.

Alternative: a slice on the store. Rejected for the hydration race and for coupling a
pre-auth measurement to per-user state that gets wiped on sign-out.

**D3. Capture runs in `src/instrumentation-client.ts`, immediately after the PostHog init.
DEFAULT: yes.**

Next runs that module before hydration and before any component effect. The comment at
`src/instrumentation-client.ts:14-20` records why PostHog init was moved there: a
provider-level effect loses the race against `ftue_landed`, which fires from the onboarding
mount effect. Attribution has the same race and needs the same answer, and it has to be
stored before `ftue_landed` reads it.

Alternative: a `useEffect` in a provider or in the root layout. Rejected: same race,
already lost once in this codebase.

**D4. First-touch expires after 90 days, and is cleared once a signup consumes it.
DEFAULT: 90 days, cleared on successful attach.**

Without an expiry, a visit from an FNRad episode in 2026 gets credit for a signup in 2028.
Without a clear-on-consume, member A's first touch is inherited by member B signing up on
the same laptop. Both are cheap to get right now and expensive to reconstruct later.

Alternative: never expire, never clear. Rejected: it produces confidently wrong numbers,
which is worse than no numbers.

**D5. The spoken code is a route handler at `/r/[code]` that 302s, with codes resolved from
a new `ref_codes` table. DEFAULT: yes.**

`linestry.com/r/fnrad-s12e04` is short enough to read on air, has no query string to
dictate letter by letter, and survives being retyped from memory. A route handler (not a
page) means no HTML, no flash, no client bundle: a lookup and a redirect. A table means Jay
can add next week's episode code with one SQL insert and no deploy.

Alternative A: a page component. Rejected: renders and hydrates a whole app shell just to
leave. Alternative B: a TypeScript constant map of codes. Rejected: minting a code would
require a code change and a deploy, which puts a marketing action behind an engineering
session.

**D6. 302, not 301. DEFAULT: 302 (temporary).**

Browsers cache a 301 aggressively and effectively forever. A code whose destination Jay
later changes, or a code typed wrong once, would be pinned in the listener's browser. The
proxy's person-node redirects are 301 because a merged slug genuinely is permanent
(`src/proxy.ts:158`); a campaign code is not.

Alternative: 301 for the SEO signal. Rejected: these links are spoken, not crawled, and the
episode page they can point at carries its own canonical.

**D7. No admin CRUD screen for ref codes this session. DEFAULT: codes are minted by SQL
insert, with a copy-paste template in section 6, T4.**

Jay already applies SQL routinely as part of the Ship sequence, and code minting happens
about once per episode. An admin screen is maybe 90 minutes of the session's budget spent
on the least uncertain part of the feature. Section 14 logs it.

Alternative: build the screen now. Rejected as scope: it delays the measurement, which is
the point.

**D8. Event props carry the referrer HOST only. The raw referrer string goes in the
`acquisition` row. DEFAULT: yes.**

Full referrer URLs from other sites can carry query strings with someone else's PII, and
the diagnostics brief locked event props to structural values with no bodies, notes,
emails, or names. Worth knowing before you tune this: `next.config.ts:26` already sets
`Referrer-Policy: strict-origin-when-cross-origin`, so a cross-origin `document.referrer`
in this app is already reduced to an origin with no path. The host-only rule is therefore
almost a no-op today and is there so it stays true if that header ever changes.

Alternative: full referrer in props. Rejected on the PII rule.

**D9. No new `analytics_events` category. DEFAULT: reuse `ftue`, `auth`, and `redirect`.**

`analytics_events.category` is CHECK-constrained
(`supabase/migrations/20260602000001_diagnostics_phase1_analytics_events.sql:32-34`), so a
new category means a migration on an existing table, which is a heavier change than this
feature needs. Every event we touch already has a home: `ftue_landed` and `ftue_completed`
are `ftue`, the signup events are `auth`, and the new `ref_code_hit` fits `redirect`, which
is exactly what `node_redirect` already uses
(`src/app/api/track/node-redirect/route.ts:20-21`).

Alternative: an `acquisition` category. Rejected: a CHECK-constraint migration on a live
table to buy a filter chip.

**D10. The durable write is its own fire-and-forget route, `POST /api/attribution/attach`,
called from `/auth/complete` after the profile upsert. DEFAULT: yes.**

Keeps the signup path unbreakable (see D1), keeps the service-role write server-side where
it belongs, and means a failed attribution write costs a missing row and nothing else.

Alternative: fold it into the anon-client upsert at `/auth/complete`. Rejected: it puts a
brand-new table on the critical path of account creation.

**D11. The admin answer is two additions to the existing `/admin/users` page, not a new
page. DEFAULT: a "Came from" column plus a source filter.**

`/admin/users` already lists every profile with tier, created date, and archive state
(`src/app/admin/users/page.tsx:9-17`). "Where did this member come from" belongs on the row
that already answers "who is this member".

Alternative: a new `/admin/acquisition` dashboard. Rejected for this session; PostHog is
the analysis surface and the admin table is the durable lookup. Logged in section 14.

**D12. `/privacy` gets one added sentence. DEFAULT: extend section 2, "Usage and diagnostic
data".**

The page exists at `src/app/privacy/page.tsx` and its section 2 already discloses page
views, feature events, approximate location, and device type
(`src/app/privacy/page.tsx:73-76`). Referral codes and campaign tags are the same kind of
first-party usage data, but they are not covered by the words currently on the page, and
"we said page views" is a thin defence for "we stored the campaign you arrived from". One
sentence closes it. Exact copy is in section 6, T10.

Alternative: no copy change, on the theory it is already covered. Rejected: it is a
one-line edit and this is first-party data about how someone found us, which is precisely
the kind of thing a privacy page should name.

---

## 1. Why this, why now

Linestry is the Season 12 presenting sponsor of FNRad, and the first listeners are arriving.
Right now the app cannot tell you a single thing about where any of them came from. There
is no UTM parsing anywhere in the codebase and nothing reads `document.referrer` (F1, F2).
Two signups in June came from somewhere, and nobody can say where.

That gap is not academic. The whole point of a podcast sponsorship is that you find out
whether it works, and then do more of the thing that worked. Without attribution the
sponsorship is unmeasurable, every future channel decision is a guess, and the funnel data
that already exists (`ftue_landed` to `ftue_completed`) cannot be cut by where people came
from, which is the cut that actually changes what Jay does next.

There is a second, quieter reason to do it now rather than later. PostHog is configured with
`person_profiles: "identified_only"` (`src/instrumentation-client.ts:31`), which means
anonymous visitors get no person profile at all, and PostHog's own `$initial_utm_*` and
`$initial_referrer` person properties only start being retained from the moment someone
identifies. For a product where signup happens at the END of a seven-step wizard, that is
the wrong moment: the arrival is long gone by then. First-touch has to be captured by us,
on arrival, and carried forward. Nothing recovers a first touch retroactively.

The last reason is timing. Attribution only describes traffic that arrives after it ships.
Every week it does not exist is a week of FNRad audience that can never be attributed.

---

## 2. Prerequisites

1. `git pull` on `main`. This brief was checked against `39f169d`. The working tree on
   Jay's laptop currently shows unrelated modifications and a pile of untracked
   `bugs/.write*` scratch files; branch off clean and do not sweep them into this PR.
2. `.env.local` present with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `NEXT_PUBLIC_POSTHOG_KEY`. Without the PostHog key the client init is skipped
   (`src/instrumentation-client.ts:22`) and `trackEvent` still POSTs to `/api/track/event`,
   so the `analytics_events` half of every acceptance criterion is still testable locally.
3. **Dev-server source (playbook check 20).** Run `npm run dev` from the repo you are
   editing, and stop any dev server already holding port 3000 first. A previous session
   lost ten minutes to a stale server serving a different checkout.
4. Supabase MCP access for the section 9 migration, or the Supabase dashboard as fallback.

---

## 3. Scope

**In scope**

- A shared attribution module, `src/lib/attribution.ts`: the touch shape, a parser, the
  localStorage read/write/clear helpers, the 90-day expiry, and the PII-free props builder.
- First-touch and last-touch capture on the first client load, wired into
  `src/instrumentation-client.ts`.
- Two additive tables: `ref_codes` (the spoken-code map) and `acquisition` (one durable row
  per member).
- `/r/[code]`, a route handler that resolves a code, 302s to its destination with the
  campaign parameters appended, and records a `ref_code_hit` event.
- Attribution props stamped onto four existing funnel events: `ftue_landed`,
  `signup_started`, `signup_succeeded`, `ftue_completed`.
- Cross-device carry: attribution rides the existing `pending_onboarding` user metadata so a
  magic link opened on a phone still attributes to the laptop that saw the ad.
- `POST /api/attribution/attach`, the fire-and-forget durable write, called from
  `/auth/complete` after signup.
- A "Came from" column and a source filter on `/admin/users`.
- One added sentence in the `/privacy` copy.
- Types in `src/types/index.ts` for the new rows and the touch shape.

**Out of scope. Do not build these.**

- Any change to `profiles`. No column, no migration, no touching the upsert at
  `/auth/complete:74` beyond adding the call in T8 after it.
- An admin CRUD screen for ref codes (D7).
- A new `/admin/acquisition` dashboard or any charting (D11).
- A new `analytics_events` category (D9).
- Multi-touch or fractional attribution. First and last only.
- Server-side bot filtering, IP geolocation, or any fingerprinting. PostHog already infers
  coarse location and that is enough.
- UTM tagging of outbound transactional email from Resend. Related, separate, section 14.
- A cookie consent banner. Nothing here is a third-party pixel, and the banner question is
  its own brief (the Facebook Login brief already ruled it out of that session too).
- Custom subdomains or QR codes for campaigns.
- Backfilling attribution for existing members. It does not exist and cannot be invented.
  Existing members get a null row and that is the honest answer.

---

## 4. Out of scope (hard list)

The three most likely places this session drifts, called out so they do not:

1. **Adding the attribution fields to `profiles` "because it is simpler".** It is not
   simpler, it is a PGRST204 on every signup in the merge-to-migrate window. See D1.
2. **Building the ref-code admin screen.** It is the most comfortable part of the work and
   the least valuable. See D7.
3. **Refactoring `trackEvent` to auto-stamp attribution on every event.** Tempting, and it
   would look clean. It also silently widens the props of about forty existing events,
   changes the shape of historical PostHog data, and makes the four events that matter
   indistinguishable from the noise. Stamp the four call sites explicitly.

---

## 5. Verified facts (checked against `main` at `39f169d`, September 4 2026)

Provenance given so the session does not re-derive these. Anything the drafting pass could
not verify is tagged AUDIT.

**F1. There is no UTM parsing anywhere in the codebase.** `grep -rn "utm_" src/ supabase/`
returns zero matches. Nothing reads, stores, forwards, or strips a UTM parameter today.

**F2. Nothing reads `document.referrer`.** `grep -rn "document\.referrer" src/` returns
zero matches. Every `referrer` hit in `src/` is a `rel="noopener noreferrer"` on an anchor
(about thirty of them, e.g. `src/components/feed/story-card.tsx:422`). This confirms the
premise of the whole brief rather than assuming it (playbook check 22).

**F3. `analytics_events` has exactly six meaningful columns plus its id**: `id`,
`created_at`, `category`, `event`, `actor_id`, `severity`, `props jsonb`
(`supabase/migrations/20260602000001_diagnostics_phase1_analytics_events.sql:29-38`).
`category` is CHECK-constrained to `auth | ftue | content | invite | redirect | moderation |
error` (same file, lines 32-34), and the migration's own header comment states that adding
a category needs a migration. `actor_id` is deliberately NOT a foreign key so fire-and-forget
inserts can never fail. `props` is documented as structural only, no PII.

**F4. The client capture helper is `trackEvent(category, event, props, { actorId })`**
(`src/lib/analytics.ts:23-48`). It POSTs `{ category, event, props, actor_id, distinct_id,
occurred_at }` to `/api/track/event` with `keepalive: true` and swallows every error. The
sink is `captureServerEvent` (`src/lib/analytics-server.ts:63-98`), which captures to
PostHog and inserts one `analytics_events` row. Note for T5: the row insert at
`src/lib/analytics-server.ts:89-94` writes `category`, `event`, `actor_id`, and `props`
only, so anything added to props lands in the DB row automatically with no route change.

**F5. `/api/track/event` accepts arbitrary props and always returns 204**
(`src/app/api/track/event/route.ts:9-25`). It validates only that `category` and `event`
are strings. No change is needed to send richer props.

**F6. PostHog is initialised in `src/instrumentation-client.ts:21-33` with
`person_profiles: "identified_only"`** (line 31), `capture_pageview: true`,
`capture_pageleave: true`, and `session_recording: { maskAllInputs: true }`. The comment at
lines 14-20 explains that this file was chosen over a provider effect specifically because
it runs before hydration and before component effects, which is the same reason attribution
capture belongs here (D3).

**F7. The only two attribution-ish props in the product today** are
`ftue_landed { source: "intro" }` (`src/components/onboarding/onboarding-flow.tsx:180-182`,
where `fromIntro` is read from `?from=intro`, set by the `/intro` redirect at
`src/app/intro/page.tsx:13`) and `claim_node_requested { source }` in
`src/app/api/public/claim-node/route.ts:50` and `:182`, where source is one of
`public_timeline` or `person_page`. Neither survives past its own event.

**F8. The Zustand store persists under `lineage-store-v2`**
(`src/store/lineage-store.ts:1151`) and its `partialize` (lines 1154-1157) strips exactly
`dbClaims`, `catalog`, `catalogLoaded`, `showMemberCard`, `authReady`, `communities`,
`catalogError`, `toasts`, `tokenEarnTick`, `celebrationQueue`, `showWelcomeCelebration`,
`pendingTagCount`. Everything else IS persisted, so a store slice would survive. D2 keeps
attribution out anyway, for hydration-order reasons rather than persistence ones.

**F9. `profiles` carries the membership, Stripe, token, public-timeline, tag-privacy,
curated-profile, and archival columns. There is no `memberships` table.** Confirmed in the
repo `CLAUDE.md` "Key tables" section, which names the columns explicitly and states the
rule.

**F10. The task brief's premise about `catalog-loader.tsx` is wrong, and it matters.**
`src/components/catalog-loader.tsx` does NOT run a `select(...)` against `profiles` at all.
It fetches `/api/me` (line 25) precisely because a direct browser-client read of `profiles`
can return null under RLS (comment at lines 22-24). **The single explicit profiles column
list in the app is `src/app/api/me/route.ts:47-55.`** A second, shorter one exists at
`src/app/api/admin/users/route.ts:17`. Since this brief adds no `profiles` column, neither
list changes.

**F11. `src/proxy.ts` is the Next 16 proxy and its matcher is broad.**
`config.matcher` at lines 216-220 is
`"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"`,
so `/r/*` WILL pass through the proxy. It survives cleanly: `r` is not in
`COMMUNITY_ROUTES` (lines 24-28), does not match the `/riders` or `/people` patterns
(lines 72-121), and is not in the protected set (lines 203-205), so layers 1 and 2 pass and
layer 3 refreshes the session and continues. The only cost is one `auth.getUser()` on the
redirect hop.

**F12. Signup fires from three call sites in `src/components/onboarding/save-step.tsx`**:
`signup_started { method: "google" }` at line 85, `{ method: "facebook" }` at line 105, and
`{ method: "magic_link" }` at line 131. `buildOnboardingPayload()` at lines 16-25 returns
`{ display_name, birth_year, start_year, first_place_id, first_board_id, sessionClaims }`
and is sent to `/api/auth/magic-link` at lines 132-137, and also inline as
`data: { pending_onboarding: onboardingPayload }` in the OTP fallback at line 161. The
OAuth paths do not build it, which is correct: OAuth completes in the same browser.

**F13. The magic-link route stashes that payload on the auth user.**
`src/app/api/auth/magic-link/route.ts:150-155` calls
`admin.updateUserById(stashUserId, { user_metadata: { pending_onboarding: onboarding } })`
after `admin.generateLink` (line 128). This is the cross-device carrier, and it is why
attribution must be added to the payload object rather than invented as a new field.

**F14. `/auth/complete` is where the profile is created and the funnel closes.**
`identifyUser(user.id)` at line 36; `pending` read from `user.user_metadata.pending_onboarding`
at line 51; existence check then upsert at lines 66-85 with
`trackEvent("auth", "signup_succeeded", {}, { actorId: user.id })` at line 86 fired only
for genuinely new profiles; the stash cleared at line 106; `ftue_completed` at line 208,
gated the same way so returning users do not inflate the funnel's final step. The upsert
runs on the browser anon client, which is the fact behind D1.

**F15. `ensureProfile` guarantees a `profiles` row exists for any authenticated caller.**
`src/lib/auth.ts:22-33` upserts a placeholder row with `ignoreDuplicates`, called from the
auth helpers. This means a foreign key from `acquisition.profile_id` to `profiles(id)` is
always satisfiable by the time `POST /api/attribution/attach` runs behind `requireAuth()`.

**F16. `profiles.id` is `uuid`; `events.id` is `text`.** Profiles FK pattern:
`supabase/migrations/20260323000001_stories.sql:5` (`author_id uuid not null references
profiles(id) on delete cascade`). Events FK pattern: same file line 10
(`linked_event_id text references events(id) on delete set null`), and
`supabase/migrations/20260629000002_fnrad_featured_timelines_phase1.sql:87` notes explicitly
that `show_org_id` is text "NOT uuid" because `orgs.id` and `events.id` are text columns.
The section 9 SQL uses these types. Getting this backwards is what produced the
SQLSTATE 42804 failure in the PB-008 merge function.

**F17. Podcast episodes are `events` rows.** `event_type='episode'` (TypeScript-only value;
the column is text), with `show_org_id`, `media_url`, and `episode_number` added in
`supabase/migrations/20260629000002_fnrad_featured_timelines_phase1.sql:87-89`, and
`public_slug` plus `public_enabled` added at lines 123-125 with a partial unique index at
lines 135-137. A published episode is reachable at `/t/{public_slug}`
(`src/app/t/[slug]/page.tsx:22-24` resolves profile, then episode, then show). This is what
a ref code maps to.

**F18. `next.config.ts:26` sets `Referrer-Policy: strict-origin-when-cross-origin`** for
all routes. Cross-origin referrers therefore already arrive as a bare origin with no path.
`next.config.ts:11-18` has two unrelated redirects (`/revenue`), so there is no conflict
with a new `/r` route, and `src/app/robots.ts:8` allows everything, which is fine: a 302
hop is not indexable content.

**F19. `safeReturnTo()` at `src/lib/safe-redirect.ts:17-24` is the existing open-redirect
guard.** It rejects anything not starting with a single `/`, plus protocol-relative,
backslash, and control-character smuggling. The `/r/[code]` handler reuses it on
`destination_path` so a bad table row cannot turn a Linestry URL into an off-site bounce.

**F20. `/admin/users` already renders a profiles table.** `UserRow` at
`src/app/admin/users/page.tsx:9-17` is `{ id, display_name, email, membership_tier,
created_at, is_archived, archived_at }`, fed by `GET /api/admin/users`
(`src/app/api/admin/users/route.ts:15-27`), which is `requireEditor`-gated, selects an
explicit column list from `profiles`, and joins emails from `auth.users` in JavaScript. The
same JavaScript-join pattern is what T9 uses for the acquisition rows.

**F21. `/privacy` exists and its section 2 is where the copy change goes.**
`src/app/privacy/page.tsx:52-81` is `LegalSection id="what-we-collect"`, and the "Usage and
diagnostic data" paragraph is lines 73-76. The page uses a `LegalSection` shell imported at
line 3 and escapes all copy inside template literals. `LEGAL_EFFECTIVE` is a shared
constant in `src/components/legal/legal-shell.tsx`.

**F22. Forward-warning grep (playbook check 6) is clean for this surface area.**
`grep -rn "Phase [0-9]\|TODO.*Phase\|FIXME"` across `src/lib/analytics*.ts`,
`src/instrumentation-client.ts`, `src/app/auth/complete/page.tsx`,
`src/components/onboarding/save-step.tsx`, `src/app/api/track/`, and the admin users files
returns only descriptive "Diagnostics Phase 1" provenance comments and one PB-010 Phase 4b
section header at `src/app/auth/complete/page.tsx:172`. No prior phase left a time-capsule
warning about attribution or about these props.

**F23. AUDIT, not verified.** The following were not checkable from the repo on disk and
this brief was drafted with no live database session. None of them blocks the build; each
is a five-minute check with a Supabase session open.
- No `ref_codes` or `acquisition` table exists in prod. `grep -rn "acquisition\|ref_code"
  src/ supabase/` returns zero matches, so nothing in this repo creates or reads them, but
  the live schema was not listed (playbook checks 3 and 9).
- Orphan `auth.users` rows without a `profiles` row (playbook check 13). Mitigated by
  design regardless: `requireAuth()` calls `ensureProfile` (F15), and the attach route is
  fire-and-forget, so an orphan produces a missing row rather than an error.
- Catalog quality of `events` rows for the ref-code mapping (playbook check 14). Only
  matters if a code is pointed at an episode with no `public_slug`; T4 handles that by
  falling back to `destination_path`.

---

## 6. Task specs

### T1. `src/lib/attribution.ts`, the shared module

New file, client-safe, no server imports. This is the only place the storage shape is
defined. Everything else imports from here.

Exports:

- `ATTRIBUTION_STORAGE_KEY = "linestry_attribution_v1"`
- `ATTRIBUTION_TTL_DAYS = 90`
- `interface Touch { source, medium, campaign, content, term, ref, referrer, landing_path, at }`
  where every field except `at` is `string | null` and `at` is an ISO 8601 string.
- `interface StoredAttribution { first: Touch; last: Touch }`
- `parseTouch(search: string, referrer: string, pathname: string): Touch | null`
- `captureTouch(): void`
- `readAttribution(): StoredAttribution | null`
- `clearAttribution(): void`
- `attributionProps(): Record<string, string>`

Behaviour, in detail because the edge cases are the whole value:

**`parseTouch`** reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
`utm_term`, and `ref` from the query string, and takes `document.referrer` and the current
pathname. It returns `null` when the visit carries no acquisition signal at all: no UTM
parameters, no `ref`, and either an empty referrer or a same-origin one. Returning null is
what stops an internal click from overwriting last-touch with nothing.

Every value is sanitised before storage: lowercased, trimmed, non-matching characters
stripped down to `[a-z0-9_.\-]`, and truncated to 64 characters. This is a marketing tag,
not free text, and it ends up in a jsonb props blob and an admin table, so it gets a tight
allowlist. `landing_path` keeps `pathname` only, never the query string, so a stray
parameter someone appended cannot smuggle content into the record. `referrer` is stored as
given, which per F18 is already origin-only for cross-origin visits.

**`captureTouch`** is the whole storage lifecycle in one function, and it must be correct
about which parts are immutable:
- Wrap every `localStorage` access in `try`/`catch` and no-op on throw. Private windows,
  blocked site data, and embedded webviews all throw here, and the repo already handles
  `sessionStorage` this way (`src/components/onboarding/onboarding-flow.tsx:130-155`).
- `parseTouch` the current location. If it returns null, stop.
- Read the existing record. If it exists but `first.at` is older than
  `ATTRIBUTION_TTL_DAYS`, discard the whole record and treat this visit as a new first
  touch.
- If there is no record, write `{ first: touch, last: touch }`.
- If there is a record, write `{ first: existing.first, last: touch }`. **`first` is never
  overwritten.** This is the single most important line in the feature.

**`attributionProps`** returns a flat, prefixed, PII-free object built from `first`, with
`null` fields omitted entirely rather than sent as null:
`attr_source`, `attr_medium`, `attr_campaign`, `attr_content`, `attr_term`, `attr_ref`,
`attr_referrer_host`, `attr_landing_path`, plus `attr_first_seen_at`. Note `attr_referrer_host`:
derive the host from the stored referrer with `new URL(...).host` inside a try/catch, and
drop the field if it fails (D8). Returns `{}` when there is nothing stored, so every call
site can spread it unconditionally.

Playbook check 18 (helper-output audit): this helper's output is spread directly into
`trackEvent` props, so its shape IS the PostHog property namespace. Sample-print it once
during the build and confirm every key is prefixed `attr_` and every value is a short
sanitised string. A stray nested object or a null here becomes a permanently awkward
PostHog property.

### T2. Wire capture into `src/instrumentation-client.ts`

Append, after the existing PostHog init block that ends at line 33:

```ts
// First-touch acquisition capture. Runs here, before hydration and before any
// component effect, for the same reason the PostHog init moved here: ftue_landed
// fires from the onboarding mount effect and must be able to read a touch that is
// already stored. Fully guarded: localStorage can throw in a private window.
import { captureTouch } from "@/lib/attribution"
captureTouch()
```

Put the import at the top with the others. `captureTouch` swallows its own errors, but wrap
the call in `try`/`catch` anyway: nothing in this file may ever throw, because a throw here
breaks client instrumentation for the whole app.

One honest limitation to document in the comment: this module runs on a full page load, not
on a client-side soft navigation. First-touch is by definition a full load, so it is
unaffected. Last-touch will miss the rare case of a UTM-bearing URL reached by an in-app
soft nav, which does not happen in practice because campaign links are external.

### T3. Types in `src/types/index.ts`

Add next to the existing `AnalyticsEvent` interface (around line 824):

```ts
export interface RefCode {
  code: string
  label: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  event_id: string | null        // events.id is TEXT (F16)
  destination_path: string | null
  active: boolean
  created_at: string
}

export interface Acquisition {
  profile_id: string
  first_source: string | null
  first_medium: string | null
  first_campaign: string | null
  first_content: string | null
  first_term: string | null
  first_ref: string | null
  first_referrer: string | null
  first_landing_path: string | null
  first_seen_at: string | null
  last_source: string | null
  last_medium: string | null
  last_campaign: string | null
  last_ref: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}
```

### T4. `src/app/r/[code]/route.ts`, the spoken-code route

A route handler exporting `GET`, not a page. Pseudocode below is verified against the real
schema in section 9 and against `safeReturnTo`, but the Supabase call shape should be
eyeballed against a neighbouring route before running.

Behaviour:

1. Read `code` from params. Normalise: lowercase, trim, strip anything outside
   `[a-z0-9-]`, cap at 40 characters. A code that normalises to empty goes straight to the
   fallback in step 5.
2. Look the code up in `ref_codes` with the service client, `active = true`.
3. **Known code.** Build the destination:
   - Start from `destination_path` when set, else `/t/{public_slug}` when `event_id` is set
     AND that event has `public_slug` and `public_enabled = true` (F17), else `/onboarding`.
   - Run the result through `safeReturnTo()` (F19). If it returns null, fall back to
     `/onboarding`. A malformed row must never produce an off-site redirect.
   - Append the campaign parameters from the row as query parameters, plus
     `ref=<normalised code>`. Preserve any query parameters already on the incoming request
     so `/r/fnrad-s12e04?foo=1` does not lose `foo`, with the row's values winning on
     conflict.
4. Fire the event, fire-and-forget, before returning:
   `captureServerEvent({ category: "redirect", event: "ref_code_hit", props: { code,
   utm_source, utm_campaign, event_id, matched: true } })`. Category `redirect` is already
   valid (D9, F3), and this route is server-side so it calls `captureServerEvent` directly
   rather than going through `/api/track/event`.
5. **Unknown or inactive code.** Redirect to `/onboarding?ref=<normalised code>` and fire
   the same event with `matched: false`. Do NOT 404. Someone typed a URL they heard out
   loud; landing them in onboarding with the code preserved is both kinder and more
   informative than a dead end, and the `matched: false` count tells Jay when a code is
   being misheard.
6. Return `NextResponse.redirect(url, 302)` (D6).

Add `export const dynamic = "force-dynamic"` so the handler is never statically cached.

**Minting a code (D7).** The template Jay runs in the Supabase SQL editor per episode:

```sql
insert into public.ref_codes
  (code, label, utm_source, utm_medium, utm_campaign, utm_content, event_id, destination_path)
values
  ('fnrad-s12e04', 'FNRad Season 12 Episode 4', 'fnrad', 'podcast', 's12', 'e04', null, '/onboarding');
```

Set `event_id` to the episode's `events.id` when the code should land on that episode's
published page instead of onboarding, and leave `destination_path` null in that case.

### T5. Stamp the four funnel events

Four edits, each one line of spread. Do them explicitly, do not centralise (section 4,
item 3).

- `src/components/onboarding/onboarding-flow.tsx:182`. Currently
  `trackEvent("ftue", "ftue_landed", fromIntro ? { source: "intro" } : {})`. Becomes
  `trackEvent("ftue", "ftue_landed", { ...(fromIntro ? { source: "intro" } : {}), ...attributionProps() })`.
  The existing `source: "intro"` prop stays exactly as it is: it is a different axis
  (which internal entry point) from `attr_source` (which external channel), and an existing
  PostHog funnel reads it (F7).
- `src/components/onboarding/save-step.tsx:85`, `:105`, `:131`. Each `signup_started` call
  gains `...attributionProps()` alongside its existing `method`. Leave the three
  `signup_failed` calls alone: a failure is a different question and its props are already
  doing a job.
- `src/app/auth/complete/page.tsx:86`, `signup_succeeded`. Spread the resolved props (see
  T8 for why they are resolved rather than read directly).
- `src/app/auth/complete/page.tsx:208`, `ftue_completed`. Same resolved props.

Because `captureServerEvent` writes `props` straight into the `analytics_events` row
(F4), all of this lands in the durable log automatically with no route change.

### T6. Carry attribution across devices

`src/components/onboarding/save-step.tsx`, `buildOnboardingPayload()` at lines 16-25. Add
one field:

```ts
attribution: readAttribution(),
```

That is the entire cross-device mechanism. The payload already travels two ways (F12, F13):
POSTed to `/api/auth/magic-link`, which stashes it on the auth user via
`admin.updateUserById` (`src/app/api/auth/magic-link/route.ts:150-155`), and inlined as
`data: { pending_onboarding: onboardingPayload }` on the OTP fallback path
(`save-step.tsx:161`). Both carriers pick the new field up with no further change, which is
the point of putting it there rather than inventing a parallel channel.

`/api/auth/magic-link` types the field as `onboarding?: Record<string, unknown>` (line 71),
so no type change is needed there either. Verify that before assuming it.

### T7. `POST /api/attribution/attach`

New route, `src/app/api/attribution/attach/route.ts`.

- `requireAuth()` from `src/lib/auth.ts`. Return its 401 response if present. This also
  guarantees the `profiles` row exists (F15), which the foreign key needs.
- Body: `{ first: Touch, last: Touch }`. Validate defensively. Every field is optional and
  every value gets the same sanitiser T1 uses (re-sanitise server-side; the client is not
  trusted).
- Write with an upsert whose conflict clause updates the last-touch fields only:

```ts
await db.from("acquisition").upsert(
  { profile_id: user.id, first_source: ..., /* all first_* + last_* */ },
  { onConflict: "profile_id" }
)
```

Careful here: a plain Supabase `upsert` replaces the row on conflict, which would overwrite
first-touch. Use the SQL-level `on conflict do update set last_* = excluded.last_*` semantic
instead. The simplest correct implementation is a two-step: try an `insert`, and on a `23505`
unique violation fall back to an `update` that sets only the `last_*` columns and
`updated_at`. That keeps first-touch immutable at the DATABASE level, not only in the client
helper, which matters because the client helper is the thing most likely to be bypassed by a
future change.

- Always return `{ ok: true }` with status 200, even on a write failure, and log the error
  server-side. This route must never be able to affect what the caller does next (D10).

### T8. Call the attach route from `/auth/complete`

In `src/app/auth/complete/page.tsx`, inside `saveAndRedirect`:

1. Resolve the attribution once, near where `pending` is resolved at line 51, using the
   same precedence the file already uses for `display_name` and `sessionClaims` (lines
   61-65): **local storage wins, the stashed payload repairs the cross-context case.**

```ts
const effAttribution = readAttribution() ?? (pending?.attribution ?? null)
```

2. After the profile upsert block (lines 74-86), and only when a new profile was created
   (the same `if (!existingProfile)` branch that gates `signup_succeeded`), fire-and-forget
   the attach:

```ts
void fetch("/api/attribution/attach", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(effAttribution),
  keepalive: true,
}).catch(() => {})
```

Gating on new-profile-only matters: attaching on every sign-in would let a member's
last-touch be rewritten by their own return visits from an unrelated link, and would keep
re-attaching rows for members who signed up before this shipped.

3. Stamp `signup_succeeded` (line 86) and `ftue_completed` (line 208) with props built from
   `effAttribution` rather than from `attributionProps()` directly, so a cross-device magic
   link still attributes. Extract a tiny local helper for this rather than duplicating the
   mapping twice.
4. After the attach fetch is dispatched, call `clearAttribution()` (D4). The first touch
   has now been consumed by the signup it produced and must not be inherited by the next
   person who signs up on this device.

**Lifecycle inventory (playbook check 8), stated in full because this is a state feature:**

| State | When |
|---|---|
| SET | First page load carrying a UTM parameter, a `ref`, or a cross-origin referrer. |
| UPDATED | Any later such load updates `last` only. `first` is immutable in the helper AND in the DB (T7). |
| EXPIRED | The whole record is discarded when `first.at` is more than 90 days old, and that visit becomes a new first touch. |
| CONSUMED and CLEARED | On a successful new-profile signup, after the attach is dispatched. |
| NEVER SET | Direct navigation, same-origin referrer, blocked or unavailable localStorage. `attributionProps()` returns `{}` and every call site degrades to today's behaviour. |
| ORPHANED | An `acquisition` row for a deleted profile. Prevented by `on delete cascade` (section 9). |
| NOT BACKFILLED | Members who signed up before this ships have no row. The admin column reads "Unknown", not a guess. |

### T9. Surface it in `/admin/users`

- `src/app/api/admin/users/route.ts`: after the existing profiles select (line 15-19) and
  the `auth.users` email join (line 22-25), add a third read of `acquisition` for the same
  ids, and map it in the same JavaScript-join style already used at line 27. Do not convert
  this to a PostgREST embedded select; the file's existing pattern is separate reads joined
  in JS, and matching it is cheaper than debugging an embed.
- `src/app/admin/users/page.tsx`: extend `UserRow` (lines 9-17) with
  `first_source`, `first_campaign`, `first_ref`. Add one "Came from" column rendering
  `first_source` with `first_campaign` beneath it in muted small text, or "Unknown" when the
  row is absent. Add a source filter next to the existing search box: a select populated
  from the distinct sources present in the loaded rows, plus "All" and "Unknown".

That is the complete answer to "where did this member come from" for this session (D11).

### T10. One sentence in `/privacy`

`src/app/privacy/page.tsx`, section 2, the "Usage and diagnostic data" paragraph at lines
73-76. Append to that paragraph's template literal, inside the existing string, keeping the
file's escaping style:

> ` If you arrive through a campaign link or a referral code (for example a code read out on a podcast), we record that code and the standard campaign tags on the link, along with the site that referred you, so we can tell which of our own efforts brought people here. This is first-party measurement only: we do not run advertising pixels and we do not share it with advertisers.`

Do not bump `LEGAL_EFFECTIVE` in `src/components/legal/legal-shell.tsx` unless Jay asks.
This is an addition that narrows nothing and removes no right, and bumping the date on
every clarification devalues the signal when a material change does land. Flag the decision
to Jay in the PR description rather than making it silently.

---

## 7. Surface pairing (playbook check 12)

| Endpoint or module | UI trigger | Affordance |
|---|---|---|
| `GET /r/[code]` | A URL read aloud on a FNRad episode, typed into a browser bar | Instant 302 to `/onboarding` (or the episode page), campaign tags appended, no visible interstitial |
| `src/lib/attribution.ts` `captureTouch()` | Every full page load, via `src/instrumentation-client.ts` | Invisible. Writes localStorage only |
| `attributionProps()` on `ftue_landed` | Landing on `/onboarding` | Invisible. PostHog + `analytics_events` row |
| `attributionProps()` on `signup_started` | Tapping Continue with Google / Facebook, or sending a magic link, on the FTUE save step | Invisible |
| `pending_onboarding.attribution` | Sending a magic link from the save step | Invisible. The carrier for a link opened on another device |
| `POST /api/attribution/attach` | Completing signup at `/auth/complete` | Invisible, fire-and-forget. Failure has no user-visible effect |
| `signup_succeeded` / `ftue_completed` props | End of the signup round trip | Invisible |
| `acquisition` row | `/admin/users`, "Came from" column and source filter | Text column plus a select filter |
| `ref_codes` row | Supabase SQL editor, template in T4 | SQL insert, no UI this session |
| Privacy disclosure | `/privacy`, section 2 | One sentence of body copy |

---

## 8. Acceptance criteria

Each is checkable by running something, not by reading the diff.

**A1.** `npx tsc --noEmit` is clean.

**A2.** Loading `http://localhost:3000/onboarding?utm_source=fnrad&utm_medium=podcast&utm_campaign=s12&utm_content=e04`
in a fresh private window writes `linestry_attribution_v1` to localStorage with `first` and
`last` both populated and equal, and `first.at` set to now.

**A3.** Navigating from there to `/onboarding?utm_source=instagram` in the same window
leaves `first.source` as `fnrad` and changes `last.source` to `instagram`. This is the
immutability check and it is the single most important criterion in the list.

**A4.** An internal click (any same-origin navigation with no UTM and no `ref`) leaves the
stored record completely unchanged, `last` included.

**A5.** Hand-editing `first.at` in localStorage to 91 days ago and reloading a UTM-bearing
URL replaces the whole record with a new first touch.

**A6.** In a private window with site data blocked, or with localStorage stubbed to throw,
`/onboarding` renders normally, `ftue_landed` still fires, and nothing appears in the
console.

**A7.** After A2, the `ftue_landed` row in `analytics_events` (or the PostHog live event)
carries `attr_source: "fnrad"`, `attr_medium: "podcast"`, `attr_campaign: "s12"`,
`attr_content: "e04"`, and `attr_landing_path: "/onboarding"`. No key is null-valued and no
key holds an object.

**A8.** With the T4 template row inserted, `curl -i http://localhost:3000/r/fnrad-s12e04`
returns `302` with a `Location` of
`/onboarding?utm_source=fnrad&utm_medium=podcast&utm_campaign=s12&utm_content=e04&ref=fnrad-s12e04`
(parameter order does not matter). `/r/FNRAD-S12E04` and `/r/fnrad-s12e04/` behave
identically.

**A9.** `curl -i http://localhost:3000/r/not-a-real-code` returns `302` to
`/onboarding?ref=not-a-real-code`, and an `analytics_events` row exists with
`category='redirect'`, `event='ref_code_hit'`, and `props.matched = false`.

**A10.** A `ref_codes` row whose `destination_path` is set to `https://example.com` or
`//example.com` redirects to `/onboarding`, not off site. This is the open-redirect guard
and it must be tested with a deliberately bad row.

**A11.** Full same-device signup through `/r/fnrad-s12e04` with Google: after landing on the
timeline, the `acquisition` table has exactly one row for the new user with
`first_source='fnrad'`, `first_ref='fnrad-s12e04'`, `first_seen_at` set, and
`localStorage.linestry_attribution_v1` is now gone.

**A12.** Cross-device magic link: start at `/r/fnrad-s12e04` on the desktop, request the
magic link, open it on a phone or in a different browser profile. The new member's
`acquisition` row still shows `first_source='fnrad'`. This is the criterion the whole
`pending_onboarding` mechanism exists for, and it is the one most likely to be skipped
because it needs two devices. Do not skip it.

**A13.** Signing in again later from a plain `linestry.com` visit does NOT create a second
`acquisition` row, does not change any `first_*` value, and does not re-fire
`signup_succeeded`.

**A14.** `/admin/users` shows a "Came from" column. A member created in A11 reads `fnrad`
with `s12` beneath it; a member created before this shipped reads "Unknown". The source
filter narrows the table correctly, including the "Unknown" option.

**A15.** `/privacy` renders the new sentence in section 2, in a logged-out private window,
in both light and dark themes, with no layout break at 375px width.

**A16.** With `NEXT_PUBLIC_POSTHOG_KEY` unset, every one of the above still behaves, minus
the PostHog half. Nothing throws, nothing blocks, no console error.

---

## 9. Migration

**Yes, there is a migration. Two additive CREATE TABLE statements, plus indexes and a
comment. It is SAFE under the repo risk gate: purely additive, new tables only, no ALTER on
any existing table, and specifically no SQL touching `profiles`, so the "any SQL touching
profiles is GATED" clause does not fire. Apply it yourself via the Supabase MCP.**

**Is it a HARD PRE-MERGE GATE? No, and the design is why.** Gate 23 fires when a write path
sends a new column unconditionally, so a missing column 500s the path. Here, both new tables
are written only by `POST /api/attribution/attach` and read only by `/r/[code]` and
`/api/admin/users`, all of them behind try/catch or returning `{ ok: true }` regardless
(T7). If the PR merged before the migration, the outcome is that attribution silently
records nothing until the tables exist. That is a soft gate.

It is worth stating plainly what would have happened under the rejected design: had
attribution been added as columns on `profiles` (D1, Alternative A), the anon-client upsert
at `src/app/auth/complete/page.tsx:74` would send them unconditionally, and every signup in
the merge-to-migrate window would fail with PGRST204. That would have been a hard gate on
the most important write path in the product. Avoiding it is the main reason D1 is what it
is.

**Order regardless: migrate first, then merge.** There is no reason to accept even a soft
gap, and the ship sequence puts migration before merge anyway.

File: `supabase/migrations/20260904000001_funnel_attribution.sql`

```sql
-- ============================================================================
-- First-touch acquisition attribution
-- ============================================================================
--
-- Two additive tables. Nothing here alters an existing table, and nothing here
-- touches profiles.
--
--   ref_codes    short, human-typeable codes for spoken campaign callouts
--                (a podcast host reading linestry.com/r/fnrad-s12e04 on air).
--                Resolved at request time by src/app/r/[code]/route.ts.
--
--   acquisition  one durable row per member recording where they came from.
--                first_* is written once and never updated: the write path
--                inserts, and on a unique violation updates only the last_*
--                columns. Immutability is enforced by that access pattern, not
--                by a trigger, so a future caller that does a naive upsert can
--                still clobber it. If that becomes a real risk, add a BEFORE
--                UPDATE trigger that pins the first_* columns.
--
-- Both are written by POST /api/attribution/attach (service role, requireAuth)
-- and read by GET /api/admin/users. RLS is enabled with zero policies on
-- acquisition so the anon and authenticated keys cannot read or write it at
-- all, matching analytics_events. ref_codes gets a public read policy: the
-- redirect route reads it through the service client, but a public read is
-- harmless (a code is spoken on a podcast) and keeps a future client-side
-- lookup from being blocked.
--
-- Idempotent: safe to re-run.

-- ── ref_codes ───────────────────────────────────────────────────────────────
-- events.id is TEXT, not uuid (see supabase/migrations/20260323000001_stories.sql
-- line 10 and the FNRad Phase 1 migration). Getting this wrong throws 42804.
create table if not exists public.ref_codes (
  code              text primary key,
  label             text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  event_id          text references public.events(id) on delete set null,
  destination_path  text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists ref_codes_active_idx
  on public.ref_codes (active)
  where active;

alter table public.ref_codes enable row level security;

drop policy if exists "ref_codes_select_active" on public.ref_codes;
create policy "ref_codes_select_active" on public.ref_codes
  for select using (active);

comment on table public.ref_codes is
  'Short spoken campaign codes resolved by /r/[code]. destination_path is validated with safeReturnTo() before any redirect.';

-- ── acquisition ─────────────────────────────────────────────────────────────
-- profiles.id is uuid. One row per member; cascade so a deleted profile leaves
-- no orphan.
create table if not exists public.acquisition (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  first_source        text,
  first_medium        text,
  first_campaign      text,
  first_content       text,
  first_term          text,
  first_ref           text,
  first_referrer      text,
  first_landing_path  text,
  first_seen_at       timestamptz,
  last_source         text,
  last_medium         text,
  last_campaign       text,
  last_ref            text,
  last_seen_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Cohort queries: "everyone who came from fnrad", "everyone from the s12 campaign".
create index if not exists acquisition_first_source_idx
  on public.acquisition (first_source)
  where first_source is not null;

create index if not exists acquisition_first_campaign_idx
  on public.acquisition (first_campaign)
  where first_campaign is not null;

create index if not exists acquisition_first_ref_idx
  on public.acquisition (first_ref)
  where first_ref is not null;

alter table public.acquisition enable row level security;

comment on table public.acquisition is
  'First-touch and last-touch acquisition per member. first_* columns are write-once: the attach route inserts, then on conflict updates only last_*. Written by POST /api/attribution/attach.';
```

**Post-migration verification (run these, do not assume):**

```sql
-- 1. Both tables exist with the expected column counts.
select table_name, count(*) as columns
from information_schema.columns
where table_schema = 'public' and table_name in ('ref_codes', 'acquisition')
group by table_name;
-- expect ref_codes = 10, acquisition = 17

-- 2. The FK types actually resolved (this is the 42804 guard).
select tc.table_name, kcu.column_name, ccu.table_name as references_table
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name in ('ref_codes', 'acquisition');
-- expect ref_codes.event_id -> events, acquisition.profile_id -> profiles

-- 3. Seed the first real code so A8 is testable immediately.
insert into public.ref_codes
  (code, label, utm_source, utm_medium, utm_campaign, utm_content, event_id, destination_path)
values
  ('fnrad', 'FNRad Season 12, general', 'fnrad', 'podcast', 's12', null, null, '/onboarding')
on conflict (code) do nothing;
```

---

## 10. Risks and gotchas

**Safari caps script-written storage.** Safari's tracking prevention can clear
script-written localStorage after seven days without user interaction on the site. A visitor
who hears the episode, lands, browses, leaves, and signs up nine days later on Safari may
have lost their first touch. There is no clean client-side fix and this brief does not
attempt one; the `ref` code in the URL and the `attr_*` props on `ftue_landed` still capture
the arrival even when the signup later goes unattributed. Know it before you interpret a
gap between `ftue_landed` counts by source and `acquisition` rows by source.

**Attributed signups will be fewer than attributed landings, and that is correct.** The
FTUE is seven steps and signup is at the end. Do not treat the difference as a bug in this
feature.

**Do not let a naive upsert clobber first-touch.** Supabase's `.upsert()` REPLACES the row
on conflict. T7 spells out the insert-then-update-last-only pattern for exactly this reason.
If a later session "simplifies" it back to an upsert, first-touch quietly becomes last-touch
and nobody notices for months.

**The proxy runs on `/r/*`.** F11 confirms it passes cleanly, but it does mean the redirect
hop pays one `auth.getUser()`. Acceptable. Do not "optimise" this by editing the proxy
matcher: that file gates auth for `/me/*` and `/[community]/timeline`, and narrowing its
matcher is a security change wearing a performance costume.

**`localStorage` throws, it does not just return null.** Private windows, blocked site data,
and some embedded webviews raise on access. Every single read and write in
`src/lib/attribution.ts` needs its own try/catch. The repo already does this for
`sessionStorage` at `src/components/onboarding/onboarding-flow.tsx:130-155`; copy that
posture.

**Ad blockers block PostHog, not us.** `trackEvent` POSTs to the first-party
`/api/track/event`, so the `analytics_events` row lands even when the PostHog request is
blocked. The durable log is the more trustworthy of the two sources for absolute counts, and
this feature is partly insurance against exactly that.

**Jay's own traffic will pollute the data.** Every visit Jay makes from his own Instagram
post counts. Not solved here; be aware when reading the first week's numbers.

**Props are structural only.** `analytics_events.props` is documented as carrying no
bodies, notes, emails, or display names. `attributionProps()` must never grow a field that
could carry free text. The 64-character sanitised allowlist in T1 is the guard.

**Cross-device is the criterion that gets skipped.** A12 needs two devices or two browser
profiles and about five minutes. It is also the single hardest thing in this brief to get
right and the easiest to believe works. Run it.

---

## 11. Rollback

Single flip point. Everything the PR adds is additive: one new module, one new route
handler, one new API route, four one-line prop spreads, one payload field, two admin
columns, one sentence of copy. Reverting the PR restores exactly today's behaviour, because
every consumer of attribution already degrades to `{}` or `null` when nothing is stored.

The two tables can be left in place after a revert. They are inert with no writer: empty
tables that nothing reads. Dropping them is a GATED operation under the repo risk gate, so
do not drop them reflexively; leave them and tell Jay they are there.

If only the `/r/[code]` route is a problem (a bad code redirecting somewhere wrong), the
fastest fix needs no deploy at all: `update public.ref_codes set active = false where code =
'...'`, which immediately routes that code to the unknown-code fallback in T4 step 5.

---

## 11b. The episode-1 carve-out (read this if the FNRad episode is close)

> **Added September 4 2026, evening.** The FNRad deal is announced and episode 1 drops in one to two weeks. Episode 1 is the single highest-signal moment this campaign will ever have, and this brief in full is 5 to 7 hours sitting behind three other briefs. If the full brief cannot land before the episode, ship this carve instead. It is roughly 1.5 to 2 hours and it is forward-compatible: every task below is a strict subset of the full brief, so the full build later replaces nothing and discards no data.

**What the carve includes.**

1. **Capture only, on first page view.** The reader from T2, writing first-touch to the `localStorage` key from D2 with the 90-day lifecycle from D4. Capture `utm_source`, `utm_medium`, `utm_campaign`, `ref`, the referrer host, and the landing path. Nothing else changes on the client.
2. **Stamp two events, not four.** Spread the attribution props onto `signup_started` and `signup_succeeded` only. Skip `ftue_landed` and `ftue_completed` for now. Those two are enough to answer "did episode 1 produce signups, and from which link", which is the whole question.
3. **No migration, no new tables, no `/r/[code]` route.** The `acquisition` table, the `ref_codes` table, the spoken short route and the `/admin/users` column all wait for the full build. Attribution lives in PostHog event props only during the carve, which is lossy if PostHog is ever purged but costs nothing to ship.
4. **Static params carry the campaign.** The FNRad surfaces ship `?ref=fnrad` and `?ref=fnrad-s12eNN` as plain query params, which the capture step reads with no route work. This is already what `features/fnrad-listener-landing-brief.md` specifies, so the two fit together with no coordination.

**What the carve deliberately leaves out, and the cost.** Without the `acquisition` table, attribution is not durable and cannot be joined to a member later, so "which members came from episode 1" is answerable only for as long as PostHog retains the events. Without `/r/[code]`, nothing short can be read out on air, so episode 1 must use a plain URL. Both are recovered by the full build with no rework and no backfill loss, because the carve writes the same `localStorage` shape the full build reads.

**Do not ship the carve if the full brief is already scheduled ahead of the episode.** Two passes over the same files is worse than one.

---

## 12. Suggested order

The activating step goes last, as the playbook's carry-forward positives ask. Here the
activating step is T2: until `captureTouch()` is wired into the client instrumentation,
nothing is stored and every other piece is inert and safe to land.

1. **T3, types.** Small, and everything else compiles against them.
2. **Section 9 migration.** Apply it and run the three verification queries, including the
   seed insert, so `/r/fnrad` works the moment T4 exists.
3. **T1, `src/lib/attribution.ts`.** The whole storage contract in one file. Sample-print
   `attributionProps()` output before moving on (playbook check 18).
4. **T4, `/r/[code]`.** Independently testable with curl (A8, A9, A10) with no client state
   involved.
5. **T7, `POST /api/attribution/attach`.** Testable with curl and a real session cookie.
6. **T9, the admin surface.** Testable against a hand-inserted `acquisition` row.
7. **T6 and T8, the carry and the attach call.** The signup-path edits. Do these together,
   they are two halves of one behaviour.
8. **T5, stamp the four events.**
9. **T10, the privacy sentence.**
10. **T2, wire `captureTouch()` into `src/instrumentation-client.ts`.** The flip. Now run
    A2 through A7 and A11 through A13 end to end.

---

## 13. Ship sequence

Per the repo `CLAUDE.md` standing rule. Do not treat opening the PR as the end of the
session.

1. `npx tsc --noEmit` clean. Push the branch, open the PR, state the PR number.
2. **Migration classification: SAFE.** Two CREATE TABLE statements plus indexes, RLS, and
   comments. No ALTER on an existing table. No SQL touching `profiles`. Apply it yourself
   via the Supabase MCP.
3. **Migrate first, then merge.** Not a hard gate (section 9 explains why), but there is no
   upside to merging first.
4. Print the applied SQL in a fenced `sql` block for the record, then run the three
   post-migration verification queries in section 9 and paste the results.
5. No GATED migration in this session. If the build ends up needing one anyway, stop and
   surface it rather than widening the risk gate.
6. Merge the PR yourself with `gh pr merge` once tsc is clean and the migration is verified.
   The exception list does not apply: this session touches no payment path, no Stripe, no
   auth mechanism (it adds props to auth EVENTS, which is not the same as changing how auth
   works), and no data-deletion path. Confirm in chat that Vercel will auto-deploy `main`.
7. After deploy, run A8 against production (`curl -i https://linestry.com/r/fnrad`) and
   confirm the 302 and the `ref_code_hit` row.
8. Append the SHIP-LOG entry (below) and tell Jay the code-minting SQL template in T4 is how
   he adds each episode code.

---

## 14. Follow-ups, NOT this session

- **Admin CRUD for ref codes** (D7). A small `/admin/campaigns` screen: list, create,
  activate and deactivate, plus a hit count per code from `analytics_events`. Worth building
  once there are more than about ten codes, or the first time Jay wants one at 9pm.
- **A per-episode acquisition view.** Codes carry `event_id`, so an episode page could show
  "brought N members here" once there is data worth showing. Needs data first.
- **UTM tagging on outbound transactional email.** Every Resend link (tag notifications,
  comment notifications, invites, claim links) is currently untagged, so email-driven
  returns are invisible in the same way podcast traffic is today. Same shape of fix, its own
  brief, and larger than it sounds because the link builders are spread across
  `src/lib/emails/`.
- **Member referral codes.** The `ref_codes` shape already supports one code per person. The
  interesting version ties it to the token economy, which makes it a product decision rather
  than a plumbing one.
- **Multi-touch.** `acquisition` is one row per member by design and can be relaxed to a
  touch log later (D1). Do not until first-touch has been read in anger for a few months.
- **A bot and self-traffic filter.** Jay's own visits and preview-deploy traffic will sit in
  the numbers. A simple exclusion list on `first_source` or an internal-traffic flag would
  clean it up.
- **Backfill for FNRad Season 12 pre-ship arrivals.** There is nothing to backfill from. Say
  so plainly rather than reconstructing it from PostHog session guesses.

---

## SHIP-LOG entry to write at wrap

```
type: feature
pr: #<number>
branch: feat/funnel-attribution
ids: none
scope: funnel-attribution
migration: 20260904000001_funnel_attribution.sql (applied, SAFE, two additive CREATE TABLE)
status: merged
tsc: clean
```
