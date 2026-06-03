// Client-safe capture helpers for Diagnostics Phase 1. Mirrors the
// invite-tracking client/server split: these fire-and-forget POST to the
// /api/track/* routes, which are the single sink-writer (see
// src/lib/analytics-server.ts). Safe to import into client components.
//
// distinct_id is read from posthog-js (initialized in the PostHogProvider) and
// sent up so server-side posthog-node captures land on the same person and
// funnel as the client's anonymous session. Everything is swallowed: a missing
// key or a posthog-js that has not loaded yet degrades to no-op (brief D9).

import posthog from "posthog-js"
import type { AnalyticsCategory } from "@/types"

function distinctId(): string | undefined {
  try {
    if (typeof window === "undefined") return undefined
    return posthog.get_distinct_id?.()
  } catch {
    return undefined
  }
}

export function trackEvent(
  category: AnalyticsCategory,
  event: string,
  props: Record<string, unknown> = {},
  opts: { actorId?: string | null } = {}
): void {
  // Stamp the event at call time on the client. captureServerEvent forwards
  // this to PostHog as the event timestamp so funnels order events by when they
  // actually fired. Without it, two fire-and-forget POSTs (e.g. signup_succeeded
  // then ftue_completed) get the server's capture time and can invert, which
  // zeroes out the final step of a strict-order funnel.
  const occurredAt = new Date().toISOString()
  void fetch("/api/track/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      category,
      event,
      props,
      actor_id: opts.actorId ?? null,
      distinct_id: distinctId(),
      occurred_at: occurredAt,
    }),
    keepalive: true,
  }).catch(() => {})
}

export function trackError(
  category: AnalyticsCategory,
  tag: string,
  payload: Record<string, unknown> = {}
): void {
  void fetch("/api/track/error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category, tag, payload }),
    keepalive: true,
  }).catch(() => {})
}

// Associate the current PostHog session with an auth user, so events after
// signup attach to the user and the anon->identified funnel stitches. No-op
// when posthog-js is not loaded (no key).
export function identifyUser(userId: string, props: Record<string, unknown> = {}): void {
  try {
    if (typeof window === "undefined") return
    posthog.identify?.(userId, props)
  } catch {
    // ignore
  }
}
