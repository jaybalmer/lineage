"use client"

/**
 * Per-(user, kind) "seen" set for the contextual entry-add celebrations
 * fired from /profile (the contextual claim and story toasts queued via
 * queueCelebration → CelebrationOverlay).
 *
 * Without persistence, the two useEffects on the profile page re-fire on
 * every visit: dbClaims and stories arrive after the initial render, so the
 * count jumps from a small baseline to the full set and the effect reads it
 * as "a new entry was just added". That re-plays the most-recent claim and
 * story celebration on every reload.
 *
 * This module persists which entry IDs have already had their celebration
 * shown for a given user. A missing localStorage key means "never seen any
 * entries before" — on first visit we silently mark every currently-loaded
 * entry as seen (high-water mark) so existing entries don't replay, but a
 * genuinely new entry added later still fires its celebration once.
 *
 * Mirrors the existing localStorage precedent at
 *   src/components/ui/bulk-invite-prompt.tsx → lineage_invite_bulk_dismissed_count
 * and the one-time intro toast in
 *   src/components/pending-tag-poller.tsx → lineage-tags-intro-seen.
 */

export type SeenKind = "claim" | "story"

const KEY = (userId: string, kind: SeenKind) =>
  `lineage_seen_entry_celebrations:${userId}:${kind}`

/**
 * Returns the set of seen IDs for this (user, kind), or null if the key has
 * never been written. Null is the signal to seed a high-water mark; an empty
 * set means "initialized, but nothing seen yet" (treat new IDs as celebrate-worthy).
 */
export function readSeenIds(userId: string, kind: SeenKind): Set<string> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY(userId, kind))
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === "string"))
  } catch {
    return new Set()
  }
}

export function writeSeenIds(userId: string, kind: SeenKind, ids: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY(userId, kind), JSON.stringify([...ids]))
  } catch {
    // Quota exceeded or storage unavailable. Silently ignore; worst case the
    // celebration re-fires next visit, which is no worse than before this fix.
  }
}
