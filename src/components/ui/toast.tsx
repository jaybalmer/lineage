"use client"

import { useLineageStore } from "@/store/lineage-store"

export function Toasts() {
  const toasts = useLineageStore((s) => s.toasts)
  const dismissToast = useLineageStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg text-sm border",
            toast.type === "error"
              ? "bg-red-950 border-red-800 text-red-200"
              : "bg-surface border-border-default text-foreground",
          ].join(" ")}
        >
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
