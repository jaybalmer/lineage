# Funnel Event Completion

> Cowork-authored feature brief, September 4 2026. Self-contained. ~5 to 7 hr, ONE PR,
> NO migration (see section 9 for the one thing that would trigger one). This closes the
> holes in the analytics event vocabulary that Linestry already has. It does NOT rebuild
> the analytics layer: the dual-sink substrate (PostHog plus the durable `analytics_events`
> table) is good and stays exactly as it is.
> Playbook subset run: checks 1, 2, 6, 7, 10, 11, 12, 20, 21, 22. Checks 3, 4, 5, 8, 9,
> 13, 14, 15, 16, 17, 18, 19, 23, 24 are not applicable (no migration, no backfill, no
> view rebuild, no plpgsql function, no catalog operation, no cross-user state model, no
> moderation terminology).

---

## DECISIONS (review before building)

Every decision has a shippable default. Build the defaults unless Jay says otherwise.

**D1. Collapse the five duplicated local `trackEvent` helpers into ONE shared server helper, and keep the HTTP hop. DEFAULT: yes.**
Five route files each define a byte-identical private `trackEvent(origin, event, props)`
that POSTs to `/api/track/claim-event` (F4). That duplication is why the actor id was
never added in one place: there was no one place. A new `src/lib/track-server.ts` exports
one helper that all five import.
Alternative: have those routes import `captureServerEvent` directly and skip the self-fetch
entirely. Rejected because `captureServerEvent` awaits a PostHog flush plus a database
insert, so a direct call either sits on the user's request path adding latency, or floats
un-awaited and gets truncated when the serverless function returns. The self-fetch is
deliberate: it moves capture off the critical path into its own invocation. Keep it.
(D5 is the one place we do call directly, for a reason stated there.)

**D2. All three under-fed sinks accept `distinct_id`, `occurred_at`, and an explicit `actor_id`. DEFAULT: yes, all three.**
Today only `/api/track/event` reads those fields (F1, F3). Every invite, claim, and
redirect event therefore lands in PostHog under the shared `"anonymous"` distinct id with
the server's capture time instead of the event time. That means: those events cannot join
a funnel with the client events, and strict-order funnels can invert. Two lines per route.
Alternative: only fix `claim-event`. Rejected: `invite-event` is the growth loop and is the
one Jay will most want to funnel on.

**D3. `claim_node_invited` and `claim_node_requested` are re-categorised from `moderation` to `invite`. DEFAULT: yes, via a per-event category map inside the claim sink.**
Both are growth events. They are filed under `moderation` only because they happen to share
a sink that hardcodes `category: "moderation"` (F5). That makes the `/admin/activity`
moderation count wrong and hides both events from any invite-category rollup.
Alternative: leave them and remember the quirk. Rejected: an event registry that lies is
worse than no registry. Historical rows keep the old category; the doc says so.

**D4. Commerce events ride the existing `content` category with `props.domain = "commerce"`. NO migration. DEFAULT: yes.**
Adding a real `commerce` category means a CHECK-constraint swap on `analytics_events`, plus
edits in three more places that hardcode the seven values (F12, F12a). The failure mode is
nasty: `captureServerEvent` swallows everything, so if the write lands before the
constraint change the row is dropped SILENTLY, with a green PostHog event and no database
row. `captureServerError` already sets the precedent of recording the real domain in
`props.domain` while the stored category is fixed. Use the same shape.
Alternative: add the `commerce` category now. Rejected as the more expensive path for this
session; logged in section 14 as a clean follow-up once the events have proven useful.

**D5. Wire the dormant invite telemetry by calling `captureServerEvent` directly from `invite-tracking-server.ts`, and DELETE the two dead HTTP helpers. DEFAULT: yes.**
`trackInviteEventServer` and `trackInviteErrorServer` have zero callers repo-wide (F6). The
reason they were never wired is that they need an absolute `origin`, and the function that
should fire them, `maybeFireThresholdNotification`, takes only a person id and is called
from five places that would all have to thread an origin through. A direct call needs
nothing threaded. The D1 latency argument does not apply here: this function is already
awaiting a database round trip and a Resend send, so one more await is noise.
Alternative: delete the helpers and never fire the events. Rejected: the threshold email is
the ambient growth loop, and it currently sends with no record that it sent.

**D6. The returning-user case gets a new always-firing `auth_complete_landed`. `ftue_completed` and `signup_succeeded` stay gated on new profiles. DEFAULT: yes.**
Both events fire only inside `if (!existingProfile)` (F9), and that gate is correct: firing
`ftue_completed` for a returning member would inflate the last step of the FTUE funnel,
which is exactly what the code comment there says. The real hole is that nothing at all
fires for a returning member, so `/auth/complete` has no denominator. One new unconditional
event with an `is_new_account` flag fixes the denominator without touching either existing
funnel definition in PostHog.
Alternative: fire `ftue_completed` for everyone with a `returning: true` prop. Rejected:
it silently changes the meaning of an event Jay already has dashboards on.

**D7. The pageview fix is `capture_pageview: "history_change"`, not a custom route handler. DEFAULT: yes.**
posthog-js 1.378.1 ships a `HistoryAutocapture` extension driven by exactly this config
value (F15a). One word. A hand-rolled `usePathname` effect would need `capture_pageview:
false` plus first-load handling plus a Suspense boundary for `useSearchParams`, which is
three chances to double-count or to break a build.
Alternative: custom handler. Rejected as more code for the same outcome.

**D8. `posthog.reset()` on sign out. DEFAULT: yes.**
There is exactly one sign-out call site (F16). Without the reset, the next person to use a
shared or public machine inherits the previous member's distinct id and person profile.
That is both a data-quality problem and a privacy one.

**D9. NO PostHog reverse proxy this session. DEFAULT: no.**
The client sink is a same-origin POST to `/api/track/*` (F1), so a blocker that kills
`posthog.com` does not kill it. A blocker with a generic `/api/track` rule would, and the
symptom is invisible: server events keep flowing so the dashboard looks alive. A rewrite in
`next.config.ts` would change the ingest path for every event at once and cannot be
verified without a production deploy. Wrong thing to bundle into a PR whose whole point is
trusting the numbers again.
Alternative: add the rewrite now. Rejected; logged in section 14 with the measurement that
would justify it.

**D10. Commit a `.env.example`, and add a `!.env.example` negation to `.gitignore`. DEFAULT: yes.**
The repo has no `.env*` file except the local, ignored `.env.local` (F17). `.gitignore`
line 34 is a bare `.env*`, so a new `.env.example` is invisible to git unless the negation
is added. Without it, `NEXT_PUBLIC_POSTHOG_KEY` can go missing on a new deploy target and
every single capture becomes a silent no-op, because both `instrumentation-client.ts` and
`analytics-server.ts` guard on the key and degrade to nothing.
Alternative: a README section. Rejected: nobody diffs a README against their Vercel
environment variables.

**D11. `docs/analytics-events.md` ships in this same PR, generated from section 7. DEFAULT: yes.**
The taxonomy currently lives only in code comments spread across six files. The registry in
section 7 is the reference doc; writing it to `docs/` is a copy-paste, and doing it in a
later session means it never happens.

**D12. First-story activation is a PROP on `story_created`, not a separate event. DEFAULT: `is_first` plus `story_ordinal`.**
PostHog funnel steps filter on properties, so `story_created where is_first = true` works as
a funnel step. A prop also gives the second and third story for free, which is what the
existing `first_three_stories_completed` celebration is about. Cost is one count query per
story insert.
Alternative: a distinct `first_story_created` event. Rejected as a second name for the same
thing, and it cannot answer "how many people got to story three".

**D13. The public timeline share event is a NEW name, `share_clicked`. `share_link_copied` is untouched. DEFAULT: yes.**
The stack header tries `navigator.share` first and falls back to clipboard (F14a), so
"copied" is not always true. `share_clicked` fires once at the top of the handler with a
`method` prop. The existing `share_link_copied` on the help-connect card keeps its exact
current meaning.

---

## 1. Why this, why now

Linestry has a working analytics layer. Two sinks, one code path: every product event goes
to PostHog for funnels and to an `analytics_events` row for a durable, queryable record
that survives PostHog retention and is visible at `/admin/activity`. The design is right
and this brief does not touch it.

What is wrong is the vocabulary. The June funnel data (165 unique visitors, 34 onboarding
landings, 11 aha, 2 signups) is the number Jay is now trying to move, and the events needed
to explain the drop between those steps do not exist. Specifically:

