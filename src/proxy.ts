import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { PersonRedirectMap, PersonRedirectReason } from "@/types"

/**
 * Three-layer proxy (renamed from middleware.ts per Next 16's proxy file
 * convention). Same matcher and behaviour as before; the function is now
 * exported as `proxy` instead of `middleware`.
 *
 *   1. Person-node redirects (PB-008 Phase 2 Session 1):
 *        /[community]/riders/<seg>  -> /people/<canonical-seg>
 *        /riders/<seg>              -> /people/<canonical-seg>   (legacy top-level)
 *        /people/<old-seg>          -> /people/<canonical-seg>   (merged or reslugged)
 *
 *   2. Top-level community routes that still live under /[community]/...
 *      (e.g. /feed -> /snowboarding/feed). "riders" used to live here too
 *      but moved to top-level /people in PB-008 Phase 2; layer 1 handles it.
 *
 *   3. Supabase session refresh + auth gate for /[community]/timeline.
 */

/** Community-scoped routes; "riders" intentionally absent (now /people). */
const COMMUNITY_ROUTES = new Set([
  "places", "events", "boards", "brands", "orgs",
  "stories", "feed", "connections", "collective", "profile",
  "explore", "timeline",
])

/** Mock and dev-only person identifiers; never appear in the alias table. */
const MOCK_ID = /^(u\d+|dev[-_].+)$/i

type RedirectReasonTag = PersonRedirectReason | "route-migration"

interface ResolvedPersonRedirect {
  path: string
  from: string
  to: string
  reason: RedirectReasonTag
}

async function loadAliases(origin: string): Promise<PersonRedirectMap> {
  try {
    const res = await fetch(`${origin}/api/internal/person-redirects`, {
      next: { revalidate: 60, tags: ["person-redirects"] },
    })
    if (!res.ok) return {}
    const data = (await res.json()) as { aliases?: PersonRedirectMap }
    return data.aliases ?? {}
  } catch {
    return {}
  }
}

function canonicalFor(
  segment: string,
  map: PersonRedirectMap,
): { slug: string; reason: PersonRedirectReason } | null {
  if (MOCK_ID.test(segment)) return null
  const entry = map[segment]
  if (!entry) return null
  return { slug: entry.to_slug || entry.to_id, reason: entry.reason }
}

async function resolvePersonRedirect(
  request: NextRequest,
): Promise<ResolvedPersonRedirect | null> {
  const path = request.nextUrl.pathname
  const origin = request.nextUrl.origin

  // /[community]/riders[/<seg>[/...]]
  const ridersMatch = path.match(/^\/([^/]+)\/riders(?:\/(.+))?\/?$/)
  if (ridersMatch) {
    const rest = ridersMatch[2] ?? ""
    if (!rest) return { path: "/people", from: "", to: "", reason: "route-migration" }
    const [firstSeg, ...remainder] = rest.split("/")
    const map = await loadAliases(origin)
    const canonical = canonicalFor(firstSeg, map)
    const targetSeg = canonical?.slug ?? firstSeg
    const tail = remainder.length ? "/" + remainder.join("/") : ""
    return {
      path: `/people/${targetSeg}${tail}`,
      from: firstSeg,
      to: targetSeg,
      reason: canonical?.reason ?? "route-migration",
    }
  }

  // Top-level /riders[/<seg>[/...]] — bookmarks from before PB-008 Phase 2.
  const topRidersMatch = path.match(/^\/riders(?:\/(.+))?\/?$/)
  if (topRidersMatch) {
    const rest = topRidersMatch[1] ?? ""
    if (!rest) return { path: "/people", from: "", to: "", reason: "route-migration" }
    const [firstSeg, ...remainder] = rest.split("/")
    const map = await loadAliases(origin)
    const canonical = canonicalFor(firstSeg, map)
    const targetSeg = canonical?.slug ?? firstSeg
    const tail = remainder.length ? "/" + remainder.join("/") : ""
    return {
      path: `/people/${targetSeg}${tail}`,
      from: firstSeg,
      to: targetSeg,
      reason: canonical?.reason ?? "route-migration",
    }
  }

  // /people/<seg>[/...] — alias resolution only; canonical paths pass through.
  const peopleMatch = path.match(/^\/people\/([^/]+)(\/.*)?$/)
  if (peopleMatch) {
    const firstSeg = peopleMatch[1]
    const tail = peopleMatch[2] ?? ""
    const map = await loadAliases(origin)
    const canonical = canonicalFor(firstSeg, map)
    if (!canonical || canonical.slug === firstSeg) return null
    return {
      path: `/people/${canonical.slug}${tail}`,
      from: firstSeg,
      to: canonical.slug,
      reason: canonical.reason,
    }
  }

  return null
}

function trackRedirect(
  origin: string,
  payload: { from_slug: string; to_slug: string; reason: RedirectReasonTag },
) {
  // Fire-and-forget. PostHog stub is at /api/track/node-redirect.
  void fetch(`${origin}/api/track/node-redirect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

export async function proxy(request: NextRequest) {
  // ── Layer 1: person-node redirects ──
  const personTarget = await resolvePersonRedirect(request)
  if (personTarget) {
    const newUrl = new URL(
      personTarget.path + request.nextUrl.search,
      request.nextUrl.origin,
    )
    const samePath =
      newUrl.pathname + newUrl.search ===
      request.nextUrl.pathname + request.nextUrl.search
    if (!samePath) {
      // Loop protection: the alias map collapses chains at build time, so a
      // single redirect lands at the terminal canonical. The same-path guard
      // above breaks any cycle that somehow survives.
      trackRedirect(request.nextUrl.origin, {
        from_slug: personTarget.from,
        to_slug: personTarget.to,
        reason: personTarget.reason,
      })
      return NextResponse.redirect(newUrl, 301)
    }
  }

  // ── Layer 2: legacy top-level community routes ──
  const { pathname } = request.nextUrl
  const firstSegment = pathname.split("/")[1]
  if (firstSegment && COMMUNITY_ROUTES.has(firstSegment)) {
    const url = request.nextUrl.clone()
    url.pathname = `/snowboarding${pathname}`
    return NextResponse.redirect(url, 301)
  }

  // ── Layer 3: Supabase session refresh + auth gate ──
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not write logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Only /[community]/timeline requires auth — all browse pages stay public
  const isProtected = /^\/[^/]+\/timeline/.test(request.nextUrl.pathname)

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/onboarding"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
