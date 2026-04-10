"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: "", color: "" }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: "Weak",   color: "#ef4444" }
  if (score <= 3) return { score, label: "Fair",   color: "#f59e0b" }
  return                { score, label: "Strong", color: "#22c55e" }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady]         = useState(false)
  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [done, setDone]           = useState(false)

  // Exchange the code from the URL for a session so we can call updateUser
  useEffect(() => {
    async function exchangeCode() {
      // PKCE code from query params
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) { setReady(true); return }
        } catch { /* fall through */ }
      }

      // Implicit flow hash (older links)
      const hash   = new URLSearchParams(window.location.hash.slice(1))
      const access = hash.get("access_token")
      const refresh = hash.get("refresh_token")
      if (access && refresh) {
        try {
          const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh })
          if (!error) { setReady(true); return }
        } catch { /* fall through */ }
      }

      // Might already have a session from a previous exchange
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setReady(true); return }

      // No valid reset session — link is expired or invalid
      router.replace("/auth/forgot-password?error=link_expired")
    }

    exchangeCode()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return }
    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push("/"), 2000)
  }

  const pw = passwordStrength(password)

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-[#B8862A] text-3xl animate-pulse">⬡</div>
          <div className="text-muted text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Verifying reset link…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-[#B8862A] text-4xl">⬡</span>
          </Link>
          <h1 className="mt-3 text-foreground font-semibold" style={{ fontSize: 16 }}>
            Set a new password
          </h1>
        </div>

        {done ? (
          <div className="rounded-xl border border-border-default bg-surface p-6 text-center space-y-3">
            <div className="text-green-400 text-2xl">✓</div>
            <p className="text-foreground font-semibold" style={{ fontSize: 13 }}>Password updated</p>
            <p className="text-muted" style={{ fontSize: 11 }}>Signing you in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-muted mb-1.5" style={{ fontSize: 11 }}>
                New password
              </label>
              <input
                type="password"
                required
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border-default text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
                style={{ fontSize: 13 }}
              />
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {[1,2,3,4,5].map(i => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all"
                        style={{ background: i <= pw.score ? pw.color : "#27272a" }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: pw.color }}>{pw.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-muted mb-1.5" style={{ fontSize: 11 }}>
                Confirm password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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
              disabled={loading || password.length < 8 || !confirm}
              className="w-full px-6 py-3 rounded-xl bg-[#1C1917] text-[#F5F2EE] font-semibold hover:bg-[#292524] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ fontSize: 13 }}
            >
              {loading ? "Saving…" : "Set password →"}
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
