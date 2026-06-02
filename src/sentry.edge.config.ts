import * as Sentry from "@sentry/nextjs"

// Edge-runtime Sentry init. Guarded like the server config so a missing DSN
// degrades to no-capture. Diagnostics Phase 1, brief D9.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  })
}
