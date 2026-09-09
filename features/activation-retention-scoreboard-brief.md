# Activation, Retention, and the Funnel Scoreboard

> Cowork-authored feature brief, September 4 2026. Self-contained. ~5 to 7 hr, ONE PR,
> WITH a migration: one additive column and one partial unique index on
> `analytics_events`, plus two read-only SQL functions. All of it is SAFE under the repo
> risk gate (nothing touches `profiles`, nothing is destructive), so the session applies
> it itself. The column IS a hard pre-merge gate: `captureServerEvent` will send it on
> every insert, and in the merge-before-migrate window every analytics write would fail
> silently. Migrate first, then merge (section 9).
> Playbook subset run: checks 1, 2, 4, 6, 7, 8, 10, 11, 12, 18, 19, 20, 21, 22, 23.
> Checks 5, 15, 16, 17, 24 are not applicable (no PostgREST view repoint, no
> owner/editor moderation terminology, no conditional-action UI, no prior-phase
> invariant conflict, no `_public` view column). Checks 3, 9, 13, 14 are tagged AUDIT in
> section 5: this brief was drafted from the repo on disk with no live database session,
> so no assertion was run against prod.

---

## DECISIONS (review before building)

Every decision below has a shippable default. Build the defaults unless Jay says
otherwise. Nothing here blocks on an answer.

**D1. Activation is: signed up, AND posted at least one story, AND came back on a later
calendar day. DEFAULT: those three, in any order.**

This is the load-bearing decision, so here is the reasoning in full.

An activation definition has to be small enough to explain in one sentence, and it has to
be made of actions that a member could only take on purpose. Signing up is not activation
because half the people who sign up never come back. Finishing the FTUE is not activation
because the wizard hands you your first claim: `ftue_completed` fires at the end of a flow
that also creates a place claim and a board claim for you, so "completed FTUE plus N
claims" would largely be measuring the wizard, not the member.

A story is different. There is no story anywhere in the onboarding flow. Writing one is a
deliberate act taken after the wizard is over, it is the exact ask in the first-wave push
("create an account and post 3 stories"), and it is the thing the product is actually for.

The return visit is the half that predicts sticking around. One story on signup day is a
person being polite. One story plus a second day is a person with a habit forming.

Why one story and not three: at current volume, two signups in a month, a three-story bar
returns zero and an always-zero metric teaches nothing. One story is the loose bar that
still moves. The scoreboard shows the three-story count as a separate, deeper step
(section 6, T5) so the harder bar is visible without being the definition.

Alternative: "completed FTUE plus 3 claims." Rejected because the FTUE itself creates
claims, so the number would be inflated by construction and would not distinguish a real
member from someone who finished a wizard.

Alternative: "returned on 2 separate later days." Rejected as a v2 tightening. Write the
definition down now, watch it for a quarter, tighten it when there is data to tighten it
against. Section 14 logs the review.

**D2. Activation is emitted as an analytics event, `member_activated`, made idempotent by
a PARTIAL UNIQUE INDEX on `analytics_events`, not by a new `profiles` column.
DEFAULT: the index.**

`create unique index ... on analytics_events (actor_id) where event = 'member_activated'`
gives exactly-once at the durable-log level with zero new code: `captureServerEvent`
already swallows every insert error, so a second attempt fails at the constraint and
disappears silently, which is precisely the behaviour wanted. It also keeps this whole
session out of the GATED lane, because the repo risk gate treats any SQL touching
`profiles` as GATED and a `profiles` migration would mean waiting on Jay for a one-line
ALTER.

Alternative: a `profiles.activated_at timestamptz` column. It reads nicer and makes
"how many activated members do we have, ever" a single-column query. Rejected for this
session because it is a GATED migration for a fact that is already derivable, and because
`profiles` is the highest-consequence table in the schema (membership, Stripe, tokens).
Section 14 keeps it as a follow-up if the derived query ever gets annoying.

Alternative: a `token_events`-style ledger table. Rejected as a whole new table for one
boolean per member.

**D3. The activation check runs server-side in ONE helper, called from exactly TWO places.
DEFAULT: `src/lib/activation.ts` exporting `maybeMarkActivated`, called from the
`POST /api/stories` success path and from the daily-visit winner branch in `GET /api/me`.**

Those two call sites are the only two moments the definition can newly become true: the
member posts their qualifying story, or the member's return visit lands. Anywhere else is
a wasted read. Both call sites already exist and already run server-side with the service
client, and both already fire analytics from the same spot.

The helper needs three cheap reads and no new indexes:
`profiles.created_at` and `profiles.last_visit_award_date` (both existing columns, F14 and
F9), a `stories` existence check on the indexed `author_id` (F16), and the activation
pre-check served by the D2 index.

**D4. The return signal is a new `member_returned` event, hung off the existing
`award_daily_visit` winner branch. DEFAULT: yes, and it never fires on signup day.**

`award_daily_visit` already does exactly the work a return event needs: it is atomic, it
fires at most once per UTC day per member, and `/api/me` already knows which load won it.
Adding a second dedupe mechanism next to it would be two sources of truth for the same
fact. The event fires only when `day_index >= 1`, where
`day_index = today (UTC) - profiles.created_at (UTC date)`, so the signup-day visit is
excluded by construction and day 1 means "came back the next day."

Props: `{ day_index }`. That single number makes "how many came back at all" and "how
long is the gap" answerable from one event.

**D5. `analytics_events` gains a real `distinct_id text` column. DEFAULT: a column, not a
props key.**

This is the fact that decides whether the scoreboard can count PEOPLE or only EVENTS
before signup. Today `trackEvent` sends `distinct_id` up to the sink, and
`captureServerEvent` forwards it to PostHog and then throws it away: the insert writes
only `category, event, actor_id, props` (F5). Anonymous events land with `actor_id` NULL,
so `ftue_landed` in the durable log is a pile of rows with no way to tell one visitor from
forty page reloads. Without this column the top of the funnel is uncountable in-app and
the founder is back in PostHog, which is the thing this brief exists to end.

Alternative: stash it in `props->>'distinct_id'`. No migration, and at current volume the
unindexed jsonb read is fine. Rejected because the column is one line of additive DDL, it
is the natural home for an identity key, and a jsonb key would need a functional index
within a year anyway.

**D6. The scoreboard is a new page at `/admin/funnel`, gated by `requireModerator()`.
DEFAULT: yes. The name is free.**

`find src -ipath "*funnel*"` returns nothing (F17), so there is no collision. It sits
beside `/admin/activity` rather than inside it: Activity is a raw event tail for
debugging one member's session, the scoreboard is an aggregate read for a weekly
decision. Cramming both into one page would make each worse. `requireModerator` (is_editor
only, founding tier is not enough) matches the gate Activity already uses (F3).

**D7. All aggregation happens in TWO read-only Postgres functions called via
`db.rpc(...)`, not in TypeScript over paginated rows. DEFAULT: the functions.**

PostgREST caps a select at 1000 rows per request on Supabase's default configuration. A
90-day window aggregated in TypeScript would need a paginated read loop, and any
un-paginated select would silently truncate rather than error. That failure mode is
already latent in the existing Activity route, whose 24h count strip selects with no limit
(F4), so the founder would be reading a silently-capped number and would not know.

One `db.rpc` call returns exact numbers in one round trip, and `count(distinct actor_id)`
over a btree range scan on `created_at` is the cheapest possible shape for this question.
See section 10 for the honest performance answer and the row count at which it stops being
free.

Alternative: TypeScript aggregation with `.range()` pagination. Rejected per the above.

**D8. Exclusion is a constant list of actor ids plus a bot stamp at the sink. DEFAULT: a
`src/lib/analytics-exclusions.ts` constant, NOT a flag on `profiles`.**

This is the single biggest reason the existing numbers are not trusted, so it gets an
explicit mechanism rather than a caveat.

Two separate problems, two separate fixes:

1. **Internal humans.** Jay's own account, the plus-aliased test gmails, any staged
   fixture. That is a list of maybe six uuids that changes twice a year. One exported
   constant, read by both RPCs as a `uuid[]` parameter and echoed on the page so the
   founder can see who is excluded. An `is_internal` column on `profiles` would be a GATED
   migration, a new admin toggle, and a second place to look, for a six-item list.
2. **Bots.** Crawlers hit `/onboarding` and fire `ftue_landed` with no way to tell them
   from a person. The fix is at the sink: `/api/track/event` reads the request
   `user-agent`, and when it matches a conservative bot pattern it STAMPS
   `props.bot = true` rather than dropping the event. Both RPCs then filter
   `props->>'bot' is not true`. Stamping keeps `/admin/activity` honest as a raw tail and
   makes the decision reversible; dropping would destroy evidence.

