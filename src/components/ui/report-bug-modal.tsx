"use client"

import { useState } from "react"
import posthog from "posthog-js"
import { cn } from "@/lib/utils"
import { useLineageStore } from "@/store/lineage-store"

interface ReportBugModalProps {
  open: boolean
  onClose: () => void
  /** When true, the helper line notes that the signed-in account is attached too. */
  includeAccount?: boolean
}

/**
 * "Report a bug" modal, opened from the avatar dropdown. Captures the current
 * page, viewport, browser, and PostHog session replay link automatically so
 * triage can reproduce without a back-and-forth. Reporter identity is added
 * server-side from the session, so it is never sent from here (cannot be spoofed).
 */
export function ReportBugModal({ open, onClose, includeAccount = false }: ReportBugModalProps) {
  const addToast = useLineageStore((s) => s.addToast)
  const [note, setNote] = useState("")
  const [expected, setExpected] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const canSend = note.trim().length > 0 && !submitting

  async function handleSend() {
    if (note.trim().length === 0 || submitting) return
    setSubmitting(true)

    // PostHog session replay link. The method name has drifted across versions,
    // so guard it and accept null rather than assuming it exists, or that PostHog
    // is even initialized (there is no key in some environments).
    let posthogSessionUrl: string | null = null
    try {
      posthogSessionUrl = posthog.get_session_replay_url?.({ withTimestamp: true }) || null
    } catch {
      posthogSessionUrl = null
    }

    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim(),
          expected: expected.trim() || undefined,
          url: window.location.href,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
          posthogSessionUrl,
        }),
      })
      if (!res.ok) throw new Error("request failed")
      addToast("Thanks. Bug report sent.", "info")
      setNote("")
      setExpected("")
      onClose()
    } catch {
      addToast("Could not send. Please try again.", "error")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border-default rounded-xl max-w-md w-full p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground mb-1">Report a bug</h2>
        <p className="text-sm text-muted mb-4">
          {includeAccount
            ? "Your current page, browser, and account are attached automatically so we can reproduce it."
            : "Your current page and browser are attached automatically so we can reproduce it."}
        </p>

        <label className="block text-xs font-medium text-foreground mb-1">What happened?</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what went wrong"
          autoFocus
          rows={4}
          className="w-full p-2 rounded-lg border border-border-default bg-background text-foreground text-sm mb-4"
        />

        <label className="block text-xs font-medium text-foreground mb-1">
          What did you expect? <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="What should have happened instead"
          rows={3}
          className="w-full p-2 rounded-lg border border-border-default bg-background text-foreground text-sm mb-4"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              !canSend
                ? "bg-surface-active text-muted cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700",
            )}
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
