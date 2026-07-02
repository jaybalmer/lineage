"use client"

import { useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { AdminInvitePanel } from "@/components/ui/admin-invite-panel"
import { formatSmartDate, nameToSlug } from "@/lib/utils"
import { pluralize } from "@/lib/claim-request-helpers"
import type { ClaimRequest } from "@/types"

export interface ClaimRequestWithContext extends ClaimRequest {
  // Null on email-first (public_invite) claims, which have no claimant account.
  claimant: { id: string; display_name: string; avatar_url: string | null } | null
  person:   { id: string; display_name: string; node_status: string }
  voucher_names: string[]
  added_by_name?: string | null
  node_claim_count?: number
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  rode_with:   "Rode with",
  worked_with: "Worked with",
  family:      "Family",
  other:       "Other",
}

export function ClaimsAdminClient({ initialRequests }: { initialRequests: ClaimRequestWithContext[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRequests.map((r) => [r.id, r.editor_notes ?? ""]))
  )

  function setError(id: string, msg: string) {
    setErrors((e) => ({ ...e, [id]: msg }))
  }
  function clearError(id: string) {
    setErrors((e) => { const { [id]: _, ...rest } = e; return rest })
  }

  async function handleAction(req: ClaimRequestWithContext, action: "approve" | "deny") {
    setBusyId(req.id)
    clearError(req.id)
    try {
      // Persist any pending notes edits first so denial/approval emails see them.
      if (draftNotes[req.id] !== (req.editor_notes ?? "")) {
        await fetch(`/api/claim-requests/${req.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_notes", editor_notes: draftNotes[req.id] || null }),
        })
      }
      const res = await fetch(`/api/claim-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json() as ClaimRequest & { error?: string }
      if (!res.ok) {
        setError(req.id, data.error ?? "Request failed")
        return
      }
      // Drop the row from the list; both approve and deny remove it from the open queue.
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
    } catch {
      setError(req.id, "Network error")
    } finally {
      setBusyId(null)
    }
  }

  async function handleSaveNotes(req: ClaimRequestWithContext) {
    setBusyId(req.id)
    clearError(req.id)
    try {
      const res = await fetch(`/api/claim-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_notes", editor_notes: draftNotes[req.id] || null }),
      })
      const data = await res.json() as ClaimRequest & { error?: string }
      if (!res.ok) {
        setError(req.id, data.error ?? "Failed to save")
        return
      }
      setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, editor_notes: data.editor_notes } : r))
    } catch {
      setError(req.id, "Network error")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Claim Requests</h1>
            <p className="text-sm text-muted mt-1">
              {requests.length} open {pluralize(requests.length, "request", "requests")} (pending or vouched)
            </p>
          </div>
          <Link href="/admin" className="text-xs text-muted hover:text-foreground transition-colors">
            ← Back to admin
          </Link>
        </div>

        <AdminInvitePanel />

        {requests.length === 0 ? (
          <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
            No open claim requests.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => {
              const vouchCount = (r.vouches_received ?? []).length
              const ready = r.status === "vouched"
              const isPublicInvite = r.claim_kind === "public_invite"
              const isProtected = r.verification_tier === "protected"
              const personSlug = nameToSlug(r.person.display_name) || r.person.id
              return (
                <div
                  key={r.id}
                  className="postcard rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/people/${personSlug}`}
                          className="text-base font-semibold text-gray-900 hover:underline"
                        >
                          {r.person.display_name}
                        </Link>
                        <span
                          className={
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider " +
                            (ready
                              ? "bg-violet-100 text-violet-800"
                              : "bg-amber-100 text-amber-800")
                          }
                        >
                          {ready ? "Ready" : "Pending"}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                          tier: {r.verification_tier}
                        </span>
                        {isPublicInvite && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-100 text-blue-800">
                            Email claim
                          </span>
                        )}
                      </div>
                      {isPublicInvite ? (
                        <p className="text-xs text-gray-600 mt-1">
                          From{" "}
                          <span className="font-semibold text-gray-900">{r.claimant_email}</span>{" "}
                          · requested {formatSmartDate(r.created_at)}
                          {r.added_by_name ? <> · node added by {r.added_by_name}</> : null}
                          {" "}· <span className="font-semibold text-gray-900">{r.node_claim_count ?? 0}</span>{" "}
                          {pluralize(r.node_claim_count ?? 0, "claim", "claims")} on node
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600 mt-1">
                          Claimed by{" "}
                          <span className="font-semibold text-gray-900">{r.claimant?.display_name ?? "Unknown"}</span>{" "}
                          · requested {formatSmartDate(r.created_at)} ·{" "}
                          <span className="font-semibold text-gray-900">{vouchCount}/{r.vouches_required}</span>{" "}
                          {pluralize(r.vouches_required, "vouch", "vouches")}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPublicInvite && isProtected && (
                    <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                      <p className="text-xs font-semibold text-red-700">
                        PROTECTED node. Verify identity out of band before approving.
                      </p>
                    </div>
                  )}

                  {r.evidence_notes && (
                    <div className="mb-3">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        Evidence from claimant
                      </div>
                      <p className="text-xs text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 whitespace-pre-wrap">
                        {r.evidence_notes}
                      </p>
                    </div>
                  )}

                  {(r.vouches_received ?? []).length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        Vouches
                      </div>
                      <ul className="text-xs text-gray-800 space-y-1">
                        {r.vouches_received.map((v, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-gray-500 shrink-0">•</span>
                            <span className="min-w-0">
                              <span className="font-semibold">{r.voucher_names[i] ?? v.voucher_id}</span>{" "}
                              <span className="text-gray-500">
                                ({RELATIONSHIP_LABEL[v.relationship] ?? v.relationship})
                              </span>
                              {v.note && <span className="text-gray-700"> — {v.note}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">
                      Editor notes
                    </label>
                    <textarea
                      value={draftNotes[r.id] ?? ""}
                      onChange={(e) => setDraftNotes((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="Internal notes — shown to claimant only on denial."
                      rows={2}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    />
                  </div>

                  {errors[r.id] && (
                    <p className="text-xs text-red-600 mb-3">{errors[r.id]}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(r, "approve")}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-lg bg-violet-700 text-white text-xs font-semibold hover:bg-violet-800 disabled:opacity-50 transition-colors"
                    >
                      {busyId === r.id ? "Working…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(r, "deny")}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => handleSaveNotes(r)}
                      disabled={busyId === r.id || draftNotes[r.id] === (r.editor_notes ?? "")}
                      className="px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      Save notes
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
