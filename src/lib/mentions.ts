// Podcast pass Session B: pure mention helpers.
//
// Client-safe by design: this module is imported by MentionRow and the editor
// modal, so it must never reach for the service client or anything else that
// pulls next/headers into a client bundle. The server-side episode hydration
// lives in mentions-server.ts for exactly that reason.

import type { MentionSubjectType } from "@/types"

export const MENTION_SUBJECT_TYPES: MentionSubjectType[] = [
  "person", "place", "org", "board", "event",
]

/**
 * Parse a timestamp input into whole seconds. Accepts `mm:ss`, `h:mm:ss`, or a
 * raw seconds count. Returns null for empty input and undefined for garbage,
 * so a caller can tell "clear this" from "reject this".
 */
export function parseTimestampInput(raw: string): number | null | undefined {
  const value = raw.trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  const parts = value.split(":")
  if (parts.length < 2 || parts.length > 3) return undefined
  if (!parts.every((p) => /^\d+$/.test(p.trim()))) return undefined
  const nums = parts.map((p) => parseInt(p.trim(), 10))
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]]
  if (m > 59 || s > 59) return undefined
  return h * 3600 + m * 60 + s
}

/** Seconds to `mm:ss`, or `h:mm:ss` past the hour mark. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
