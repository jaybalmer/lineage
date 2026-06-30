import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// FNRad Featured Timelines Phase 4: an episode's member-added community
// connections (the riders/places/events/orgs/boards an episode covered but that
// are not in the editor-curated featured set).
//
// GET    /api/events/[id]/connections — raw grouped rows { type: [{ ref_id, added_by }] }.
//   Public read; the client resolves names from the store catalog (every ref is
//   a catalog entity, since the add picker only offers catalog items).
// POST   /api/events/[id]/connections — requireAuth, body { type, ref_id } (add).
// DELETE /api/events/[id]/connections — requireAuth, body { type, ref_id }.
//   Removal rights: the adder, or any editor.
//
// Simple junction model (brief §5.4, confirmed): no tag pipeline / consent gate.

type ConnType = "riders" | "places" | "events" | "orgs" | "boards"

const CONFIG: Record<ConnType, { table: string; col: string }> = {
  riders: { table: "event_people", col: "person_id" },
  places: { table: "event_places", col: "place_id" },
  events: { table: "event_events", col: "related_event_id" },
  orgs:   { table: "event_orgs",   col: "org_id" },
  boards: { table: "event_boards", col: "board_id" },
}

const TYPES = Object.keys(CONFIG) as ConnType[]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params
  const db = getServiceClient()

  const results = await Promise.all(
    TYPES.map(async (type) => {
      const { col, table } = CONFIG[type]
      const { data } = await db
        .from(table)
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ref_id: r[col] as string,
        added_by: (r.added_by as string | null) ?? null,
      }))
      return [type, rows] as const
    }),
  )

  return NextResponse.json(Object.fromEntries(results))
}

function parseBody(body: unknown): { type: ConnType; ref_id: string } | null {
  const type = (body as { type?: unknown })?.type
  const ref = (body as { ref_id?: unknown })?.ref_id
  if (typeof type !== "string" || !TYPES.includes(type as ConnType)) return null
  if (typeof ref !== "string" || !ref.trim()) return null
  return { type: type as ConnType, ref_id: ref.trim() }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth()
  if (response) return response

  const { id: eventId } = await params
  const parsed = parseBody(await req.json().catch(() => null))
  if (!parsed) return NextResponse.json({ error: "type and ref_id are required" }, { status: 400 })

  const db = getServiceClient()
  const { data: ev } = await db.from("events").select("id").eq("id", eventId).maybeSingle()
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  const { table, col } = CONFIG[parsed.type]
  // Ignore a duplicate (PK conflict) so re-adding is idempotent.
  const { error } = await db
    .from(table)
    .upsert({ event_id: eventId, [col]: parsed.ref_id, added_by: user.id }, { onConflict: `event_id,${col}` })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth()
  if (response) return response

  const { id: eventId } = await params
  const parsed = parseBody(await req.json().catch(() => null))
  if (!parsed) return NextResponse.json({ error: "type and ref_id are required" }, { status: 400 })

  const db = getServiceClient()
  const { table, col } = CONFIG[parsed.type]

  const { data: row } = await db
    .from(table)
    .select("added_by")
    .eq("event_id", eventId)
    .eq(col, parsed.ref_id)
    .maybeSingle()
  if (!row) return NextResponse.json({ ok: true }) // already gone

  // Removal rights: the adder, or any editor.
  const isAdder = (row as { added_by: string | null }).added_by === user.id
  if (!isAdder) {
    const { data: profile } = await db
      .from("profiles")
      .select("is_editor, membership_tier")
      .eq("id", user.id)
      .single()
    const isEditor = profile?.is_editor || profile?.membership_tier === "founding"
    if (!isEditor) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await db.from(table).delete().eq("event_id", eventId).eq(col, parsed.ref_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
