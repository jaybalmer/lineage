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

/**
 * How recent an entry's created_at must be for a celebration to fire (BUG-167).
 * The seen-set alone is a localStorage high-water mark: any read-path change
 * that surfaces previously hidden rows (PR #188 own-non-public stories, a trust
 * auto-approve, a limit=100 boundary crossing) adds OLD ids that are legitimately
 * absent from the set, and they then read as fresh adds and replay their toast.
 * Gating on recency kills that whole class regardless of why an id showed up
 * unseen. 10 minutes covers a slow add plus an accidental reload; nothing
 * historical can slip through.
 */
export const CELEBRATION_RECENCY_MS = 10 * 60 * 1000

/**
 * True when `iso` (a row's created_at) is within `withinMs` of now. Missing or
 * unparseable timestamps return false: a celebration should never fire for an
 * entry we cannot prove is recent. Compare against created_at, never story_date
 * (which can be 1993).
 */
export function isRecentlyCreated(
  iso: string | null | undefined,
  withinMs: number = CELEBRATION_RECENCY_MS,
): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return Date.now() - t <= withinMs
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
