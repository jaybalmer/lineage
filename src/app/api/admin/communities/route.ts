import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// Community Landing Redesign, Phase 2 (Workstream A 4.4)
// Persists the admin-set image URLs for a community. The image bytes go to
// storage from the client (mirroring edit-profile-modal); this route only
// writes the resulting public URLs. communities writes are RLS-protected, so
// the service client is required here, the same pattern the other /api/admin/*
// mutators use. Auth: requireEditor (is_editor OR founding).
export async function PATCH(req: NextRequest) {
  const { response } = await requireEditor()
  if (response) return response

  const body = (await req.json()) as {
    id?: string
    hero_image_url?: string | null
    avatar_url?: string | null
  }

  const { id, hero_image_url, avatar_url } = body
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  // Only write the fields the caller actually provided. A null clears the
  // column (remove image); an absent field is left untouched.
  const patch: Record<string, string | null> = {}
  if (hero_image_url !== undefined) patch.hero_image_url = hero_image_url
  if (avatar_url !== undefined) patch.avatar_url = avatar_url
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no image fields provided" }, { status: 400 })
  }

  const client = getServiceClient()
  const { data, error } = await client
    .from("communities")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, community: data })
}
