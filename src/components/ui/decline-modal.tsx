"use client"

// PB-009 Phase 3 — shared decline / report category-picker modal.
//
// Lifted verbatim from the inlined DeclineModal in /me/tags. The owner inbox
// (single + bulk decline), the editor preemptive decline, and the member
// report-as-abuse flow all share this layout — same backdrop, same category
// radio group, same optional "Other" note. Two props differentiate the
// flows: `title` + `confirmLabel` for the call-to-action copy, and
// `destructive` for the red vs. neutral confirm button style.

import { useState } from "react"
import { cn } from "@/lib/utils"
import { USER_FACING_CATEGORIES } from "@/lib/decline-categories"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { TagEventDeclineCategory } from "@/types"

interface DeclineModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: (category: TagEventDeclineCategory, note?: string) => void | Promise<void>
  count?: number
  title?: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  submitting?: boolean
}

export function DeclineModal({
  open,
  onCancel,
  onConfirm,
  count = 1,
  title,
  description,
  confirmLabel,
  destructive = true,
  submitting = false,
}: DeclineModalProps) {
  const [category, setCategory] = useState<TagEventDeclineCategory | null>(null)
  const [note,     setNote]     = useState("")

  // Lock the background page while the modal is open (BUG-048). Called before
  // the early return so the hook order stays stable across renders.
  useBodyScrollLock(open)

  if (!open) return null

  const canConfirm = category !== null && !submitting
  const heading = title ?? `Decline ${count > 1 ? `${count} tags` : "tag"}`
  const cta     = confirmLabel ?? "Decline"
  const sub     = description ?? "Tell us why — the asserter will see only the category, not the note."

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border-default rounded-xl max-w-md w-full p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground mb-1">{heading}</h2>
        <p className="text-sm text-muted mb-4">{sub}</p>

        <div className="flex flex-col gap-2 mb-4">
          {USER_FACING_CATEGORIES.map((c) => (
            <label key={c.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="decline-category"
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                className="h-4 w-4"
              />
              <span className="text-sm text-foreground">{c.label}</span>
            </label>
          ))}
        </div>

        {category === "other" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            placeholder="Tell us more (optional, 280 char max)"
            className="w-full p-2 rounded-lg border border-border-default bg-background text-foreground text-sm mb-4"
            rows={3}
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(category!, category === "other" ? note : undefined)}
            disabled={!canConfirm}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              !canConfirm
                ? "bg-surface-active text-muted cursor-not-allowed"
                : destructive
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-blue-600 text-white hover:bg-blue-700",
            )}
          >
            {submitting ? "Working…" : cta}
          </button>
        </div>
      </div>
    </div>
  )
}
