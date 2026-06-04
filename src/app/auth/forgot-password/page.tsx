"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { BrandMark } from "@/components/ui/brand-mark"

export default function ForgotPasswordPage() {
  const [email, setSent_email] = useState("")
  const [loading, setLoading]  = useState(false)
  const [sent, setSent]        = useState(false)
  const [error, setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!addr) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
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

      // The server route falls back to Supabase's built-in reset email when
      // Resend or the service-role key are unavailable (e.g. local dev without
      // those secrets). resetPasswordForEmail is non-enumerating, so an unknown
      // address still silently no-ops rather than leaking account existence.
      if (data.fallback) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          addr,
          { redirectTo: `${window.location.origin}/auth/reset-password` },
        )
        if (resetError) {
          setError(resetError.message)
          return
        }
      }

      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <Link href="/" className="inline-block">
            <BrandMark size={36} className="text-accent" />
          </Link>
          <h1 className="mt-3 text-foreground font-semibold" style={{ fontSize: 16 }}>
            Reset your password
          </h1>
          <p className="text-muted mt-1" style={{ fontSize: 12 }}>
            {sent ? "" : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border-default bg-surface p-6 text-center space-y-3">
            <div className="text-green-400 text-2xl">✓</div>
            <p className="text-foreground font-semibold" style={{ fontSize: 13 }}>Check your email</p>
            <p className="text-muted" style={{ fontSize: 11 }}>
              We sent a password reset link to{" "}
              <span className="text-foreground">{email}</span>.
              Click it to set a new password.
            </p>
            <p className="text-muted" style={{ fontSize: 10 }}>
              Wrong email?{" "}
              <button
                onClick={() => { setSent(false); setSent_email("") }}
                className="underline hover:text-foreground"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-muted mb-1.5" style={{ fontSize: 11 }}>
                Email address
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setSent_email(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border-default text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
                style={{ fontSize: 13 }}
              />
            </div>

            {error && (
              <p className="text-red-400" style={{ fontSize: 11 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full px-6 py-3 rounded-xl bg-[#1C1917] text-white font-semibold hover:bg-[#292524] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ fontSize: 13 }}
            >
              {loading ? "Sending…" : "Send reset link →"}
            </button>
          </form>
        )}

        <div className="text-center" style={{ fontSize: 10 }}>
          <Link href="/auth/signin" className="text-muted hover:text-foreground transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
