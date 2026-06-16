"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { cn } from "@/lib/utils"

interface PublicTimelineResponse { enabled: boolean; slug: string | null }

export default function MePublicTimelinePage() {
  const { activePersonId, authReady, addToast } = useLineageStore()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
  }, [])

  const refresh = useCallback(() => {
    if (!isAuthUser(activePersonId)) return
    setLoading(true)
    fetch("/api/me/public-timeline")
      .then((r) => r.json())
      .then((r: PublicTimelineResponse) => { setEnabled(Boolean(r.enabled)); setSlug(r.slug ?? null) })
      .catch(() => addToast("Could not load your public timeline setting.", "error"))
      .finally(() => setLoading(false))
  }, [activePersonId, addToast])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }
    refresh()
  }, [authReady, activePersonId, refresh])

  const setPreference = async (next: boolean) => {
    setSaving(true)
    const previous = enabled
    setEnabled(next)
    try {
      const res = await fetch("/api/me/public-timeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        setEnabled(previous)
        addToast("Could not update setting.", "error")
        return
      }
      const data = (await res.json()) as PublicTimelineResponse
      setEnabled(Boolean(data.enabled))
      setSlug(data.slug ?? null)
      addToast(next
        ? "Your public timeline is live. Share the link below."
        : "Your public timeline is off. The link now shows nothing.")
    } catch {
      setEnabled(previous)
      addToast("Could not update setting.", "error")
    } finally {
      setSaving(false)
    }
  }

  const publicUrl = slug ? `${origin}/t/${slug}` : ""

  const copy = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      addToast("Could not copy. Select and copy the link manually.", "error")
    }
  }

  if (!authReady || loading) {
    return (
      <>
        <Nav />
        <MeSubNav />
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Loading…</main>
      </>
    )
  }
  if (!isAuthUser(activePersonId)) {
    return (
      <>
        <Nav />
        <MeSubNav />
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Sign in to manage your public timeline.</main>
      </>
    )
  }

  const checked = Boolean(enabled)

  return (
    <>
      <Nav />
      <MeSubNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Public timeline</h1>
        <p className="text-sm text-muted mt-1 mb-5">
          Turn on a clean, public page of your timeline that anyone can view, no account needed.
          Only your public claims and stories appear.
        </p>

        <label
          className={cn(
            "flex items-start gap-3 border rounded-xl p-4 bg-surface cursor-pointer transition-colors",
            checked ? "border-blue-600" : "border-border-default",
          )}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={saving}
            onChange={(e) => setPreference(e.target.checked)}
            className="h-5 w-5 mt-0.5 rounded border-border-default flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">
              Share my timeline publicly
            </div>
            <p className="text-xs text-muted mt-1">
              When on, your timeline is reachable at a shareable link. When off (default),
              the link returns nothing and your timeline stays inside Linestry.
            </p>
          </div>
        </label>

        {/* Stack View curation — the share-first card list (PB-010A Phase 3). */}
        <Link
          href="/me/public-view"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface p-4 hover:border-blue-600 transition-colors"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Curate your Stack View</div>
            <p className="text-xs text-muted mt-1">
              Pick a short, scannable set of highlight cards to lead with when you share your link.
            </p>
          </div>
          <span className="text-accent-strong text-sm flex-shrink-0">→</span>
        </Link>

        {checked && slug && (
          <div className="mt-4 rounded-xl border border-border-default bg-surface p-4">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">
              Your public link
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code className="flex-1 min-w-0 text-sm text-foreground bg-surface-hover border border-border-default rounded-lg px-3 py-2 truncate">
                {publicUrl}
              </code>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={copy}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-xs text-muted hover:text-foreground transition-colors"
                >
                  View
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
