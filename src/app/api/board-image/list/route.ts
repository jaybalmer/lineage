import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// Bulk map of board_id -> most recent community-suggested image URL, across all
// boards at once. The boards catalog uses this to know synchronously which
// boards have a user-added image (board_image_votes) so the brand-index cover
// selection is not gated by the per-board, localStorage-cached useBoardImage
// probe. Mirrors the board_image_votes priority in /api/board-image. Not
// localStorage-cached, so an image added on a board page shows on the next load.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("board_image_votes")
      .select("board_id, suggested_image_url, created_at")
      .not("suggested_image_url", "is", null)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ images: {} })

    // Most recent suggestion per board wins (rows arrive newest-first).
    const images: Record<string, string> = {}
    for (const row of data ?? []) {
      const id = row.board_id as string | null
      const url = row.suggested_image_url as string | null
      if (id && url && !images[id]) images[id] = url
    }
    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: {} })
  }
}
