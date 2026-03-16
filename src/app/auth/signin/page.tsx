"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"



export default function SignInPage() {
  const router  = useRouter()
  const [email, setEmail]   = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setSending(false)
    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-blue-400 text-4xl">⬡</span>
          </Link>
          <h1 className="mt-3 text-foreground font-semibold" style={{ fontSize: 16 }}>
            Sign in to Lineage
          </h1>
          <p className="text-muted mt-1" style={{ fontSize: 12 }}>
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border-default bg-surface p-6 text-center space-y-3">
            <div className="text-green-400 text-2xl">✓</div>
            <p className="text-foreground font-semibold" style={{ fontSize: 13 }}>Check your email</p>
            <p className="text-muted" style={{ fontSize: 11 }}>
              We sent a sign-in link to <span className="text-foreground">{email}</span>.
              Click it to open your lineage.
            </p>
            <p className="text-muted" style={{ fontSize: 10 }}>
              Wrong email?{" "}
              <button
                onClick={() => { setSent(false); setEmail("") }}
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
                onChange={e => setEmail(e.target.value)}
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
              disabled={sending || !email.trim()}
              className="w-full px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ fontSize: 13 }}
            >
              {sending ? "Sending…" : "Send magic link →"}
            </button>
          </form>
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
