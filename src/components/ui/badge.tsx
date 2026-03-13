import { cn } from "@/lib/utils"
import type { ConfidenceLevel } from "@/types"
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS } from "@/lib/utils"

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", CONFIDENCE_COLORS[level])}>
      {CONFIDENCE_LABELS[level]}
    </span>
  )
}

export function UnverifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40">
      <span>◎</span> unverified
    </span>
  )
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "blue" | "green" | "amber"
}) {
  const variants = {
    default: "bg-surface-active text-zinc-300",
    blue: "bg-blue-950 text-blue-300",
    green: "bg-emerald-950 text-emerald-300",
    amber: "bg-amber-950 text-amber-300",
  }
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded font-medium", variants[variant])}>
      {children}
    </span>
  )
}
