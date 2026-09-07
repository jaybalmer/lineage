import * as Sentry from "@sentry/nextjs"
import posthog from "posthog-js"
import { captureTouch } from "@/lib/attribution"

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
    // App Router navigates client-side, so the boolean form only ever captured
    // hard loads: every in-site navigation went uncounted, inflating every
    // page-level funnel's denominator. "history_change" captures pushState /
    // replaceState / popstate navigations too.
    capture_pageview: "history_change",
    capture_pageleave: true,
    // Mask all input values in session replay so we never record emails, names,
    // story bodies, or claim notes. PII discipline, brief D-LOCKED-3.
    session_recording: { maskAllInputs: true },
    // Only create PostHog person profiles for identified (signed-in) users.
    person_profiles: "identified_only",
  })
}

// First-touch acquisition capture. Runs here, before hydration and before any
// component effect, for the same reason the PostHog init moved here: ftue_landed
// fires from the onboarding mount effect and must be able to read a touch that is
// already stored. This module runs on a full page load, not on a client-side soft
// navigation, which is exactly right for first-touch (a full load by definition);
// last-touch misses only the rare UTM-bearing in-app soft nav, which does not
// happen because campaign links are external. captureTouch swallows its own
// errors, but wrap the call anyway: nothing in this file may ever throw, or client
// instrumentation breaks for the whole app.
try {
  captureTouch()
} catch {
  // never let attribution capture break instrumentation
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
