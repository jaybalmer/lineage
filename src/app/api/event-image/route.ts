import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

/**
 * GET /api/event-image?event_id=xxx
 *
 * Returns the most recent community-suggested image for an event, if any.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("event_id") ?? ""

  if (!eventId) return NextResponse.json({ url: null })

  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from("event_image_votes")
      .select("suggested_image_url")
      .eq("event_id", eventId)
      .not("suggested_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ url: data?.suggested_image_url ?? null })
  } catch {
    return NextResponse.json({ url: null })
  }
}
