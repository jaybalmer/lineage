import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { SEEDED_IMAGE_COLUMNS, pickSeeded, seededUrl, type SeededImageRow } from "@/lib/board-seeded-image"

/**
 * Resolve a board thumbnail.
 *
 * Priority (boards.image_url is applied by the callers, which already hold it):
 *   1. community-suggested image (board_image_votes), skipped with skip_community=1
 *   2. seeded image (board_sources kind='image', status='active'), re-hosted copy
 *      with provenance; returns source='seeded' plus caption fields
 *   otherwise { url: null } and the caller shows the brand logo.
 *
 * There is no live search tier: the paid Google Images lookup was turned off so
 * image sourcing is a one-time seeding cost, not a per-visitor one.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brand   = searchParams.get("brand")    ?? ""
  const model   = searchParams.get("model")    ?? ""
  const year    = searchParams.get("year")     ?? ""
  const boardId = searchParams.get("board_id") ?? ""
  const skipCommunity = searchParams.get("skip_community") === "1"

  if (!brand || !model) {
    return NextResponse.json({ url: null })
  }

  if (boardId) {
    const supabase = await createServerSupabaseClient()

    // ── Priority 1: community-suggested image ────────────────────────────────
    if (!skipCommunity) {
      try {
        const { data } = await supabase
          .from("board_image_votes")
          .select("suggested_image_url")
          .eq("board_id", boardId)
          .not("suggested_image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        if (data?.suggested_image_url) {
          return NextResponse.json({ url: data.suggested_image_url, source: "community" })
        }
      } catch { /* fall through */ }
    }

    // ── Priority 2: seeded image with provenance ─────────────────────────────
    try {
      const { data } = await supabase
        .from("board_sources")
        .select(SEEDED_IMAGE_COLUMNS)
        .eq("board_id", boardId)
        .eq("kind", "image")
        .eq("status", "active")
      const best = pickSeeded((data ?? []) as SeededImageRow[], year ? parseInt(year, 10) : null)
      if (best) {
        return NextResponse.json({
          url: seededUrl(best),
          source: "seeded",
          link: best.source_url,
          publisher: best.publisher,
          doc_title: best.doc_title,
          page: best.page,
          source_tier: best.source_tier,
        })
      }
    } catch { /* fall through */ }
  }

  // No live Google Images (Serper) lookup any more (Jay, 2026-11-24): it ran per
  // visitor per board and drained the credits. Boards without a community, stored
  // or seeded image show the brand logo plus "Replace with your photo". Serper is
  // still used once, offline, by scripts/seed-board-images.mjs --tier serper.
  return NextResponse.json({ url: null })
}
