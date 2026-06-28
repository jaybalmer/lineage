"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useLineageStore } from "@/store/lineage-store"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

// BUG-115 / BUG-116: the onboarding picks live only in client localStorage, which
// does not survive the magic-link round trip when the link opens in a fresh
// context (the iOS Mail default). Carry the payload to the server so
// /auth/complete can restore the typed name and the FTUE claims from the auth
// user's metadata when the local store is empty.
function buildOnboardingPayload() {
  const { onboarding, sessionClaims } = useLineageStore.getState()
  return {
    display_name: onboarding.display_name?.trim() || undefined,
    birth_year: onboarding.birth_year ?? undefined,
    start_year: onboarding.start_year ?? undefined,
    first_place_id: onboarding.first_place_id ?? undefined,
    first_board_id: onboarding.first_board_id ?? undefined,
    sessionClaims,
  }
}

const inputCls =
  "w-full bg-surface border border-border-default rounded-lg px-4 py-3 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

// Final FTUE step: a one-tap OAuth gate or a one-link email auth. Saving is what
// migrates the user's session claims into real, durable claims (handled at /auth/complete).
export function SaveStep() {
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const continueWithGoogle = async () => {
    setError(null)
    trackEvent("auth", "signup_started", { method: "google" })
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) setError(oauthError.message)
  }

  const sendMagicLink = async () => {
    const e = email.trim().toLowerCase()
    if (!e.includes("@")) {
      setError("Enter a valid email address.")
      return
    }
    setSending(true)
    setError(null)
    trackEvent("auth", "signup_started", { method: "magic_link" })
    const onboardingPayload = buildOnboardingPayload()
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, onboarding: onboardingPayload }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        fallback?: boolean
        error?: string
      }

      if (data.error) {
        setError(data.error)
        return
      }

      // The server route falls back to a client-side OTP when Resend / the
      // service-role key are unavailable (e.g. local dev without those secrets).
      if (data.fallback) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: e,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/complete`,
            shouldCreateUser: true,
            // Same carry-across as the server path: stash the picks in
            // user_metadata so /auth/complete can restore them cross-context.
            data: { pending_onboarding: onboardingPayload },
          },
        })
        if (otpError) {
          setError(otpError.message)
          return
        }
      }

      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center pt-8">
        <div className="text-5xl">📬</div>
        <h2 className="text-xl font-bold text-foreground">Check your email</h2>
        <p className="text-muted text-sm leading-relaxed">
          We sent a sign-in link to{" "}
          <span className="text-foreground font-medium">{email.trim().toLowerCase()}</span>.
          Open the link to finish signing in.
        </p>
        <p className="text-xs text-muted pt-2">
          Wrong address?{" "}
          <button
            onClick={() => { setSent(false); setShowEmail(true) }}
            className="text-blue-400 hover:underline"
          >
            Try again
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Save your linestry</h2>
        <p className="text-muted text-sm leading-relaxed">
          Pick how you want to sign in. Your moments are waiting on the other side.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={continueWithGoogle}
          className="w-full px-4 py-3 rounded-lg bg-white text-[#1C1917] text-sm font-medium hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2.5 border border-border-default"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        {!showEmail ? (
          <button
            onClick={() => { setShowEmail(true); setError(null) }}
            className="w-full px-4 py-3 rounded-lg bg-[#1C1917] text-white text-sm font-medium hover:bg-[#292524] transition-colors"
          >
            Continue with email
          </button>
        ) : (
          <div className="space-y-2">
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !sending) sendMagicLink() }}
              placeholder="you@example.com"
              className={inputCls}
            />
            <button
              onClick={sendMagicLink}
              disabled={sending}
              className={cn(
                "w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                sending
                  ? "bg-surface-active text-muted cursor-not-allowed"
                  : "bg-[#1C1917] text-white hover:bg-[#292524]"
              )}
            >
              {sending ? "Sending…" : "Send me a sign-in link"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
    </div>
  )
}
