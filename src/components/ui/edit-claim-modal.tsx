"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { Claim, ConfidenceLevel, PrivacyLevel } from "@/types"
import { PREDICATE_LABELS, PREDICATE_ICONS } from "@/lib/utils"

const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; label: string; desc: string }[] = [
  { value: "self-reported", label: "Self-reported", desc: "You remember it" },
  { value: "corroborated", label: "Corroborated", desc: "Someone else confirms it" },
  { value: "documented", label: "Documented", desc: "Photos, articles, etc." },
  { value: "partner-verified", label: "Partner verified", desc: "Verified by an org or partner" },
]

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; icon: string }[] = [
  { value: "private", label: "Private", icon: "🔒" },
  { value: "shared", label: "Shared", icon: "👥" },
  { value: "public", label: "Public", icon: "🌐" },
]

interface EditClaimModalProps {
  claim: Claim
  entityName: string
  onClose: () => void
}

function parseYear(dateStr?: string): string {
  return dateStr ? dateStr.slice(0, 4) : ""
}

function yearToDate(year: string): string | undefined {
  if (!year || year.length < 4) return undefined
  return `${year}-01-01`
}

export function EditClaimModal({ claim, entityName, onClose }: EditClaimModalProps) {
  const { updateClaim } = useLineageStore()

  const [startYear, setStartYear] = useState(parseYear(claim.start_date))
  const [endYear, setEndYear] = useState(parseYear(claim.end_date))
  const [note, setNote] = useState(claim.note ?? "")
  const [confidence, setConfidence] = useState<ConfidenceLevel>(claim.confidence)
  const [visibility, setVisibility] = useState<PrivacyLevel>(claim.visibility)

  const canSave = startYear.length === 4 || startYear.length === 0

  const handleSave = () => {
    updateClaim(claim.id, {
      start_date: yearToDate(startYear) ?? claim.start_date,
      end_date: yearToDate(endYear),
      note: note.trim() || undefined,
      confidence,
      visibility,
    })
    onClose()
  }

  const icon = PREDICATE_ICONS[claim.predicate] ?? "•"
  const label = PREDICATE_LABELS[claim.predicate] ?? claim.predicate

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span>{icon}</span>
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="font-semibold text-white">{entityName}</span>
          </div>
          <p className="text-xs text-zinc-600">Edit the details of this claim</p>
        </div>

        <div className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Start year</label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                placeholder="e.g. 2003"
                min={1965}
                max={2030}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">End year <span className="text-zinc-700">(optional)</span></label>
              <input
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                placeholder="present"
                min={1965}
                max={2030}
                className={inputCls}
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Note <span className="text-zinc-700">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any context about this claim..."
              rows={2}
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Confidence</label>
            <div className="grid grid-cols-2 gap-2">
              {CONFIDENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfidence(opt.value)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border text-xs transition-all",
                    confidence === opt.value
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-[#2a2a2a] text-zinc-400 hover:border-zinc-600 hover:text-white"
                  )}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Visibility</label>
            <div className="flex gap-2">
              {PRIVACY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all",
                    visibility === opt.value
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-[#2a2a2a] text-zinc-400 hover:border-zinc-600 hover:text-white"
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white border border-[#2a2a2a] hover:border-zinc-600 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSave
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-[#1e1e1e] text-zinc-600 cursor-not-allowed"
            )}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