Historical rows stay unstamped, so the scoreboard's default window is 30 days and the
page carries a one-line note that rows before the ship date are unfiltered for bots.

**D9. Charts are hand-built HTML, CSS and inline SVG. DEFAULT: no chart library.**

`package.json` has no charting dependency (F18) and this is one admin page. Adding
recharts or d3 for four small visuals is a bundle and a maintenance surface for nothing.
The exact mark and color specs are in T6 so this does not become a taste argument at build
time.

**D10. Window control is 7 / 30 / 90 days, defaulting to 30. DEFAULT: 30.**

30 days is the weekly-read window that still contains enough events to be non-zero. 7 is
for "did the podcast push do anything this week." 90 is for trend. Three buttons, a query
param, no date picker.

**D11. Cohort retention is weekly, showing W+1, W+2 and W+3, for the last 8 cohorts.
DEFAULT: yes.**

The question asked is "of the members who signed up in week W, how many came back in week
W+1," so W+1 is the required column. W+2 and W+3 come free from the same query and turn a
single number into a shape. Eight cohorts is two months, which fits without scrolling.
Cohorts are built off `profiles.created_at` (durable state) and returns off
`token_events.source = 'daily_visit'` (durable state), NOT off analytics events, so the
retention view works retroactively over the entire history of the product from day one.
That is the one place in this brief where old data is fully usable, and it matters.

**D12. No scheduled digest, no email, no cron this session. DEFAULT: not this session.**

The stated failure was that the weekly read required opening PostHog and building a
funnel. A bookmarked page that loads in one click fixes that. A digest is a nicer version
of a fixed problem and it brings a scheduler, an email template, and a suppression check
with it. Section 14.

---

## 1. Why this, why now

Linestry can see people arrive and it can see people sign up. It cannot see whether anyone
came back, and there is no written-down answer to "what is an activated member."

That is a gap in the instrumentation, but the reason it matters now is a distribution
one. FNRad podcast traffic is starting to arrive. When it does, the only questions worth
asking are: how many arrived, how many signed up, how many became real members, and how
many are still here a week later. Right now the fourth question cannot be answered at all,
and the first three require a hand-run PostHog query that has not been done since July.

The July plan said "watch the wave in PostHog weekly." It did not happen. Not because
anyone was lazy, but because the task was "open a third-party tool, remember the event
names, rebuild a funnel from scratch, and remember to exclude yourself." That is a
twenty-minute job that gets skipped every week forever. A page that loads in one click is
a thirty-second job that gets done.

The last numbers on record, and they are worth stating as context and not as fact:
a PostHog read covering June 1 to July 1 2026 recorded 165 unique visitors, 34
`ftue_landed`, 11 `ftue_aha_shown`, 2 `signup_succeeded`, 3 `ftue_completed`, 35 stories,
123 claims. Those are reported numbers, not verified from code by this brief. They came
from a period whose instrumentation only started on June 2, and they were never filtered
for bots or for test accounts. A prior brief explicitly instructed re-running that funnel
excluding `$virt_is_bot` before trusting the land-step drop-off
(`features/archive/2026-07-02-ftue-conversion-pass.md`, decision D5), and that re-run was
never done. So the honest position today is: the numbers are directionally suggestive and
individually untrustworthy. That is the state this brief ends.

There is one more reason the timing is right. The only return signal that exists anywhere
in the product today is the token ledger: `award_daily_visit` writes a `token_events` row
on the first `/api/me` load of each UTC day, and that fact is surfaced as a streak chip and
nowhere else. It emits no analytics event. So the data to answer "did they come back"
has been quietly accumulating since June and has never once been read as retention. This
session turns an existing side effect into a measured one, which is why the retention view
can go back to day one while the funnel view cannot.

---

## 2. Prerequisites

1. Pull `main` at `/Users/jaybalmer/lineage/`. `npm run dev` runs from that repo root, and
   the smoke pass in section 8 runs against that dev server. Stop any stale dev server
   first so port 3000 binds to this instance (playbook check 20).
2. `.env.local` present at the repo root, with `SUPABASE_SERVICE_ROLE_KEY` set. Every read
   in this session goes through the service client. If working in a worktree, symlink
   `.env.local` in (the known `@supabase/ssr` prerender friction).
3. Supabase MCP access, or dashboard SQL access, to apply the section 9 migration. It is
   SAFE, so apply it in-session; do not wait on Jay.
4. An editor account to view `/admin/funnel` (`profiles.is_editor = true`, F3). Founding
   tier alone will not open it.
5. Jay's own `profiles.id` and the ids of any plus-aliased test accounts, for the D8
   exclusion constant. If they are not to hand, ship the constant with Jay's id only and
   leave a marked TODO line; the page renders the excluded list so the gap is visible.
6. No other branch in flight touching `src/lib/analytics-server.ts`,
   `src/app/api/me/route.ts`, or `src/app/api/stories/route.ts`. Two sibling briefs staged
   the same day (`features/funnel-event-completion-brief.md` and
   `features/funnel-attribution-brief.md`) both touch the analytics layer. See section 10,
   risk 7.

---

## 3. Scope

**Part A, the activation definition made real.** A written definition (D1), one helper
`src/lib/activation.ts`, two call sites, one new `member_activated` event carrying
`days_to_activate` and `trigger`, made exactly-once by a partial unique index.

**Part B, the return signal.** A new `member_returned` event with a `day_index` prop, fired
from the existing `award_daily_visit` winner branch in `GET /api/me`, never on signup day.

**Part C, identity in the durable log.** A real `distinct_id` column on `analytics_events`,
written by `captureServerEvent`, so unique-person counts work for pre-auth funnel steps.

**Part D, exclusion.** One constant of excluded actor ids, plus a conservative bot stamp
applied at `/api/track/event`, plus both filters applied inside the RPCs.

**Part E, the scoreboard.** A new moderator-gated `/admin/funnel` page: a KPI row, an
eight-step acquisition-to-activation funnel with unique-actor counts and step-to-step
conversion, a two-series daily time series of signups and activations, a weekly cohort
retention table, and a content-contribution count. Backed by two read-only SQL functions
and one new `GET /api/admin/funnel` route. A link to it from the `/admin` header, beside
Activity.

---

## 4. Out of scope (hard list)

Do not build these. Each is a real idea and each belongs to a different session.

- **Any change to `captureServerEvent`'s or `captureServerError`'s contract** beyond adding
  `distinct_id` to the insert. Do not add batching, do not add a queue, do not stop
  swallowing errors. The swallow is what makes D2's idempotency work.
- **Adding a column to `profiles`.** Not `activated_at`, not `is_internal`, not
  `last_seen_at`. See D2 and D8. A `profiles` migration is GATED and this session is
  designed to avoid the gate entirely.
- **A scheduled digest, email, or cron.** See D12.
- **A `funnel` or `metrics` analytics category.** The two new events ride existing
  categories: `member_activated` and `member_returned` are both `auth`. A new category is a
  CHECK-constraint migration (F1) for zero benefit.
- **Backfilling historical `analytics_events` rows** with a `distinct_id`, a bot stamp, or
  a retroactive `member_activated`. The information to do it does not exist. The page
  states the instrumentation start date instead. The one exception is retention, which is
  derived from durable state and works retroactively for free (D11).
- **Rebuilding or restyling `/admin/activity`.** It stays exactly as it is. Its latent
  1000-row truncation on the 24h strip (F4) is noted in section 14, not fixed here.
- **A PostHog dashboard, a PostHog reverse proxy, or any PostHog configuration change.**
  This brief makes the in-app read authoritative; it does not touch the external sink.
- **The events owned by the two sibling briefs.** `funnel-event-completion-brief.md` adds
  `magic_link_sent`, `signin_succeeded`, `auth_complete_landed`, the commerce events, and
  the `is_first` / `story_ordinal` props on `story_created`.
  `funnel-attribution-brief.md` adds the `ref_codes` and `acquisition` tables. Do not
  build either. This brief neither depends on nor blocks them.
- **Per-member drill-down** from a funnel step to the list of people in it. Tempting, and
  the natural next click. It is a different page with a privacy conversation attached.
  Section 14.
- **Any change to `award_daily_visit` itself.** The RPC is correct. This session reads its
  result; it does not touch the function.

---

## 5. Verified facts (checked against `main` at `39f169d`, September 4 2026)

