import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { maybeFireThresholdNotification } from "@/lib/invite-tracking-server"

// POST /api/post-tag-event
//
// Bridge endpoint for client-side tag writes (claims and riding_days insert
// directly from the Zustand store via the browser Supabase client — they
// don't pass through an API route). The store calls this fire-and-forget
// after a successful tag insert so maybeFireThresholdNotification can run
// server-side.
//
// SECURITY DISPOSITION
// --------------------
// This endpoint accepts arbitrary person_ids from any authed caller. The
// UNIQUE constraint on person_invite_notifications dedup prevents email
// spam; the count query is the source of truth so misuse only triggers
// earlier-than-normal notification firing for already-eligible persons.
// Accept this risk; no additional caller-side validation needed.
//
// The caller's auth user id is taken as the tagger; clients cannot spoof.
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  let body: { person_ids?: unknown }
  try {
    body = await req.json()
  } catch {
    return new NextResponse(null, { status: 400 })
  }

  const ids = Array.isArray(body.person_ids)
    ? Array.from(new Set(body.person_ids.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : []

  if (ids.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  const origin = req.headers.get("origin") || req.nextUrl.origin
  // Fire each notification check in parallel; the helper never throws.
  await Promise.all(ids.map((id) => maybeFireThresholdNotification(origin, id, user.id)))
  return new NextResponse(null, { status: 204 })
}
