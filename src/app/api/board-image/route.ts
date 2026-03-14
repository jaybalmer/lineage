import { NextRequest, NextResponse } from "next/server"

/**
 * Auto-fetch a board thumbnail via Serper.dev Google Image Search API.
 *
 * Required env vars (add to .env.local):
 *   SERPER_API_KEY — API key from serper.dev (2,500 free credits)
 *
 * Free tier: 2,500 queries. Results are cached client-side (7 days) to stay well within limits.
 * Falls back through: brand+model+year → brand+model → brand only
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brand = searchParams.get("brand") ?? ""
  const model = searchParams.get("model") ?? ""
  const year  = searchParams.get("year")  ?? ""

  if (!brand || !model) {
    return NextResponse.json({ url: null })
  }

  const apiKey = process.env.SERPER_API_KEY

  if (!apiKey) {
    return NextResponse.json({ url: null, unconfigured: true })
  }

  // Fallback queries: most specific → least specific
  const queries = [
    year ? `${brand} ${model} ${year} snowboard` : null,
    `${brand} ${model} snowboard`,
    `${brand} snowboard`,
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
      const url = (data.images?.[0]?.imageUrl as string) ?? null
      if (url) {
        console.log(`[board-image] found via "${query}"`)
        return NextResponse.json({ url })
      }
    }
    return NextResponse.json({ url: null })
  } catch (err) {
    console.error("[board-image] fetch failed", err)
    return NextResponse.json({ url: null })
  }
}