Provenance is given so the session does not re-derive these. Facts drawn from the repo on
disk are direct reads. Anything that needs a live database is tagged AUDIT and must be
confirmed before it is relied on.

**F1. `analytics_events` is the durable event log, and its category list is
CHECK-constrained to seven values.**
`supabase/migrations/20260602000001_diagnostics_phase1_analytics_events.sql:30-40` defines
`id uuid pk default gen_random_uuid()`, `created_at timestamptz not null default now()`,
`category text not null check (category in ('auth','ftue','content','invite','redirect',
'moderation','error'))`, `event text not null`, `actor_id uuid`,
`severity text check (severity in ('warning','error'))`,
`props jsonb not null default '{}'::jsonb`. `actor_id` is deliberately NOT a foreign key
(comment at `:14-19`). Adding a category requires a migration; this session adds none.

**F2. Two indexes exist, and RLS is on with zero policies.**
`analytics_events_created_at_idx on (created_at desc)` at `:43-44` and
`analytics_events_category_created_at_idx on (category, created_at desc)` at `:47-48`.
`alter table public.analytics_events enable row level security;` at `:50`, with no
`create policy` statement anywhere in the file or in
`supabase/migrations/20260623000001_rls_enable_flagged_tables.sql` (grep for
`analytics_events` in that file returns nothing). Only the service-role client can read or
write it. Confirmed by the header comment at `:24-26`.

**F3. The existing admin surface is a raw event tail, and it is moderator-gated.**
Three files, all read in full:
- `src/app/admin/activity/page.tsx` is a 20-line server component calling
  `requireModerator()` at `:14`, redirecting 401 to `/onboarding` and 403 to `/admin`
  (`:16-17`), then rendering `<ActivityClient />`.
- `src/app/admin/activity/activity-client.tsx` renders a last-24h count strip
  (`:136-152`), seven category filter chips plus All (`:30-39`, `:155-171`), and a flat
  newest-first table with exactly five columns, When / Category / Event / Actor / Details
  (`:178-182`). Error rows are tinted (`:198`). There are no funnels, no unique-actor
  counts, no time series, no conversion rates, no date range, no pagination and no search.
- `src/app/api/admin/activity/route.ts` gates on `requireModerator()` at `:21`, uses
  `getServiceClient()` at `:25`, and computes `limit` as
  `Math.min(Math.max(parseInt(... ?? "200"), 1), 500)` at `:31`. The client never sends a
  `limit`, so 200 is the effective page size and the 500 cap is not reachable from the UI.
`requireModerator` is `is_editor` only; founding tier is not enough
(`src/lib/auth.ts:124-144`, compare `requireEditor` at `:88-108` which accepts either).

**F4. The Activity route's 24h count strip has a latent truncation.**
`src/app/api/admin/activity/route.ts:47-50` selects the `category` column for the last 24
hours with no `.limit()` and no `.range()`. PostgREST caps a page at 1000 rows on
Supabase's default configuration, so once a day exceeds 1000 events the strip
under-reports with no error. Not this session's job to fix (section 14), but it is the
direct evidence for D7: in-memory aggregation over a wide window is a silent-truncation
trap in this codebase.

**F5. `captureServerEvent` receives `distinct_id` and then discards it.**
`src/lib/analytics-server.ts:63-98`. `distinctId` is accepted at `:56`, defaulted at `:69`,
and passed to PostHog at `:76`. The database insert at `:89-94` writes only
`{ category, event, actor_id, props }`. This is the fact D5 exists to fix. The whole
function is wrapped in a try/catch that swallows everything (`:95-97`), which is what makes
D2's unique-index idempotency work with no new code.

**F6. The client helper already sends everything needed.**
`src/lib/analytics.ts:23-48`: `trackEvent(category, event, props, { actorId })` POSTs
`{ category, event, props, actor_id, distinct_id, occurred_at }` to `/api/track/event`
with `keepalive: true`. `distinct_id` comes from `posthog.get_distinct_id()` (`:14-21`).
`occurred_at` is stamped at call time on the client (`:29-34`).

**F7. The generic sink route passes all six fields through.**
`src/app/api/track/event/route.ts:13-20`. It always returns 204 and never throws
(`:22-25`). This is the one place D8's bot stamp goes.

**F8. THE ONLY EXISTING RETURN SIGNAL IS THE TOKEN LEDGER, AND IT EMITS NO ANALYTICS
EVENT.** `src/app/api/me/route.ts:33-43` calls `db.rpc("award_daily_visit", { p_user:
user.id })` on every `/api/me` load, before the profile read, and sets `dailyVisitAwarded`
from the boolean it returns. The result is returned to the client as
`daily_visit_awarded` at `:98`. There is no `captureServerEvent` call anywhere in that
file. A repo-wide `grep -rn "daily_visit" src/` returns exactly eight hits, in
`api/me/route.ts`, `api/me/tokens-today/route.ts`, `components/ui/daily-token-chip.tsx`
and `components/catalog-loader.tsx`, and not one of them is an analytics capture.
Confirmed: no `daily_visit` analytics event exists.

**F9. `award_daily_visit` is atomic, once per UTC day, and it already maintains a date
column on `profiles`.** `migration-013-token-earning.sql:46-69`. The guarded UPDATE sets
`last_visit_award_date = current_date` and increments `token_contribution`, with
`where id = p_user and (last_visit_award_date is null or last_visit_award_date <>
current_date)`. It returns true only when `row_count > 0`, and inserts the
`token_events` row with `source = 'daily_visit'` only in that branch. The column itself is
added at `:24-25` (`alter table public.profiles add column if not exists
last_visit_award_date date`). **This column is the whole return-visit check**: a member has
returned on a later day if and only if `last_visit_award_date > created_at::date`.

**F10. The streak is derived by walking back day by day over a 60-day window.**
`src/app/api/me/tokens-today/route.ts:43-94`. It selects `amount, source, created_at` from
`token_events` for one user over 60 days (`:40-47`), sets `visit_awarded_today` at `:72`,
and computes `visit_streak` with a while loop at `:81-94`. Per-user only; there is no
aggregate view of this anywhere.

**F11. The streak is surfaced only as a chip.**
`src/components/ui/daily-token-chip.tsx:54-58` reads `GET /api/me/tokens-today` on mount
and on `tokenEarnTick`. `daily_visit` appears in its label map at `:35` as "Showing up."
That chip is the entire user-facing and founder-facing surface for the return signal.

**F12. There is no session id, no last-seen column, and no return-visit event anywhere.**
`grep -rn "last_seen\|last_active\|session_id\|return_visit" src/ supabase/migrations/`
returns four kinds of hit, none of them relevant: the Stripe checkout `session_id` in
`src/app/welcome/page.tsx:15` and `src/app/api/stripe/checkout/route.ts:55`, and a
scattering of the English word "returned" in comments. No `last_seen`, no `last_active`,
no day-N event, no return event.

**F13. The closest thing to an activation milestone today never backfills.**
`src/components/profile/owner-timeline-panel.tsx:657` fires
`trackEvent("ftue", "first_three_stories_completed", {}, { actorId: activePersonId })`.
Read the gate precisely (`:645-658`): the effect returns early unless
`isAuthUser(activePersonId)`, and again unless BOTH `storiesLoaded` AND
`contributionsLoaded` are true. It then compares a ref-held previous count to the current
count, and returns after seeding the ref on the very first pass (`prev === null`). It fires
only on `prev < 3 && count >= 3 && !triggerPrefs.first_three_stories_shown`. So it requires
the count to cross from below 3 to 3-or-more WHILE the owner timeline panel is mounted and
both loaders have already resolved. A member who crosses the threshold anywhere else, or
who arrives already at 3, never fires it. It is a celebration trigger that happens to emit
an event, not a milestone measurement. Do not build activation on this pattern.

**F14. `ftue_completed` is the last instrumented funnel step, and it is gated on there
being no existing profile.** `src/app/auth/complete/page.tsx:207-209` fires
`trackEvent("ftue", "ftue_completed", {}, { actorId: user.id })` inside
`if (!existingProfile)`. The comment at `:203-206` states the reason: a returning user
landing on `/auth/complete` already finished onboarding, so firing it would inflate the
final step. `signup_succeeded` at `:86` is gated the same way, inside the
`if (!existingProfile)` upsert branch that begins at `:72`. `existingProfile` comes from a
`profiles` select on `id` at `:66-70`. Nothing measures anything after `ftue_completed`.
The upstream steps fire from `src/components/onboarding/onboarding-flow.tsx`:
`ftue_landed` at `:182` (with `source: "intro"` when arriving from `/intro`),
and one step-shown event per step at `:193-207`, which maps to `ftue_intro_viewed`,
`ftue_aha_shown`, `ftue_timeline_shown` and `ftue_save_shown`.

