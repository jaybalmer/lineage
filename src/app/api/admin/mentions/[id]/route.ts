import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { MENTION_SUBJECT_TYPES } from "@/lib/mentions"
import { hydrateEpisodes } from "@/lib/mentions-server"
import type { Mention, MentionSubjectType } from "@/types"

// Podcast pass Session B: editor-only mention edit + removal.
//
// PATCH  /api/admin/mentions/[id]  timestamp / excerpt / status / subject
// DELETE /api/admin/mentions/[id]  hard delete (curation artifact, no tombstone)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireEditor()
  if (response) return response

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const b = body as Record<string, unknown>

  if ("timestamp_seconds" in b) {
    const raw = b.timestamp_seconds
    if (raw === null || raw === "") {
      patch.timestamp_seconds = null
    } else {
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "timestamp_seconds must be a non-negative number" }, { status: 400 })
      }
      patch.timestamp_seconds = Math.floor(n)
    }
  }
  if ("excerpt" in b) {
    const raw = typeof b.excerpt === "string" ? b.excerpt.trim() : ""
    patch.excerpt = raw || null
  }
  if ("status" in b) {
    if (b.status !== "draft" && b.status !== "published") {
      return NextResponse.json({ error: "status must be draft or published" }, { status: 400 })
    }
    patch.status = b.status
  }
  if ("subject_type" in b) {
    if (!MENTION_SUBJECT_TYPES.includes(b.subject_type as MentionSubjectType)) {
      return NextResponse.json({ error: "Invalid subject_type" }, { status: 400 })
    }
    patch.subject_type = b.subject_type
  }
  if ("subject_id" in b) {
    const raw = typeof b.subject_id === "string" ? b.subject_id.trim() : ""
    if (!raw) return NextResponse.json({ error: "subject_id cannot be empty" }, { status: 400 })
    patch.subject_id = raw
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from("mentions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already mapped" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Mention not found" }, { status: 404 })

  const [hydrated] = await hydrateEpisodes([data as Mention])
  return NextResponse.json(hydrated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireEditor()
  if (response) return response

  const { id } = await params
  const db = getServiceClient()
  const { error } = await db.from("mentions").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
