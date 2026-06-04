"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { trackEvent } from "@/lib/analytics"
import { BrandMark } from "@/components/ui/brand-mark"
import { cn } from "@/lib/utils"

const inputCls =
  "w-full px-3 py-2.5 rounded-lg bg-surface border border-border-default text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"

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

type View = "choices" | "email" | "password"

export default function SignInPage() {
  const router = useRouter()
  const [view, setView]         = useState<View>("choices")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading]   = useState(false) // password submit in flight
  const [sending, setSending]   = useState(false) // magic link send in flight
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const continueWithGoogle = async () => {
    setError(null)
    trackEvent("auth", "signin_started", { method: "google" })
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
    trackEvent("auth", "signin_started", { method: "magic_link" })
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, intent: "signin" }),
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

      // The server route falls back to a client-side OTP when Resend or the
      // service-role key are unavailable (e.g. local dev without those secrets).
      // shouldCreateUser is false here: this is the sign-in surface, so a stray
      // address must not silently create a brand new account.
      if (data.fallback) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: e,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/complete`,
            shouldCreateUser: false,
          },
        })
        if (otpError) {
          const msg = otpError.message.toLowerCase()
          setError(
            msg.includes("signups not allowed") || msg.includes("not found")
              ? "We could not find an account with that email."
              : otpError.message
          )
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

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    trackEvent("auth", "signin_started", { method: "password" })

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setError(
        authError.message.toLowerCase().includes("invalid")
          ? "Incorrect email or password."
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <BrandMark size={36} className="text-accent" />
          </Link>
          <h1 className="mt-3 text-foreground font-semibold" style={{ fontSize: 16 }}>
            Sign in to Linestry
          </h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">📬</div>
            <h2 className="text-foreground font-semibold" style={{ fontSize: 15 }}>
              Check your email
            </h2>
            <p className="text-muted leading-relaxed" style={{ fontSize: 12 }}>
              We sent a sign-in link to{" "}
              <span className="text-foreground font-medium">{email.trim().toLowerCase()}</span>.
              Open it to finish signing in.
            </p>
            <button
              onClick={() => { setSent(false); setView("email") }}
              className="text-accent-strong hover:underline"
              style={{ fontSize: 11 }}
            >
              Wrong address? Try again
            </button>
          </div>
        ) : (
          <div className="space-y-3">

            {/* Google */}
            <button
              onClick={continueWithGoogle}
              className="w-full px-4 py-3 rounded-xl bg-white text-[#1C1917] font-semibold hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2.5 border border-border-default"
              style={{ fontSize: 13 }}
            >
              <GoogleGlyph />
              Continue with Google
            </button>

            {/* Magic link */}
            {view !== "email" ? (
              <button
                onClick={() => { setView("email"); setError(null) }}
                className="w-full px-4 py-3 rounded-xl bg-[#1C1917] text-white font-semibold hover:bg-[#292524] transition-colors"
                style={{ fontSize: 13 }}
              >
                Continue with email
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !sending) sendMagicLink() }}
                  placeholder="you@example.com"
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
                <button
                  onClick={sendMagicLink}
                  disabled={sending}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl font-semibold transition-colors",
                    sending
                      ? "bg-surface-active text-muted cursor-not-allowed"
                      : "bg-[#1C1917] text-white hover:bg-[#292524]"
                  )}
                  style={{ fontSize: 13 }}
                >
                  {sending ? "Sending…" : "Send me a sign-in link"}
                </button>
              </div>
            )}

            {/* Password (secondary) */}
            {view !== "password" ? (
              <button
                onClick={() => { setView("password"); setError(null) }}
                className="w-full text-center text-muted hover:text-foreground transition-colors pt-1"
                style={{ fontSize: 11 }}
              >
                Sign in with a password instead
              </button>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
                <div>
                  <div className="flex items-center justify-end mb-1.5">
                    <Link
                      href="/auth/forgot-password"
                      className="text-muted hover:text-foreground transition-colors"
                      style={{ fontSize: 11 }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full px-6 py-3 rounded-xl bg-[#1C1917] text-white font-semibold hover:bg-[#292524] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ fontSize: 13 }}
                >
                  {loading ? "Signing in…" : "Sign in →"}
                </button>
              </form>
            )}

            {error && (
              <p className="text-red-400" style={{ fontSize: 11 }}>{error}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between" style={{ fontSize: 10 }}>
          <p className="text-muted">
            No account yet?{" "}
            <Link href="/onboarding" className="underline hover:text-foreground">
              Create your timeline
            </Link>
          </p>
          <button
            onClick={() => router.back()}
            className="text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
