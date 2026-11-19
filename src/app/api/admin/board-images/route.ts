import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// Takedown surface for seeded board images (board_sources kind='image').
//
// GET   -> { flagged, recent, publishers }
//          flagged: boards with a flag vote (board_image_votes vote='flag') that
//                   currently show a seeded image, with that image + flag count
//          recent:  the most recent active seeded rows
//          publishers: active seeded row counts per publisher (for bulk removal)
// POST  { id, reason }         -> soft-remove one seeded row
// POST  { publisher, reason }  -> soft-remove every active seeded row from a publisher
//
// Removal is soft (status='removed', removed_reason) so the seeder never re-adds it.
// Editor-only; writes go through the service client.

const COLS = "id, board_id, publisher, doc_title, page, source_url, image_url, hosted_url, source_tier, model_year, status, created_at, boards(brand, model, model_year)"

export async function GET() {
  const auth = await requireEditor()
  if (auth.response) return auth.response
  const db = getServiceClient()

  const { data: flags } = await db
    .from("board_image_votes")
    .select("board_id")
    .eq("vote", "flag")
  const flagCount = new Map<string, number>()
  for (const f of flags ?? []) flagCount.set(f.board_id as string, (flagCount.get(f.board_id as string) ?? 0) + 1)

  let flagged: unknown[] = []
  if (flagCount.size) {
    const { data } = await db
      .from("board_sources")
      .select(COLS)
      .eq("kind", "image")
      .eq("status", "active")
      .in("board_id", [...flagCount.keys()])
      .order("source_tier", { ascending: true })
    flagged = (data ?? []).map((r) => ({ ...r, flags: flagCount.get(r.board_id as string) ?? 0 }))
  }

  const { data: recent } = await db
    .from("board_sources")
    .select(COLS)
    .eq("kind", "image")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(0, 99)

  // Per-publisher counts (paged; there can be thousands of rows).
  const publishers: Record<string, number> = {}
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("board_sources")
      .select("publisher")
      .eq("kind", "image")
      .eq("status", "active")
      .range(from, from + PAGE - 1)
    if (error || !data) break
    for (const r of data) publishers[r.publisher as string] = (publishers[r.publisher as string] ?? 0) + 1
    if (data.length < PAGE) break
  }

  return NextResponse.json({ flagged, recent: recent ?? [], publishers })
}

export async function POST(req: NextRequest) {
  const auth = await requireEditor()
  if (auth.response) return auth.response
  const db = getServiceClient()

  const body = await req.json().catch(() => ({}))
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 300) : null
  if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 })

  let q = db
    .from("board_sources")
    .update({ status: "removed", removed_reason: reason })
    .eq("kind", "image")
    .eq("status", "active")
  if (typeof body.id === "string" && body.id) q = q.eq("id", body.id)
  else if (typeof body.publisher === "string" && body.publisher) q = q.eq("publisher", body.publisher)
  else return NextResponse.json({ error: "Pass id or publisher" }, { status: 400 })

  const { data, error } = await q.select("id")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ removed: data?.length ?? 0 })
}
