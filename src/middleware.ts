import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Supabase session middleware — required for @supabase/ssr.
 * Reads the session from request cookies, refreshes the token if needed,
 * and writes updated cookies back to the response so the session stays alive.
 * Without this, Supabase JWTs expire after 1 hour and the user gets signed out.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write updated cookies to both the request (for downstream) and response (for browser)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session if the JWT is expired — this is the key call
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
