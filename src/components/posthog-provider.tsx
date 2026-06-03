"use client"

import type { ReactNode } from "react"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

// PostHog is initialized in src/instrumentation-client.ts, which Next.js runs
// before hydration and before any component effect, so early FTUE events (e.g.
// ftue_landed, fired from onboarding-flow's mount effect) get a real distinct id
// that stitches on identify. This provider only wires the already-initialized
// singleton into the posthog-js/react context. With the key absent the singleton
// was never initialized, so we render children untouched. Diagnostics Phase 1.
export function PostHogProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return <>{children}</>
  return <PHProvider client={posthog}>{children}</PHProvider>
}
