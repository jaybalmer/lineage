import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { safeReturnTo } from "@/lib/safe-redirect"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // BUG-054: preserve returnTo across the OAuth hop so /auth/complete can honor
  // it after the session is established. Validated to an internal path.
  const returnTo = safeReturnTo(searchParams.get("returnTo"))
  const completeUrl = `${origin}/auth/complete${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`

  if (!code) {
    return NextResponse.redirect(`${origin}/onboarding?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/onboarding?error=auth_failed`)
  }

  return NextResponse.redirect(completeUrl)
}
