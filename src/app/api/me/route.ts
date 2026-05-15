import { NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// ── GET /api/me ───────────────────────────────────────────────────────────────
// Returns the current user's profile + membership data.
// requireAuth() identifies the caller and idempotently bootstraps a profile row
// if one is missing (defends against the orphan-auth-user case). The read uses
// the service role client to bypass RLS.
export async function GET() {
  try {
    const { user, response } = await requireAuth()
    if (response) {
      // Preserve the original error shape for existing clients (catalog-loader, etc.)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await getServiceClient()
      .from("profiles")
      .select(`
        display_name, birth_year, riding_since, privacy_level,
        bio, links, home_resort_id, city, region, country, avatar_url,
        membership_tier, membership_status, founding_badge, founding_member_number,
        token_founder, token_member, token_contribution,
        stripe_customer_id, stripe_subscription_id, membership_expires_at, pending_credit,
        is_editor
      `)
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ uid: user.id, profile })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
