"use client"

import { useEffect } from "react"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"

// PB-009 Phase 2: lightweight 30s polling of /api/me/tags?status=pending so
// the avatar-dropdown badge and profile pill stay close to live. No realtime
// subscription yet — Phase 4 or 5 can swap this for a Supabase realtime
// channel if the count update latency becomes a complaint.
//
// Also fires the one-time "you have tag requests" intro toast — guarded by a
// localStorage flag so it never reappears for the same browser. Resets when
// the flag is cleared (rare, mostly used in dev).

const POLL_MS = 30_000
const INTRO_FLAG = "lineage-tags-intro-seen"

export function PendingTagPoller() {
  const { activePersonId, authReady, pendingTagCount, refreshPendingTagCount, addToast } = useLineageStore()

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) return

    refreshPendingTagCount()
    const id = setInterval(refreshPendingTagCount, POLL_MS)
    return () => clearInterval(id)
  }, [authReady, activePersonId, refreshPendingTagCount])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) return
    if (pendingTagCount <= 0) return
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(INTRO_FLAG)) return

    window.localStorage.setItem(INTRO_FLAG, "1")
    addToast("You have new tag requests. Review them in your Tags inbox.")
  }, [authReady, activePersonId, pendingTagCount, addToast])

  return null
}
