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
  const e = end ? formatSmartDate(end) : "present"
  return s === e ? s : `${s} – ${e}`
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
