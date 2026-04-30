import { NextResponse } from "next/server"
import { buildPersonRedirectMap } from "@/lib/person-redirects"

// The redirect middleware fetches this endpoint with
//   fetch(url, { next: { revalidate: 60, tags: ["person-redirects"] } })
// so the response is cached at the edge. Writers (claim and merge handlers)
// call revalidateTag("person-redirects") to force a refresh on the next read.
//
// This endpoint is read-only and returns only data that is otherwise visible
// in the public people directory (canonical id, derived slug, redirect reason).
// It is intentionally unauthenticated so middleware on cold edge nodes can
// reach it without a session.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const aliases = await buildPersonRedirectMap()
    return NextResponse.json({ aliases })
  } catch (err) {
    console.error("[person-redirects] failed to build map:", err)
    // Returning an empty map keeps the middleware in pass-through mode rather
    // than 500-ing every request when the table is briefly unavailable.
    return NextResponse.json({ aliases: {} }, { status: 200 })
  }
}