- There is no event for the two onboarding steps that ask the user to type something. Those
  are the likeliest abandon points and they are the only two steps that emit nothing.
- There is no event for a magic link being sent, or for one being clicked. The single most
  common signup path in this product has an unmeasured gap in the middle of it, sitting
  across an email client where the user is most likely to be lost.
- There is no event for a successful sign-in, so returning-member activity is invisible.
- `/auth/complete` bounces to an error page after ten seconds of silence and fires nothing.
  Every one of its post-auth side effects is caught and logged to a console nobody reads.
- Client-side navigations fire no `$pageview`, so every top-of-funnel page number understates
  by an unknown amount.
- Three of the five capture sinks drop the fields that make funnels work, so invite, claim
  and redirect events cannot be joined to the client events at all.

None of that requires new infrastructure. It is a vocabulary gap and a handful of dropped
fields, which is why this is one PR of small additions rather than a project.

The second-order value: after this session the event list is written down in `docs/`, which
means the next feature can add its events by pattern instead of by archaeology.

---

## 2. Prerequisites

1. Pull `main`. This brief was checked at `39f169d`.
2. `npm run dev` runs from the repo you are building in, which is the same `~/lineage`
   working copy. Stop any pre-existing dev server first so port 3000 binds to this
   instance. (Playbook check 20. A previous session lost ten minutes to this.)
3. `.env.local` must carry `NEXT_PUBLIC_POSTHOG_KEY`, or every capture in this session is a
   silent no-op and you will believe your own code is broken. Confirm with
   `grep -c NEXT_PUBLIC_POSTHOG_KEY .env.local` before you smoke anything.
4. Have PostHog open in a second tab, on the Live Events view, filtered to your own distinct
   id. Most acceptance criteria in section 8 are "the event arrives with the right props",
   and reading them off the live stream is much faster than querying afterwards.

---

## 3. Scope

**Part A, fix the sinks.** Make `/api/track/claim-event`, `/api/track/invite-event` and
`/api/track/node-redirect` accept `distinct_id`, `occurred_at` and `actor_id`. Extract one
shared `src/lib/track-server.ts` helper and replace the five duplicated local ones. Pass a
real actor from all eight claim call sites. Re-categorise the two growth events.

**Part B, auth and FTUE events.** Step-shown events for the `name` and `year` steps.
`magic_link_sent`, `magic_link_clicked`, `signin_succeeded`, `signin_failed`,
`auth_complete_landed`, `auth_complete_failed` with a reason, `oauth_callback_failed`.
Extract `signupErrorClass` so the sign-in surface can bucket its errors the same way the
signup surface already does.

**Part C, activation and loop closing.** `is_first` and `story_ordinal` props on
`story_created`. `invite_accepted` on the three invite completion routes. `share_clicked` on
the public timeline stack header. Wire the dormant threshold telemetry.

**Part D, capture correctness.** `capture_pageview: "history_change"`.
`posthog.reset()` on sign out.

**Part E, commerce.** Six events across checkout, portal, webhook and gift redemption,
riding the `content` category with `props.domain = "commerce"` per D4.

**Part F, documentation.** `docs/analytics-events.md` and `.env.example` plus the
`.gitignore` negation.

---

## 4. Out of scope (hard list)

Do not build these. Each one is a real idea and each one belongs to a different session.

- Any change to `captureServerEvent` or `captureServerError` beyond what they already do.
  The dual-sink design is correct. Do not add batching, do not add a queue, do not change
  the swallow-everything contract.
- A `commerce` category and its migration. See D4 and section 14.
- A PostHog reverse proxy rewrite in `next.config.ts`. See D9.
- Any new analytics UI. `/admin/activity` renders whatever categories exist and needs no
  edit under D4.
- Server-side `$pageview` capture, or middleware-level page tracking.
- Session replay configuration, sampling, or masking changes.
- Deleting `/api/track/claim-event` even though under D1 its only callers are internal. It
  stays, and it stays fixed.
- Backfilling or rewriting historical `analytics_events` rows to the new categories. History
  keeps the category it was written with; the doc records the change date.
- Retiring the four `InviteErrorTag` values that still have no call site after this session
  (`invite_resend_failed`, `invite_db_insert_failed`, `invite_target_not_claimable`,
  `threshold_notification_dedup_violation`). Leave them declared with a comment. Pruning
  them is a judgement call about `/api/invite` error handling that this session has not
  audited.
- Adding events to `/api/founding`. It is a read-only GET that lists founding members
  (F12b). The premise that it is a commerce write path is wrong.
- Any onboarding copy, layout, or step-order change. This session adds two `trackEvent`
  lines to `onboarding-flow.tsx` and changes nothing a user can see.

---

## 5. Verified facts (checked against `main` at `39f169d`, September 4 2026)

Every fact below was re-derived from the tree in this session. Provenance is given so the
build session does not repeat the reads. Anything tagged `AUDIT` was not verifiable from
the source alone.

**F1. The client helper already does this correctly, and its comments say why.**
`src/lib/analytics.ts:23-48`. `trackEvent(category, event, props, opts)` POSTs
`{category, event, props, actor_id, distinct_id, occurred_at}` to `/api/track/event`.
`distinct_id` comes from `posthog.get_distinct_id()` via a guarded helper at lines 14-21.
`occurred_at` is stamped at call time (line 34) and the comment at lines 29-33 explains it:
two fire-and-forget POSTs get the server's capture time and can invert, which zeroes out
the final step of a strict-order funnel. Read those comments before you touch anything;
they are the design rationale for all of Part A. `identifyUser` is at line 66.

**F2. The server sink is the single writer.** `src/lib/analytics-server.ts:63-98`,
`captureServerEvent` captures to PostHog (posthog-node) and inserts an `analytics_events`
row. `distinctId` falls back `distinctId || actorId || "anonymous"` at line 69, which is the
fact that makes Part A work for authenticated events: passing `actorId` alone is enough,
because `identifyUser(user.id)` at `src/app/auth/complete/page.tsx:36` makes the auth user
id the PostHog person id. `captureServerError` at lines 111-136 writes Sentry plus a row
with `category: "error"` and the real domain in `props.domain` (line 132). That is the
precedent D4 follows. Both functions swallow everything (lines 95, 134).

**F3. THE SINK INCONSISTENCY. Only one of the four event sinks reads the funnel fields.**
- `src/app/api/track/event/route.ts:17-19` reads `actor_id`, `distinct_id`, `occurred_at`.
- `src/app/api/track/claim-event/route.ts:19-24` passes `category: "moderation"` hardcoded,
  `props`, and `actorId` read from `props.actor_id`. No `distinctId`, no `occurredAt`.
- `src/app/api/track/invite-event/route.ts:22-34` reads `props.inviter_id` then
  `props.actor_id` for the actor. No `distinctId`, no `occurredAt`.
- `src/app/api/track/node-redirect/route.ts:19-27` passes only three props. No actor, no
  `distinctId`, no `occurredAt`.
Consequence, stated plainly: every invite, claim and redirect event in PostHog today sits
under the distinct id `"anonymous"` with the server's capture timestamp. They cannot be
joined to the client-side funnel and their ordering is unreliable.

**F4. `/api/track/claim-event` reads `props.actor_id`, and not one caller passes it.**
Five files POST to it, and each defines its own byte-identical private helper:
`src/app/api/claim-requests/route.ts:9`, `src/app/api/claim-requests/[id]/route.ts:16`,
`src/app/api/claim-requests/[id]/vouch/route.ts:13`,
`src/app/api/admin/invite-node/route.ts:10`,
`src/app/api/public/claim-node/route.ts:31`. Eight call sites across them:
`claim_requested` (route.ts:165), `claim_node_approved` ([id]/route.ts:193),
`claim_approved` ([id]/route.ts:278), `claim_status_changed` ([id]/route.ts:354 and
vouch/route.ts:164), `vouch_added` (vouch/route.ts:155), `claim_node_invited`
(invite-node/route.ts:164), `claim_node_requested` (claim-node/route.ts:178). None of the
eight props objects contains `actor_id`. The vouch site passes `voucher_id` (vouch:157),
which is the right value under the wrong key. So every claim, vouch and merge event in the
database has `actor_id` NULL and is anonymous in PostHog.

**F5. Category miscoding.** `src/app/api/track/claim-event/route.ts:20` hardcodes
`category: "moderation"` for every event through that sink, including
`claim_node_invited` (an editor inviting someone to claim a node) and
`claim_node_requested` (an anonymous visitor saying "that is me"). Both are growth events.

