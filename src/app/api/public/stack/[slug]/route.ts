import { NextResponse } from "next/server"
import { readPublicStack } from "@/lib/public-timeline-read"

// GET /api/public/stack/[slug] — unauthenticated public read of the curated
// Stack View. Same posture as /api/public/timeline/[slug]: resolves the slug to
// an enabled profile, returns the owner header + the resolved, position-ordered
// stack entries (visibility already enforced by readPublicTimeline, which the
// stack read layers on top of). Disabled and unknown slugs both 404 (brief D4).
//
// The chromeless page reads the same helper directly server-side; this route
// exists for embeds/clients and as the single documented public contract.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await readPublicStack(slug)
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(payload, {
    headers: {
      // Edge-cacheable with a short TTL: the category_summary counts are
      // computed per request, so we keep the window tight and revalidate in the
      // background, matching the timeline route.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  })
}
