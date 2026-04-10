"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)

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
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-[#B8862A] text-4xl">⬡</span>
          </Link>
          <h1 className="mt-3 text-foreground font-semibold" style={{ fontSize: 16 }}>
            Sign in to Lineage
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-muted mb-1.5" style={{ fontSize: 11 }}>
              Email address
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border-default text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
              style={{ fontSize: 13 }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-muted" style={{ fontSize: 11 }}>
                Password
              </label>
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
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border-default text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
              style={{ fontSize: 13 }}
            />
          </div>

          {error && (
            <p className="text-red-400" style={{ fontSize: 11 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full px-6 py-3 rounded-xl bg-[#1C1917] text-[#F5F2EE] font-semibold hover:bg-[#292524] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ fontSize: 13 }}
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>

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
