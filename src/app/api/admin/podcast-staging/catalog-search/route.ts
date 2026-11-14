import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { STAGING_SUBJECT_TYPES } from "@/lib/podcast-staging"
import type { StagingSubjectType } from "@/lib/podcast-staging"
import { searchCatalog } from "@/lib/podcast-staging-queries"

// Podcast archive staging: catalog search for the "pick a match" picker.
// Strict gate: requireModerator. Read-only.
//
// GET /api/admin/podcast-staging/catalog-search?type=person&q=jimi

export async function GET(req: NextRequest) {
  const { response } = await requireModerator()
  if (response) return response
  const type = req.nextUrl.searchParams.get("type") as StagingSubjectType | null
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (!type || !STAGING_SUBJECT_TYPES.includes(type)) return NextResponse.json({ error: "type is required" }, { status: 400 })
  if (q.length < 2) return NextResponse.json({ rows: [] })
  try {
    return NextResponse.json({ rows: await searchCatalog(getServiceClient(), type, q) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
