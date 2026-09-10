// Server-only fire-and-forget helper for the claim-event and invite-event
// sinks. Collapses the five byte-identical private trackEvent() helpers that
// used to live in the claim-request / invite-node / claim-node routes into one
// place, so the actor id, distinct id, and event time are threaded in a single
// spot rather than being silently dropped per-route (brief T1).
//
// Like src/lib/analytics.ts, this POSTs to the /api/track/* hop rather than
// calling captureServerEvent directly: that keeps the PostHog flush + the
// analytics_events insert off the caller's request path in a separate
// invocation, instead of either adding latency to the user's response or
// floating un-awaited and getting truncated when the serverless function
// returns.

interface TrackServerOpts {
  actorId?: string | null
  distinctId?: string | null
  occurredAt?: string | null
}

export function trackServerEvent(
  origin: string,
  sink: "claim-event" | "invite-event",
  event: string,
  props: Record<string, unknown>,
  opts: TrackServerOpts = {},
): void {
  // Stamp the event at call time so PostHog orders events by when they actually
  // fired, not when the server happened to capture them. Two fire-and-forget
  // POSTs can otherwise be captured out of order, which zeroes out the final
  // step of a strict-order funnel (mirrors src/lib/analytics.ts).
  const occurredAt = opts.occurredAt ?? new Date().toISOString()
  void fetch(`${origin}/api/track/${sink}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event,
      props,
      actor_id: opts.actorId ?? null,
      distinct_id: opts.distinctId ?? null,
      occurred_at: occurredAt,
    }),
  }).catch(() => {})
}
