"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { PREDICATE_LABELS } from "@/lib/utils"
import type { Predicate } from "@/types"

interface InviteRiderModalProps {
  personId: string
  personName: string
  predicate: Predicate
  onClose: () => void
}

export function InviteRiderModal({ personId, personName, predicate, onClose }: InviteRiderModalProps) {
  const { activePersonId, profileOverride, catalog } = useLineageStore()
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [link, setLink] = useState("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  // Resolve inviter display name
  const inviterName =
    profileOverride?.display_name ??
    catalog.people.find((p) => p.id === activePersonId)?.display_name ??
    "Someone"

  const predicateLabel = PREDICATE_LABELS[predicate] ?? predicate

  async function handleSend(sendEmail: boolean) {
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: personId,
          person_name: personName,
          invited_by: activePersonId,
          inviter_name: inviterName,
          predicate,
          email: sendEmail && email.trim() ? email.trim() : undefined,
        }),
      })
      const data = await res.json() as { token?: string; link?: string; error?: string }
      if (!res.ok || !data.link) {
        setError(data.error ?? "Something went wrong. Try again.")
        setSending(false)
        return
      }
      setLink(data.link)
      setDone(true)
      // Auto-copy to clipboard
      try {
        await navigator.clipboard.writeText(data.link)
        setCopied(true)
      } catch {
        // clipboard not available
      }
    } catch {
      setError("Network error. Check your connection.")
    } finally {
      setSending(false)
    }
  }

  async function handleCopyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: show the link
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm bg-surface border border-border-default rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-default">
            <div>
              <h2 className="text-base font-bold text-foreground">Invite {personName}</h2>
              <p className="text-xs text-muted mt-0.5">They can claim their profile on Lineage</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            {!done ? (
              <>
                {/* Context */}
                <div className="bg-surface-hover border border-border-default rounded-xl px-4 py-3">
                  <p className="text-xs text-muted leading-relaxed">
                    You added <span className="text-foreground font-medium">{personName}</span> as someone you{" "}
                    <span className="text-foreground font-medium">{predicateLabel.toLowerCase()}</span>.
                    Send them an invite so they can claim their profile and verify the connection.
                  </p>
                </div>

                {/* Email input */}
                <div>
                  <label className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2 block">
                    Their email <span className="normal-case text-muted/60 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rider@example.com"
                    className="w-full bg-surface-hover border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => handleSend(true)}
                    disabled={sending}
                    className="w-full py-2.5 rounded-xl bg-[#1C1917] text-sm font-semibold text-[#F5F2EE] hover:bg-[#292524] disabled:opacity-50 transition-colors"
                  >
                    {sending ? "Sending…" : email.trim() ? "Send invite →" : "Get invite link →"}
                  </button>
                  {email.trim() && (
                    <button
                      onClick={() => handleSend(false)}
                      disabled={sending}
                      className="w-full py-2 rounded-xl text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border border-border-default"
                    >
                      Copy link only (no email)
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full py-2 text-xs text-muted hover:text-foreground transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </>
            ) : (
              /* ── Done state ── */
              <div className="space-y-4 py-2">
                <div className="text-center space-y-1">
                  <div className="text-3xl">✅</div>
                  <p className="text-sm font-semibold text-foreground">
                    {email.trim() ? "Invite sent!" : "Link ready!"}
                  </p>
                  <p className="text-xs text-muted">
                    {email.trim()
                      ? `We emailed ${email.trim()} with a link to claim their profile.`
                      : "Share this link with them:"}
                  </p>
                </div>

                {/* Link display */}
                <div className="flex items-center gap-2 bg-surface-hover border border-border-default rounded-xl px-3 py-2.5">
                  <span className="text-xs text-muted truncate flex-1">{link}</span>
                  <button
                    onClick={handleCopyLink}
                    className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0 transition-colors font-medium"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                {email.trim() && (
                  <p className="text-[10px] text-muted text-center">
                    You can also share the link above directly via SMS or DM.
                  </p>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-surface-hover border border-border-default text-sm font-medium text-foreground hover:bg-surface-active transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
