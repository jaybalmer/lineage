"use client"

import { useState, type FormEvent, type ChangeEvent } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { trackInviteEvent, trackInviteError } from "@/lib/invite-tracking"

interface HelpConnectCardProps {
  personId: string
  personName: string
}

export function HelpConnectCard({ personId, personName }: HelpConnectCardProps) {
  const { activePersonId, profileOverride, catalog } = useLineageStore()

  const [email, setEmail] = useState("")
  const [emailReported, setEmailReported] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [clipboardFallback, setClipboardFallback] = useState(false)

  const inviterName =
    profileOverride?.display_name ??
    catalog.people.find((p) => p.id === activePersonId)?.display_name ??
    "Someone"

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/people/${personId}`
      : `/people/${personId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setClipboardFallback(false)
      trackInviteEvent("share_link_copied", { person_id: personId })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setClipboardFallback(true)
      trackInviteError("clipboard_unavailable", {
        person_id: personId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setEmail(value)
    if (error) setError("")
    if (!emailReported && value.length > 0) {
      setEmailReported(true)
      trackInviteEvent("invite_email_added", { person_id: personId })
    }
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
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
          email: value,
        }),
      })
      const data = (await res.json()) as { token?: string; link?: string; error?: string }
      if (!res.ok || !data.link) {
        const msg = data.error ?? "Couldn't send invite. Try again."
        setError(msg)
        trackInviteError("invite_email_send_failed", {
          person_id: personId,
          status: res.status,
          message: msg,
        })
        setSending(false)
        return
      }
      setSentTo(value)
      setSent(true)
      trackInviteEvent("invite_email_sent", { person_id: personId })
    } catch (err) {
      setError("Network error. Check your connection.")
      trackInviteError("invite_email_send_failed", {
        person_id: personId,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-border-default bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="text-base shrink-0 text-muted">🔗</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-0.5">
            Help connect this person
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Share their profile or send them a direct invite. They can claim it and verify the connections.
          </p>

          {/* Copy share link */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg border border-border-default bg-surface-hover text-xs font-medium text-foreground hover:bg-surface-active transition-colors"
            >
              {copied ? "Copied!" : "Copy share link"}
            </button>
            {clipboardFallback && (
              <div className="mt-2">
                <p className="text-[11px] text-muted mb-1">
                  Couldn&apos;t copy automatically. Select and copy this link:
                </p>
                <input
                  readOnly
                  value={profileUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full bg-surface-hover border border-border-default rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Email invite */}
          <div className="mt-4 pt-4 border-t border-border-default">
            {sent ? (
              <div className="flex items-start gap-2">
                <span className="text-sm" style={{ color: "#16a34a" }} aria-hidden>✓</span>
                <p className="text-xs text-foreground">
                  Sent! We emailed <span className="font-medium">{sentTo}</span>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-2">
                <label htmlFor="help-connect-email" className="block text-[10px] font-medium text-muted uppercase tracking-widest">
                  Or invite by email
                </label>
                <div className="flex gap-2">
                  <input
                    id="help-connect-email"
                    type="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    disabled={sending}
                    placeholder="rider@example.com"
                    className="flex-1 min-w-0 bg-surface-hover border border-border-default rounded-lg px-3 py-2 text-xs text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sending || !email.trim()}
                    className="px-3 py-2 rounded-lg bg-[#1C1917] text-xs font-semibold text-[#F5F2EE] hover:bg-[#292524] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {sending ? "Sending…" : "Send invite"}
                  </button>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
