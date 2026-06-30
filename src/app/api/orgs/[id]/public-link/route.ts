import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { ensureUniquePublicSlug } from "@/lib/public-slug"

// FNRad Featured Timelines Phase 3: editor opt-in for a show's public, login-free
// chromeless page at /t/[slug].
//
// GET   /api/orgs/[id]/public-link — { enabled, slug }
// PATCH /api/orgs/[id]/public-link — body { enabled: boolean } (editor only)
//
// Mirrors /api/events/[id]/public-link, generalized to an org owner: enabling
// mints a slug in the shared /t/{slug} namespace when none exists; disabling only
// flips the flag (slug kept so the URL is stable).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = getServiceClient()
  const { data, error } = await db
    .from("orgs")
    .select("public_enabled, public_slug")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    enabled: Boolean(data.public_enabled),
    slug: data.public_slug ?? null,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireEditor()
  if (response) return response

  const { id: orgId } = await params
  const body = await req.json().catch(() => null)
  const enabled: unknown = body?.enabled
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 })
  }

  const db = getServiceClient()
  const { data: org, error: readErr } = await db
    .from("orgs")
    .select("name, public_slug")
    .eq("id", orgId)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 })

  let slug: string | null = org.public_slug ?? null

  if (!enabled || slug) {
    const { error } = await db.from("orgs").update({ public_enabled: enabled }).eq("id", orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, enabled, slug })
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    slug = await ensureUniquePublicSlug(org.name ?? null, orgId, db, "org")
    const { error } = await db
      .from("orgs")
      .update({ public_enabled: true, public_slug: slug })
      .eq("id", orgId)
    if (!error) return NextResponse.json({ ok: true, enabled: true, slug })
    if (error.code !== "23505" || attempt === 1) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: "Could not assign a public slug" }, { status: 500 })
}
