import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import type { AnalyticsCategory } from "@/types"

// ── GET /api/admin/activity ───────────────────────────────────────────────────
// Moderator-only read of the analytics_events feed. Powers /admin/activity.
// Query params: category (one of the AnalyticsCategory values, or omitted for
// all), limit (default 200, max 500).
//
// Returns the most recent rows plus a 24h per-category count strip. actor_id is
// resolved to a display_name here for the moderator view only; names are never
// written back into analytics_events.props (D-LOCKED-3).

export const dynamic = "force-dynamic"

const CATEGORIES: AnalyticsCategory[] = [
  "auth", "ftue", "content", "invite", "redirect", "moderation", "error",
]

export async function GET(req: NextRequest) {
  const auth = await requireModerator()
  if (auth.response) return auth.response

  try {
    const db = getServiceClient()
    const { searchParams } = new URL(req.url)
    const categoryParam = searchParams.get("category")
    const category = CATEGORIES.includes(categoryParam as AnalyticsCategory)
      ? (categoryParam as AnalyticsCategory)
      : null
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "200"), 1), 500)

    let query = db
      .from("analytics_events")
      .select("id, created_at, category, event, actor_id, severity, props")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (category) query = query.eq("category", category)

    const { data: rows, error } = await query
    if (error) throw error

    // 24h per-category counts: fetch just the category column for the window
    // and tally in memory. Phase-1 volume is low (tester cohort), so this is
    // cheaper than a stored procedure and keeps the route self-contained.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recent } = await db
      .from("analytics_events")
      .select("category")
      .gte("created_at", since)
    const counts: Record<string, number> = {}
    for (const c of CATEGORIES) counts[c] = 0
    let total24h = 0
    for (const r of (recent ?? []) as { category: string }[]) {
      if (r.category in counts) counts[r.category] += 1
      total24h += 1
    }

    // Resolve actor display names for the rows we're returning.
    const actorIds = Array.from(
      new Set(((rows ?? []) as { actor_id: string | null }[])
        .map((r) => r.actor_id)
        .filter((id): id is string => !!id)),
    )
    const nameById = new Map<string, string | null>()
    if (actorIds.length > 0) {
      const { data: profs } = await db
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds)
      for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
        nameById.set(p.id, p.display_name)
      }
    }

    const withNames = ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      actor_name: r.actor_id ? nameById.get(r.actor_id as string) ?? null : null,
    }))

    return NextResponse.json({ rows: withNames, counts, total_24h: total24h })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