**F15. `profiles.created_at` exists.** `src/app/api/admin/users/route.ts:17` selects
`"id, display_name, membership_tier, created_at, is_archived, archived_at"` from
`profiles`. That select runs in production today, so the column is real. It is NOT in the
`/api/me` select list (`src/app/api/me/route.ts:47-54`), so T2 must add it there. Adding
an EXISTING column to an explicit select is safe and is not a migration gate.

**F16. Reliable server-side content events, with their real names and props.**
All from `src/app/api/stories/`:
- `story_created`, `src/app/api/stories/route.ts:429-443`, props
  `story_id, visibility, date_precision, photo_count, rider_count, board_count,
  has_youtube, has_link`.
- `story_date_fixed`, `:519-526`, props `story_id, author_id, moderated, date_precision`.
- `story_edited`, `:697-706`, props `story_id, visibility, rider_count, board_count`.
- `story_deleted`, `:823-830`, props `story_id, moderated, author_id`.
- `story_reaction_set` and `story_reaction_removed`,
  `src/app/api/stories/[id]/reactions/route.ts:81` and `:113`.
- `story_comment_added`, `src/app/api/stories/[id]/comments/route.ts:105`.
- `story_connection_added` and `story_connection_removed`,
  `src/app/api/stories/[id]/connections/route.ts:212` and `:348`.
Client-side, from the store: `claim_created` at `src/store/lineage-store.ts:493-497`,
props `predicate, subject_type, object_type, visibility`; and `riding_day_created` at
`:923-928`, props `place_id, rider_count, has_note, visibility`. Both pass
`actorId: activePersonId`.
The `stories` table has `author_id uuid not null references profiles(id) on delete cascade`
and `create index on stories (author_id)`
(`supabase/migrations/20260323000001_stories.sql:5` and `:39`), so the T1 story-existence
check is an indexed lookup.

**F17. `/admin/funnel` is free.** `ls src/app/admin/` returns
`activity, asserters, brand, claims, community, layout.tsx, page.tsx, podcast,
results-scanner, tag-queue, users`. `find src -ipath "*funnel*"` returns nothing. The
`/admin/*` tree is gated server-side by `src/app/admin/layout.tsx` calling
`requireEditorPage()`, and each page re-gates itself; the new page follows the Activity
pattern and calls `requireModerator()` directly.
The `/admin` header nav is a row of `<Link>` chips in `src/app/admin/page.tsx:1852-1908`.
The Activity chip specifically is at `:1866-1874`, wrapped in
`{membership.is_editor && ( ... )}`, with a `<span>` emoji, a label, and the shared class
string `"shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border
border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"`.
Copy that chip exactly.

**F18. There is no charting library.** `package.json` dependencies are
`@radix-ui/*`, `@sentry/nextjs`, `@supabase/ssr`, `@supabase/supabase-js`,
`@vercel/analytics`, `class-variance-authority`, `clsx`, `lucide-react`, `next`,
`posthog-js`, `posthog-node`, `react`, `react-dom`, `resend`, `stripe`,
`tailwind-merge`, `zustand`. No recharts, no d3, no chart.js. D9 follows from this.

**F19. `profiles` carries membership, tokens and archival state, and there is no
`memberships` table.** The repo `CLAUDE.md` "Key tables" section states it explicitly
("There is no `memberships` table"), and `src/app/api/me/route.ts:47-54` is the proof: the
select list pulls `membership_tier, membership_status, founding_badge,
founding_member_number, token_founder, token_member, token_contribution,
stripe_customer_id, stripe_subscription_id, membership_expires_at, membership_source,
pending_credit, is_editor` from `profiles` and from nowhere else.
`src/app/api/admin/users/route.ts:17` adds `is_archived, archived_at` from the same table.
There is no `is_test`, `is_internal`, `is_staff` or `test_account` column anywhere:
grepping those four names across `src/`, `supabase/` and the root `migration-01*.sql`
files returns nothing. D8 follows from this.

**F20. The historical baseline is reported context, not a verified fact.** A PostHog read
covering June 1 to July 1 2026 recorded 165 unique visitors, 34 `ftue_landed`, 11
`ftue_aha_shown`, 2 `signup_succeeded`, 3 `ftue_completed`, 35 stories, 123 claims. It is
not derived from the repo and this brief does not treat it as verified. Two known defects
in it: instrumentation only started June 2, so the window is short by a day and the
pre-June-2 baseline is absent entirely; and no bot or test-account filtering was applied.
`features/archive/2026-07-02-ftue-conversion-pass.md` decision D5 instructed re-running the
funnel excluding `$virt_is_bot` before concluding the land-step cliff was real, and its
section 3 fact 8 records the numbers as "PostHog project 451141, unfiltered for bots;
hence D5's re-run instruction." That re-run was never done. No funnel read has been done
since. This is the direct provenance for D8.

**AUDIT items (need a live database; confirm before relying on them).**
- **A1 (playbook check 9).** No SQL assertion in this brief has been run against prod. Run
  the section 9 pre-flight block before applying the migration.
- **A2 (playbook check 3).** Current `analytics_events` row count and the row count in the
  last 90 days. Section 10 gives the performance answer as a function of that number;
  measure it once so the answer is real.
- **A3 (playbook check 13).** Orphan auth users (`auth.users` rows with no `profiles`
  row). The cohort function reads `profiles` for cohort membership, so an orphan is
  invisible to retention. There is a backfill migration on record
  (`supabase/migrations/20260515000001_orphan_auth_users_backfill.sql`) and `requireAuth()`
  bootstraps a missing profile, so the expected count is 0. Verify.
- **A4 (playbook check 14).** Whether any live `analytics_events` row already carries a
  `props.bot` key, which would collide with D8's stamp. Expected 0.
- **A5.** PostgREST's effective `db.max_rows` on this Supabase project. D7 assumes 1000.
  A one-row probe settles it, and the answer only strengthens or weakens the argument for
  the RPC; it does not change the design.

---

## 6. Task specs

### T1: `src/lib/activation.ts`, the activation check

New file. One exported function, no side effects other than the event.

```ts
// pseudocode, verify signatures against the real client at build time
export type ActivationTrigger = "story" | "return"

export async function maybeMarkActivated(
  db: SupabaseClient,          // service-role client, from getServiceClient()
  userId: string,
  trigger: ActivationTrigger,
): Promise<boolean>
```

Behaviour, in order, bailing out as early as possible so the common case is one read:

1. **Already activated?** Select `id` from `analytics_events` where
   `event = 'member_activated'` and `actor_id = userId`, limit 1. If a row exists, return
   false. This read is served by the D2 partial unique index.
2. **Read the two profile facts.** Select `created_at, last_visit_award_date` from
   `profiles` where `id = userId`. If the row is missing, return false.
3. **Condition A, has a story.** Select `id` from `stories` where `author_id = userId`,
   limit 1. Indexed (F16). If none, return false.
4. **Condition B, has returned.** True when `last_visit_award_date` is not null AND
   `last_visit_award_date > created_at::date` (compare as UTC dates, both sides). If
   false, return false.
5. **Fire.** `captureServerEvent({ category: "auth", event: "member_activated",
   actorId: userId, props: { days_to_activate, trigger } })` where `days_to_activate` is
   whole UTC days between `created_at` and now. Return true.

Notes for the builder:

- Activation is defined off DURABLE STATE (a `stories` row, a date column on `profiles`),
  never off a fire-and-forget analytics event. `ftue_completed` is a client-side
  `trackEvent` that can be lost to a closed tab; a `profiles` row cannot. This is
  deliberate and it is why "signed up" is checked by the existence of the profile rather
  than by the event.
- The function must never throw. Wrap the whole body in try/catch and return false on
  any error, matching the fire-and-forget contract every analytics path in this repo
  already uses.
- Step 1 is a cheap guard, not the idempotency guarantee. The guarantee is the unique
  index (D2). Two concurrent calls can both pass step 1; the second insert then violates
  the constraint and `captureServerEvent` swallows it (F5). One row survives. This is the
  designed behaviour, not an accident, and it is why no lock is needed.

### T2: call site 1, `GET /api/me` (the return arm)

`src/app/api/me/route.ts`.

1. Add `created_at, last_visit_award_date` to the explicit profile select at `:47-54`.
   Both columns already exist (F9, F15), so this is not a migration gate.
