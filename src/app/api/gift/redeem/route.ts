import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { code, userId } = await req.json() as { code: string; userId: string }

  if (!code || !userId) {
    return NextResponse.json({ error: "Missing code or userId" }, { status: 400 })
  }

  const normalizedCode = code.toUpperCase()
  const db = adminClient()

  // Fetch and validate the gift code (single atomic-ish read)
  const { data: giftRow, error: fetchErr } = await db
    .from("gift_codes")
    .select("code, gifted_by, status")
    .eq("code", normalizedCode)
    .maybeSingle()

  if (fetchErr || !giftRow) {
    return NextResponse.json({ error: "Invalid gift code" }, { status: 400 })
  }

  if (giftRow.status === "redeemed") {
    return NextResponse.json({ error: "Gift code already redeemed" }, { status: 409 })
  }

  // Can't redeem your own gift code
  if (giftRow.gifted_by === userId) {
    return NextResponse.json({ error: "You cannot redeem your own gift code" }, { status: 400 })
  }

  // Mark the code as redeemed
  const { error: updateCodeErr } = await db
    .from("gift_codes")
    .update({ status: "redeemed", redeemed_by: userId })
    .eq("code", normalizedCode)

  if (updateCodeErr) {
    return NextResponse.json({ error: "Failed to redeem code" }, { status: 500 })
  }

  // Grant annual membership to the user
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  const { error: profileErr } = await db
    .from("profiles")
    .update({
      membership_tier:        "annual",
      membership_status:      "gifted",
      token_member:           10,
      membership_expires_at:  expiresAt,
    })
    .eq("id", userId)

  if (profileErr) {
    return NextResponse.json({ error: "Failed to grant membership" }, { status: 500 })
  }

  // Log token grant
  await db.from("token_events").insert({
    user_id:    userId,
    token_type: "member",
    amount:     10,
    source:     "gift_redemption",
  })

  return NextResponse.json({ success: true })
}
