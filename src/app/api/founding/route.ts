import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public — no auth required. Returns founding member list + spot count.
export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await db
    .from("profiles")
    .select("id, display_name, founding_member_number, created_at, bio")
    .eq("membership_tier", "founding")
    .order("founding_member_number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const members = (data ?? []).map((p) => ({
    id:     p.id,
    name:   p.display_name ?? "Rider",
    joined: p.created_at,
    number: p.founding_member_number,
    tagline: p.bio ?? null,
  }))

  return NextResponse.json({
    members,
    filled: members.length,
    total:  500,
  })
}
