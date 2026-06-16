import { NextResponse } from "next/server"
import { readPublicTimeline } from "@/lib/public-timeline-read"

// GET /api/public/timeline/[slug] — unauthenticated public read.
//
// Resolves public_slug -> enabled profile and returns the fully server-resolved
// timeline payload (owner header + claims + stories + the catalog subset the
// read-only renderer needs). All reads go through the _public views, so a
// disabled timeline, a non-public claim/story, or a declined/hidden tag never
// leaks. Disabled and unknown slugs both return 404 (brief D4).
//
// The chromeless page reads the same helper directly server-side; this route
// exists for embeds/clients and as the single documented public contract.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await readPublicTimeline(slug)
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(payload, {
    headers: {
      // Edge-cacheable: public, immutable enough for a minute, revalidated in
      // the background for up to ten so a fresh entry shows quickly without a
      // thundering-herd of cold reads.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  })
}
