"use client"

import { useCallback, useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import {
  type CommentEmailPref,
  COMMENT_EMAIL_PREFS,
  COMMENT_EMAIL_PREF_META,
  DEFAULT_COMMENT_EMAIL_PREF,
} from "@/lib/comment-email-prefs"

interface PrefResponse { comment_email_pref: CommentEmailPref }

export default function MeNotificationsPage() {
  const { activePersonId, authReady, addToast } = useLineageStore()
  const [pref, setPref] = useState<CommentEmailPref | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(() => {
    if (!isAuthUser(activePersonId)) return
    setLoading(true)
    fetch("/api/me/notification-prefs")
      .then((r) => r.json())
      .then((r: PrefResponse) => setPref(r.comment_email_pref ?? DEFAULT_COMMENT_EMAIL_PREF))
      .catch(() => addToast("Could not load your notification settings.", "error"))
      .finally(() => setLoading(false))
  }, [activePersonId, addToast])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }
    refresh()
  }, [authReady, activePersonId, refresh])

  const choose = async (next: CommentEmailPref) => {
    if (next === pref || saving) return
    setSaving(true)
    const previous = pref
    setPref(next)
    try {
      const res = await fetch("/api/me/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_email_pref: next }),
      })
      if (!res.ok) {
        setPref(previous)
        addToast("Could not update setting.", "error")
        return
      }
      addToast(`Comment emails: ${COMMENT_EMAIL_PREF_META[next].label}.`)
    } catch {
      setPref(previous)
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
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Sign in to manage your notifications.</main>
      </>
    )
  }

  return (
    <>
      <Nav />
      <MeSubNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
        <p className="text-sm text-muted mt-1 mb-5">
          Choose how often we email you when someone comments on your stories.
        </p>

        <div className="space-y-3">
          {COMMENT_EMAIL_PREFS.map((value) => {
            const selected = pref === value
            const meta = COMMENT_EMAIL_PREF_META[value]
            return (
              <label
                key={value}
                className={cn(
                  "flex items-start gap-3 border rounded-xl p-4 bg-surface cursor-pointer transition-colors",
                  selected ? "border-blue-600" : "border-border-default hover:border-foreground/30",
                )}
              >
                <input
                  type="radio"
                  name="comment_email_pref"
                  checked={selected}
                  disabled={saving}
                  onChange={() => choose(value)}
                  className="h-5 w-5 mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {meta.label}
                    {value === DEFAULT_COMMENT_EMAIL_PREF && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-muted">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">{meta.blurb}</p>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-6 text-xs text-muted">
          Every comment email also has quick links to change this or turn it off.
        </div>
      </main>
    </>
  )
}
