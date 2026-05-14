import { NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"

// GET /api/admin/tag-queue/count
//
// PB-009 Phase 3 — feeds the amber badge on the /admin Queue tab. Counts
// open tag_reports. Cheap query against the partial index
// tag_reports_open_recent.

export async function GET() {
  const { response } = await requireModerator()
  if (response) return response

  const db = getServiceClient()
  const { count, error } = await db
    .from("tag_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}
