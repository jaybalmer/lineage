# Analytics events

Reference for the Linestry product-event vocabulary. This is the source of truth
for event names, their category, where they originate, and their props. Add new
events by pattern rather than by archaeology.

## The two sinks

Every product event goes to two places through one code path:

1. **PostHog** (funnels, retention, session replay). Retention-limited.
2. The **`analytics_events`** table (durable, queryable, survives PostHog
   retention, surfaced at `/admin/activity`). This is the durable record.

- **Client events** go through `trackEvent(category, event, props, opts)` in
  `src/lib/analytics.ts`, which fire-and-forget POSTs to `/api/track/event`
  (and a few dedicated sinks: `/api/track/claim-event`, `/api/track/invite-event`,
  `/api/track/node-redirect`). The client stamps `distinct_id` (from posthog-js)
  and `occurred_at` (call time) so identified and anonymous events stitch into
  one person and strict-order funnels do not invert.
- **Server events** go through `captureServerEvent(...)` in
  `src/lib/analytics-server.ts` directly (or through one of the sink routes
  above). It is the single sink-writer and swallows every failure: a bad
  category, a malformed props object, or a forgotten `await` produces silence,
  not an error. Verify a new event by seeing it arrive, not by reasoning the code
  looks right.

## Category is CHECK-constrained

The category set is `auth | ftue | content | invite | redirect | moderation | error`.
Adding one is a four-place change, and getting it wrong drops the durable row
silently while the PostHog event still appears (the constraint violation is
swallowed by `captureServerEvent`). The four places:

1. the CHECK constraint in
   `supabase/migrations/20260602000001_diagnostics_phase1_analytics_events.sql`
2. the `AnalyticsCategory` union in `src/types/index.ts`
3. `VALID_CATEGORIES` in `src/lib/analytics-server.ts`
4. the `CATEGORIES` array in `src/app/api/admin/activity/route.ts`
   (and the `CATEGORY_STYLE` map in `src/app/admin/activity/activity-client.tsx`)

## The `props.domain` convention

`captureServerError` always stores `category: "error"` and records the real
domain in `props.domain`. Commerce events follow the same shape: they ride the
existing `content` category with `props.domain = "commerce"` rather than adding a
`commerce` category (which would be the four-place migration above). A real
`commerce` category is a logged follow-up.

## Category seam

On **2026-09-10**, `claim_node_invited` and `claim_node_requested` moved from
`moderation` to `invite` (they are growth events). Historical rows written before
that date keep `moderation`; query accordingly.

---

## auth

| Event | C/S | Props |
|---|---|---|
| `signin_started` | C | `method` (google, facebook, magic_link, password) |
| `signin_succeeded` | C | `method` (password only) |
| `signin_failed` | C | `method`, `error_class` |
| `signup_started` | C | `method` |
| `signup_failed` | C | `method`, `error_class` |
| `signup_succeeded` | C | `is_new_account: true` (+ attribution props) |
| `magic_link_sent` | C | `intent` (signin, signup), `surface`, `fallback` |
| `magic_link_clicked` | C | `flow` (implicit, pkce) |
| `auth_complete_landed` | C | `flow` (implicit, pkce, cookie) |
| `auth_complete_failed` | C | `reason` (timeout, no_session, threw), `flow` |
| `oauth_callback_failed` | S | `reason` (no_code, exchange_failed), `error_class` |

`auth_complete_landed` is the always-firing denominator for `/auth/complete`; it
does NOT carry `is_new_account` (unknown at fire time). The returning-user signal
is `auth_complete_landed` with no following `signup_succeeded`.

## ftue

| Event | C/S | Props |
|---|---|---|
| `ftue_landed` | C | `source` when arriving from the intro |
| `ftue_intro_viewed` | C | `step_id` (scatter, weave) |
| `ftue_intro_skipped` | C | `step_id` |
| `ftue_name_shown` | C | `step_id` (name) |
| `ftue_year_shown` | C | `step_id` (year) |
| `ftue_aha_shown` | C | `step_id` (era) |
| `ftue_timeline_shown` | C | `step_id` (welcome) |
| `ftue_save_shown` | C | `step_id` (save) |
| `ftue_step_completed` | C | `step_id` |
| `ftue_exited` | C | `step_id` |
| `ftue_completed` | C | `is_new_account: true`, or `via: "dev_bypass"` |
| `claim_welcome_shown` | C | `moment_count` |
| `first_three_stories_completed` | C | none |