2. In the `dailyVisitAwarded === true` branch, after the existing founding-token block at
   `:87-93`, compute
   `day_index = floor(UTC date today - UTC date of profile.created_at)` and, when
   `day_index >= 1`, fire
   `captureServerEvent({ category: "auth", event: "member_returned", actorId: user.id,
   props: { day_index } })`.
3. Then `await maybeMarkActivated(db, user.id, "return")`.

Both calls sit inside the `dailyVisitAwarded` branch, so they inherit the RPC's
once-per-UTC-day guarantee (F9) and add no second dedupe mechanism. Both are best-effort:
a failure must not change the `/api/me` response. The route's existing pattern of
`try { ... } catch { console.error(...) }` around the RPC call at `:32-43` is the model.

There is a subtlety worth stating: `maybeMarkActivated` is called here even though the
member's `last_visit_award_date` was updated microseconds ago by the RPC. Re-read it from
the profile select rather than assuming, because the profile read at `:45` happens AFTER
the RPC at `:33` and therefore already reflects today's write. Confirm that ordering
during the pre-read; if it ever inverts, the return arm silently stops activating people.

### T3: call site 2, `POST /api/stories` (the story arm)

`src/app/api/stories/route.ts`. Immediately after the existing `story_created`
`captureServerEvent` at `:429-443` and before the 201 response at `:445`, add
`await maybeMarkActivated(supabase, user.id, "story")`.

Same contract: never throws, never changes the response. It sits after the token awards
and after the event capture so a failure there cannot affect the story write, which is
already committed by that point.

### T4: `distinct_id` on the durable log, and the bot stamp

1. **Migration.** Section 9 adds `analytics_events.distinct_id text`.
2. **`src/lib/analytics-server.ts`.** In `captureServerEvent`, add `distinct_id: distinctId`
   to the insert object at `:89-94`. `distinctId` is already computed at `:69` as
   `args.distinctId || actorId || "anonymous"`. Write that same resolved value, so an
   authenticated event carries both keys and an anonymous one carries the PostHog id.
   Do NOT add it to `captureServerError`'s insert; errors are not funnel steps.
3. **`src/types/index.ts`.** Add `distinct_id: string | null` to the `AnalyticsEvent`
   interface at `:825-833`.
4. **`src/app/api/track/event/route.ts`.** Read `req.headers.get("user-agent")` and, when
   it matches a conservative bot pattern, merge `{ bot: true }` into the props before
   calling `captureServerEvent`. Keep the pattern short, case-insensitive, and boring:
   `bot`, `crawl`, `spider`, `slurp`, `bingpreview`, `headlesschrome`, `python-requests`,
   `curl/`, `wget`, `facebookexternalhit`. STAMP, never drop (D8). Everything stays inside
   the existing try/catch so a bad header cannot break the sink.

Do not touch `/api/track/error` or the three other track routes. Those belong to the
sibling brief.

### T5: the two SQL functions

Both are `stable`, both are read-only, both return `jsonb`, both take an exclusion array.
Both are `security invoker` (the default) and both have EXECUTE revoked from `anon` and
`authenticated`, because they are only ever called by the service-role client.

**Tagged: pseudocode, verify before running.** These were written against the schema on
disk with no live database session. Run the section 9 pre-flight block first, then apply,
then run the section 9 verification block.

Function 1, `analytics_funnel_summary(p_since timestamptz, p_until timestamptz,
p_exclude uuid[] default '{}')`, returns one jsonb object with three keys:

- `steps`: the eight funnel counts, defined as
  - `landed` = `count(distinct distinct_id) filter (where event = 'ftue_landed')`
  - `aha` = same over `ftue_aha_shown`
  - `save_shown` = same over `ftue_save_shown`
  - `signed_up` = `count(distinct actor_id) filter (where event = 'signup_succeeded')`
  - `onboarded` = same over `ftue_completed`
  - `posted_story` = same over `story_created`
  - `returned` = same over `member_returned`
  - `activated` = same over `member_activated`
- `daily`: one row per UTC day in the window with `day`, `signups`, `activations`, each a
  distinct-actor count, ordered ascending.
- `content`: raw event counts (not distinct actors) over the window for `story_created`,
  `claim_created`, `riding_day_created`, `story_comment_added`, `story_reaction_set`,
  `story_connection_added`.

Every count comes from one CTE that applies the window and both exclusion filters once:
`created_at >= p_since and created_at < p_until`,
`coalesce((props->>'bot')::boolean, false) = false`, and
`(actor_id is null or not (actor_id = any(p_exclude)))`.

Function 2, `analytics_cohort_retention(p_weeks int default 8, p_exclude uuid[]
default '{}')`, returns a jsonb array, newest cohort first, one object per weekly cohort
with `cohort_week`, `size`, `w1`, `w2`, `w3`.

Cohorts come from `profiles`, bucketed by `date_trunc('week', created_at at time zone
'UTC')`, excluding `is_archived` and the exclusion list. Returns come from `token_events`
where `source = 'daily_visit'`, with the week offset computed as
`((visit_date - signup_date) / 7)::int`. Note that `date - date` yields an integer number
of days in Postgres, so this is plain integer division; do not reach for
`extract(epoch from ...)`, which does not apply to a date difference.

`w1` is `count(distinct id) filter (where week_offset = 1)`, and so on. Because both
sides are durable state, this function works over the entire history of the product,
including the period before analytics existed. That is the point of D11.

### T6: `/admin/funnel`, the scoreboard

Files: `src/app/admin/funnel/page.tsx` (server, gate), `src/app/admin/funnel/funnel-client.tsx`
(client, render), `src/app/api/admin/funnel/route.ts` (moderator-gated read).

The page component is a near-copy of `src/app/admin/activity/page.tsx` (F3): call
`requireModerator()`, redirect 401 to `/onboarding` and 403 to `/admin`, render the client.
`export const dynamic = "force-dynamic"`.

The route calls `requireModerator()`, then `getServiceClient()`, then both RPCs, passing
the exclusion array from `src/lib/analytics-exclusions.ts` and a window resolved from a
`days` query param clamped to one of 7, 30 or 90 (default 30). It returns
`{ window_days, since, until, steps, daily, content, cohorts, excluded_count,
instrumentation_start }`.

`src/lib/analytics-exclusions.ts` exports `EXCLUDED_ACTOR_IDS: readonly string[]`,
seeded with Jay's profile id and any test-account ids, each on its own line with a
trailing comment naming who it is. Also export
`INSTRUMENTATION_START = "2026-06-02"` (F1, the migration date) so the page can be honest
about how far back the funnel view is meaningful.

**Layout, top to bottom.**

1. **Header.** "Funnel" as the H1, one line of subcopy naming the window and the
   exclusions in plain words, a back-to-admin chip and a refresh chip, matching
   `activity-client.tsx:107-133`. Then the three window buttons (7 / 30 / 90).
2. **KPI row.** Four stat tiles: Arrived, Signed up, Activated, Returned. Value as a hero
   figure, label beneath, and the conversion from the previous step as a small secondary
   line. A stat tile, not a one-bar chart.
3. **The funnel.** Eight horizontal bars, longest at the top, each bar's width a
   percentage of step 1. This is a magnitude comparison of one series, so it takes ONE hue
   (sequential job), no legend, and a direct label on every bar: step name on the left,
   count and step-to-step percent on the right. Plain `div`s with a percentage width and a
   4px rounded right end. Below the bars, one italic line: steps 1 to 3 count anonymous
   browsers by `distinct_id` and steps 4 to 8 count members by `actor_id`, so the
   conversion from step 3 to step 4 crosses two identity spaces and is approximate.
4. **The daily series.** Two series, signups and activations, over the window. Trend over
   time with two distinct series, so it is a two-line inline SVG with a categorical
   palette, a legend (always present at two series), and a direct end-label on each line.
   One y-axis only: both series are counts of people per day, so they share a scale. A
   crosshair with a tooltip showing the date and both values on hover. Recessive grid.
5. **Cohort retention.** A table, not a chart: cohort week down the left, then Size, W+1,
   W+2, W+3. Each retention cell shows the count and the percentage as text, with a
   sequential single-hue background tint keyed to the percentage. Because three of the
   tint steps sit below 3:1 against the surface, the number stays visible as text in every
   cell; the tint is a secondary encoding only.
6. **Content contributions.** A plain six-row table of counts. No chart. Six numbers do
   not need one.

**Color, exactly.** Define the roles as CSS custom properties in one block at the top of
the client component, then reference them by role, so the light and dark values swap in
one place:

