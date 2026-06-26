"use client"

import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"

export function Toasts() {
  const toasts = useLineageStore((s) => s.toasts)
  const dismissToast = useLineageStore((s) => s.dismissToast)
  const celebrationQueue = useLineageStore((s) => s.celebrationQueue)

  // BUG-107: the claim/celebration toast (CelebrationOverlay) also anchors
  // bottom-right at a higher z-index, so when a Tier 1-2 celebration toast is
  // showing it covers this "+1 token earned" toast. Lift the toast stack above
  // the celebration card when one is present so both read instead of stacking
  // on top of each other.
  const hasCelebrationToast = (celebrationQueue[0]?.tier ?? 0) <= 2 && celebrationQueue.length > 0

  if (toasts.length === 0) return null

  return (
    <div className={cn(
      "fixed right-4 z-50 flex flex-col gap-2 max-w-sm transition-all",
      hasCelebrationToast ? "bottom-36" : "bottom-4",
    )}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg text-sm border",
            toast.type === "error"
              ? "bg-red-950 border-red-800 text-red-200"
              : toast.type === "reward"
                ? "bg-surface border-emerald-500/60 text-foreground"
                : "bg-surface border-border-default text-foreground",
          ].join(" ")}
        >
          {toast.type === "reward" && (
            <span aria-hidden className="shrink-0 font-bold" style={{ color: "#10b981" }}>◆</span>
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
