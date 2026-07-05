import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// ─── PATCH /api/admin/users/[id]/archive ── soft-hide / restore a user ────────
//
// Body: { archived: boolean }. Archiving sets is_archived=true plus the audit
// trail (archived_at=now, archived_by=caller); un-archiving clears all three.
// requireEditor gate (is_editor OR founding), matching the membership admin.
// No data is deleted; the flag is fully reversible.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireEditor()
  if (response) return response

  const { id } = await params
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  let body: { archived?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body.archived !== "boolean") {
    return NextResponse.json({ error: "archived (boolean) required" }, { status: 400 })
  }

  const client = getServiceClient()
  const updates = body.archived
    ? { is_archived: true, archived_at: new Date().toISOString(), archived_by: user.id }
    : { is_archived: false, archived_at: null, archived_by: null }

  const { data, error } = await client
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("id, display_name, is_archived, archived_at")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({ ok: true, user: data })
}
