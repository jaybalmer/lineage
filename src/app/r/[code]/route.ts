import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"
import { safeReturnTo } from "@/lib/safe-redirect"
import { captureServerEvent } from "@/lib/analytics-server"

// GET /r/[code] — the spoken-code redirect (brief T4, D5, D6).
//
// A route handler, not a page: a lookup and a 302, no HTML, no client bundle.
// linestry.com/r/fnrad-s12e04 is short enough to read on air; codes live in the
// ref_codes table so a new episode code is one SQL insert, no deploy. Unknown or
// inactive codes 302 to /onboarding with the code preserved rather than 404, so a
// mis-heard code is kinder and the matched:false count tells us it happened.

export const dynamic = "force-dynamic"

// A code is spoken and retyped from memory, so keep the charset tiny.
function normalizeCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40)
}

interface RefCodeRow {
  code: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  event_id: string | null
  destination_path: string | null
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await ctx.params
  const code = normalizeCode(rawCode ?? "")
  const origin = req.nextUrl.origin

  // Fallback used for an empty/unknown/inactive/malformed code: onboarding with
  // the (normalised) code preserved so we can see what was typed.
  const fallback = () => {
    const url = new URL("/onboarding", origin)
    if (code) url.searchParams.set("ref", code)
    return url
  }

  let row: RefCodeRow | null = null
  if (code) {
    try {
      const db = getServiceClient()
      const { data } = await db
        .from("ref_codes")
        .select("code, utm_source, utm_medium, utm_campaign, utm_content, event_id, destination_path")
        .eq("code", code)
        .eq("active", true)
        .maybeSingle()
      row = (data as RefCodeRow | null) ?? null
    } catch {
      row = null
    }
  }

  if (!row) {
    // Unknown or inactive code. Fire matched:false, then 302 to onboarding.
    await captureServerEvent({
      category: "redirect",
      event: "ref_code_hit",
      props: { code, matched: false },
    }).catch(() => {})
    return NextResponse.redirect(fallback(), 302)
  }

  // Build the destination path: destination_path wins; else the episode page when
  // event_id points at a published episode; else onboarding.
  let destPath = row.destination_path ?? null
  if (!destPath && row.event_id) {
    try {
      const db = getServiceClient()
      const { data: ev } = await db
        .from("events")
        .select("public_slug, public_enabled")
        .eq("id", row.event_id)
        .maybeSingle()
      const e = ev as { public_slug: string | null; public_enabled: boolean | null } | null
      if (e?.public_slug && e.public_enabled) destPath = `/t/${e.public_slug}`
    } catch {
      // fall through to onboarding
    }
  }
  if (!destPath) destPath = "/onboarding"

  // Never let a malformed row bounce off-site. safeReturnTo validates the path
  // portion; strip any query the row carried before validating, then rebuild.
  const pathOnly = destPath.split("?")[0]
  const safePath = safeReturnTo(pathOnly) ?? "/onboarding"

  const url = new URL(safePath, origin)
  // Preserve incoming query params (…/r/fnrad?foo=1 keeps foo) without clobbering
  // anything the destination path itself carried.
  for (const [k, v] of req.nextUrl.searchParams) {
    if (!url.searchParams.has(k)) url.searchParams.set(k, v)
  }
  // The row's campaign params win on conflict.
  if (row.utm_source) url.searchParams.set("utm_source", row.utm_source)
  if (row.utm_medium) url.searchParams.set("utm_medium", row.utm_medium)
  if (row.utm_campaign) url.searchParams.set("utm_campaign", row.utm_campaign)
  if (row.utm_content) url.searchParams.set("utm_content", row.utm_content)
  url.searchParams.set("ref", code)

  await captureServerEvent({
    category: "redirect",
    event: "ref_code_hit",
    props: {
      code,
      utm_source: row.utm_source,
      utm_campaign: row.utm_campaign,
      event_id: row.event_id,
      matched: true,
    },
  }).catch(() => {})

  return NextResponse.redirect(url, 302)
}
