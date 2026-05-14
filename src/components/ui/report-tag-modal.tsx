"use client"

// PB-009 Phase 3 — member abuse-report modal.
//
// Same primitive layout as DeclineModal (backdrop + radio category picker +
// optional "Other" note). Different from DeclineModal in two ways:
//   1. Title and CTA copy ("Report tag", "Submit report")
//   2. Non-destructive button styling (blue confirm rather than red)
//
// Reuses the shared USER_FACING_CATEGORIES list (Phase 2 reused decline
// categories for reports per Q2 — DO NOT invent parallel taxonomy).

import { DeclineModal } from "@/components/ui/decline-modal"
import type { TagEventDeclineCategory } from "@/types"

interface ReportTagModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: (category: TagEventDeclineCategory, note?: string) => void | Promise<void>
  submitting?: boolean
}

export function ReportTagModal({ open, onCancel, onConfirm, submitting }: ReportTagModalProps) {
  return (
    <DeclineModal
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Report tag"
      description="Tell editors what's wrong. Your name is visible to editors only."
      confirmLabel="Submit report"
      destructive={false}
      submitting={submitting}
    />
  )
}
