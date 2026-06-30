// Shared validation + normalization for writing public_stack_entries on a
// non-profile owner (event or org). The profile path (/api/me/stack) keeps its
// own inline copy; this helper backs the FNRad event + org curate routes so the
// shape rules (one summary per category, dedupe refs, hard max, text limits)
// live in one place and mirror the public_stack_entry_shape DB constraint.

import type { PublicStackEntryType, PublicStackCategoryKey } from "@/types"

const ENTRY_TYPES = new Set<PublicStackEntryType>(["story", "place", "event", "board", "rider", "category_summary"])
const CATEGORY_KEYS = new Set<PublicStackCategoryKey>(["places", "boards", "events", "riders", "stories"])
const MAX_ENTRIES = 20
const TITLE_MAX = 200
const SUMMARY_MAX = 600

export type StackOwner = { owner_type: "event" | "org"; owner_id: string }

export type StackRow = {
  owner_type: "event" | "org"
  owner_id: string
  owner_profile_id: null
  entry_type: PublicStackEntryType
  entry_ref_id: string | null
  category_key: PublicStackCategoryKey | null
  position: number
  custom_title: string | null
  custom_summary: string | null
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/** Validate + normalize an incoming `entries` array into rows ready to insert,
 *  or return a user-facing error + HTTP status. owner_profile_id is always null
 *  for non-profile owners (the row is addressed by owner_type/owner_id). */
export function buildStackRows(
  incoming: unknown,
  owner: StackOwner,
): { rows: StackRow[] } | { error: string; status: number } {
  if (!Array.isArray(incoming)) return { error: "entries must be an array", status: 400 }
  if (incoming.length > MAX_ENTRIES) {
    return { error: `A featured set can hold at most ${MAX_ENTRIES} entries.`, status: 400 }
  }

  const seenRefs = new Set<string>()
  const seenCategories = new Set<string>()
  const rows: StackRow[] = []

  for (const raw of incoming as Record<string, unknown>[]) {
    const entry_type = raw.entry_type as PublicStackEntryType
    if (!ENTRY_TYPES.has(entry_type)) {
      return { error: `Unknown entry_type: ${String(raw.entry_type)}`, status: 400 }
    }
    const custom_title = cleanText(raw.custom_title, TITLE_MAX)
    const custom_summary = cleanText(raw.custom_summary, SUMMARY_MAX)

    if (entry_type === "category_summary") {
      const category_key = raw.category_key as PublicStackCategoryKey
      if (!CATEGORY_KEYS.has(category_key)) {
        return { error: "category_summary needs a valid category_key", status: 400 }
      }
      if (seenCategories.has(category_key)) continue
      seenCategories.add(category_key)
      rows.push({
        ...owner, owner_profile_id: null, entry_type, entry_ref_id: null, category_key,
        position: rows.length, custom_title, custom_summary,
      })
    } else {
      const entry_ref_id = typeof raw.entry_ref_id === "string" ? raw.entry_ref_id.trim() : ""
      if (!entry_ref_id) return { error: `${entry_type} needs an entry_ref_id`, status: 400 }
      const dedupeKey = `${entry_type}:${entry_ref_id}`
      if (seenRefs.has(dedupeKey)) continue
      seenRefs.add(dedupeKey)
      rows.push({
        ...owner, owner_profile_id: null, entry_type, entry_ref_id, category_key: null,
        position: rows.length, custom_title, custom_summary,
      })
    }
  }

  return { rows }
}
