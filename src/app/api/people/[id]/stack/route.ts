import { NextRequest, NextResponse } from "next/server"
import { readProfileStackById } from "@/lib/public-timeline-read"

// GET /api/people/[id]/stack: public read of a member's curated stack, used by
// the Featured rail on /people/[id] (Curated Member Profile T10/T16). Mirrors
// /api/orgs/[id]/stack but resolves a profile owner. No public_timeline_enabled
// gate: the rail lives on the member's own (already public) profile page.
// Visibility is enforced inside the read (claims_public + public stories), so
// nothing private leaks. Returns 404 for a missing/archived profile.
//
// Read-only: there is no PUT here. Members curate their stack at /me/public-view
// via /api/me/stack; this endpoint only surfaces the resolved result publicly.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await readProfileStackById(id)
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(payload)
}
