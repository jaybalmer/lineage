"use client"

import { useCallback, useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { cn } from "@/lib/utils"

interface PrefResponse { require_tag_approval: boolean }

export default function MeTagPrivacyPage() {
  const { activePersonId, authReady, addToast } = useLineageStore()
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(() => {
    if (!isAuthUser(activePersonId)) return
    setLoading(true)
    fetch("/api/me/tag-privacy")
      .then((r) => r.json())
      .then((r: PrefResponse) => setRequireApproval(Boolean(r.require_tag_approval)))
      .catch(() => addToast("Could not load your tag privacy setting.", "error"))
      .finally(() => setLoading(false))
  }, [activePersonId, addToast])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }
    refresh()
  }, [authReady, activePersonId, refresh])

  const setPreference = async (next: boolean) => {
    setSaving(true)
    const previous = requireApproval
    setRequireApproval(next)
    try {
      const res = await fetch("/api/me/tag-privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ require_tag_approval: next }),
      })
      if (!res.ok) {
        setRequireApproval(previous)
        addToast("Could not update setting.", "error")
        return
      }
      addToast(next
        ? "Approval required. New tags will wait in your inbox."
        : "Approval not required. Tags appear immediately.")
    } catch {
      setRequireApproval(previous)
      addToast("Could not update setting.", "error")
    } finally {
      setSaving(false)
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
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Sign in to manage tag privacy.</main>
      </>
    )
  }

  const checked = Boolean(requireApproval)

  return (
    <>
      <Nav />
      <MeSubNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Tag privacy</h1>
        <p className="text-sm text-muted mt-1 mb-5">
          Choose when other riders' tags become visible on your profile.
        </p>

        <label
          className={cn(
            "flex items-start gap-3 border rounded-xl p-4 bg-surface cursor-pointer transition-colors",
            checked ? "border-blue-600" : "border-border-default hover:border-border-default",
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
              Require approval before tags appear publicly
            </div>
            <p className="text-xs text-muted mt-1">
              When on, riders who tag you will land in your inbox for approval before
              showing on the story or claim. When off (default), tags appear immediately
              and you can remove them anytime from your inbox.
            </p>
          </div>
        </label>

        <div className="mt-6 text-xs text-muted">
          You can review pending and recent tags in <a href="/me/tags" className="underline hover:text-foreground">your tag inbox</a>.
        </div>
      </main>
    </>
  )
}
