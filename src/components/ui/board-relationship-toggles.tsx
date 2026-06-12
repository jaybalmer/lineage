"use client"

import { cn } from "@/lib/utils"

// Two independent toggles for a board claim: "Rode it" and "In my collection".
// Both can be on (-> 'both'); at least one must be on to save. Shared by the
// add-claim modal (board branch) and the board shelf's inline edit.

interface BoardRelationshipTogglesProps {
  rode: boolean
  own: boolean
  onChange: (next: { rode: boolean; own: boolean }) => void
  size?: "sm" | "md"
}

export function BoardRelationshipToggles({ rode, own, onChange, size = "md" }: BoardRelationshipTogglesProps) {
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
  const base = "flex-1 rounded-lg border font-medium transition-all flex items-center justify-center gap-1.5"
  const on = "border-emerald-600 bg-emerald-950/40 text-emerald-200"
  const off = "border-border-default text-muted hover:text-foreground"
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={rode}
        onClick={() => onChange({ rode: !rode, own })}
        className={cn(base, pad, rode ? on : off)}
      >
        {rode && <span aria-hidden>✓</span>} Rode it
      </button>
      <button
        type="button"
        aria-pressed={own}
        onClick={() => onChange({ rode, own: !own })}
        className={cn(base, pad, own ? on : off)}
      >
        {own && <span aria-hidden>✓</span>} In my collection
      </button>
    </div>
  )
}
