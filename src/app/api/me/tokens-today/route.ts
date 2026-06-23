import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { DAILY_CONTENT_TOKEN_CAP, CAPPED_SOURCES } from "@/lib/tokens"

// ── GET /api/me/tokens-today ──────────────────────────────────────────────────
// Today's earning readout for the daily progress chip (token-game-feel brief
// D2). Everything is derived at read time from the token_events ledger, so
// there is no schema change and the numbers always agree with what was
// actually granted.
//
//   content_earned_today  sum over the five capped (content) sources today
//   cap                   DAILY_CONTENT_TOKEN_CAP (imported, never hardcoded)
//   visit_awarded_today   has today's daily_visit reward landed yet
//   total_earned_today    sum over every source today (content + visit + ...)
//   visit_streak          consecutive UTC days with a daily_visit, ending on
//                         the most recent visit when that is today or yesterday
//
// The UTC-day boundary mirrors awardContributionTokens() in tokens.ts so the
// meter and the cap agree. One windowed query (60 days) feeds both today's
// sums and the streak, so the streak needs no denormalized counter / migration.

const CAPPED_SET: ReadonlySet<string> = new Set(CAPPED_SOURCES)

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const { user, response } = await requireAuth()
    if (response) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const db = getServiceClient()
    const todayUtc = utcDayKey(new Date())

    // 60-day window: enough to render any realistic active streak while keeping
    // the row count trivial for a single user.
    const windowStart = new Date(`${todayUtc}T00:00:00Z`)
    windowStart.setUTCDate(windowStart.getUTCDate() - 59)

    const { data, error } = await db
      .from("token_events")
      .select("amount, source, created_at")
      .eq("user_id", user.id)
      .gte("created_at", windowStart.toISOString())

    if (error) {
      console.error("[api/me/tokens-today] query failed:", error.message)
      return NextResponse.json({ error: "Could not load today's tokens" }, { status: 500 })
    }

    const rows = (data ?? []) as { amount?: number; source?: string; created_at?: string }[]

    let contentEarned = 0
    let totalEarned = 0
    let visitAwardedToday = false
    const visitDays = new Set<string>()
    // Today's earnings broken down by source, so the chip can show what you
    // actually earned by type (not just the rules). Keyed by token_events.source.
    const bySource: Record<string, number> = {}

    for (const row of rows) {
      const day = row.created_at ? row.created_at.slice(0, 10) : null
      if (row.source === "daily_visit" && day) visitDays.add(day)
      if (day === todayUtc) {
        const amt = row.amount ?? 0
        totalEarned += amt
        if (row.source) bySource[row.source] = (bySource[row.source] ?? 0) + amt
        if (row.source && CAPPED_SET.has(row.source)) contentEarned += amt
        if (row.source === "daily_visit") visitAwardedToday = true
      }
    }

    // Streak: walk back day by day from the most recent visit. We only count an
    // ACTIVE streak (most recent visit is today or yesterday) so a long-dormant
    // run does not read as current. Anchoring on the most recent visit rather
    // than strictly on today keeps the count honest during the brief window
    // before /api/me has awarded today's visit on first paint.
    let visitStreak = 0
    if (visitDays.size > 0) {
      const yesterday = new Date(`${todayUtc}T00:00:00Z`)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yesterdayUtc = utcDayKey(yesterday)
      const mostRecent = [...visitDays].sort().reverse()[0]
      if (mostRecent === todayUtc || mostRecent === yesterdayUtc) {
        const cursor = new Date(`${mostRecent}T00:00:00Z`)
        while (visitDays.has(utcDayKey(cursor))) {
          visitStreak++
          cursor.setUTCDate(cursor.getUTCDate() - 1)
        }
      }
    }

    return NextResponse.json({
      content_earned_today: contentEarned,
      cap: DAILY_CONTENT_TOKEN_CAP,
      visit_awarded_today: visitAwardedToday,
      total_earned_today: totalEarned,
      visit_streak: visitStreak,
      by_source: bySource,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
