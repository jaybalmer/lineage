import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// FNRad Featured Timelines Phase 2: editor-managed header guest(s) for an
// episode (event_guests). Kept separate from attendance claims and the curated
// stack so the guest header is unambiguous.
//
// GET /api/events/[id]/guests — { person_ids: string[] } in position order.
// PUT /api/events/[id]/guests — editor-only replace of the ordered guest set.

const MAX_GUESTS = 12

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = getServiceClient()
  const { data, error } = await db
    .from("event_guests")
    .select("person_id, position")
    .eq("event_id", id)
    .order("position", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    person_ids: ((data ?? []) as { person_id: string }[]).map((g) => g.person_id),
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireEditor()
  if (response) return response

  const { id: eventId } = await params
  const body = await req.json().catch(() => null)
  const incoming: unknown = body?.person_ids
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "person_ids must be an array" }, { status: 400 })
  }

  // Normalize: trimmed, deduped, capped, order preserved.
  const seen = new Set<string>()
  const ids: string[] = []
  for (const raw of incoming) {
    if (typeof raw !== "string") continue
    const pid = raw.trim()
    if (!pid || seen.has(pid)) continue
    seen.add(pid)
    ids.push(pid)
    if (ids.length >= MAX_GUESTS) break
  }

  const db = getServiceClient()
  const { data: ev } = await db.from("events").select("id").eq("id", eventId).maybeSingle()
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const { error: delErr } = await db.from("event_guests").delete().eq("event_id", eventId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (ids.length > 0) {
    const rows = ids.map((person_id, position) => ({
      event_id: eventId, person_id, position, added_by: user.id,
    }))
    const { error: insErr } = await db.from("event_guests").insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, person_ids: ids })
}
