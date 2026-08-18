import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"

// GET /api/stats/community[?year=1994]
//
// Public aggregate behind the FTUE callouts (the "riders named so far" number
// and the era screen's two stats). Counts only — no row data leaves here, so
// there is nothing to leak. Same posture as /api/equity/pool and /api/founding,
// which already expose community-size signals publicly.
//
// Every field is nullable on purpose. A count that fails to resolve comes back
// as null and the FTUE hides that callout rather than showing a placeholder;
// the flow must never invent a number it cannot stand behind.

export const dynamic = "force-dynamic"

type Counts = {
  riders: number | null
  places: number | null
  brands: number | null
  connections: number | null
  year: number | null
  /** Riders whose first season matches `year`. Null when no year was asked for. */
  peers: number | null
  /** Stories dated inside `year`. Null when no year was asked for. */
  stories: number | null
}

/** A head-only exact count. Returns null on error so one bad table cannot 500
 *  the whole endpoint and blank every callout at once. */
async function countOf(build: () => PromiseLike<{ count: number | null; error: unknown }>) {
  try {
    const { count, error } = await build()
    if (error) return null
    return count ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year")
  const parsedYear = yearParam ? parseInt(yearParam, 10) : NaN
  const year =
    Number.isFinite(parsedYear) && parsedYear >= 1960 && parsedYear <= new Date().getFullYear() + 1
      ? parsedYear
      : null

  let db
  try {
    db = getServiceClient()
  } catch {
    // No service-role key in this environment (local dev without secrets).
    // Answer with an all-null body so the FTUE degrades to no callouts.
    return NextResponse.json({
      riders: null, places: null, brands: null, connections: null,
      year, peers: null, stories: null,
    } satisfies Counts)
  }

  const head = { count: "exact" as const, head: true }

  // Riders = catalog person records + registered profiles. `people` holds the
  // unclaimed/ghost nodes riders get named as in other people's stories, which
  // is exactly the population the "named so far" line is talking about. A
  // person who later claims their node is merged (see merge_log), so the two
  // tables do not stack a duplicate for the same human.
  const [peopleCount, profileCount, places, brands, connections] = await Promise.all([
    countOf(() => db.from("people").select("id", head)),
    countOf(() => db.from("profiles").select("id", head).not("is_archived", "is", true)),
    countOf(() => db.from("places").select("id", head)),
    countOf(() => db.from("orgs").select("id", head).eq("org_type", "brand")),
    // Read through the visibility-filtered view, never the raw claims table.
    countOf(() => db.from("claims_public").select("id", head)),
  ])

  const riders =
    peopleCount === null && profileCount === null
      ? null
      : (peopleCount ?? 0) + (profileCount ?? 0)

  let peers: number | null = null
  let stories: number | null = null
  if (year !== null) {
    const [peerPeople, peerProfiles, storyCount] = await Promise.all([
      countOf(() => db.from("people").select("id", head).eq("riding_since", year)),
      countOf(() =>
        db.from("profiles").select("id", head).eq("riding_since", year).not("is_archived", "is", true),
      ),
      countOf(() =>
        db
          .from("stories")
          .select("id", head)
          .gte("story_date", `${year}-01-01`)
          .lte("story_date", `${year}-12-31`),
      ),
    ])
    peers =
      peerPeople === null && peerProfiles === null ? null : (peerPeople ?? 0) + (peerProfiles ?? 0)
    stories = storyCount
  }

  return NextResponse.json({
    riders, places, brands, connections, year, peers, stories,
  } satisfies Counts)
}
