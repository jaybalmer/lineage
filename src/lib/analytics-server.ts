// Server-side capture layer for Diagnostics Phase 1. The single sink-writer:
// every product event is captured to PostHog (posthog-node) and written as an
// analytics_events row; every error is captured to Sentry and written as an
// analytics_events row with category='error'. Both functions are fully
// fire-and-forget: they never throw, so no caller is ever blocked or broken by
// a capture failure (brief D-LOCKED-1, D-LOCKED-2).
//
// Client-safe helpers live in src/lib/analytics.ts. This module imports the
// service-role client and posthog-node, so it must only be imported from
// server code (route handlers, server components, the store is client so it
// goes through the /api/track/* routes instead).

import { PostHog } from "posthog-node"
import * as Sentry from "@sentry/nextjs"
import { getServiceClient } from "@/lib/auth"
import type { AnalyticsCategory, AnalyticsSeverity } from "@/types"

const VALID_CATEGORIES: readonly AnalyticsCategory[] = [
  "auth",
  "ftue",
  "content",
  "invite",
  "redirect",
  "moderation",
  "error",
]

// Lazy posthog-node singleton. Returns null when the key is absent so capture
// degrades to no-op (brief D9). flushAt:1 sends each event immediately, which
// is what we want for low-volume launch traffic running on serverless.
let _posthog: PostHog | null | undefined
function getPostHogServer(): PostHog | null {
  if (_posthog !== undefined) return _posthog
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    _posthog = null
    return null
  }
  _posthog = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  })
  return _posthog
}

interface ServerEventArgs {
  category: AnalyticsCategory
  event: string
  props?: Record<string, unknown>
  /** Auth user id when known; null for anonymous / pre-auth. */
  actorId?: string | null
  /** PostHog distinct_id passed up from the client so anon events stitch into
   *  the same person/funnel. Falls back to actorId, then "anonymous". */
  distinctId?: string | null
  /** Client-side event time (ISO 8601) so PostHog orders events by when they
   *  actually fired, not when the server happened to capture them. Two
   *  fire-and-forget POSTs can otherwise be captured out of order, which breaks
   *  strict-order funnels (e.g. signup_succeeded before ftue_completed). */
  occurredAt?: string | null
}

export async function captureServerEvent(args: ServerEventArgs): Promise<void> {
  try {
    const { category, event } = args
    if (!VALID_CATEGORIES.includes(category) || !event) return
    const props = args.props ?? {}
    const actorId = args.actorId ?? null
    const distinctId = args.distinctId || actorId || "anonymous"
    const occurred = args.occurredAt ? new Date(args.occurredAt) : null
    const timestamp = occurred && !isNaN(occurred.getTime()) ? occurred : undefined

    const ph = getPostHogServer()
    if (ph) {
      ph.capture({
        distinctId,
        event,
        properties: { category, ...props },
        ...(timestamp ? { timestamp } : {}),
      })
      try {
        await ph.flush()
      } catch {
        // delivery is best-effort; never surface
      }
    }

    const db = getServiceClient()
    await db.from("analytics_events").insert({
      category,
      event,
      actor_id: actorId,
      props,
    })
  } catch {
    // fire-and-forget: a capture failure must never break a caller (D-LOCKED-2)
  }
}

interface ServerErrorArgs {
  /** The domain the error came from (invite, moderation, content, ...). The
   *  stored row always uses category='error'; this is recorded in props.domain
   *  and as a Sentry tag for grouping. */
  category: AnalyticsCategory
  tag: string
  payload?: Record<string, unknown>
  actorId?: string | null
  severity?: AnalyticsSeverity
}

export async function captureServerError(args: ServerErrorArgs): Promise<void> {
  try {
    const { tag } = args
    if (!tag) return
    const domain = VALID_CATEGORIES.includes(args.category) ? args.category : "error"
    const payload = args.payload ?? {}
    const actorId = args.actorId ?? null
    const severity: AnalyticsSeverity = args.severity ?? "error"

    Sentry.captureMessage(tag, {
      level: severity === "warning" ? "warning" : "error",
      tags: { domain, error_tag: tag },
      extra: payload,
    })

    const db = getServiceClient()
    await db.from("analytics_events").insert({
      category: "error",
      event: tag,
      severity,
      actor_id: actorId,
      props: { domain, ...payload },
    })
  } catch {
    // fire-and-forget
  }
}
