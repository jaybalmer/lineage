"use client"

import { useEffect } from "react"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

// Guarded PostHog provider. With NEXT_PUBLIC_POSTHOG_KEY absent we render
// children untouched and never init the client, so a missing key degrades to
// no-capture rather than a crash. Diagnostics Phase 1, brief D9.
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

  useEffect(() => {
    if (!key) return
    if (posthog.__loaded) return
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      // Mask all input values in session replay so we never record emails,
      // names, story bodies, or claim notes. PII discipline, brief D-LOCKED-3.
      session_recording: { maskAllInputs: true },
      // Only create PostHog person profiles for identified (signed-in) users.
      person_profiles: "identified_only",
    })
  }, [key])

  if (!key) return <>{children}</>
  return <PHProvider client={posthog}>{children}</PHProvider>
}
