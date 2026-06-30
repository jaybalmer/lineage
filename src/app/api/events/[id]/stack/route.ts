import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { readEventStack } from "@/lib/public-timeline-read"
import type { PublicStackEntryType, PublicStackCategoryKey } from "@/types"

// FNRad Featured Timelines Phase 2: an episode's editor-curated featured set.
//
// GET  /api/events/[id]/stack — server-resolved episode payload (owner header,
//   meta, resolved stack entries, referenced stories + entities). Public read,
//   no enabled gate: the in-app episode page is already community-visible, and
//   the stack content is curated catalog references, not private data.
// PUT  /api/events/[id]/stack — editor-only rewrite of the curated set
//   (delete-and-reinsert with owner_type='event'), mirroring /api/me/stack.

const ENTRY_TYPES = new Set<PublicStackEntryType>(["story", "place", "event", "board", "rider", "category_summary"])
const CATEGORY_KEYS = new Set<PublicStackCategoryKey>(["places", "boards", "events", "riders", "stories"])
const MAX_ENTRIES = 20
const TITLE_MAX = 200
const SUMMARY_MAX = 600

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await readEventStack({ eventId: id })
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(payload)
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireEditor()
  if (response) return response

  const { id: eventId } = await params
  const db = getServiceClient()

  // The target event must exist (and be an episode, the only curatable event).
  const { data: ev } = await db
    .from("events")
    .select("id, event_type")
    .eq("id", eventId)
    .maybeSingle()
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const incoming: unknown = body?.entries
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "entries must be an array" }, { status: 400 })
  }
  if (incoming.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `A featured set can hold at most ${MAX_ENTRIES} entries.` }, { status: 400 })
  }

  const seenRefs = new Set<string>()
  const seenCategories = new Set<string>()
  type Row = {
    owner_type: "event"; owner_id: string; owner_profile_id: null
    entry_type: PublicStackEntryType; entry_ref_id: string | null
    category_key: PublicStackCategoryKey | null; position: number
    custom_title: string | null; custom_summary: string | null
  }
  const rows: Row[] = []

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
        owner_type: "event", owner_id: eventId, owner_profile_id: null,
        entry_type, entry_ref_id: null, category_key,
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
        owner_type: "event", owner_id: eventId, owner_profile_id: null,
        entry_type, entry_ref_id, category_key: null,
        position: rows.length, custom_title, custom_summary,
      })
    }
  }

  const { error: delErr } = await db
    .from("public_stack_entries")
    .delete()
    .eq("owner_type", "event")
    .eq("owner_id", eventId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rows.length > 0) {
    const { error: insErr } = await db.from("public_stack_entries").insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const payload = await readEventStack({ eventId })
  return NextResponse.json({ ok: true, ...(payload ?? {}) })
}
