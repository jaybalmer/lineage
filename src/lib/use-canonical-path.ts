"use client"

import { useEffect } from "react"

/**
 * Rewrites the address bar to `canonical` when it differs from the current
 * pathname — without a navigation (no reload, no refetch). Query string and
 * hash are preserved. Pass `null` to skip (e.g. before the entity resolves, or
 * when the current URL is already canonical).
 *
 * Used to make detail pages show their name-based slug even when reached via a
 * raw UUID (pasted/bookmarked link, or a link we haven't migrated yet). Next
 * App Router supports window.history.replaceState for shallow URL updates.
 */
export function useCanonicalPath(canonical: string | null): void {
  useEffect(() => {
    if (!canonical) return
    if (typeof window === "undefined") return
    if (window.location.pathname === canonical) return
    const { search, hash } = window.location
    window.history.replaceState(window.history.state, "", canonical + search + hash)
  }, [canonical])
}
