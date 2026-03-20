import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

/**
 * GET /api/place-image?place_id=xxx
 *
 * Returns the most recent community-suggested image for a place, if any.
 * Unlike boards, places don't use Serper search — photos come entirely from
 * community uploads / URL suggestions via place_image_votes.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get("place_id") ?? ""

  if (!placeId) return NextResponse.json({ url: null })

  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from("place_image_votes")
      .select("suggested_image_url")
      .eq("place_id", placeId)
      .not("suggested_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ url: data?.suggested_image_url ?? null })
  } catch {
    return NextResponse.json({ url: null })
  }
}
