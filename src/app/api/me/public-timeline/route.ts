import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { ensureUniquePublicSlug } from "@/lib/public-slug"

// GET   /api/me/public-timeline  — { enabled: boolean, slug: string | null }
// PATCH /api/me/public-timeline  — body: { enabled: boolean }
//
// The owner opt-in for the PB-010 Phase 2 chromeless route at /t/[slug].
// Enabling flips public_timeline_enabled and, when public_slug is still null,
// mints a unique slug via ensureUniquePublicSlug (the one slug authority, shared
// with the Phase 1 backfill). Disabling only flips the flag; the slug is kept so
// re-enabling restores the same URL.

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { data, error } = await db
    .from("profiles")
    .select("public_timeline_enabled, public_slug")
    .eq("id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    enabled: Boolean(data?.public_timeline_enabled),
    slug: data?.public_slug ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const enabled: unknown = body?.enabled
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 })
  }

  const db = getServiceClient()
  const { data: prof, error: readErr } = await db
    .from("profiles")
    .select("display_name, public_slug")
    .eq("id", user.id)
    .single()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

  let slug: string | null = prof?.public_slug ?? null

  // Disabling, or already has a slug: a single flag update.
  if (!enabled || slug) {
    const { error } = await db
      .from("profiles")
      .update({ public_timeline_enabled: enabled })
      .eq("id", user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, enabled, slug })
  }

  // Enabling for the first time: mint a unique slug, then write both. Retry once
  // on the partial-unique-index violation (23505) in case a concurrent enable
  // grabbed the same name slug between the check and the write.
  for (let attempt = 0; attempt < 2; attempt++) {
    slug = await ensureUniquePublicSlug(prof?.display_name ?? null, user.id, db)
    const { error } = await db
      .from("profiles")
      .update({ public_timeline_enabled: true, public_slug: slug })
      .eq("id", user.id)
    if (!error) return NextResponse.json({ ok: true, enabled: true, slug })
    if (error.code !== "23505" || attempt === 1) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Unreachable (the loop returns on success or on the second failure).
  return NextResponse.json({ error: "Could not assign a public slug" }, { status: 500 })
}