**F6. The invite server helpers are dead code, and seven declared events never fire.**
`src/lib/invite-tracking.ts:65` (`trackInviteEventServer`) and `:73`
(`trackInviteErrorServer`) have ZERO callers repo-wide. Confirmed by grep across `src/`:
the only hits are the definitions themselves. Consequence, cross-checked against the
declared vocabulary at lines 23-43: `tag_threshold_notification_sent`,
`invite_resend_failed`, `invite_db_insert_failed`, `invite_target_not_claimable`,
`threshold_notification_dedup_violation`, `threshold_notification_send_failed` and
`threshold_count_query_failed` are declared and never fire. Only `invite_post_fetch_failed`
has real call sites (`help-connect-card.tsx:69,85`, `invite-rider-modal.tsx:73,104`).
`src/lib/invite-tracking-server.ts:182-243`, `maybeFireThresholdNotification`, resolves the
inviter, inserts the dedup row, and sends the threshold email at line 237 with no analytics
event anywhere in the function. Its failure branches (`person_not_found`, `rpc_error`,
`insert_error`, `no_inviter`, `no_recipient`) `console.error` and return. `sendThresholdEmail`
at lines 132-157 checks both the Resend result object and the throw path and
`console.error`s both. The batch runner `fireTagEvents` at line 255 is live, called from
`/api/tag-event:88`, `/api/stories/route.ts:410` and `:685`,
`/api/stories/[id]/connections/route.ts:196`, and `/api/claims/route.ts:236`.

**F7. Missing auth events, all four confirmed absent by repo-wide grep.**
- `signin_succeeded` and `signin_failed`: zero occurrences in `src/`. The sign-in page fires
  `signin_started` four times and nothing else: `src/app/auth/signin/page.tsx:58` (google),
  `:70` (facebook), `:88` (magic_link), `:143` (password). The password branch resolves
  inline and has a real error path at `:145-158` with nothing attached to it.
- `magic_link_sent`: zero occurrences. `src/components/onboarding/save-step.tsx:171` sets
  `setSent(true)` on success and fires no event, despite firing `signup_failed` on all four
  failure branches (`:146`, `:165`, `:173`, and the OAuth ones at `:92`, `:98`, `:112`,
  `:118`). The sign-in page has the same shape at `signin/page.tsx:129`.
- `magic_link_clicked`: zero occurrences. `src/app/auth/callback/route.ts` is 44 lines with
  zero tracking of any kind. `src/app/api/auth/magic-link/route.ts` is 183 lines with zero
  tracking of any kind.
- `signupErrorClass`, the PII-free error bucketer, is a private function at
  `save-step.tsx:34-43`. It is not exported and the sign-in page has no equivalent.

**F8. The two FTUE steps that require typing emit no shown-event.**
`src/components/onboarding/onboarding-flow.tsx:50`, `STEPS` is
`["scatter", "weave", "name", "year", "era", "welcome", "save"]`. The step-shown effect at
`:193-209` maps `scatter`/`weave` to `ftue_intro_viewed`, `era` to `ftue_aha_shown`,
`welcome` to `ftue_timeline_shown`, `save` to `ftue_save_shown`, and returns `null` for
everything else, which is exactly `name` and `year` (line 202). Line 203 is
`if (!name) return`. So the two steps that ask the user to enter their name and the year
they started riding, the only two steps in the wizard that require input and therefore the
likeliest abandon points, produce no shown-event. A drop between `ftue_intro_viewed` and
`ftue_aha_shown` today is unattributable to either of them.

**F9. `ftue_completed` and `signup_succeeded` fire only for brand-new profiles.**
`src/app/auth/complete/page.tsx:67-72` selects the existing profile;
`:73` opens `if (!existingProfile)` and `:86` fires `signup_succeeded` inside it;
`:207-209` re-tests `!existingProfile` and fires `ftue_completed` inside that. The comment
at `:203-206` states the reasoning, and the reasoning is correct (D6). The hole is the
absence of any event for the other branch, not the gate itself.

**F10. `/auth/complete` has a ten second silent bounce.**
`src/app/auth/complete/page.tsx:229-231`, `setTimeout(... router.replace(expiredUrl), 10000)`,
where `expiredUrl` is built at `:26` as `/auth/signin?error=link_expired`. No event fires.
Three more silent exits: the poll loop at `:258-263` gives up after ten attempts and
`:266-267` replaces with the same URL; `init().catch(...)` at `:271` bounces on a throw. And
every post-auth side effect is caught and console-logged only: profile save `:85`, claim
migrate `:97`, metadata clear `:108`, invite claim `:152`, admin-invite `:169`, public claim
`:182`, plus the PKCE and setSession branches at `:241`, `:243`, `:253`, `:255`. A member who
lands here and bounces is indistinguishable from a member who never clicked the link.
Flow discrimination for Part B is clean and readable off the code: `?code` in the query is
PKCE (`:236-238`), an `#access_token` plus `#refresh_token` hash is the implicit magic-link
flow (`:245-249`), and neither present means the session came from the cookie set by
`/auth/callback`, which is the OAuth path (`:258-263`).

**F11. No first-story or first-claim signal exists.** `src/app/api/stories/route.ts:429-443`
fires `story_created` with `story_id`, `visibility`, `date_precision`, `photo_count`,
`rider_count`, `board_count`, `has_youtube`, `has_link`. No ordinal, no first-time flag.
Repo-wide grep for `first_story_created`, `first_claim_created` and `is_first` returns only
the unrelated `is_first_time` asserter flag in the tag queue
(`src/app/api/admin/tag-queue/route.ts:197`). `claim_created` is fired client-side from
`src/store/lineage-store.ts:493` and has the same gap.

**F12. Every Stripe and commerce route has zero tracking.** Measured as hits for
`trackEvent|captureServerEvent|api/track`: `stripe/checkout/route.ts` 0 of 65 lines,
`stripe/portal/route.ts` 0 of 43, `stripe/webhook/route.ts` 0 of 161,
`gift/redeem/route.ts` 0 of 81. The webhook handles five event types
(`webhook/route.ts:48` `checkout.session.completed`, `:107`
`customer.subscription.deleted`, `:116` `customer.subscription.updated`, `:128`
`invoice.payment_succeeded`, `:152` `invoice.payment_failed`). Checkout tiers are keyed
`annual | lifetime | founding | gift_annual` (`checkout/route.ts:5-10`).

**F12a. Adding a category is a four-place change, and getting it wrong fails silently.**
The CHECK constraint is at
`supabase/migrations/20260602000001_diagnostics_phase1_analytics_events.sql:33-35`,
hardcoding `'auth', 'ftue', 'content', 'invite', 'redirect', 'moderation', 'error'`. The
same seven are the `AnalyticsCategory` union at `src/types/index.ts:813-821`, the
`VALID_CATEGORIES` guard at `src/lib/analytics-server.ts:18-26`, the `CATEGORIES` array at
`src/app/api/admin/activity/route.ts:16`, and the `CATEGORY_STYLE` map at
`src/app/admin/activity/activity-client.tsx:41`. `VALID_CATEGORIES` returns early on an
unknown category (`analytics-server.ts:66`), and the database insert is inside the same
swallowing try. An out-of-sync category produces no error anywhere.

**F12b. PREMISE CORRECTION (playbook check 22). `/api/founding` is not a commerce write
path.** `src/app/api/founding/route.ts` is a 34 line public GET that lists founding members
and a spot count. It has zero tracking because it needs none. Do not add a commerce event
to it.

**F13. The invite loop cannot be closed today.** No `invite_accepted` or
`invite_link_opened` anywhere in `src/`. The three routes that actually complete an invite
have zero tracking: `src/app/api/invite/claim/route.ts` (170 lines, the authenticated tail
of the email-invite flow, returns `{ok, claimed, display_name}` at `:165-169`),
`src/app/api/public/claim-complete/route.ts` (131 lines, returns `claimed` at `:126`), and
`src/app/api/public/admin-invite-complete/route.ts` (90 lines, returns
`{ok, claimed: claimedAny}` at `:89`). All three are called in sequence from
`/auth/complete` at `:139`, `:165` and `:174`, and the first two results are captured into
`inviteClaimed` and `adminInviteClaimed`; the third call at `:174` discards its result
entirely. Without an accepted-side event, invite conversion rate has a numerator of nothing.