- Funnel bars and the sequential cohort tint: one hue, the Linestry accent
  (`--accent`, `#3B82F6`), stepped by opacity for the tint.
- Daily series, two categorical slots, taken as a validated adjacent PAIR:
  series 1 `#2a78d6` light / `#3987e5` dark, series 2 `#eb6834` light / `#d95926` dark.
  Do not substitute the brand blue into the two-series chart without re-validating the
  pair; the pair, not the individual hue, is what passes the colorblind separation gate.
- All text stays on the existing text tokens (`text-foreground`, `text-muted`). Never
  color a number with its series hue; put a small colored mark beside it instead.
- Dark mode: declare the dark values under both `@media (prefers-color-scheme: dark)` with
  a `:root:not([data-theme="light"])` guard AND `:root[data-theme="dark"]`, so the theme
  toggle wins in both directions.

**Empty and thin states.** Every number on this page can legitimately be zero. A zero
funnel step renders as a zero-width bar with the label still present, never as a missing
row. A window with no days renders "No events in this window" and keeps the chrome. This
matters more than usual: at current volume the 7-day view will often be nearly empty, and
an empty state that looks like a broken page will get the tool abandoned.

### T7: the link from `/admin`

Add one `<Link>` chip to `src/app/admin/page.tsx` in the header row, immediately after the
Activity chip at `:1866-1874`. Same wrapper (`{membership.is_editor && (...)}`), same
class string, emoji and label of the builder's choosing. Do not restructure the row.

---

## 7. Surface pairing (playbook check 12)

| Endpoint or emitter | UI trigger | Affordance the user or founder sees |
|---|---|---|
| `member_activated` (event, `src/lib/activation.ts`) | Member posts their qualifying story, or their return visit lands | Nothing member-facing by design. It surfaces as the Activated tile and the final funnel bar on `/admin/funnel`. |
| `member_returned` (event, `GET /api/me`) | First `/api/me` load of a UTC day, after signup day | Nothing member-facing. Surfaces as the Returned tile, funnel step 7, and the Activity tail. |
| `props.bot` stamp (`POST /api/track/event`) | Any client `trackEvent` from a bot user-agent | Surfaces as rows excluded from every scoreboard number, and as the "excluded" line under the header. |
| `GET /api/admin/funnel?days=30` | `/admin/funnel` page load, and the 7 / 30 / 90 buttons | The whole scoreboard: KPI row, funnel, daily series, cohorts, contributions. |
| `analytics_funnel_summary` RPC | Called by the route above | Funnel bars, KPI row, daily series, contributions table. |
| `analytics_cohort_retention` RPC | Called by the route above | Cohort retention table. |
| `/admin/funnel` | The new chip in the `/admin` header, beside Activity | The one page the weekly read opens. |
| `distinct_id` column | Every `captureServerEvent` write | Makes funnel steps 1 to 3 count people instead of page loads. Also appears nowhere in the UI, deliberately: it is an identity key and it stays out of the Activity Details column. |

---

## 8. Acceptance criteria

**A1.** `npx tsc --noEmit` is clean. `npm run lint` is clean.

**A2.** A brand-new test account that signs up, posts one story on signup day, and does
nothing else has NO `member_activated` row. Condition B is unmet.

**A3.** That same account, loaded the next UTC day, produces exactly one `member_returned`
row with `props.day_index = 1`, and exactly one `member_activated` row with
`props.trigger = "return"` and `props.days_to_activate = 1`.

**A4.** A test account that returns on a later day FIRST and posts its first story
SECOND produces exactly one `member_activated` row with `props.trigger = "story"`. The
definition is order-independent.

**A5.** Loading `/api/me` five times in one day produces at most one `member_returned` row
for that day, and never one on signup day.

**A6.** Posting a second, third and fourth story produces no additional
`member_activated` row.
`select actor_id, count(*) from analytics_events where event = 'member_activated'
group by 1 having count(*) > 1` returns zero rows.

**A7.** Attempting a deliberate duplicate insert of `member_activated` for an
already-activated actor fails at the unique index, is swallowed, and does not surface an
error to the caller. The story POST still returns 201.

**A8.** Every new `analytics_events` row written after the migration has a non-null
`distinct_id`. Rows written before it are null and are not backfilled.

**A9.** `/admin/funnel` renders for an `is_editor` account. An authenticated non-editor is
redirected to `/admin`. An anonymous visitor is redirected to `/onboarding`. Verified for
both the page and `GET /api/admin/funnel` (which returns 403 and 401 respectively).

**A10.** Switching the window between 7, 30 and 90 changes every number on the page and
updates the URL, and the chosen window survives a page reload.

**A11.** The funnel shows eight steps with unique-actor (or unique-`distinct_id`) counts
and a step-to-step percentage on each. Every percentage is computed against the step above
it, not against step 1, and the page says so.

**A12.** The cohort table shows at least one cohort from before June 2 2026 with a real
W+1 number, proving the retention view is retroactive over durable state (D11). If the
product has no members from before that date, the criterion is met by showing the oldest
cohort that exists with a non-null W+1.

**A13.** Every number on the page excludes the ids in `EXCLUDED_ACTOR_IDS` and every row
stamped `props.bot`. Verified by adding a test id to the constant, reloading, and watching
the counts drop by the expected amount.

**A14.** A dev-server run with the window set to 90 days renders `/admin/funnel` in under
two seconds from a cold load, and the network tab shows exactly one call to
`/api/admin/funnel`.

**A15.** The page renders correctly in both light and dark theme, at 375px width with no
horizontal body scroll, and with all four visuals legible. The daily-series chart has a
legend and both lines are direct-labeled.

**A16.** `/admin/activity` is unchanged: same columns, same filters, same counts. It now
also happens to show the two new events in its tail, which is the only expected
difference.

---

## 9. Migration

**There IS a migration.** One file:
`supabase/migrations/20260904000001_activation_retention_scoreboard.sql`.

**Gate classification: SAFE.** Every statement is additive: one ADD COLUMN, one CREATE
INDEX, two CREATE FUNCTIONs, two REVOKEs. Nothing is dropped, truncated, renamed or
retyped. No existing row is updated or deleted. **No statement touches `profiles`**, which
is what keeps this out of the GATED lane (the risk gate treats any SQL against `profiles`
as GATED because it carries the membership, Stripe and token columns). The session applies
this itself via the Supabase MCP and does not wait for Jay.

**Ordering: migrate FIRST, then merge. This is a HARD pre-merge gate.** T4 makes
`captureServerEvent` send `distinct_id` on every insert. In the window between the PR
merging and the migration landing, PostgREST returns PGRST204 for the unknown column on
every event write, and because `captureServerEvent` swallows every error (F5), the failure
is completely silent: the app keeps working, and every analytics event in that window
vanishes with no log line. That is worse than a 500, because nobody would notice. Apply
the migration before the merge.

**Pre-flight (run these first, confirm the expected results, then apply).**

```sql
-- 1. The column does not exist yet. Expect 0 rows.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'analytics_events'
  and column_name = 'distinct_id';

-- 2. No actor has more than one member_activated row already. Expect 0 rows.
--    (The unique index below would fail to build if this returned anything.)
select actor_id, count(*) from public.analytics_events
where event = 'member_activated' and actor_id is not null
group by 1 having count(*) > 1;

-- 3. Nothing already uses a props.bot key. Expect 0. (AUDIT item A4.)
select count(*) from public.analytics_events where props ? 'bot';

-- 4. Size the table, so section 10's performance answer is real, not assumed.
--    (AUDIT item A2.)
select count(*) as total,
       count(*) filter (where created_at > now() - interval '90 days') as last_90d
from public.analytics_events;

-- 5. Orphan auth users. Expect 0. (AUDIT item A3.)
select count(*) from auth.users u
left join public.profiles p on p.id = u.id where p.id is null;
```

**The migration.**

