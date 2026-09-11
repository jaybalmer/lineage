import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { EXCLUDED_ACTOR_IDS, INSTRUMENTATION_START } from "@/lib/analytics-exclusions"

// ── GET /api/admin/funnel ─────────────────────────────────────────────────────
// Moderator-only read powering /admin/funnel. All aggregation happens in two
// read-only Postgres functions (brief D7) so a wide window is one round trip and
// never silently truncated by PostgREST's 1000-row cap.
//
// Query param: days (7 | 30 | 90, default 30). The exclusion list and both
// filters (internal humans, and props.bot rows) are applied inside the RPCs.

export const dynamic = "force-dynamic"

const ALLOWED_WINDOWS = [7, 30, 90] as const
const COHORT_WEEKS = 8

export async function GET(req: NextRequest) {
  const auth = await requireModerator()
  if (auth.response) return auth.response

  try {
    const db = getServiceClient()
    const { searchParams } = new URL(req.url)
    const daysParam = parseInt(searchParams.get("days") ?? "30", 10)
    const windowDays = (ALLOWED_WINDOWS as readonly number[]).includes(daysParam)
      ? daysParam
      : 30

    const until = new Date()
    const since = new Date(until.getTime() - windowDays * 24 * 60 * 60 * 1000)
    const exclude = [...EXCLUDED_ACTOR_IDS]

    const [summaryRes, cohortRes] = await Promise.all([
      db.rpc("analytics_funnel_summary", {
        p_since: since.toISOString(),
        p_until: until.toISOString(),
        p_exclude: exclude,
      }),
      db.rpc("analytics_cohort_retention", {
        p_weeks: COHORT_WEEKS,
        p_exclude: exclude,
      }),
    ])

    if (summaryRes.error) throw summaryRes.error
    if (cohortRes.error) throw cohortRes.error

    const summary = (summaryRes.data ?? {}) as {
      steps?: Record<string, number>
      daily?: { day: string; signups: number; activations: number }[]
      content?: Record<string, number>
    }

    return NextResponse.json({
      window_days: windowDays,
      since: since.toISOString(),
      until: until.toISOString(),
      steps: summary.steps ?? {},
      daily: summary.daily ?? [],
      content: summary.content ?? {},
      cohorts: cohortRes.data ?? [],
      excluded_count: EXCLUDED_ACTOR_IDS.length,
      instrumentation_start: INSTRUMENTATION_START,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
