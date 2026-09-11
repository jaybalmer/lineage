"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useLineageStore } from "@/store/lineage-store"
import { trackEvent } from "@/lib/analytics"
import { attributionProps, readAttribution } from "@/lib/attribution"
import { signupErrorClass } from "@/lib/auth-error-class"
import { cn } from "@/lib/utils"

// BUG-115 / BUG-116: the onboarding picks live only in client localStorage, which
// does not survive the magic-link round trip when the link opens in a fresh
// context (the iOS Mail default). Carry the payload to the server so
// /auth/complete can restore the typed name and the FTUE claims from the auth
// user's metadata when the local store is empty.
function buildOnboardingPayload(returnTo?: string | null) {
  const { onboarding, sessionClaims } = useLineageStore.getState()
  return {
    display_name: onboarding.display_name?.trim() || undefined,
    birth_year: onboarding.birth_year ?? undefined,
    start_year: onboarding.start_year ?? undefined,
    first_place_id: onboarding.first_place_id ?? undefined,
    first_board_id: onboarding.first_board_id ?? undefined,
    sessionClaims,
    // Cross-device carry (T6): first-touch rides the same pending_onboarding
    // stash, so a magic link opened on a phone still attributes to the laptop
    // that saw the ad. Read here (client) since /auth/complete may run in a fresh
    // context with empty localStorage.
    attribution: readAttribution(),
    // Second channel for the signup intent (D7): the magic link itself carries
    // returnTo in its redirect, but if Supabase discards redirect_to (sending
    // origin not in the Redirect URLs allowlist) the stash is what survives.
    ...(returnTo ? { returnTo } : {}),
  }
}

const inputCls =
  "w-full bg-surface-2 border border-border-default rounded-2xl px-4 py-4 text-[17px] text-foreground " +
  "outline-none transition-colors placeholder:text-muted/60 focus:border-accent"

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

function FacebookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" />
      <path fill="#fff" d="M16.671 15.469 17.203 12h-3.328V9.749c0-.949.465-1.874 1.956-1.874h1.513V5.235s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669V12H7.078v3.469h3.047v8.385a12.13 12.13 0 0 0 3.75 0v-8.385h2.796z" />
    </svg>
  )
}

