// Fire-and-forget client telemetry for the invite surfaces.
//
// trackInviteEvent posts to /api/track/invite-event (a 204 stub today; the
// real PostHog captureClientEvent call will replace the route handler once
// the SDK is wired in). trackInviteError posts to /api/track/invite-error
// for instrumented error paths. Neither throws; callers do not need to
// await or wrap.
//
// Event and tag vocabularies are defined alongside the route handlers:
//   src/app/api/track/invite-event/route.ts
//   src/app/api/track/invite-error/route.ts

export type InviteEvent =
  | "share_link_copied"
  | "invite_email_added"
  | "invite_email_sent"

export type InviteErrorTag =
  | "clipboard_unavailable"
  | "invite_email_send_failed"

export function trackInviteEvent(
  event: InviteEvent,
  props: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return
  void fetch("/api/track/invite-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, props }),
    keepalive: true,
  }).catch(() => {})
}

export function trackInviteError(
  tag: InviteErrorTag,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return
  void fetch("/api/track/invite-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag, payload }),
    keepalive: true,
  }).catch(() => {})
}