## content

| Event | C/S | Props |
|---|---|---|
| `story_created` | S | `story_id`, `visibility`, `date_precision`, `photo_count`, `rider_count`, `board_count`, `has_youtube`, `has_link`, `story_ordinal`, `is_first` |
| `story_edited` | S | `story_id`, plus edit fields |
| `story_deleted` | S | `story_id`, `moderated`, `author_id` |
| `story_date_fixed` | S | `story_id`, `author_id`, `moderated`, `date_precision` |
| `story_comment_added` | S | story and comment ids |
| `story_comment_deleted` | S | story and comment ids |
| `story_reaction_set` | S | story id, emoji |
| `story_reaction_removed` | S | story id |
| `story_connection_added` | S | story id, entity |
| `story_connection_removed` | S | story id, entity |
| `claim_created` | C | `predicate`, `subject_type`, `object_type`, `visibility` |
| `riding_day_created` | C | `place_id`, `rider_count`, `has_note`, `visibility` |
| `checkout_started` | S | `domain: "commerce"`, `tier`, `is_gift` |
| `checkout_completed` | S | `domain: "commerce"`, `tier` |
| `membership_cancelled` | S | `domain: "commerce"`, `tier` |
| `payment_failed` | S | `domain: "commerce"`, `tier` |
| `gift_redeemed` | S | `domain: "commerce"` |
| `billing_portal_opened` | S | `domain: "commerce"` |

## invite

| Event | C/S | Props |
|---|---|---|
| `invite_modal_opened` | C | `surface`, `person_id`, `predicate` |
| `invite_modal_dismissed` | C | `surface`, `person_id`, `predicate` |
| `invite_link_created` | C | `surface`, `person_id`, `predicate` |
| `invite_email_sent` | C | `surface`, `person_id`, `predicate` |
| `invite_link_copied` | C | `surface`, `person_id`, `auto` |
| `invite_email_added` | C | `surface`, `person_id` |
| `invite_prompt_shown` | C | `surface`, `person_id` |
| `invite_prompt_clicked` | C | `surface`, `person_id` |
| `invite_prompt_dismissed` | C | `surface`, `person_id` |
| `share_link_copied` | C | `surface`, `person_id` |
| `share_clicked` | C | `surface`, `method` (native, clipboard) |
| `invite_accepted` | S | `path` (email_invite, public_tag, admin_invite), `node_id` |
| `tag_threshold_notification_sent` | S | `person_id`, `distinct_tagger_count` |
| `claim_node_invited` | S | `node_id`, `surface`, `resend`, `actor_id` (moved from `moderation` 2026-09-10) |
| `claim_node_requested` | S | `claim_request_id`, `node_id`, `verification_tier`, `source` (moved from `moderation` 2026-09-10) |

## moderation

| Event | C/S | Props |
|---|---|---|
| `claim_requested` | S | `claim_request_id`, `node_id`, `verification_tier`, `vouches_required` |
| `claim_approved` | S | `claim_request_id`, `path`, `noop`, ghost and canonical ids, repoint counts |
| `claim_node_approved` | S | `claim_request_id`, `node_id`, `verification_tier` |
| `claim_status_changed` | S | `claim_request_id`, `from`, `to`, `reason` |
| `vouch_added` | S | `claim_request_id`, `voucher_id`, `relationship`, `vouch_count`, `threshold_met` |

All five now carry a non-null `actor_id` (the acting user), passed via the shared
`trackServerEvent` helper in `src/lib/track-server.ts`.

## redirect

| Event | C/S | Props |
|---|---|---|
| `node_redirect` | S | `from_slug`, `to_slug`, `reason` (+ `occurred_at` stamped at the edge) |

## error (stored `category: "error"`, real domain in `props.domain`)

| Tag | C/S | Domain |
|---|---|---|
| `invite_post_fetch_failed` | C | invite |
| `threshold_count_query_failed` | S | invite |
| `threshold_notification_send_failed` | S | invite |
| `invite_resend_failed` | n/a | invite (declared, no call site yet) |
| `invite_db_insert_failed` | n/a | invite (declared, no call site yet) |
| `invite_target_not_claimable` | n/a | invite (declared, no call site yet) |
| `threshold_notification_dedup_violation` | n/a | invite (declared, no call site yet) |
