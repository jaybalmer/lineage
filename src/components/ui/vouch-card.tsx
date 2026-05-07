"use client"

import { useState } from "react"
import { pluralize } from "@/lib/claim-request-helpers"
import { formatSmartDate } from "@/lib/utils"
import type { ClaimRequest, ClaimRequestStatus } from "@/types"

const RELATIONSHIP_OPTIONS = [
  { value: "rode_with",   label: "Rode with them" },
  { value: "worked_with", label: "Worked with them" },
  { value: "family",      label: "Family" },
  { value: "other",       label: "Other" },
] as const

type Relationship = (typeof RELATIONSHIP_OPTIONS)[number]["value"]

export interface ClaimRequestWithClaimant extends ClaimRequest {
  claimant: { display_name: string; avatar_url: string | null }
}

interface VouchCardProps {
  request: ClaimRequestWithClaimant
  currentUserId: string
  onVouched: (next: { status: ClaimRequestStatus; vouch_count: number }) => void
}

export function VouchCard({ request, currentUserId, onVouched }: VouchCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [relationship, setRelationship] = useState<Relationship>("rode_with")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const vouchCount = Array.isArray(request.vouches_received) ? request.vouches_received.length : 0
  const required = request.vouches_required
  const alreadyVouched = (request.vouches_received ?? []).some((v) => v.voucher_id === currentUserId)
  const isOwnClaim = request.claimant_id === currentUserId
  const vouchWord = pluralize(required, "vouch", "vouches")

  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/claim-requests/${request.id}/vouch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationship, note: note.trim() || undefined }),
      })
      const data = await res.json() as { status?: ClaimRequestStatus; vouch_count?: number; error?: string }
      if (!res.ok || !data.status) {
        setError(data.error ?? "Something went wrong. Try again.")
        setSubmitting(false)
        return
      }
      onVouched({ status: data.status, vouch_count: data.vouch_count ?? vouchCount + 1 })
      setExpanded(false)
    } catch {
      setError("Network error. Check your connection.")
      setSubmitting(false)
    }
  }

  return (
    <div className="postcard rounded-xl border border-violet-700/40 bg-violet-500/10 p-4 mb-3">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full bg-violet-200 flex items-center justify-center text-violet-900 font-bold text-sm shrink-0"
          aria-hidden
        >
          {request.claimant.display_name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            <span>{request.claimant.display_name}</span>{" "}
            <span className="text-gray-600 font-normal">says this is them</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Requested {formatSmartDate(request.created_at)} ·{" "}
            <span className="font-medium text-gray-700">{vouchCount}/{required}</span> {vouchWord}
          </p>

          {request.evidence_notes && (
            <p className="text-xs text-gray-700 mt-2 leading-relaxed bg-white/60 rounded-lg px-3 py-2 border border-violet-700/20">
              {request.evidence_notes}
            </p>
          )}

          {!expanded && (
            <div className="mt-3">
              {isOwnClaim ? (
                <span className="text-[11px] text-gray-500 italic">Your claim — waiting on vouches</span>
              ) : alreadyVouched ? (
                <span className="text-[11px] text-violet-700 font-medium">✓ You vouched for this claim</span>
              ) : request.status === "vouched" ? (
                <span className="text-[11px] text-violet-700 font-medium">Threshold met — awaiting editor review</span>
              ) : (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors"
                >
                  I know this person →
                </button>
              )}
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[10px] font-medium text-gray-600 uppercase tracking-widest mb-1.5 block">
                  How do you know them?
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as Relationship)}
                  className="w-full bg-white border border-violet-700/30 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-700 transition-colors"
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-600 uppercase tracking-widest mb-1.5 block">
                  Anything to add <span className="normal-case text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. rode together at Mt Hood ‘02"
                  rows={2}
                  className="w-full bg-white border border-violet-700/30 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-700 transition-colors resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-violet-700 text-white text-xs font-semibold hover:bg-violet-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Vouching…" : "Submit vouch"}
                </button>
                <button
                  onClick={() => { setExpanded(false); setError("") }}
                  className="px-3 py-2 rounded-lg border border-violet-700/30 text-xs text-gray-700 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
