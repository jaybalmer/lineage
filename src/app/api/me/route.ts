import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"

// ── GET /api/me ───────────────────────────────────────────────────────────────
// Returns the current user's profile + membership data.
// Uses the service role key to bypass RLS — the session cookie is used only
// to identify the user, not to gate the read.
export async function GET() {
  try {
    // 1. Identify the calling user via their session cookie (SSR client)
    const sessionClient = await createServerSupabaseClient()
    const { data: { user }, error: authErr } = await sessionClient.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // 2. Fetch profile using service role (bypasses RLS)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: profile, error: profileErr } = await serviceClient
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
