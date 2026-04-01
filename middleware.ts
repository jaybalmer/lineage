import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** Routes that now live under /(community)/[community]/ */
const COMMUNITY_ROUTES = new Set([
  "riders", "places", "events", "boards", "brands", "orgs",
  "stories", "feed", "connections", "collective", "profile",
  "explore", "timeline",
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const firstSegment = pathname.split("/")[1] // "riders", "auth", etc.

  // Redirect old top-level community routes → /snowboarding/...
  if (firstSegment && COMMUNITY_ROUTES.has(firstSegment)) {
    const url = request.nextUrl.clone()
    url.pathname = `/snowboarding${pathname}`
    return NextResponse.redirect(url, 301)
  }

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
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not write logic between createServerClient and getUser()
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
