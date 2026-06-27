import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"
import { weightedTokens, isEquityEligible } from "@/lib/equity-offer"

// GET /api/equity/pool
//
// Public aggregate that feeds the share estimates (brief §5.4): the platform-
// wide weighted token total and how many accounts hold a balance. Exposes no
// per-member data; community-size signals are already public via /api/founding.
// force-dynamic so the build never freezes the aggregate into a static route.

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const db = getServiceClient()
    const { data, error } = await db
      .from("profiles")
      .select(
        "token_founder, token_member, token_contribution, membership_tier, membership_status, membership_expires_at",
      )
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Only eligible members count in the pool (brief §5.2): free contributors
    // keep their tokens but stop inflating the denominator, so an eligible
    // member's slice reflects the membership the offer is actually gated behind.
    let totalWeighted = 0
    let memberCount = 0
    for (const row of data ?? []) {
      if (!isEquityEligible(row)) continue
      const weighted = weightedTokens({
        founder: (row.token_founder as number) ?? 0,
        member: (row.token_member as number) ?? 0,
        contribution: (row.token_contribution as number) ?? 0,
      })
      if (weighted > 0) {
        totalWeighted += weighted
        memberCount += 1
      }
    }

    return NextResponse.json({
      total_weighted_tokens: totalWeighted,
      member_count: memberCount,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
