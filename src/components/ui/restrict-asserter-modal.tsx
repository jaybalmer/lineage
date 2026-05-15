"use client"

// PB-009 Phase 3 — editor restrict-asserter confirmation modal.
//
// Different content from DeclineModal: rap-sheet preview (cascade counts +
// asserter display name) and a free-text reason field. Deliberately verbose
// copy so an editor never restricts by accident — restriction cascades
// approved tags to disabled (Q7) and that's hard to unwind on the asserter's
// timeline even if the block is later removed.

import { useState } from "react"
import { cn } from "@/lib/utils"

interface CascadePreview {
  pending_declined:  number
  approved_disabled: number
}

interface RestrictAsserterModalProps {
  open: boolean
  asserterName: string | null
  cascadePreview: CascadePreview | null   // null = loading
  onCancel: () => void
  onConfirm: (reason: string) => void | Promise<void>
  submitting?: boolean
}

const MAX_REASON = 500

export function RestrictAsserterModal({
  open,
  asserterName,
  cascadePreview,
  onCancel,
  onConfirm,
  submitting = false,
}: RestrictAsserterModalProps) {
  const [reason, setReason] = useState("")

  if (!open) return null

  const display = asserterName ?? "this asserter"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border-default rounded-xl max-w-md w-full p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground mb-1">Restrict {display}</h2>
        <p className="text-sm text-muted mb-3">
          This will prevent {display} from creating new tags across the platform. The action is reversible,
          but the cascade is not.
        </p>

        {cascadePreview ? (
          <div className="mb-4 p-3 rounded-lg bg-surface-active border border-border-default text-sm">
            <div className="font-medium text-foreground mb-1">Cascade preview</div>
            <ul className="text-muted space-y-0.5">
              <li>{cascadePreview.pending_declined} pending tags will be declined.</li>
              <li>{cascadePreview.approved_disabled} approved tags will be hidden.</li>
            </ul>
          </div>
        ) : (
          <div className="mb-4 text-sm text-muted">Loading cascade preview…</div>
        )}

        <label className="block text-sm text-foreground mb-1" htmlFor="restrict-reason">
          Reason (editor-only audit log)
        </label>
        <textarea
          id="restrict-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
          placeholder="What did you see? 500 char max."
          className="w-full p-2 rounded-lg border border-border-default bg-background text-foreground text-sm mb-4"
          rows={4}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={submitting}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              submitting
                ? "bg-surface-active text-muted cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            {submitting ? "Working…" : "Restrict asserter"}
          </button>
        </div>
      </div>
    </div>
  )
}
