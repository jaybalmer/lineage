import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 })
  }

  const db = adminClient()

  // Fetch the gift code row
  const { data, error } = await db
    .from("gift_codes")
    .select("code, gifted_by, status")
    .eq("code", code)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ status: "invalid" })
  }

  if (data.status === "redeemed") {
    return NextResponse.json({ status: "already_redeemed" })
  }

  // Look up gifted-by display name
  const { data: profile } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", data.gifted_by)
    .maybeSingle()

  return NextResponse.json({
    status: "valid",
    giftedByName: profile?.display_name ?? "a community member",
  })
}
