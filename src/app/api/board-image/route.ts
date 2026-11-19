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
 *   3. live Serper (Google Images) lookup, hotlinked with attribution
 *
 * Required env var for tier 3: SERPER_API_KEY (serper.dev). Results are cached
 * client-side (7 days) and 24h on the server.
 *
 * Serper queries are brand+model+year, then brand+model. There is deliberately no
 * brand-only fallback: a wrong board on a page is worse than the brand logo.
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
    } catch { /* fall through to Serper */ }
  }

  const apiKey = process.env.SERPER_API_KEY

  if (!apiKey) {
    return NextResponse.json({ url: null, unconfigured: true })
  }

  const queries = [
    year ? `${brand} ${model} ${year} snowboard` : null,
    `${brand} ${model} snowboard`,
  ].filter(Boolean) as string[]

  try {
    for (const query of queries) {
      const res = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 1 }),
        next: { revalidate: 86400 }, // cache 24h on server
      })
      const data = await res.json()
      if (!res.ok) {
        // e.g. 400 "Not enough credits". Log loudly so a dead key is visible.
        console.error(`[board-image] serper ${res.status}: ${data?.message ?? "error"}`)
        return NextResponse.json({ url: null })
      }
      const img = data.images?.[0]
      const url = (img?.imageUrl as string) ?? null
      if (url) {
        // Pass through Serper's attribution so the board page can credit the
        // source (these are Google Image Search results, not owned assets).
        return NextResponse.json({
          url,
          source: (img?.source as string) ?? (img?.domain as string) ?? null,
          link: (img?.link as string) ?? null,
        })
      }
    }
    return NextResponse.json({ url: null })
  } catch (err) {
    console.error("[board-image] fetch failed", err)
    return NextResponse.json({ url: null })
  }
}
