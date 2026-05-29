"use client"

import { useState } from "react"
import type { ClaimRequest } from "@/types"

interface ClaimRequestModalProps {
  personId: string
  personName: string
  onClose: () => void
  onCreated: (req: ClaimRequest) => void
}

export function ClaimRequestModal({ personId, personName, onClose, onCreated }: ClaimRequestModalProps) {
  const [evidence, setEvidence] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/claim-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: personId,
          evidence_notes: evidence.trim() || undefined,
        }),
      })
      const data = await res.json() as ClaimRequest & { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.")
        setSubmitting(false)
        return
      }
      onCreated(data)
    } catch {
      setError("Network error. Check your connection.")
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-surface border border-border-default rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-default">
            <div>
              <h2 className="text-base font-bold text-foreground">Claim {personName}</h2>
              <p className="text-xs text-muted mt-0.5">Tell us this is you</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="bg-surface-hover border border-border-default rounded-xl px-4 py-3">
              <p className="text-xs text-muted leading-relaxed">
                You&rsquo;re asking to claim the profile for{" "}
                <span className="text-foreground font-medium">{personName}</span>.
                Members who know you can vouch for the claim from this profile.
                An editor reviews it once enough vouches come in.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2 block">
                Anything that helps verify <span className="normal-case text-muted/60 font-normal">(optional)</span>
              </label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Instagram, links to coverage, anything that helps us confirm this is you."
                rows={4}
                className="w-full bg-surface-hover border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="space-y-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-[#1C1917] text-sm font-semibold text-white hover:bg-[#292524] disabled:opacity-50 transition-colors"
              >
                {submitting ? "Submitting…" : "Submit claim →"}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs text-muted hover:text-foreground transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
