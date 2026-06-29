"use client"

// node-claim-by-admin-invite: the email-capture sheet a NOT-logged-in visitor
// uses to say "that's me" on a person node. Self-contained client island (no
// store, no auth): it posts { node_id, email, note, source, slug } to
// /api/public/claim-node and transitions in place to a confirmation state. Used
// from both the in-app person page (/people/[id]) and node references on the
// public timeline (/t/[slug]), so it carries its own light-surface styling and
// renders as a centered modal that reads on either ground.

import { useState } from "react"

export function ClaimNodeSheet({
  nodeId,
  personName,
  source,
  slug,
  onClose,
}: {
  nodeId: string
  personName: string
  source: "person_page" | "public_timeline"
  slug?: string
  onClose: () => void
}) {
  const [email, setEmail] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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
      const res = await fetch("/api/public/claim-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          email: trimmed,
          note: note.trim() || undefined,
          source,
          slug,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not submit. Try again.")
        return
      }
      setDone(true)
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
            <h2 className="mb-2 text-base font-bold text-gray-900">Check your email</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We will review your claim on{" "}
              <span className="font-semibold text-gray-900">{personName}</span> and email{" "}
              <span className="font-semibold text-gray-900">{email.trim()}</span> to finish setting
              up your profile.
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
              Is this you, {personName}?
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              Add your email and we will review your claim. Once approved, we email you a link to
              finish setting up your profile, with the existing history already attached.
            </p>
            <input
              className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="Your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              autoComplete="email"
              autoFocus
            />
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {busy ? "Submitting…" : "Submit claim"}
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
