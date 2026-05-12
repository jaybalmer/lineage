"use client"

import { useState } from "react"
import { trackInviteError, trackInviteEvent } from "@/lib/invite-tracking"

interface HelpConnectCardProps {
  personId: string
  personName: string
  /** Used to build the share URL. Defaults to window.location.href. */
  profileUrl?: string
  /** Inviter display name passed through to /api/invite. */
  inviterName: string
}

// PB-008 Phase 2 Session 4 (Item 2). Surfaced on every unclaimed person
// profile alongside the "This is me" CTA. Two actions, always visible to any
// authed visitor:
//   - Copy share link → clipboard
//   - Email-share → calls /api/invite with the provided email
//
// Calling /api/invite reuses the existing invite flow: it persists
// people.invite_email when null, queues the magic-link email via Resend, and
// elevates node_status catalog→unclaimed when applicable.
export function HelpConnectCard({ personId, personName, profileUrl, inviterName }: HelpConnectCardProps) {
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const resolvedUrl =
    profileUrl ?? (typeof window !== "undefined" ? window.location.href : "")

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resolvedUrl)
      setCopied(true)
      trackInviteEvent("share_link_copied", {
        surface: "help_connect_card",
        person_id: personId,
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError("Couldn't copy. Select the link manually.")
    }
  }

  async function handleEmailShare(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: personId,
          person_name: personName,
          inviter_name: inviterName,
          predicate: "rode_with",
          email: trimmed,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Couldn't send. Try again.")
        trackInviteError("invite_post_fetch_failed", {
          surface: "help_connect_card",
          person_id: personId,
          status: res.status,
        })
        setSending(false)
        return
      }
      setSent(true)
      setEmail("")
      trackInviteEvent("invite_email_added", {
        surface: "help_connect_card",
        person_id: personId,
      })
    } catch {
      setError("Network error. Check your connection.")
      trackInviteError("invite_post_fetch_failed", {
        surface: "help_connect_card",
        person_id: personId,
        reason: "network",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="mb-6 rounded-xl p-4"
      style={{ background: "#3b82f608", border: "1px dashed #3b82f640" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-base shrink-0" style={{ color: "#3b82f6" }}>🤝</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-0.5">
            Help connect this person
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Share their profile or send a direct invite — whichever is easier to get to them.
          </p>

          {/* Action row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={{ borderColor: "#3b82f640", color: "#3b82f6", background: "#3b82f610" }}
            >
              {copied ? "Link copied" : "Copy share link"}
            </button>

            <form onSubmit={handleEmailShare} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={sent ? "Send another?" : `${personName.split(" ")[0]}'s email`}
                disabled={sending}
                className="flex-1 min-w-0 bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: "#1C1917", color: "#F5F2EE" }}
              >
                {sending ? "Sending…" : sent ? "Sent" : "Send invite"}
              </button>
            </form>
          </div>

          {error && (
            <p className="text-[11px] text-red-400 mt-2">{error}</p>
          )}
          {sent && !error && (
            <p className="text-[11px] text-muted mt-2">
              We sent a claim link to that address. They can send it back to you if you want to confirm it landed.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
