"use client"

// A Link that records one analytics event on click (FNRad Archive, A7). For
// server-rendered CTAs that otherwise need no client code.

import Link from "next/link"
import type { ComponentProps } from "react"
import { trackEvent } from "@/lib/analytics"

export function TrackedLink({
  event,
  props,
  ...rest
}: ComponentProps<typeof Link> & { event: string; props?: Record<string, unknown> }) {
  return <Link {...rest} onClick={() => trackEvent("content", event, props ?? {})} />
}
