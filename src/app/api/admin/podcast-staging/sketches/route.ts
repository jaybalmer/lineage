import { gzipSync } from "node:zlib"
import { NextRequest, NextResponse } from "next/server"
import { requireModerator, getServiceClient } from "@/lib/auth"
import { buildSketchPayload } from "@/lib/podcast-sketches"

// Podcast archive staging: the Sketches tab payload (brief Part B, B2).
// Strict gate: requireModerator (is_editor = true only), same as every other
// staging route. Read-only, built live from the staging tables.
//
// The JSON is about 4.3 MB (every story with a 250-character excerpt), which
// sits right under Vercel's 4.5 MB function response limit. So it is gzipped
// here (about 1 MB on the wire); the browser decompresses it transparently.
//
// GET /api/admin/podcast-staging/sketches

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { response } = await requireModerator()
  if (response) return response
  let json: string
  try {
    json = JSON.stringify(await buildSketchPayload(getServiceClient()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    Vary: "Accept-Encoding",
  }
  if (!/\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")) return new Response(json, { headers })
  return new Response(new Uint8Array(gzipSync(json)), { headers: { ...headers, "Content-Encoding": "gzip" } })
}
