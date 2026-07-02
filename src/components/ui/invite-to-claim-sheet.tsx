"use client"

// node-claim-by-admin-invite: the editor-facing sheet to proactively invite a
// person node to claim their account by email. The editor twin of
// ClaimNodeSheet (which a visitor uses on themselves): here an editor pastes the
// rider's email and we POST to /api/admin/invite-node, which inserts an
// already-approved public_invite claim and sends the account-creating magic
// link. Self-contained client island; centered modal on a light surface.

import { useState } from "react"

export function InviteToClaimSheet({
  nodeId,
  personName,
  initialEmail,
  onClose,
  onInvited,
}: {
  nodeId: string
  personName: string
  initialEmail?: string | null
  onClose: () => void
  onInvited: (email: string) => void
}) {
  const [email, setEmail] = useState(initialEmail ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const isResend = !!initialEmail

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes("@") || trimmed.length < 3) {
      setError("Enter a valid email.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/invite-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, email: trimmed }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not send the invite. Try again.")
        return
      }
      setDone(true)
      onInvited(trimmed)
    } catch {
      setError("Network error. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <div className="mb-3 text-3xl">📨</div>
            <h2 className="mb-2 text-base font-bold text-gray-900">Invite sent</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We emailed <span className="font-semibold text-gray-900">{email.trim()}</span> a link to
              claim <span className="font-semibold text-gray-900">{personName}</span>. Opening it
              creates their account with the existing history already attached.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 className="mb-1 text-base font-bold text-gray-900">
              {isResend ? "Re-send invite" : "Invite"} {personName} to claim
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              Enter their email. They get a link that creates their account and folds this profile,
              with its existing history, straight into it. No claim review needed.
            </p>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="rider@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              autoComplete="off"
              autoFocus={!isResend}
              disabled={isResend}
            />
            {isResend && (
              <p className="mt-2 text-xs text-gray-500">
                Re-sends to the same address. To invite a different email, decline this one first.
              </p>
            )}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {busy ? "Sending…" : isResend ? "Re-send invite" : "Send invite"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
