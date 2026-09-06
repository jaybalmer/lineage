import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// GET /api/admin/person-search?q=<name> — editor person search over the
// person_search view (members in profiles + catalog/ghost nodes in people),
// used to pick the canonical target in the /admin/claims merge panel. Members
// (source='profile') rank first so the real account is the obvious pick.
// Editor-gated; the merge route enforces its own guards.

export async function GET(req: NextRequest) {
  const { response } = await requireEditor()
  if (response) return response

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json([])

  const db = getServiceClient()
  const { data, error } = await db
    .from("person_search")
    .select("id, display_name, node_status, source, membership_tier")
    .ilike("display_name", `%${q}%`)
    .order("display_name", { ascending: true })
    .limit(20)
  if (error) {
    console.error("[person-search GET] search failed:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }

  // Members first (source='profile'), then catalog/ghost, then by name.
  const rows = (data ?? []) as {
    id: string
    display_name: string
    node_status: string | null
    source: string
    membership_tier: string | null
  }[]
  rows.sort((a, b) => {
    const am = a.source === "profile" ? 0 : 1
    const bm = b.source === "profile" ? 0 : 1
    if (am !== bm) return am - bm
    return a.display_name.localeCompare(b.display_name)
  })

  return NextResponse.json(rows)
}
