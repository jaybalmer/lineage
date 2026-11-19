import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { SEEDED_IMAGE_COLUMNS, pickSeeded, seededUrl, type SeededImageRow } from "@/lib/board-seeded-image"

// Bulk maps across all boards at once, so the boards catalog knows synchronously
// which boards have an image and the brand-index cover selection is not gated by
// the per-board, localStorage-cached useBoardImage probe. Not localStorage-cached,
// so an image added on a board page shows on the next load.
//
//   images: board_id -> most recent community-suggested URL (board_image_votes)
//   seeded: board_id -> best seeded URL (board_sources kind='image', active)
//
// Callers apply the chain: community > boards.image_url > seeded > live lookup.
export async function GET() {
  const images: Record<string, string> = {}
  const seeded: Record<string, string> = {}
  try {
    const supabase = await createServerSupabaseClient()

    const { data } = await supabase
      .from("board_image_votes")
      .select("board_id, suggested_image_url, created_at")
      .not("suggested_image_url", "is", null)
      .order("created_at", { ascending: false })
    // Most recent suggestion per board wins (rows arrive newest-first).
    for (const row of data ?? []) {
      const id = row.board_id as string | null
      const url = row.suggested_image_url as string | null
      if (id && url && !images[id]) images[id] = url
    }

    // Seeded rows, paged (PostgREST caps a response at 1,000 rows).
    const rows: (SeededImageRow & { boards: { model_year: number | null } | null })[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabase
        .from("board_sources")
        .select(`${SEEDED_IMAGE_COLUMNS}, boards(model_year)`)
        .eq("kind", "image")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1)
      if (error || !page) break
      rows.push(...(page as unknown as typeof rows))
      if (page.length < PAGE) break
    }
    const byBoard = new Map<string, typeof rows>()
    for (const r of rows) {
      const list = byBoard.get(r.board_id)
      if (list) list.push(r)
      else byBoard.set(r.board_id, [r])
    }
    for (const [id, list] of byBoard) {
      const best = pickSeeded(list, list[0].boards?.model_year ?? null)
      const url = best ? seededUrl(best) : null
      if (url) seeded[id] = url
    }
  } catch { /* return what we have */ }
  return NextResponse.json({ images, seeded })
}
