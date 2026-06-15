// Per-user comment-email cadence. Shared, dependency-free, client-safe: the
// settings page, the API route, and the email pipeline all read these values,
// so the type, the option metadata, and the smart-spacing ladder live in one
// place. No node/crypto imports here (see email-pref-token.ts for the signed
// one-click links).

export type CommentEmailPref = "smart" | "each" | "6h" | "daily" | "off"

export const COMMENT_EMAIL_PREFS: CommentEmailPref[] = ["smart", "each", "6h", "daily", "off"]

export const DEFAULT_COMMENT_EMAIL_PREF: CommentEmailPref = "smart"

export function isCommentEmailPref(p: unknown): p is CommentEmailPref {
  return typeof p === "string" && (COMMENT_EMAIL_PREFS as string[]).includes(p)
}

// Display copy for the settings page and the email footer. One source of truth
// so the wording stays consistent between where you set it and where it is
// explained.
export const COMMENT_EMAIL_PREF_META: Record<
  CommentEmailPref,
  { label: string; blurb: string }
> = {
  smart: {
    label: "Smart spacing",
    blurb:
      "An email for each of the first few comments, then spaced out as a thread gets busy (1, 2, 3, 4, 5, then 10, 25, 50, 100...). One per comment on a normal story, never a flood on a popular one.",
  },
  each: {
    label: "Every comment",
    blurb: "An email for every single comment. The most detailed option; can get busy on an active story.",
  },
  "6h": {
    label: "Every 6 hours",
    blurb: "At most one email per story every 6 hours, summarising the new comments since the last one.",
  },
  daily: {
    label: "Once a day",
    blurb: "At most one email per story per day, summarising the new comments since the last one.",
  },
  off: {
    label: "Off",
    blurb: "No comment notification emails. You can still see comments on the story itself.",
  },
}

// The smart-spacing ladder: send when the running count of comments (by people
// other than the author) lands on one of these. The early run (1..5) means a
// normal story emails on every comment; the gaps after that throttle a thread
// that takes off. Beyond the explicit ladder, send once per 10,000 so an
// extreme thread still ticks without an unbounded list.
const SMART_MILESTONES = new Set([1, 2, 3, 4, 5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000])

export function isSmartMilestone(count: number): boolean {
  if (count <= 0) return false
  if (SMART_MILESTONES.has(count)) return true
  return count > 10000 && count % 10000 === 0
}
