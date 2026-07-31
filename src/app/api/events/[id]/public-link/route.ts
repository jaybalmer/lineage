import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { ensureUniquePublicSlug } from "@/lib/public-slug"

// FNRad Featured Timelines Phase 2: editor opt-in for an episode's public,
// login-free chromeless page at /t/[slug].
//
// GET   /api/events/[id]/public-link — { enabled, slug }
// PATCH /api/events/[id]/public-link — body { enabled: boolean } (editor only),
//   or { mint: true } to mint the slug WITHOUT publishing (podcast pass, B4:
//   powers the pre-publish editor preview at /t/[slug]).
//
// Mirrors /api/me/public-timeline, generalized to an event owner: enabling
// mints a slug in the shared /t/{slug} namespace when none exists yet, and
// disabling only flips the flag (the slug is kept so the URL is stable).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = getServiceClient()
  const { data, error } = await db
    .from("events")
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

  const { id: eventId } = await params
  const body = await req.json().catch(() => null)
  const enabled: unknown = body?.enabled
  const mintOnly = body?.mint === true
  if (!mintOnly && typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 })
  }

  const db = getServiceClient()
  const { data: ev, error: readErr } = await db
    .from("events")
    .select("name, public_slug, public_enabled")
    .eq("id", eventId)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  let slug: string | null = ev.public_slug ?? null

  // Mint-only: ensure a slug exists (for the editor preview), never touch the
  // published flag.
  if (mintOnly && slug) {
    return NextResponse.json({ ok: true, enabled: Boolean(ev.public_enabled), slug })
  }

  // Flag-only update: disabling, or enabling with a slug already minted.
  if (!mintOnly && (enabled === false || slug)) {
    const { error } = await db.from("events").update({ public_enabled: enabled }).eq("id", eventId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, enabled, slug })
  }

  // No slug yet: mint a unique one across the shared namespace, retry once on
  // a partial-unique-index race (23505). Enabling sets both; mint-only sets the
  // slug alone.
  const nextEnabled = mintOnly ? Boolean(ev.public_enabled) : true
  for (let attempt = 0; attempt < 2; attempt++) {
    slug = await ensureUniquePublicSlug(ev.name ?? null, eventId, db, "event")
    const update = mintOnly ? { public_slug: slug } : { public_enabled: true, public_slug: slug }
    const { error } = await db.from("events").update(update).eq("id", eventId)
    if (!error) return NextResponse.json({ ok: true, enabled: nextEnabled, slug })
    if (error.code !== "23505" || attempt === 1) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: "Could not assign a public slug" }, { status: 500 })
}
