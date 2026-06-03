import * as Sentry from "@sentry/nextjs"

// Guarded init: with no DSN (env var absent) we skip init entirely, so a
// missing key degrades to no-capture rather than crashing or adding noise.
// Diagnostics Phase 1, brief D9.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    // Launch-period default; revisit post-launch once volume is known.
    tracesSampleRate: 1.0,
  })
}
