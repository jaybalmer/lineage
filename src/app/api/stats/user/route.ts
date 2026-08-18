import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"

// ─── Era copy (5-era system) ─────────────────────────────────────────────────
// The era BOUNDARIES live in src/lib/eras.ts, shared with the FTUE so the era a
// rider is told during signup matches the one their profile reports afterwards.
// Only the rotating context lines are owned here.

import { eraForYear, type EraKey } from "@/lib/eras"

const ERA_LINES: Record<EraKey, string[]> = {
  pioneers: [
    "You were riding before most resorts even allowed it.",
    "You were riding before snowboarding had rules. You helped write them.",
    "The mountains weren't ready for you yet. You went anyway.",
  ],
  boom: [
    "You were part of the wave that made snowboarding legit.",
    "Burton ads in every magazine. Halfpipes going Olympic. You were in the middle of it.",
    "The sport exploded in the 90s and you were already strapped in.",
  ],
  golden_age: [
    "You grew up in the golden age. Forum, Robot Food, Kingpin.",
    "Park laps, video premieres, crew trips. The culture peaked and you were in it.",
    "The golden age of snowboarding shaped a generation. Yours.",
  ],
  evolution: [
    "You watched the culture shift from park to pow.",
    "Backcountry, splitboards, and a new definition of style. You rode through the evolution.",
    "The sport grew up in the 2010s. So did the riders who stuck with it.",
  ],
  modern: [
    "You're riding in the most connected era ever.",
    "Social media, global crews, and endless terrain. The modern era is yours.",
    "More access, more progression, more ways to ride. You're writing the next chapter.",
  ],
}

type Era = { key: EraKey; label: string; lines: string[] }

function getEra(ridingSince: number): Era {
  const bound = eraForYear(ridingSince)
  return { key: bound.key, label: bound.label, lines: ERA_LINES[bound.key] }
}

function pickContextLine(era: Era): string {
  return era.lines[Math.floor(Math.random() * era.lines.length)]
}

// ─── GET /api/stats/user ─────────────────────────────────────────────────────
// Query params:
//   userId     (required) — profile UUID
//   boardId    (optional) — compute board overlap count
//   eventId    (optional) — compute event claim count

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const boardId = searchParams.get("boardId")
    const eventId = searchParams.get("eventId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const db = getServiceClient()

    // Fetch profile
    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select("riding_since, created_at, founding_member_number, membership_tier")
      .eq("id", userId)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Compute stats in parallel
    const currentYear = new Date().getFullYear()
    const ridingSince = profile.riding_since as number | null
    const yearsRiding = ridingSince ? currentYear - ridingSince : null

    const era = ridingSince ? getEra(ridingSince) : null

    // Member number: count of profiles created at or before this user
    const memberNumberPromise = db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .lte("created_at", profile.created_at)

    // Total claims by this user
    const totalClaimsPromise = db
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", userId)

    // Board overlap (optional)
    const boardOverlapPromise = boardId
      ? db
          .from("claims")
          .select("id", { count: "exact", head: true })
          .eq("predicate", "owned_board")
          .eq("object_id", boardId)
          .neq("subject_id", userId)
      : null

    // Event claim count (optional)
    const eventClaimPromise = eventId
      ? db
          .from("claims")
          .select("id", { count: "exact", head: true })
          .eq("object_id", eventId)
          .neq("subject_id", userId)
      : null

    const [memberRes, claimsRes, boardRes, eventRes] = await Promise.all([
      memberNumberPromise,
      totalClaimsPromise,
      boardOverlapPromise,
      eventClaimPromise,
    ])

    const stats = {
      years_riding: yearsRiding,
      era: era ? era.key : null,
      era_label: era ? era.label : null,
      era_context_line: era ? pickContextLine(era) : null,
      member_number: memberRes.count ?? null,
      founding_member_number: profile.founding_member_number ?? null,
      membership_tier: profile.membership_tier ?? "free",
      total_claims: claimsRes.count ?? 0,
      board_overlap_count: boardRes ? (boardRes.count ?? 0) : null,
      event_claim_count: eventRes ? (eventRes.count ?? 0) : null,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error("[stats/user] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
