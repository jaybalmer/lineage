import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Predicate, ConfidenceLevel } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert a display name to a URL-safe slug, e.g. "Jay Balmer" → "jay_balmer" */
export function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

export function formatYear(dateStr?: string): string {
  if (!dateStr) return "present"
  return dateStr.slice(0, 4)
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

/** Formats a YYYY-MM-DD date string smartly:
 *  - If day > 1 and month present → "15 Jan 2023"
 *  - Otherwise → "2023" (year only) */
export function formatSmartDate(dateStr?: string): string {
  if (!dateStr) return "present"
  const parts = dateStr.split("-")
  const year = parts[0]
  const month = parseInt(parts[1] ?? "0")
  const day = parseInt(parts[2] ?? "0")
  if (month >= 1 && month <= 12 && day > 1) {
    return `${day} ${MONTHS_SHORT[month - 1]} ${year}`
  }
  return year
}

export function formatDateRange(start?: string, end?: string): string {
  if (!start) return ""
  const s = formatSmartDate(start)
  // No end date stored → show the single date only. We do not synthesize a
  // "to present" range (BUG-033): an open-ended claim renders just its start.
  if (!end) return s
  const e = formatSmartDate(end)
  return s === e ? s : `${s} – ${e}`
}

/** Format a possibly-partial ISO date to a clean label, omitting absent
 *  components. Accepts "YYYY", "YYYY-MM", or "YYYY-MM-DD":
 *  - "1986"       → "1986"
 *  - "1992-03"    → "Mar 1992"
 *  - "1992-03-15" → "15 Mar 1992"
 *  Unlike formatSmartDate (which collapses partial dates to year-only), this
 *  keeps the month when present. Never emits "NaN" or "undefined". */
export function formatPartialDate(dateStr?: string): string {
  if (!dateStr) return ""
  const [year, m, d] = dateStr.split("-")
  if (!year) return ""
  const month = m ? parseInt(m) : NaN
  const monthName = month >= 1 && month <= 12 ? MONTHS_SHORT[month - 1] : ""
  const day = d ? parseInt(d) : NaN
  if (monthName && day >= 1) return `${day} ${monthName} ${year}`
  if (monthName) return `${monthName} ${year}`
  return year
}

/** Format an event's start/end dates as a range, compressing shared parts.
 *  Precision-aware (see formatPartialDate), so it is safe on year-only and
 *  year-month events. Examples:
 *  - start only "1992-03-03"               → "3 Mar 1992"
 *  - same month "1992-03-03" / "1992-03-05" → "3–5 Mar 1992"
 *  - cross month "1992-03-30" / "1992-04-02" → "30 Mar 1992 – 2 Apr 1992"
 *  - year-month "2026-05"                   → "May 2026" */
export function formatEventDateRange(start?: string, end?: string): string {
  if (!start) return ""
  const startStr = formatPartialDate(start)
  if (!end || end === start) return startStr
  const [sy, sm, sd] = start.split("-")
  const [ey, em, ed] = end.split("-")
  // Same year + month with both days present: "3–5 Mar 1992"
  if (sy === ey && sm === em && sd && ed) {
    const month = parseInt(sm)
    const monthName = month >= 1 && month <= 12 ? MONTHS_SHORT[month - 1] : ""
    if (monthName) return `${parseInt(sd)}–${parseInt(ed)} ${monthName} ${sy}`
  }
  return `${startStr} – ${formatPartialDate(end)}`
}

export const PREDICATE_LABELS: Record<Predicate, string> = {
  rode_at: "Rode at",
  worked_at: "Worked at",
  sponsored_by: "Sponsored by",
  part_of_team: "Part of team",
  fan_of: "Fan of",
  rode_with: "Rode with",
  shot_by: "Shot by",
  competed_at: "Competed at",
  spectated_at: "Spectated at",
  organized_at: "Organized",
  owned_board: "Rode",
  coached_by: "Coached by",
  organized: "Organized",
  located_at: "Located at",
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  "self-reported": "Self-reported",
  "corroborated": "Corroborated",
  "documented": "Documented",
  "partner-verified": "Partner verified",
}

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  "self-reported": "bg-zinc-700 text-zinc-300",
  "corroborated": "bg-blue-900 text-blue-200",
  "documented": "bg-emerald-900 text-emerald-200",
  "partner-verified": "bg-violet-900 text-violet-200",
}

/** Extract an 11-char YouTube video ID from any common URL format.
 *  Handles: watch?v=, youtu.be/, /embed/, /shorts/ */
export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export const PREDICATE_ICONS: Record<Predicate, string> = {
  rode_at: "🏔",
  worked_at: "🏪",
  sponsored_by: "🎽",
  part_of_team: "👥",
  fan_of: "❤️",
  rode_with: "🤙",
  shot_by: "📷",
  competed_at: "🏆",
  spectated_at: "👀",
  organized_at: "📋",
  owned_board: "🏂",
  coached_by: "🎓",
  organized: "🎪",
  located_at: "📍",
}