**F14. Share surfaces: 16 call sites in 11 files, 3 tracked, 13 untracked.**
Tracked: `help-connect-card.tsx:36` (fires `share_link_copied` at `:38`),
`invite-rider-modal.tsx:96` and `:113` (fire `invite_link_copied` at `:98` and `:115`).
Untracked, all 13:
`src/components/public-timeline/stack-header.tsx:36-40` (the public timeline share button,
the growth-relevant one),
`src/app/me/settings/public-timeline/page.tsx:75`,
`src/app/me/public-view/page.tsx:335`,
`src/app/compare/page.tsx:333`,
`src/app/account/membership/page.tsx:189`, `:294`, `:316`,
`src/components/ui/rider-card.tsx:543`,
`src/components/ui/member-card-overlay.tsx:334`,
`src/components/orgs/show-module.tsx:67`,
`src/components/events/episode-page.tsx:173`.
This session tracks ONE of them, the stack header. The rest are section 14.

**F14a. The stack-header share is not always a copy.** `stack-header.tsx:33-43`:
`StackViewControls.share()` tries `navigator.share({url})` first and falls through to
`navigator.clipboard.writeText(url)` on cancel or absence. The file has zero tracking
imports today (playbook check 10: verified by reading the whole component, not by grep
alone). This is why D13 uses a new name with a `method` prop.

**F15. THE PAGEVIEW BUG.** `src/instrumentation-client.ts:25` sets
`capture_pageview: true`. There is no `$pageview` capture anywhere in `src/` (repo-wide
grep for `$pageview` returns zero hits) and no route-change handler:
`src/components/posthog-provider.tsx` is 17 lines, a bare context wrapper with no
`usePathname`, no `useSearchParams`, and no effect at all. Every `usePathname` hit in the
repo is navigation UI (`nav.tsx:100`, `avatar-dropdown.tsx:29`, `me-subnav.tsx:19`,
`community-switcher.tsx:34`, `guest-menu.tsx:17`, `sign-in-prompt.tsx:25`,
`boards/page.tsx:46`). In a Next App Router SPA, `capture_pageview: true` in the legacy
sense fires on hard document loads only. Client-side navigations, which is most navigation
in this product, are uncounted, so every top-of-funnel page metric understates by an
unknown amount and time-on-page and entry/exit paths are wrong.

**F15a. The fix is a config value, already available.** posthog-js is pinned `^1.378.1`
and 1.378.1 is what is installed. `node_modules/posthog-js/dist/module.d.ts:1239-1245`
documents a `HistoryAutocapture` extension: "This class is used to capture pageview events
when the user navigates using the history API (pushState, replaceState) and when the user
navigates using the browser's back/forward buttons ... When set to `'history_change'`, this
class will capture pageviews on history API changes."

**F16. No `posthog.reset()` anywhere.** Repo-wide grep for `posthog.reset` returns zero
hits. There is exactly one sign-out call site:
`src/components/ui/nav/avatar-dropdown.tsx:40`, `await supabase.auth.signOut()`. On a shared
device the next visitor inherits the previous member's distinct id, which both corrupts the
funnel and attaches a stranger's session replay to a real member's person profile.