```sql
-- ============================================================================
-- Activation, retention, and the funnel scoreboard
-- ============================================================================
-- Additive only. No DROP, no UPDATE, no DELETE, nothing against profiles.
-- Idempotent: safe to re-run.
--
-- 1. distinct_id lets the durable log count PEOPLE, not page loads, for the
--    pre-auth funnel steps where actor_id is always null.
-- 2. The partial unique index is the idempotency guarantee for member_activated.
--    captureServerEvent swallows insert errors, so a duplicate attempt fails at
--    the constraint and disappears. Exactly one row per member, no locks.
-- 3. Two read-only aggregate functions. Called only by the service-role client
--    from /api/admin/funnel, so EXECUTE is revoked from anon and authenticated.

-- ── 1. Identity for anonymous events ────────────────────────────────────────

alter table public.analytics_events
  add column if not exists distinct_id text;

-- ── 2. Exactly-once activation ──────────────────────────────────────────────

create unique index if not exists analytics_events_one_activation_per_actor
  on public.analytics_events (actor_id)
  where event = 'member_activated' and actor_id is not null;

-- ── 3. Funnel summary ───────────────────────────────────────────────────────
-- pseudocode-tagged in the brief: verify column names against the live table
-- before trusting the first run.

create or replace function public.analytics_funnel_summary(
  p_since   timestamptz,
  p_until   timestamptz,
  p_exclude uuid[] default '{}'
)
returns jsonb
language sql
stable
as $$
with ev as (
  select e.created_at, e.event, e.actor_id, e.distinct_id
  from public.analytics_events e
  where e.created_at >= p_since
    and e.created_at <  p_until
    and coalesce((e.props->>'bot')::boolean, false) = false
    and (e.actor_id is null or not (e.actor_id = any(p_exclude)))
),
steps as (
  select
    count(distinct distinct_id) filter (where event = 'ftue_landed')      as landed,
    count(distinct distinct_id) filter (where event = 'ftue_aha_shown')   as aha,
    count(distinct distinct_id) filter (where event = 'ftue_save_shown')  as save_shown,
    count(distinct actor_id)    filter (where event = 'signup_succeeded') as signed_up,
    count(distinct actor_id)    filter (where event = 'ftue_completed')   as onboarded,
    count(distinct actor_id)    filter (where event = 'story_created')    as posted_story,
    count(distinct actor_id)    filter (where event = 'member_returned')  as returned,
    count(distinct actor_id)    filter (where event = 'member_activated') as activated
  from ev
),
daily as (
  select
    (created_at at time zone 'UTC')::date                              as day,
    count(distinct actor_id) filter (where event = 'signup_succeeded') as signups,
    count(distinct actor_id) filter (where event = 'member_activated') as activations
  from ev
  where event in ('signup_succeeded', 'member_activated')
  group by 1
),
content as (
  select
    count(*) filter (where event = 'story_created')          as stories,
    count(*) filter (where event = 'claim_created')          as claims,
    count(*) filter (where event = 'riding_day_created')     as riding_days,
    count(*) filter (where event = 'story_comment_added')    as comments,
    count(*) filter (where event = 'story_reaction_set')     as reactions,
    count(*) filter (where event = 'story_connection_added') as connections
  from ev
)
select jsonb_build_object(
  'since',   p_since,
  'until',   p_until,
  'steps',   (select to_jsonb(s) from steps s),
  'daily',   coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily d), '[]'::jsonb),
  'content', (select to_jsonb(c) from content c)
);
$$;

-- ── 4. Weekly cohort retention ──────────────────────────────────────────────
-- Built entirely from durable state (profiles + token_events), so it works
-- retroactively over the whole history of the product, including the period
-- before analytics_events existed.

create or replace function public.analytics_cohort_retention(
  p_weeks   int default 8,
  p_exclude uuid[] default '{}'
)
returns jsonb
language sql
stable
as $$
with cohort as (
  select
    p.id,
    date_trunc('week', p.created_at at time zone 'UTC')::date as cohort_week,
    (p.created_at at time zone 'UTC')::date                   as signup_day
  from public.profiles p
  where p.created_at >= date_trunc('week', now() at time zone 'UTC')
                        - ((p_weeks)::text || ' weeks')::interval
    and coalesce(p.is_archived, false) = false
    and not (p.id = any(p_exclude))
),
visits as (
  select
    c.id,
    c.cohort_week,
    (((t.created_at at time zone 'UTC')::date - c.signup_day) / 7)::int as week_offset
  from cohort c
  join public.token_events t
    on t.user_id = c.id
   and t.source  = 'daily_visit'
)
select coalesce(jsonb_agg(r order by r->>'cohort_week' desc), '[]'::jsonb)
from (
  select jsonb_build_object(
    'cohort_week', c.cohort_week,
    'size',        count(distinct c.id),
    'w1',          count(distinct v.id) filter (where v.week_offset = 1),
    'w2',          count(distinct v.id) filter (where v.week_offset = 2),
    'w3',          count(distinct v.id) filter (where v.week_offset = 3)
  ) as r
  from cohort c
  left join visits v on v.id = c.id
  group by c.cohort_week
) rows;
$$;

-- ── 5. Service-role only ────────────────────────────────────────────────────

revoke execute on function public.analytics_funnel_summary(timestamptz, timestamptz, uuid[])
  from anon, authenticated;
revoke execute on function public.analytics_cohort_retention(int, uuid[])
  from anon, authenticated;
```

**Post-apply verification (playbook check 19 for the two functions).**

```sql
-- Column landed, nullable, text.
select column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'analytics_events'
  and column_name = 'distinct_id';

-- Partial unique index landed with the right predicate.
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'analytics_events'
  and indexname = 'analytics_events_one_activation_per_actor';

-- Both function bodies are what we think they are (playbook check 19).
select pg_get_functiondef('public.analytics_funnel_summary(timestamptz,timestamptz,uuid[])'::regprocedure);
select pg_get_functiondef('public.analytics_cohort_retention(int,uuid[])'::regprocedure);

-- Both run and return shaped jsonb.
select public.analytics_funnel_summary(now() - interval '30 days', now(), '{}');
select public.analytics_cohort_retention(8, '{}');

-- Grants are gone for the public roles.
select grantee, privilege_type from information_schema.routine_privileges
where routine_schema = 'public' and routine_name in
  ('analytics_funnel_summary', 'analytics_cohort_retention');
```

---

## 10. Risks and gotchas

**1. The silent-write hazard is the whole reason for migrate-before-merge.** Repeated
because it is the one thing that would cost real data:
`captureServerEvent` swallows every error (F5), so an unknown `distinct_id` column does not
produce a 500, a log line, or a Sentry event. It produces a period of perfect silence in
the analytics log. Apply the migration first.

**2. `count(distinct actor_id)` is fast enough here, and here is the number where it
stops.** The funnel query is a range scan on `analytics_events_created_at_idx` (F2)
followed by a hash aggregate. The jsonb `props` column is only touched for the `bot`
predicate, and never deserialised into a group key, so the jsonb costs almost nothing. On
Postgres, this shape runs comfortably to a few million rows in the window: expect single
digit milliseconds at 10k rows, tens of milliseconds at 100k, and a few hundred
milliseconds at 1M. At current volume (AUDIT A2, but on the order of thousands of rows
total for the whole life of the table) it is free.

The point at which it stops being free is roughly **2 million rows inside a single
window**, where the hash aggregate starts spilling and the 90-day view crosses a second.
Two things happen well before that and are the real triggers: the `filter (where event =
...)` clauses all scan the same window eight times over, so once the 90-day window exceeds
about 500k rows it is worth adding an index on `(event, created_at desc)`; and once
`/admin/funnel` is loaded by more than one person a day, the answer is a materialised
daily rollup rather than a live query. Both are section 14 follow-ups, neither is this
session.

**3. Two identity spaces meet at funnel step 3 to 4.** Steps 1 to 3 count anonymous
browsers by `distinct_id`; steps 4 to 8 count members by `actor_id`. One person can be
several `distinct_id`s (two devices, a cleared cookie) and, rarely, one `distinct_id` can
be several members (a shared laptop). PostHog's `identify` call at
`src/app/auth/complete/page.tsx:36` stitches them on PostHog's side but not in
`analytics_events`. So the step 3 to step 4 conversion rate is an estimate. The page must
say so in one line (T6, item 3). Do not attempt to stitch the two spaces in this session.

**4. Bot filtering only works forward.** The stamp lands at write time, so every row
written before this ships is unstamped and therefore counted. The 30-day default window
means that within a month of shipping, the default view is clean. Until then the page
carries the instrumentation note. Do not backfill; there is no user-agent stored to
backfill from.

**5. The activation definition will look wrong for the first week.** `member_activated`
fires going forward only. Every existing member who already meets the definition will be
missing from the funnel until they next post a story or return, at which point the check
runs and fires. That is a feature (it is a real signal of a live member) but it will read
as "the number is too low" on day one. Say so in the PR description so it does not get
"fixed."

Note the subtlety: because the check runs on both arms and reads durable state, an
existing long-time member who simply loads the app on a later day WILL activate on that
load, retroactively-ish. So the number self-heals for active members within a few days and
never heals for dormant ones, which is exactly the desired behaviour.

