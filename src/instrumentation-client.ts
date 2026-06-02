import * as Sentry from "@sentry/nextjs"

// Client-side Sentry init. Guarded on the DSN so a missing key is inert
// (no-capture, no throw). Diagnostics Phase 1, brief D9.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