**F17. No `.env.example`, and `.gitignore` would swallow one.**
`find . -maxdepth 2 -name ".env*"` outside `node_modules` returns exactly one file,
`./.env.local`. `.gitignore:33-34` is a comment plus a bare `.env*`; `:42` repeats
`.env.local`. So a committed example file needs an explicit negation. Environment variables
actually referenced in `src/`, `next.config.ts` and the instrumentation files:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SENTRY_DSN`,
`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `RESEND_API_KEY`,
`ADMIN_NOTIFY_EMAIL`, `SERPER_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME`, `STRIPE_PRICE_FOUNDING`,
`STRIPE_PRICE_GIFT_ANNUAL`. Four of those (`ADMIN_NOTIFY_EMAIL`, `SENTRY_ORG`,
`SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) are absent from the local `.env.local`, which is the
exact class of drift the example file is meant to make visible.

**F18. `next.config.ts` has no `rewrites()` block.** It has `outputFileTracingIncludes`,
two `redirects()`, and a global `headers()` block including `X-Frame-Options: DENY`
(`next.config.ts:4-32`), wrapped in `withSentryConfig`. A PostHog reverse proxy (D9, not
this session) would be the first rewrite in the file.

**F19. `docs/` exists and has no analytics file.** Eleven files, mostly SQL and two
markdown specs (`catalog-export-runbook.md`, `results-scanner-spec.md`,
`design-system.md`). `docs/analytics-events.md` is a new file with a clear precedent for
markdown reference docs living there.

**F20. No forward-warning breadcrumbs in the analytics surface** (playbook check 6). Grep
for `TODO` and `FIXME` across `src/lib/analytics.ts`, `src/lib/analytics-server.ts`,
`src/app/api/track/`, `src/instrumentation-client.ts`, `src/components/posthog-provider.tsx`
and `src/lib/invite-tracking.ts` returns nothing. No prior phase left a time capsule here.

---

## 6. Task specs

### T1. Shared server track helper

New file `src/lib/track-server.ts`. Server-only. Exports:

```ts
export function trackServerEvent(
  origin: string,
  sink: "claim-event" | "invite-event",
  event: string,
  props: Record<string, unknown>,
  opts?: { actorId?: string | null; distinctId?: string | null; occurredAt?: string | null },
): void
```

It POSTs `{ event, props, actor_id, distinct_id, occurred_at }` to
`${origin}/api/track/${sink}`, `void`ed and `.catch(() => {})`ed, exactly matching the
existing shape (F4). Default `occurredAt` to `new Date().toISOString()` when the caller does
not supply one, mirroring `analytics.ts:34`. Write the same "why we stamp the time" comment
so the next reader does not delete it.

Then delete the five private helpers (F4 line numbers) and import this one. Every call site
keeps its current event name and props and gains `{ actorId }`:

| File | Call site | actorId to pass |
|---|---|---|
| `claim-requests/route.ts:165` | `claim_requested` | `user.id` |
| `claim-requests/[id]/route.ts:193` | `claim_node_approved` | the acting editor's `user.id` |
| `claim-requests/[id]/route.ts:278` | `claim_approved` | the acting editor's `user.id` |
| `claim-requests/[id]/route.ts:354` | `claim_status_changed` | the acting editor's `user.id` |
| `claim-requests/[id]/vouch/route.ts:155` | `vouch_added` | `user.id` (keep `voucher_id` in props too) |
| `claim-requests/[id]/vouch/route.ts:164` | `claim_status_changed` | `user.id` |
| `admin/invite-node/route.ts:164` | `claim_node_invited` | the acting editor's `user.id` |
| `public/claim-node/route.ts:178` | `claim_node_requested` | `null`, anonymous by design |

Read each file whole before editing to confirm the auth'd user variable name in scope
(playbook check 11). The claim-request routes use `requireAuth` / `requireEditor` and have a
`user` in scope; `public/claim-node` does not.

### T2. Fix the three sinks

`src/app/api/track/claim-event/route.ts`: read `body.actor_id` first and fall back to
`props.actor_id` for compatibility with anything not yet updated; read `body.distinct_id`
and `body.occurred_at`; replace the hardcoded category with a per-event map:

```ts
const GROWTH_EVENTS = new Set(["claim_node_invited", "claim_node_requested"])
const category = GROWTH_EVENTS.has(body.event) ? "invite" : "moderation"
```

Update the route's header comment: it currently states the sink files everything under
`moderation`, which stops being true.

`src/app/api/track/invite-event/route.ts`: keep the existing
`props.inviter_id` then `props.actor_id` actor resolution and add `body.actor_id` ahead of
both; add `distinctId` and `occurredAt`.

`src/app/api/track/node-redirect/route.ts`: add `distinctId` and `occurredAt` from the body.
The proxy at `src/proxy.ts:127-136` runs on the edge and cannot import the service client,
so it keeps the HTTP hop; extend its payload type with the optional fields and stamp
`occurred_at` there. Leave `actor_id` null: the proxy has no session.

### T3. Forward the visitor's distinct id from the one anonymous client caller

`src/components/ui/claim-node-sheet.tsx:43-52` POSTs to `/api/public/claim-node` with
`{node_id, email, note, source, slug}`. Add `distinct_id`, read the same way
`analytics.ts:14-21` reads it (guarded, `posthog.get_distinct_id?.()`, undefined on
failure). Then `public/claim-node/route.ts:178` passes it through T1's `distinctId`. This is
the only path where the actor is genuinely anonymous and the client id is the only way to
stitch the event to the visitor's session. Every other server event under T1 has a real
`actorId`, which `analytics-server.ts:69` already falls back to.

### T4. FTUE step-shown events for `name` and `year`

`src/components/onboarding/onboarding-flow.tsx:193-209`. Extend the map with
`name` to `"ftue_name_shown"` and `year` to `"ftue_year_shown"`. Follow the existing
per-step naming convention rather than inventing a generic `ftue_step_shown`, so the two new
events sit alongside `ftue_aha_shown` and `ftue_save_shown` in any funnel builder without
a property filter. The dedupe via `firedRef` (`:205-207`) and the `{ step_id }` prop are
unchanged. Nothing else in the file changes. After this, every one of the seven steps emits
a shown-event and the wizard funnel has no gaps.

### T5. Extract `signupErrorClass`

Move the function at `src/components/onboarding/save-step.tsx:34-43` verbatim into a new
`src/lib/auth-error-class.ts`, export it, and import it in `save-step.tsx`. Do not change
its buckets or its behaviour. Keep the PII comment above it, it is the reason the function
exists. The sign-in page imports the same one in T6.

### T6. Sign-in success and failure

`src/app/auth/signin/page.tsx`.

- `handlePasswordSubmit` (`:135-160`) is the only method that resolves on-page. In the
  error branch at `:145`, fire
  `trackEvent("auth", "signin_failed", { method: "password", error_class: signupErrorClass(authError.message) })`.
  Immediately before the `router.push` at `:157`, fire
  `trackEvent("auth", "signin_succeeded", { method: "password" })`.
- `continueWithGoogle` (`:56-66`) and `continueWithFacebook` (`:68-78`): in the
  `if (oauthError)` branch, fire `signin_failed` with the matching `method` and
  `error_class`. There is no on-page success for these: the user leaves the page and their
  success is `auth_complete_landed` in T8.
- `sendMagicLink` (`:79-133`): fire `signin_failed { method: "magic_link", error_class }` in
  the three failure branches at `:100` (server-returned error), `:118` (OTP fallback error)
  and `:130` (the network catch). This mirrors `save-step.tsx` exactly, which already does
  this for signup.

### T7. `magic_link_sent`, both surfaces

- `src/app/auth/signin/page.tsx:129`, immediately before `setSent(true)`:
  `trackEvent("auth", "magic_link_sent", { intent: "signin", surface: "signin", fallback: !!data.fallback })`.
- `src/components/onboarding/save-step.tsx:171`, immediately before `setSent(true)`:
  `trackEvent("auth", "magic_link_sent", { intent: "signup", surface: "ftue_save", fallback: !!data.fallback })`.

The `fallback` prop distinguishes the Resend server path from the client OTP fallback, which
matters because they generate different link shapes and Jay will want to know which one is
losing people. Do NOT add tracking inside `src/app/api/auth/magic-link/route.ts`: the client
already knows the outcome, and firing from both places would double-count.

### T8. `/auth/complete` instrumentation

`src/app/auth/complete/page.tsx`. Four additions, all inside the existing effect.

1. **Flow detection, at the top of `init()`** (before the PKCE branch at `:236`), compute
   once:
   ```ts
   const hasCode = !!new URLSearchParams(window.location.search).get("code")
   const hasHash = !!new URLSearchParams(window.location.hash.slice(1)).get("access_token")
   const flow = hasCode ? "pkce" : hasHash ? "implicit" : "cookie"
   ```
   Fire `trackEvent("auth", "auth_complete_landed", { flow })` unconditionally. This is the
   denominator D6 is about: it fires for new signups, returning sign-ins, and bounces alike.
2. **`magic_link_clicked`**, immediately after, when `flow !== "cookie"`:
   `trackEvent("auth", "magic_link_clicked", { flow })`. Per F10 the discrimination is
   clean: OAuth arrives here with a cookie session and neither a `code` nor a hash, because
   `/auth/callback` already exchanged the code server-side. `AUDIT`: a password recovery
   link also arrives with an implicit hash. If recovery volume ever matters, split it on the
   hash `type` param; at current volume it does not, and mislabelling a handful of recovery
   clicks as magic-link clicks is acceptable. Do not build the split now.
3. **`auth_complete_failed`**, one event, three reasons, one at each silent exit:
   - `:230`, inside the timeout callback, `{ reason: "timeout", flow }`
   - `:266`, after the poll loop gives up, `{ reason: "no_session", flow }`
   - `:271`, in `init().catch`, `{ reason: "threw" }`
   Fire it before the `router.replace` in each case so it is not raced by the navigation.
   `trackEvent` uses `keepalive: true` (`analytics.ts:46`) so the POST survives the
   unload, but ordering the call first costs nothing.
4. **`is_new_account` on the existing events.** Add `{ is_new_account: true }` to the
   `signup_succeeded` props at `:86` and to `ftue_completed` at `:208`. Both stay inside
   their `!existingProfile` gates (D6). The prop makes the registry honest and makes the
   pair readable next to `auth_complete_landed`.

Do NOT put `is_new_account` on `auth_complete_landed`. That value is not known when the
event fires: `existingProfile` is only read inside `saveAndRedirect` at `:67`, well after
`init()` starts. Do not move the profile read earlier to get it. The join you want is
`auth_complete_landed` followed by `signup_succeeded`, and the ABSENCE of the second one is
the returning-user signal.

### T9. `oauth_callback_failed`

`src/app/auth/callback/route.ts`. This is a server route handler, so import
`captureServerEvent` directly and `await` it; there is no user waiting on a render here,
only a redirect, and an un-awaited call would be truncated by the redirect.

- `:15-17`, the no-code branch: `event: "oauth_callback_failed"`, `category: "auth"`,
  `props: { reason: "no_code" }`.
- `:39-41`, the exchange-error branch: same event, `props: { reason: "exchange_failed", error_class: signupErrorClass(error.message) }`.

Both branches currently redirect to `/onboarding` with an error query param and record
nothing. This is the only place an OAuth round trip can fail server-side, and today it is
completely dark.

### T10. First-story ordinal

`src/app/api/stories/route.ts`, in the POST handler, before the `captureServerEvent` at
`:429`. Count the author's stories with a head-count query:

```ts
const { count } = await supabase
  .from("stories")
  .select("id", { count: "exact", head: true })
  .eq("author_id", user.id)
```

Run it AFTER the insert, so the new story is included and `count` is the ordinal. Add
`story_ordinal: count ?? null` and `is_first: count === 1` to the existing props object
(F11). Do not add a separate event (D12). Guard on `count` being null: on a failed count the
props should be `null` and `false`, never a wrong `true`.

Do the same for `claim_created` in `src/store/lineage-store.ts:493` ONLY if it can be done
without a new round trip from the client. `AUDIT`: this session did not verify whether the
store has a reliable local claim count for the active user at that point.
`getAllClaims()` merges db, session and override claims, so a local count is plausible but
unconfirmed. If it is not clean, skip it and log it in section 14. The story ordinal is the
one that matters: story creation is the activation metric in the first-wave push plan.

### T11. `invite_accepted`

Three server routes, one event, a `path` prop naming which loop closed. All three already
compute a boolean for whether anything was claimed, so this is a single `captureServerEvent`
per route on the success branch:

| Route | Fire when | `path` |
|---|---|---|
| `src/app/api/invite/claim/route.ts:165` | the success return, where `claimed: true` | `"email_invite"` |
| `src/app/api/public/claim-complete/route.ts:126` | the success return | `"public_tag"` |
| `src/app/api/public/admin-invite-complete/route.ts:89` | when `claimedAny` is true | `"admin_invite"` |

Category `invite`, `actorId: user.id`, props `{ path, node_id }` where the route has the
ghost id in scope. Do NOT fire on the `claimed: false` no-op returns: all three routes are
called unconditionally for every sign-in (F13), so a fire-on-call event would be a sign-in
counter wearing an invite name.

While in `/auth/complete`, capture the discarded result of the `claim-complete` call at
`:174` into a local the same way `:144` and `:166` do for the other two. It is not needed
for the event, which fires server-side, but leaving one of three calls discarding its
result is the kind of asymmetry that grows a bug later.

### T12. `share_clicked` on the public timeline

`src/components/public-timeline/stack-header.tsx`. Add `import { trackEvent } from "@/lib/analytics"` and fire at the TOP of `share()` (`:33`), before the
`navigator.share` attempt:

```ts
trackEvent("invite", "share_clicked", {
  surface: "public_timeline_stack",
  method: typeof navigator !== "undefined" && navigator.share ? "native" : "clipboard",
})
```

Category `invite` because this is a growth surface, not content. One event per press,
regardless of which branch runs or whether the native sheet is cancelled (F14a): the thing
being measured is intent to share, and a cancelled native sheet is still a member who tried.
Do not touch the other twelve untracked surfaces (section 14).

### T13. Wire the dormant threshold telemetry, delete the dead helpers

`src/lib/invite-tracking-server.ts`. Import `captureServerEvent` and `captureServerError`
directly and `await` them (D5).

- After the successful send at `:237`, fire
  `captureServerEvent({ category: "invite", event: "tag_threshold_notification_sent", actorId: inviterId, props: { person_id: personId, distinct_tagger_count: s.distinct_count } })`.
- In the RPC error branch at `:196-199`, fire
  `captureServerError({ category: "invite", tag: "threshold_count_query_failed", actorId: null, payload: { person_id: personId } })`.
- Make `sendThresholdEmail` (`:132-157`) return a boolean, `false` on the Resend rejection
  path and on the catch. In `maybeFireThresholdNotification`, when it returns false fire
  `captureServerError({ category: "invite", tag: "threshold_notification_send_failed", ... })`
  instead of the sent event. This is the highest-value one of the three: the dedup row is
  already inserted at that point, so a failed send is permanent, and today it is invisible.

Then delete `trackInviteEventServer` and `trackInviteErrorServer` from
`src/lib/invite-tracking.ts:63-79`, including the section comment above them. Leave the four
still-unused `InviteErrorTag` values in place with a one-line comment saying they have no
call site yet (out of scope). `npx tsc --noEmit` proves nothing else referenced the deleted
helpers.

### T14. Pageview and reset

- `src/instrumentation-client.ts:25`: change `capture_pageview: true` to
  `capture_pageview: "history_change"`. Add a two-line comment explaining that the App
  Router navigates client-side so the boolean form only ever captured hard loads (F15,
  F15a). This one word is the single highest-leverage change in the brief: it fixes the
  denominator of every page-level funnel in the product.
- `src/components/ui/nav/avatar-dropdown.tsx:40`: after `await supabase.auth.signOut()`,
  call `posthog.reset()` inside a try/catch, importing `posthog` from `posthog-js`. It must
  run after the sign-out completes and before any redirect. Wrap it: `posthog.reset` throws
  if the library never initialised, which is exactly the no-key case the rest of the
  codebase guards for.

### T15. Commerce events

Six events, all `category: "content"` with `props.domain = "commerce"` (D4). All
server-side via `captureServerEvent`, all awaited inside their route handlers.

| Route | Line context | Event | Props |
|---|---|---|---|
| `stripe/checkout/route.ts` | after the session is created, before returning the url | `checkout_started` | `tier`, `is_gift` |
| `stripe/portal/route.ts` | after the portal session is created | `billing_portal_opened` | none beyond domain |
| `stripe/webhook/route.ts:48` | `checkout.session.completed` | `checkout_completed` | `tier` |
| `stripe/webhook/route.ts:107` | `customer.subscription.deleted` | `membership_cancelled` | `tier` if known |
| `stripe/webhook/route.ts:152` | `invoice.payment_failed` | `payment_failed` | `tier` if known |
| `gift/redeem/route.ts:80` | the success return | `gift_redeemed` | none beyond domain |

`actorId` is the authenticated `user.id` on checkout, portal and redeem. In the webhook
there is no session; use the profile id the handler resolves from the Stripe customer, and
pass `null` when it cannot resolve one rather than inventing a value. Read the whole webhook
file before editing (playbook check 11): it has five branches and a signature verification
guard above them, and events must fire after the branch's database work, not before, so a
failed membership update does not report as a completed checkout.

Do NOT add anything to `/api/founding` (F12b).

### T16. `docs/analytics-events.md`

Write section 7 of this brief into `docs/analytics-events.md`, plus a short preamble
covering: the two sinks and which one is durable; that client events go through
`trackEvent` in `src/lib/analytics.ts` and server events through `captureServerEvent` in
`src/lib/analytics-server.ts`; that the category list is CHECK-constrained and adding one is
a four-place change (F12a, with the four locations named); the `props.domain` convention for
errors and for commerce; and the date the two growth events changed category, so anyone
querying history knows where the seam is. Keep it a reference, not a narrative.

### T17. `.env.example` and the gitignore negation

New `.env.example` at the repo root listing all eighteen variables from F17, grouped
(Supabase, PostHog, Sentry, Resend, Stripe, misc), each with an empty value and a one-line
comment. Mark which are required for the app to boot and which degrade to a no-op when
absent. Say explicitly, on the PostHog line, that a missing `NEXT_PUBLIC_POSTHOG_KEY`
silently disables all capture on both the client and the server.

Add to `.gitignore`, directly under the existing `.env*` at line 34:

```
!.env.example
```

Then confirm with `git check-ignore -v .env.example`, which must report no match. If it
still reports a match, the negation is in the wrong place relative to the pattern and no
amount of `git add` will fix it. Never put a real secret in this file.

---

## 7. Event registry after this session

Category is the stored `analytics_events.category`. C/S is where the event originates:
Client goes through `trackEvent` and the `/api/track/*` hop, Server goes through
`captureServerEvent` directly or through a sink route.

### auth

| Event | C/S | Props | Status |
|---|---|---|---|
| `signin_started` | C | `method` (google, facebook, magic_link, password) | existing |
| `signin_succeeded` | C | `method` (password only, see T6) | NEW |
| `signin_failed` | C | `method`, `error_class` | NEW |
| `signup_started` | C | `method` | existing |
| `signup_failed` | C | `method`, `error_class` | existing |
| `signup_succeeded` | C | `is_new_account: true` | existing, prop added |
| `magic_link_sent` | C | `intent` (signin, signup), `surface`, `fallback` | NEW |
| `magic_link_clicked` | C | `flow` (implicit, pkce) | NEW |
| `auth_complete_landed` | C | `flow` (implicit, pkce, cookie) | NEW |
| `auth_complete_failed` | C | `reason` (timeout, no_session, threw), `flow` | NEW |
| `oauth_callback_failed` | S | `reason` (no_code, exchange_failed), `error_class` | NEW |

### ftue

| Event | C/S | Props | Status |
|---|---|---|---|
| `ftue_landed` | C | `source` when arriving from the intro | existing |
| `ftue_intro_viewed` | C | `step_id` (scatter, weave) | existing |
| `ftue_intro_skipped` | C | `step_id` | existing |
| `ftue_name_shown` | C | `step_id` (name) | NEW |
| `ftue_year_shown` | C | `step_id` (year) | NEW |
| `ftue_aha_shown` | C | `step_id` (era) | existing |
| `ftue_timeline_shown` | C | `step_id` (welcome) | existing |
| `ftue_save_shown` | C | `step_id` (save) | existing |
| `ftue_step_completed` | C | `step_id` | existing |
| `ftue_exited` | C | `step_id` | existing |
| `ftue_completed` | C | `is_new_account: true`, or `via: "dev_bypass"` | existing, prop added |
| `claim_welcome_shown` | C | `moment_count` | existing |
| `first_three_stories_completed` | C | none | existing |

### content

| Event | C/S | Props | Status |
|---|---|---|---|
| `story_created` | S | `story_id`, `visibility`, `date_precision`, `photo_count`, `rider_count`, `board_count`, `has_youtube`, `has_link`, `story_ordinal`, `is_first` | existing, 2 props added |
| `story_edited` | S | `story_id`, plus edit fields | existing |
| `story_deleted` | S | `story_id`, `moderated`, `author_id` | existing |
| `story_date_fixed` | S | `story_id`, `author_id`, `moderated`, `date_precision` | existing |
| `story_comment_added` | S | story and comment ids | existing |
| `story_comment_deleted` | S | story and comment ids | existing |
| `story_reaction_set` | S | story id, emoji | existing |
| `story_reaction_removed` | S | story id | existing |
| `story_connection_added` | S | story id, entity | existing |
| `story_connection_removed` | S | story id, entity | existing |
| `claim_created` | C | `predicate`, `subject_type`, `object_type`, `visibility` | existing |
| `riding_day_created` | C | `place_id`, `rider_count`, `has_note`, `visibility` | existing |
| `checkout_started` | S | `domain: "commerce"`, `tier`, `is_gift` | NEW |
| `checkout_completed` | S | `domain: "commerce"`, `tier` | NEW |
| `membership_cancelled` | S | `domain: "commerce"`, `tier` | NEW |
| `payment_failed` | S | `domain: "commerce"`, `tier` | NEW |
| `gift_redeemed` | S | `domain: "commerce"` | NEW |
| `billing_portal_opened` | S | `domain: "commerce"` | NEW |

### invite

| Event | C/S | Props | Status |
|---|---|---|---|
| `invite_modal_opened` | C | `surface`, `person_id`, `predicate` | existing |
| `invite_modal_dismissed` | C | `surface`, `person_id`, `predicate` | existing |
| `invite_link_created` | C | `surface`, `person_id`, `predicate` | existing |
| `invite_email_sent` | C | `surface`, `person_id`, `predicate` | existing |
| `invite_link_copied` | C | `surface`, `person_id`, `auto` | existing |
| `invite_email_added` | C | `surface`, `person_id` | existing |
| `invite_prompt_shown` | C | `surface`, `person_id` | existing |
| `invite_prompt_clicked` | C | `surface`, `person_id` | existing |
| `invite_prompt_dismissed` | C | `surface`, `person_id` | existing |
| `share_link_copied` | C | `surface`, `person_id` | existing, unchanged |
| `share_clicked` | C | `surface`, `method` (native, clipboard) | NEW |
| `invite_accepted` | S | `path` (email_invite, public_tag, admin_invite), `node_id` | NEW |
| `tag_threshold_notification_sent` | S | `person_id`, `distinct_tagger_count` | declared since Phase 1, FIRST FIRES this session |
| `claim_node_invited` | S | `node_id`, `surface`, `resend`, `actor_id` | existing, MOVED from `moderation` |
| `claim_node_requested` | S | `claim_request_id`, `node_id`, `verification_tier`, `source` | existing, MOVED from `moderation` |

### moderation

| Event | C/S | Props | Status |
|---|---|---|---|
| `claim_requested` | S | `claim_request_id`, `node_id`, `verification_tier`, `vouches_required` | existing, actor added |
| `claim_approved` | S | `claim_request_id`, `path`, `noop`, ghost and canonical ids, repoint counts | existing, actor added |
| `claim_node_approved` | S | `claim_request_id`, `node_id`, `verification_tier` | existing, actor added |
| `claim_status_changed` | S | `claim_request_id`, `from`, `to`, `reason` | existing, actor added |
| `vouch_added` | S | `claim_request_id`, `voucher_id`, `relationship`, `vouch_count`, `threshold_met` | existing, actor added |

### redirect

| Event | C/S | Props | Status |
|---|---|---|---|
| `node_redirect` | S | `from_slug`, `to_slug`, `reason` | existing, `occurred_at` added |

### error (stored `category: "error"`, real domain in `props.domain`)

| Tag | C/S | Domain | Status |
|---|---|---|---|
| `invite_post_fetch_failed` | C | invite | existing |
| `threshold_count_query_failed` | S | invite | declared, FIRST FIRES this session |
| `threshold_notification_send_failed` | S | invite | declared, FIRST FIRES this session |
| `invite_resend_failed` | n/a | invite | declared, still no call site (out of scope) |
| `invite_db_insert_failed` | n/a | invite | declared, still no call site (out of scope) |
| `invite_target_not_claimable` | n/a | invite | declared, still no call site (out of scope) |
| `threshold_notification_dedup_violation` | n/a | invite | declared, still no call site (out of scope) |

**Totals: 17 new event names, plus 3 declared-but-dormant names that fire for the first
time, for 20 newly flowing names. 2 events change category. 3 events gain props. 0 events
are removed or renamed.**

---

## 8. Acceptance criteria

Each is checkable in a browser plus the PostHog Live Events view, or with one SQL query
against `analytics_events`. Every one was validated as "this surface exists today" before
being written (playbook check 7).

**A1.** `npx tsc --noEmit` is clean.

**A2.** `grep -rn "function trackEvent" src/app/api/` returns nothing. The five duplicated
helpers are gone and all eight claim call sites import the shared one.

**A3.** Submit a claim request while signed in. The resulting `analytics_events` row for
`claim_requested` has a non-null `actor_id` equal to your user id, and the PostHog event
carries your distinct id, not `"anonymous"`.

**A4.** An editor invites a node from `/admin`. The `claim_node_invited` row has
`category = 'invite'`, not `'moderation'`. `claim_approved` on the same queue still has
`category = 'moderation'`.

**A5.** Walk the FTUE from `/onboarding`. PostHog shows, in order, `ftue_landed`,
`ftue_intro_viewed`, `ftue_name_shown`, `ftue_year_shown`, `ftue_aha_shown`,
`ftue_timeline_shown`, `ftue_save_shown`. Backing up and returning to a step does not
re-fire its shown-event.

**A6.** Request a magic link from `/auth/signin` with a returning address.
`magic_link_sent { intent: "signin", surface: "signin" }` fires. Click the link.
`magic_link_clicked { flow: "implicit" }` and `auth_complete_landed { flow: "implicit" }`
both fire, and `ftue_completed` does NOT.

**A7.** Run the same from the FTUE save step with a fresh plus-aliased address.
`magic_link_sent { intent: "signup" }`, then `magic_link_clicked`,
`auth_complete_landed`, `signup_succeeded { is_new_account: true }` and
`ftue_completed { is_new_account: true }` all fire, in that order, with the timestamps in
that order (this is the `occurred_at` guarantee from F1 still holding).

**A8.** Sign in with a wrong password. `signin_failed { method: "password", error_class }`
fires and `error_class` contains no email address and no raw error string. Sign in with the
right one: `signin_succeeded { method: "password" }` fires.

**A9.** Open a stale or already-used magic link and let `/auth/complete` sit.
`auth_complete_failed` fires with a `reason` before the bounce to
`/auth/signin?error=link_expired`.

**A10.** Post a story from a brand-new account. `story_created` carries
`story_ordinal: 1` and `is_first: true`. Post a second: `story_ordinal: 2`,
`is_first: false`.

**A11.** Complete an email invite end to end. `invite_accepted { path: "email_invite" }`
fires exactly once, with `actor_id` set. Sign in again with the same account:
`invite_accepted` does NOT fire a second time.

**A12.** Press Share on a `/t/<slug>` page. `share_clicked` fires once with a `method` of
`native` or `clipboard`. On a desktop browser without `navigator.share`, `method` is
`clipboard`. Cancelling a native share sheet still leaves exactly one event.

**A13.** Navigate from `/` to `/snowboarding` to `/people` using in-app links, then press
the browser back button twice. PostHog shows a `$pageview` for every one of those
transitions, not just the first hard load. This is the criterion most likely to be assumed
rather than checked; check it.

**A14.** Sign out, then sign in as a different account in the same browser. The second
account's events carry a different distinct id, and the first account's person profile does
not gain the second account's events.

**A15.** Trigger a threshold notification (three distinct taggers on one unclaimed node).
A `tag_threshold_notification_sent` row exists in `analytics_events` with `category = 'invite'`
and the inviter as `actor_id`, alongside the `person_invite_notifications` row that already
existed. Before this session there was only the second one.

**A16.** Start a Stripe checkout in test mode. `checkout_started` fires with the right
`tier` and `props.domain = "commerce"`. Complete it: `checkout_completed` fires from the
webhook. Both rows have `category = 'content'` and both appear under the content chip at
`/admin/activity`.

**A17.** `git check-ignore -v .env.example` reports no match, and `git status` shows
`.env.example` as a new tracked file. It contains no real secret values.

**A18.** `docs/analytics-events.md` exists and its table matches section 7 exactly,
including the two re-categorised events and the date they moved.

**A19.** Nothing regressed: `story_created`, `claim_created`, `ftue_landed` and
`node_redirect` all still fire with their existing props, and `/admin/activity` renders with
its seven category chips unchanged.

---

## 9. Migration

**There is no migration this session.** State this explicitly in the PR description and in
the SHIP-LOG entry, so the daily reconcile records the gate as closed rather than pending.

The one thing that WOULD trigger one is adding a `commerce` category to
`analytics_events`, which D4 declines. If a future session takes that on, it is a
CHECK-constraint swap on a pre-existing table, so under the repo risk gate it is GATED, not
SAFE: print the SQL, state the risk, wait for Jay. It is also a hard PRE-merge gate in the
Group F sense, with a twist that makes it worse than the usual case. A normal
migration-after-merge window 500s loudly. This one does not: `captureServerEvent` swallows
the constraint violation (F2, F12a), so the PostHog event still appears while the durable
row is silently dropped. The dashboard looks correct and the database is wrong.

---

## 10. Risks and gotchas

- **The whole PR is invisible if the key is missing.** Both the client and server capture
  paths guard on `NEXT_PUBLIC_POSTHOG_KEY` and degrade to nothing. If you smoke this without
  the key in `.env.local`, everything looks broken and nothing is. Prerequisite 3 exists for
  this reason, and it is also the argument for T17.
- **Everything here fires into a swallow.** `captureServerEvent` and `captureServerError`
  never throw and never log (F2). A typo in a category, a malformed props object, an await
  you forgot: all of them produce silence, not an error. Verify each new event by seeing it
  arrive, not by reasoning that the code looks right. This is the single biggest way to
  waste an hour in this session.
- **Do not `await` a capture on a render path, and do not leave one floating on a
  redirect.** T9 and T15 await deliberately because their handlers end in a redirect or a
  JSON return that would truncate a floating promise. T1 deliberately does not, because the
  HTTP hop moves the work into a separate invocation. Match the pattern to the context; do
  not standardise one of them across both.
- **Category is CHECK-constrained (F12a).** Any typo in a category string produces a
  dropped row with a live PostHog event. Reuse the `AnalyticsCategory` type at every new
  call site so TypeScript catches it rather than the database silently not catching it.
- **`capture_pageview: "history_change"` will change your numbers.** Pageview counts jump
  the day this deploys, and it is not growth. Note the deploy date next to any
  before-and-after comparison, and say so in the SHIP-LOG entry, otherwise the September
  traffic chart tells a lie about the first-wave push.
- **`posthog.reset()` throws when posthog never initialised.** Wrap it (T14). This is the
  same no-key case the rest of the codebase already guards for.
- **Do not double-fire `magic_link_sent`.** The client already knows the send outcome, so
  the server route stays untracked (T7). Adding it in both places doubles a number Jay is
  going to divide by.
- **`invite_accepted` must not fire on the no-op path.** All three completion routes are
  called for EVERY sign-in and return `claimed: false` when there is nothing to claim (F13).
  Firing on call rather than on `claimed` turns an invite metric into a sign-in metric that
  looks like an invite metric, which is worse than having neither.
- **The story ordinal count runs after the insert.** Running it before gives an off-by-one
  and `is_first` never being true. Guard the null case (T10).
- **Copy rule (playbook check 21).** No em dashes anywhere: not in code comments, not in the
  new docs file, not in the PR description. Commas, colons, parentheses, or "to" in ranges.
- **Rendering is unverified from the drafting side.** No visual acceptance criterion in
  section 8 was run by Cowork. The Cowork bridge shell is linux/arm64 while `node_modules`
  holds darwin-arm64 SWC binaries, so `npm run dev` does not run there. Every browser
  criterion above is genuinely untested until this session runs it.

---

## 11. Rollback

Single flip point, and unusually clean: nothing in this PR changes product behaviour, data
shape, or schema. Reverting the PR removes the new events and restores the old sinks with no
state to unwind and nothing to migrate back. Historical rows written under the new
categories stay as they are, which is correct: they record what actually happened.

Two partial rollbacks, if only one piece misbehaves:

- **Pageview volume looks wrong after deploy:** revert the single word in
  `src/instrumentation-client.ts:25` back to `true`. Independent of everything else.
- **A commerce event is noisy or wrong:** delete that one `captureServerEvent` call. Part E
  has no shared code with Parts A to D.

The only irreversible action in the session is T13's deletion of two dead functions, and
`npx tsc --noEmit` proves nothing referenced them.

---

## 12. Suggested order

Build in this order. It is arranged so the plumbing is provable before anything depends on
it, and so the two changes that alter existing numbers land last.

1. **T1, T2, T3.** The sinks and the shared helper. Do this first: it is the only part with
   a shared-code refactor, and every later part is easier to verify once actor and distinct
   id are flowing. Prove it with A3 and A4 before moving on.
2. **T5.** Extract `signupErrorClass`. Small, and T6 and T9 both need it.
3. **T4.** The two FTUE step events. Two lines, immediately verifiable with A5, and it is
   the fix most directly aimed at the funnel question that motivated the session.
4. **T6, T7, T8, T9.** The auth block, in that order. T8 is the largest single edit in the
   session; do it with the file open in full (playbook check 11) and A6, A7 and A9 in hand.
5. **T10, T11, T12.** Activation and loop closing. Independent of each other.
6. **T13.** The dormant telemetry and the deletion. Run `npx tsc --noEmit` immediately after
   the deletion, before anything else, so an unexpected reference surfaces on its own.
7. **T15.** Commerce. Isolated from everything above, and the webhook needs Stripe test mode
   set up, so it is the part most likely to stall. Keeping it late means a stall does not
   block the rest.
8. **T16, T17.** Docs and environment file. Write these from the finished code, not from
   this brief, so the registry documents what shipped rather than what was planned.
9. **T14 LAST.** The pageview config and `posthog.reset()`. These two change the meaning of
   existing numbers, so landing them last keeps the rest of the session's verification
   running against a stable baseline.

---

## 13. Ship sequence

Per the repo `CLAUDE.md` standing rule.

1. Build in the section 12 order. Push the branch, open the PR. State the PR number.
2. **No migration this session** (section 9). Say it explicitly in the PR description so the
   record is unambiguous.
3. Run acceptance criteria A1 through A19. A13 and A14 are the two most likely to be assumed
   rather than checked; check them.
4. Merge the PR yourself with `gh pr merge` once `npx tsc --noEmit` is clean.
   **EXCEPTION:** T15 adds code to `/api/stripe/webhook` and `/api/stripe/checkout`. The
   standing rule prompts Jay and waits when a session touches payments. The touch here is
   additive telemetry, not payment logic, but the rule is the rule: surface T15's diff to Jay
   and get an explicit go-ahead before merging. If he would rather not have Stripe files in
   this PR at all, drop Part E to a follow-up and merge the rest; nothing else depends on it.
5. Confirm Vercel auto-deploys `main`.
6. Append one entry to `bugs/SHIP-LOG.md` using the schema at the top of that file. Note in
   the body that pageview counts step up on this deploy date and that the step is a
   measurement fix, not growth.
7. After deploy, watch PostHog Live Events for ten minutes on real traffic and confirm the
   new names arrive with non-anonymous distinct ids.

---

## 14. Follow-ups, NOT this session

- **A real `commerce` category** (D4). One GATED migration plus the four hardcoded lists in
  F12a. Worth doing once the six commerce events have proven they are being used.
- **The other twelve untracked share surfaces** (F14). Membership referral, gift link, rider
  card, member card, compare, episode, show module, public-view and settings copy buttons.
  One shared `useShare()` hook that fires `share_clicked` with a `surface` prop would cover
  all of them at once and is a cleaner change than twelve inline additions.
- **`first_claim_created` or a claim ordinal** (T10 `AUDIT`). Needs a decision on whether
  the store can count the active user's claims locally without a round trip.
- **PostHog reverse proxy** (D9, F18). Justified only if a measurable gap opens between
  client and server event volume for the same user actions. That gap is now measurable,
  because `auth_complete_landed` (client) and `oauth_callback_failed` (server) sit on the
  same path.
- **The four still-dead `InviteErrorTag` values** (F6). Needs an audit of `/api/invite` error
  handling to decide whether to wire or prune them. Do not guess.
- **Retire `capture_pageleave` or confirm it still behaves** under `history_change`. Not a
  risk, just something to look at once when the new pageview data lands.
- **PostHog funnel definitions.** This session ships the events; somebody still has to build
  the funnels in PostHog that use them. That is a Jay job, not a code job, and it is the
  step where the value is actually collected: signup funnel
  (`ftue_landed` to `ftue_name_shown` to `ftue_year_shown` to `ftue_save_shown` to
  `magic_link_sent` to `magic_link_clicked` to `signup_succeeded`), invite funnel
  (`invite_link_created` to `invite_accepted`), activation funnel
  (`signup_succeeded` to `story_created where is_first`).
- **A silent-failure sweep beyond auth.** `/auth/complete` was the worst case (F10) and this
  session fixes it, but the same console.error-only pattern exists elsewhere. Worth one pass
  with `captureServerError` once the taxonomy doc gives it a home.

---

SHIP-LOG line for this session:

```
type: feature
ids: none
scope: funnel-event-completion
migration: none
```