**6. `props.bot` is a jsonb predicate on every scoreboard row.** It is cheap at current
volume and it is not indexed. If AUDIT A2 comes back with more than a few hundred thousand
rows, add `create index ... on analytics_events ((props->>'bot'))` in the same migration
rather than after.

**7. Three briefs touch the analytics layer this week.** `funnel-event-completion-brief.md`
edits `src/lib/analytics-server.ts`, the track routes, and
`src/app/auth/complete/page.tsx`. `funnel-attribution-brief.md` adds tables and stamps four
call sites. This brief edits `analytics-server.ts` (one line), `/api/track/event` (the bot
stamp), `/api/me`, and `/api/stories`. Build them one at a time on top of `main` and rebase
rather than running two branches in parallel. If the event-completion brief ships first,
its shared `src/lib/track-server.ts` helper is where the bot stamp belongs instead; check
for that file before editing the route.

**8. The `/api/me` read ordering.** T2 depends on the profile select happening after the
`award_daily_visit` RPC, which it does today (`:33` then `:45`). If a future refactor
reorders them, the return arm reads a stale `last_visit_award_date` and stops activating
people, silently. Leave a one-line comment at the RPC call saying the ordering is
load-bearing.

**9. Do not put `distinct_id` in the Activity Details column.** It is an identity key. The
Activity table renders `props` verbatim (`activity-client.tsx:64-72`), and `distinct_id`
is a column, not a prop, so it will not appear by accident. Keep it that way.

**10. The empty-state trap.** At current volume the 7-day view will frequently show zeros
across the board. If that renders as a blank page it will read as broken and the habit will
not form. Every zero must render as a labelled zero. This is a real product risk, not a
polish note.

---

## 11. Rollback

The activation and return events are additive and inert: nothing reads them except the new
page, and nothing in the member experience changes. So rollback is graded, and the
migration never needs reversing.

**To roll back the UI only:** revert the PR. `/admin/funnel` and the `/admin` chip
disappear. The column, the index and the two functions stay in place, unused and harmless.
Events already written stay written.

**To stop the new events without a deploy:** there is no flag, deliberately (a flag for two
fire-and-forget captures is more machinery than the thing it guards). Comment out the two
`maybeMarkActivated` calls and the `member_returned` capture, and ship. Three lines.

**To reverse the migration** (only if something unforeseen appears, and note this is the
one destructive step in the whole session, so it is GATED like any other DROP):

```sql
drop function if exists public.analytics_cohort_retention(int, uuid[]);
drop function if exists public.analytics_funnel_summary(timestamptz, timestamptz, uuid[]);
drop index if exists public.analytics_events_one_activation_per_actor;
-- Dropping the column loses the identity keys captured since the ship. Prefer
-- leaving it in place; it is nullable and costs nothing.
-- alter table public.analytics_events drop column if exists distinct_id;
```

**The one ordering trap in rollback:** if the migration is reversed while the code is still
deployed, every analytics write starts failing silently again (risk 1, in reverse). Revert
the code FIRST, then the migration, never the other way around.

---

## 12. Suggested order

The activating change goes last, per the standing pattern.

1. **Pre-flight reads.** Whole-file reads of `src/lib/analytics-server.ts`,
   `src/app/api/me/route.ts`, `src/app/api/track/event/route.ts`, and the three
   `/admin/activity` files. Confirm F3 to F9 and F14 to F17 against the tree, since the
   tree has moved since this brief was drafted.
2. **Run the section 9 pre-flight SQL.** Record the answers to AUDIT A1 to A5. If
   pre-flight query 2 returns rows, stop: the unique index will not build and the
   duplicates need explaining first.
3. **Apply the migration** via the Supabase MCP. Run the post-apply verification block.
   Both functions should already return valid jsonb over the existing data, with the
   funnel steps mostly zero (no `distinct_id` on historical rows) and the cohort table
   fully populated (durable state). That contrast is itself a good sanity check.
4. **T4, the column write and the bot stamp.** One line in `analytics-server.ts`, one type
   change, the sink stamp. Smoke: fire any client event, confirm the new row has a
   `distinct_id`.
5. **T5 is already applied** in step 3. Nothing to do.
6. **T1, the activation helper.** Write it with no call sites yet. It is dead code at this
   point and cannot break anything.
7. **T6, the scoreboard and its route.** Build it against the live functions. At this
   stage the funnel's last three steps read zero, which is correct and expected. Everything
   else, including the cohort table, is real.
8. **T7, the `/admin` chip.**
9. **T2 and T3, the two call sites. THIS IS THE ACTIVATING FLIP.** Wiring these two lines
   is the moment the new events start flowing. Do it last so that if anything is wrong,
   exactly two lines revert it.
10. **Smoke the full section 8 list.** A3 and A4 need a UTC day boundary, so either wait
    for one or fake it by adjusting a test account's `profiles.created_at` backwards in a
    scratch record. Do NOT adjust a real member's row.

---

## 13. Ship sequence

Per the repo `CLAUDE.md` standing rule. There IS a migration and it is a hard pre-merge
gate, so the order is not negotiable.

1. Build through step 8 of section 12, push the branch, open the PR. State the PR number.
2. **Classify:** one migration,
   `supabase/migrations/20260904000001_activation_retention_scoreboard.sql`. **SAFE**
   (additive only: ADD COLUMN, CREATE INDEX, two CREATE FUNCTION, two REVOKE; nothing
   destructive; nothing against `profiles`). Apply it yourself.
3. **Apply the migration BEFORE merging.** Hard gate: `captureServerEvent` sends
   `distinct_id` unconditionally, and a missing column produces silent data loss, not an
   error. Print the applied SQL in full in a fenced sql block for the record, then run the
   post-apply verification block and paste the results.
4. Complete section 12 steps 9 and 10 (the activating flip and the smoke pass).
5. `npx tsc --noEmit` clean, `npm run lint` clean.
6. **Merge the PR yourself** with `gh pr merge`. None of the exceptions apply: this session
   touches no payments, no auth flow, and no data-deletion path, and the migration is SAFE.
   Confirm in chat that you merged and that Vercel will auto-deploy `main`.
7. Append one entry to `bugs/SHIP-LOG.md` using the schema at the top of that file, with
   the real PR number, `migration:` naming the applied file, and `status: merged`.
8. After the deploy settles, load `/admin/funnel` on production as an editor and confirm
   the cohort table is populated from real history. Tell Jay the page exists, what the
   activation definition is in one sentence, and that the funnel's last three steps will
   read low for about a week while the new events accumulate (risk 5).

---

## 14. Follow-ups, NOT this session

- **Review the activation definition against real data**, once there are at least 20
  activated members. The two questions to ask then: does one story plus one return
  actually predict a member who is still here at day 30, and should the bar move to three
  stories or two return days. Put a date on it rather than leaving it open.
- **A weekly digest email or scheduled task** that posts the scoreboard numbers to Jay
  every Monday, so even the one-click read becomes zero-click (D12). It needs the
  suppression check in `email_suppressions` and a scheduler; that is its own small brief.
- **Per-step drill-down**: click a funnel step, see the members in it. The natural next
  click and a genuinely useful one, with a privacy conversation attached because it is a
  list of named people bucketed by behaviour.
- **Acquisition breakdown on the scoreboard.** Once `funnel-attribution-brief.md` ships its
  `acquisition` table, the funnel can split by source ("of the people who arrived from the
  FNRad link, how many activated"). That is the single highest-value addition to this page
  and it is blocked only on that brief.
- **Fix the `/admin/activity` 24h count truncation** (F4): the strip silently under-reports
  past 1000 events in a day. A `head: true, count: "exact"` request or a grouped RPC fixes
  it in a few lines.
- **A `profiles.activated_at` column**, if the derived activation query ever becomes
  annoying to write elsewhere (D2's rejected alternative). GATED migration; only worth it
  if a second surface needs the flag.
- **Materialised daily rollup** for `analytics_events`, when the 90-day window crosses
  roughly 500k rows (risk 2). Also the moment to add `(event, created_at desc)`.
- **Retire `first_three_stories_completed` as a measurement**, keeping it as the
  celebration trigger it actually is (F13). It is currently the only thing that looks like
  an activation event and it will confuse whoever reads the event list next. A comment at
  the call site saying "celebration trigger, not a measurement; see member_activated" is
  enough.
- **Stitch `distinct_id` to `actor_id` at signup**, writing an identity-alias row so the
  step 3 to 4 conversion becomes exact rather than approximate (risk 3).

---

SHIP-LOG line for this session:

```
type: feature
ids: none
scope: activation-retention-scoreboard
```
