import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { safeReturnTo } from "@/lib/safe-redirect"
import { captureServerEvent } from "@/lib/analytics-server"
import { signupErrorClass } from "@/lib/auth-error-class"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // BUG-054: preserve returnTo across the OAuth hop so /auth/complete can honor
  // it after the session is established. Validated to an internal path.
  const returnTo = safeReturnTo(searchParams.get("returnTo"))
  const completeUrl = `${origin}/auth/complete${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
  // Keep returnTo through a failed provider hop too, so the retry lands on the
  // destination (e.g. the guest page) rather than dropping it. Not R1 (that
  // renders the error message); this only stops throwing the destination away.
  const rtSuffix = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""

  if (!code) {
    // Server route ends in a redirect, so await the capture: a floating promise
    // would be truncated. This is the only place an OAuth round trip can fail
    // server-side (T9).
    await captureServerEvent({ category: "auth", event: "oauth_callback_failed", props: { reason: "no_code" } })
    return NextResponse.redirect(`${origin}/onboarding?error=no_code${rtSuffix}`)
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
    await captureServerEvent({
      category: "auth",
      event: "oauth_callback_failed",
      props: { reason: "exchange_failed", error_class: signupErrorClass(error.message) },
    })
    return NextResponse.redirect(`${origin}/onboarding?error=auth_failed${rtSuffix}`)
  }

  return NextResponse.redirect(completeUrl)
}
