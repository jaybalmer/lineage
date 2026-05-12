// Fire-and-forget client + server helpers for invite analytics.
// Mirrors the pattern used by the claim-request routes; see
// src/app/api/track/invite-event/route.ts for the event vocabulary.
//
// Server-only helpers that touch service-role clients live in
// src/lib/invite-tracking-server.ts so this module stays safe to import from
// client components.

export const TAG_THRESHOLD = 3
export const TAG_THRESHOLD_NOTIFICATION_TYPE = "tag_threshold"

export type InviteSurface =
  | "person_profile"
  | "person_profile_banner"
  | "person_list"
  | "post_claim"
  | "post_claim_companion"
  | "story_card"
  | "profile_bulk_banner"
  | "profile_bulk_list"
  | "help_connect_card"

export type InviteEvent =
  | "invite_modal_opened"
  | "invite_modal_dismissed"
  | "invite_link_created"
  | "invite_email_sent"
  | "invite_link_copied"
  | "invite_prompt_shown"
  | "invite_prompt_clicked"
  | "invite_prompt_dismissed"
  | "share_link_copied"
  | "invite_email_added"
  | "tag_threshold_notification_sent"

export type InviteErrorTag =
  | "invite_resend_failed"
  | "invite_db_insert_failed"
  | "invite_target_not_claimable"
  | "invite_post_fetch_failed"
  | "threshold_notification_dedup_violation"
  | "threshold_notification_send_failed"
  | "threshold_count_query_failed"

export function trackInviteEvent(event: InviteEvent, props: Record<string, unknown> = {}): void {
  void fetch("/api/track/invite-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
    keepalive: true,
  }).catch(() => {})
}

export function trackInviteError(tag: InviteErrorTag, payload: Record<string, unknown> = {}): void {
  void fetch("/api/track/invite-error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag, payload }),
    keepalive: true,
  }).catch(() => {})
}

// Server-side variants — these require an absolute origin since they run
// inside route handlers where relative fetch isn't a thing.
export function trackInviteEventServer(origin: string, event: InviteEvent, props: Record<string, unknown> = {}): void {
  void fetch(`${origin}/api/track/invite-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

export function trackInviteErrorServer(origin: string, tag: InviteErrorTag, payload: Record<string, unknown> = {}): void {
  void fetch(`${origin}/api/track/invite-error`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag, payload }),
  }).catch(() => {})
}

// Centralized helper used by every entry point that decides whether to
// surface invite UI. Phase 2 targets node_status in ('catalog','unclaimed').
export function isInvitableNodeStatus(status: string | null | undefined): boolean {
  return status === "catalog" || status === "unclaimed"
}
