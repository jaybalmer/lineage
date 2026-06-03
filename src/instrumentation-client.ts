import * as Sentry from "@sentry/nextjs"
import posthog from "posthog-js"

// Client-side Sentry init. Guarded on the DSN so a missing key is inert
// (no-capture, no throw). Diagnostics Phase 1, brief D9.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  })
}

// Client-side PostHog init. Runs here (before hydration and before any React
// effect) instead of in a provider useEffect, so posthog is loaded before the
// first FTUE event fires. ftue_landed is dispatched from onboarding-flow's mount
// effect; React runs child effects before parent effects, so a provider-level
// init effect loses that race and ftue_landed falls into the shared "anonymous"
// distinct id that identify() never stitches into the user. Guarded on the key
// so a missing key is inert. Diagnostics Phase 1 funnel fix.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
if (posthogKey && !posthog.__loaded) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    // Mask all input values in session replay so we never record emails, names,
    // story bodies, or claim notes. PII discipline, brief D-LOCKED-3.
    session_recording: { maskAllInputs: true },
    // Only create PostHog person profiles for identified (signed-in) users.
    person_profiles: "identified_only",
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
