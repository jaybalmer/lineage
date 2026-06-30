import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { readOrgStack } from "@/lib/public-timeline-read"
import { buildStackRows } from "@/lib/stack-write"

// FNRad Featured Timelines Phase 3: a show's editor-curated canon set.
//
// GET /api/orgs/[id]/stack — server-resolved show payload (owner header, canon
//   entries, episode list, referenced stories + entities). Public read.
// PUT /api/orgs/[id]/stack — editor-only rewrite of the canon (delete-and-
//   reinsert with owner_type='org'), reusing the shared stack validator.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await readOrgStack({ orgId: id })
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(payload)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireEditor()
  if (response) return response

  const { id: orgId } = await params
  const db = getServiceClient()

  const { data: org } = await db.from("orgs").select("id").eq("id", orgId).maybeSingle()
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const built = buildStackRows(body?.entries, { owner_type: "org", owner_id: orgId })
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: built.status })

  const { error: delErr } = await db
    .from("public_stack_entries")
    .delete()
    .eq("owner_type", "org")
    .eq("owner_id", orgId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (built.rows.length > 0) {
    const { error: insErr } = await db.from("public_stack_entries").insert(built.rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const payload = await readOrgStack({ orgId })
  return NextResponse.json({ ok: true, ...(payload ?? {}) })
}
