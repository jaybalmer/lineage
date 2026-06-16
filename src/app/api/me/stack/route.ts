import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import type { PublicStackEntry, PublicStackEntryType, PublicStackCategoryKey } from "@/types"

// GET  /api/me/stack — the caller's saved public_stack_entries, position-ordered.
// PUT  /api/me/stack — rewrite the caller's stack (delete-and-reinsert in order).
//
// The owner-curation backend for the Stack View. The manage surface at
// /me/public-view reads the candidate entries from the in-app store (signed-in,
// so the store is available) and persists the chosen selection here. The stack
// is "rebuilt on each edit" (supplement), so PUT replaces the whole set rather
// than diffing. Shape + hard-max validation mirrors the public_stack_entry_shape
// DB constraint so a malformed write is rejected before it reaches Postgres.

const ENTRY_TYPES = new Set<PublicStackEntryType>(["story", "place", "event", "board", "rider", "category_summary"])
const CATEGORY_KEYS = new Set<PublicStackCategoryKey>(["places", "boards", "events", "riders", "stories"])
const MAX_ENTRIES = 20
const TITLE_MAX = 200
const SUMMARY_MAX = 600

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { data, error } = await db
    .from("public_stack_entries")
    .select("*")
    .eq("owner_profile_id", user.id)
    .order("position", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: (data ?? []) as PublicStackEntry[] })
}

type IncomingEntry = {
  entry_type?: unknown
  entry_ref_id?: unknown
  category_key?: unknown
  custom_title?: unknown
  custom_summary?: unknown
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function PUT(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const incoming: unknown = body?.entries
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "entries must be an array" }, { status: 400 })
  }
  if (incoming.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `A stack can hold at most ${MAX_ENTRIES} entries.` }, { status: 400 })
  }

  // Validate + normalize. Drop duplicate refs and a second card for the same
  // category (one summary per category, max — supplement) rather than erroring.
  const seenRefs = new Set<string>()
  const seenCategories = new Set<string>()
  const rows: Omit<PublicStackEntry, "id" | "created_at" | "updated_at">[] = []

  for (const raw of incoming as IncomingEntry[]) {
    const entry_type = raw.entry_type as PublicStackEntryType
    if (!ENTRY_TYPES.has(entry_type)) {
      return NextResponse.json({ error: `Unknown entry_type: ${String(raw.entry_type)}` }, { status: 400 })
    }
    const custom_title = cleanText(raw.custom_title, TITLE_MAX)
    const custom_summary = cleanText(raw.custom_summary, SUMMARY_MAX)

    if (entry_type === "category_summary") {
      const category_key = raw.category_key as PublicStackCategoryKey
      if (!CATEGORY_KEYS.has(category_key)) {
        return NextResponse.json({ error: "category_summary needs a valid category_key" }, { status: 400 })
      }
      if (seenCategories.has(category_key)) continue
      seenCategories.add(category_key)
      rows.push({
        owner_profile_id: user.id, entry_type, entry_ref_id: null, category_key,
        position: rows.length, custom_title, custom_summary,
      })
    } else {
      const entry_ref_id = typeof raw.entry_ref_id === "string" ? raw.entry_ref_id.trim() : ""
      if (!entry_ref_id) {
        return NextResponse.json({ error: `${entry_type} needs an entry_ref_id` }, { status: 400 })
      }
      const dedupeKey = `${entry_type}:${entry_ref_id}`
      if (seenRefs.has(dedupeKey)) continue
      seenRefs.add(dedupeKey)
      rows.push({
        owner_profile_id: user.id, entry_type, entry_ref_id, category_key: null,
        position: rows.length, custom_title, custom_summary,
      })
    }
  }

  const db = getServiceClient()
  const { error: delErr } = await db.from("public_stack_entries").delete().eq("owner_profile_id", user.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rows.length > 0) {
    const { error: insErr } = await db.from("public_stack_entries").insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const { data } = await db
    .from("public_stack_entries")
    .select("*")
    .eq("owner_profile_id", user.id)
    .order("position", { ascending: true })

  return NextResponse.json({ ok: true, entries: (data ?? []) as PublicStackEntry[] })
}
