import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { resyncPublicSlug } from "@/lib/public-slug"

// PATCH /api/me/display-name — body: { display_name: string }
//
// BUG-159: display_name used to be written client-side straight to profiles, so
// nothing could re-mint the frozen public_slug and a renamed member's Stack URL
// (/t/<slug>) drifted from their timeline URL. This server route writes the name
// with the service client and then resyncs public_slug (which needs the service
// role to scan the shared /t/{slug} namespace across profiles, orgs, and events).
// Other profile fields stay on the existing client write to keep the blast radius
// small.

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const displayName =
    typeof body?.display_name === "string" ? body.display_name.trim() : null
  if (!displayName) {
    return NextResponse.json({ error: "display_name is required" }, { status: 400 })
  }

  const db = getServiceClient()
  const { error } = await db
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resync the public slug to the new name. A failure here must not fail the save
  // (the name is already stored); the slug simply stays as-is until next time.
  let slug: string | null = null
  try {
    slug = await resyncPublicSlug("profile", user.id, displayName, db)
  } catch (e) {
    console.error("resyncPublicSlug failed:", e)
  }

  return NextResponse.json({ ok: true, slug })
}