// Final FTUE step: a one-tap OAuth gate or a one-link email auth. Saving is what
// migrates the user's session claims into real, durable claims (handled at /auth/complete).
export function SaveStep({
  firstName = "",
  startYear = null,
  ridersWaiting = null,
  returnTo = null,
}: {
  firstName?: string
  startYear?: number | null
  /** Null when the community stats fetch failed. The tile is dropped, never faked. */
  ridersWaiting?: number | null
  /** Signup-intent destination to preserve across auth (validated by the caller). */
  returnTo?: string | null
} = {}) {
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Magic-link resend cooldown (R6). Counts down once a second; a successful
  // send (first or resend) resets it to 30. Component state only, never
  // persisted. `resent` shows the "sent again" confirmation.
  const [cooldown, setCooldown] = useState(0)
  const [resent, setResent] = useState(false)
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const continueWithGoogle = async () => {
    setError(null)
    trackEvent("auth", "signup_started", { method: "google", ...attributionProps() })
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}` },
      })
      if (oauthError) {
        trackEvent("auth", "signup_failed", { method: "google", error_class: signupErrorClass(oauthError.message) })
        setError(oauthError.message)
      }
    } catch {
      // The OAuth dispatch itself threw (e.g. redirect blocked) before Supabase
      // returned an error object; still record the drop-off.
      trackEvent("auth", "signup_failed", { method: "google", error_class: "dispatch_threw" })
      setError("Could not start Google sign-in. Please try again.")
    }
  }

  const continueWithFacebook = async () => {
    setError(null)
    trackEvent("auth", "signup_started", { method: "facebook", ...attributionProps() })
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo: `${window.location.origin}/auth/callback${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}` },
      })
      if (oauthError) {
        trackEvent("auth", "signup_failed", { method: "facebook", error_class: signupErrorClass(oauthError.message) })
        setError(oauthError.message)
      }
    } catch {
      // The OAuth dispatch itself threw (e.g. redirect blocked) before Supabase
      // returned an error object; still record the drop-off.
      trackEvent("auth", "signup_failed", { method: "facebook", error_class: "dispatch_threw" })
      setError("Could not start Facebook sign-in. Please try again.")
    }
  }

  const sendMagicLink = async (): Promise<boolean> => {
    const e = email.trim().toLowerCase()
    if (!e.includes("@")) {
      setError("Enter a valid email address.")
      return false
    }
    setSending(true)
    setError(null)
    setResent(false)
    trackEvent("auth", "signup_started", { method: "magic_link", ...attributionProps() })
    const onboardingPayload = buildOnboardingPayload(returnTo)
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // returnTo is baked into the emailed link's redirect by the route; the
        // stash inside onboardingPayload is the fallback channel (D7). No
        // `intent` field here: that name means signin|signup on this route (F7).
        body: JSON.stringify({ email: e, onboarding: onboardingPayload, returnTo: returnTo ?? undefined }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        fallback?: boolean
        error?: string
        warning?: string
      }

      if (data.error) {
        trackEvent("auth", "signup_failed", { method: "magic_link", error_class: signupErrorClass(data.error) })
        setError(data.error)
        return false
      }

      // R6c (D9): the branded link was sent, but stashing the onboarding picks on
      // the auth user failed. Nothing the visitor sees changes (the picks usually
      // survive in the client store); record it so the BUG-115 / BUG-116 failure
      // is no longer invisible to us.
      if (data.warning === "stash_failed") {
        trackEvent("error", "magic_link_stash_failed", { method: "magic_link" })
      }

      // The server route falls back to a client-side OTP when Resend / the
      // service-role key are unavailable (e.g. local dev without those secrets).
      if (data.fallback) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: e,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/complete${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
            shouldCreateUser: true,
            // Same carry-across as the server path: stash the picks in
            // user_metadata so /auth/complete can restore them cross-context.
            data: { pending_onboarding: onboardingPayload },
          },
        })
        if (otpError) {
          trackEvent("auth", "signup_failed", { method: "magic_link", error_class: signupErrorClass(otpError.message) })
          setError(otpError.message)
          return false
        }
      }

      // fallback distinguishes the Resend server path from the client OTP
      // fallback: they generate different link shapes, so Jay can see which one
      // loses people.
      trackEvent("auth", "magic_link_sent", {
        intent: "signup",
        surface: "ftue_save",
        fallback: !!data.fallback,
      })
      setSent(true)
      setCooldown(30)
      return true
    } catch {
      trackEvent("auth", "signup_failed", { method: "magic_link", error_class: "network" })
      setError("Something went wrong. Please try again.")
      return false
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
          It works once and lasts an hour.
        </p>

        <div className="space-y-2.5 pt-1">
          <p className="text-xs text-muted">
            Not there in a minute? Have a look in spam, then send it again.
          </p>
          <button
            onClick={async () => { const ok = await sendMagicLink(); if (ok) setResent(true) }}
            disabled={sending || cooldown > 0}
            className={cn(
              "w-full px-4 py-3 rounded-full text-sm font-semibold transition-colors",
              sending || cooldown > 0
                ? "bg-surface-active text-muted cursor-not-allowed"
                : "bg-accent text-white hover:bg-accent-strong"
            )}
          >
            {sending ? "Sending…" : cooldown > 0 ? `Send it again in ${cooldown}s` : "Send it again"}
          </button>
          {resent && !error && (
            <p className="text-xs text-emerald-400">Sent. Check your email again.</p>
          )}
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-2xl px-4 py-3">
              We could not send that link just now. Try once more, or go back and use a
              different address.
            </p>
          )}
        </div>

        <p className="text-xs text-muted pt-1">
          <button
            onClick={() => { setSent(false); setShowEmail(true); setError(null); setResent(false); setCooldown(0) }}
            className="text-blue-400 hover:underline"
          >
            Use a different address
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
          Last step
        </div>
        <h2 className="ftue-h1 mt-3">Save it before it scatters again.</h2>
        <p className="ftue-body mt-3.5">
          Your timeline is built and waiting{firstName ? `, ${firstName}` : ""}. Sign in and it&apos;s
          yours, including every story anyone else adds that mentions you.
        </p>
      </div>

      {(startYear !== null || ridersWaiting !== null) && (
        <div className="flex gap-2">
          {startYear !== null && <RecapTile value={String(startYear)} label="Anchored" />}
          <RecapTile value="1" label="Card ready" tone="#8b5cf6" />
          {ridersWaiting !== null && (
            <RecapTile value={ridersWaiting.toLocaleString()} label="Riders waiting" tone="#06b6d4" />
          )}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={continueWithGoogle}
          className="w-full px-4 py-4 rounded-full bg-[#F6F6F5] text-[#1C1917] text-[15px] font-semibold hover:bg-white transition-colors flex items-center justify-center gap-2.5"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        <button
          onClick={continueWithFacebook}
          className="w-full px-4 py-4 rounded-full bg-[#F6F6F5] text-[#1C1917] text-[15px] font-semibold hover:bg-white transition-colors flex items-center justify-center gap-2.5"
        >
          <FacebookGlyph />
          Continue with Facebook
        </button>

        {!showEmail ? (
          <button
            onClick={() => { setShowEmail(true); setError(null) }}
            className="w-full px-4 py-4 rounded-full border border-border-default text-foreground text-[15px] font-semibold hover:bg-surface-hover transition-colors"
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
                "w-full px-4 py-4 rounded-full text-[15px] font-semibold transition-colors",
                sending
                  ? "bg-surface-active text-muted cursor-not-allowed"
                  : "bg-accent text-white hover:bg-accent-strong"
              )}
            >
              {sending ? "Sending…" : "Send me a sign-in link"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-2xl px-4 py-3">
          {error}
        </p>
      )}

      <p className="text-center text-[11px] text-muted">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline hover:text-foreground">Terms of Service</Link>
        {" "}and{" "}
        <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
      </p>

      <p className="text-center text-[11px] text-muted">
        One tap. No password. Your two answers come with you.
      </p>
    </div>
  )
}

/** A single recap tile on the auth screen. Mirrors StatTile in ftue-bits, but
 *  takes a pre-formatted string because one of the three ("1 card ready") is a
 *  statement about the flow rather than a fetched count. */
function RecapTile({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex-1 bg-surface border border-border-default rounded-2xl px-2.5 py-3 text-center">
      <div
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 21,
          letterSpacing: "-0.02em",
          color: tone ?? "var(--foreground)",
        }}
      >
        {value}
      </div>
      <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
    </div>
  )
}
