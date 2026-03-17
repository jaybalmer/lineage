import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

/** Extract Open Graph meta tags from HTML without an npm dependency. */
function parseOG(html: string): { og_title?: string; og_image?: string; og_description?: string } {
  const get = (prop: string) => {
    const match = html.match(
      new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i")
    ) ?? html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i")
    )
    return match?.[1]?.trim()
  }

  // Fallback: <title> tag if og:title is missing
  const titleFallback = () => {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return m?.[1]?.trim()
  }

  return {
    og_title:       (get("title") ?? titleFallback())?.slice(0, 300),
    og_image:       get("image")?.slice(0, 2048),
    og_description: get("description")?.slice(0, 500),
  }
}

/**
 * POST /api/boards/links
 * Body: { board_id: string, url: string }
 *
 * Fetches Open Graph data from the submitted URL, stores the result in
 * board_links, and returns the created row. Auth is validated server-side
 * via the session cookie — RLS enforces user_id ownership on insert.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { board_id?: string; url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { board_id, url } = body
  if (!board_id || !url) {
    return NextResponse.json({ error: "board_id and url are required" }, { status: 400 })
  }

  // Basic URL sanity check
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  // Fetch OG data — best-effort, fall through on any error
  let ogData: ReturnType<typeof parseOG> = {}
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lineage/1.0; +https://lineage.wtf)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const html = await res.text()
      ogData = parseOG(html)
    }
  } catch {
    // Network error or timeout — insert with just the URL
  }

  const { data, error } = await supabase
    .from("board_links")
    .insert({
      board_id,
      user_id: user.id,
      url,
      og_title:       ogData.og_title       ?? null,
      og_image:       ogData.og_image       ?? null,
      og_description: ogData.og_description ?? null,
    })
    .select()
    .single()

  if (error) {
    // Unique violation = duplicate URL on this board
    if (error.code === "23505") {
      return NextResponse.json({ error: "This URL has already been added to this board" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
