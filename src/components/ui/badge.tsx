import { cn } from "@/lib/utils"
import type { ConfidenceLevel, EntityType } from "@/types"
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS } from "@/lib/utils"

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", CONFIDENCE_COLORS[level])}>
      {CONFIDENCE_LABELS[level]}
    </span>
  )
}

// BUG-177 / BUG-178: single source of truth for the catalog-entity status chip.
//
// This badge is a status on the CATALOG ENTITY a claim points at, not a verdict
// on the claim itself. That is why it sits next to ConfidenceBadge on a claim
// card yet means something completely different: "Self-reported" judges the
// claim, "unverified place" judges the place. Passing `entityType` gives the
// badge its noun so the two chips are no longer read as one.
//
// The treatment is the unfilled outline chip, deliberately theme-independent:
// amber-600 on a border tint reads on the near-black app background AND on the
// white surface that `.postcard` forces even in dark mode (repo gotcha 7). Do
// not add a `dark:` variant here, it would invert inside a postcard.
const UNVERIFIED_NOUN: Partial<Record<EntityType, string>> = {
  place: "place",
  org: "brand",
  board: "board",
  event: "event",
}

export function UnverifiedBadge({
  entityType,
  className,
}: {
  entityType?: EntityType
  className?: string
} = {}) {
  const noun = entityType ? UNVERIFIED_NOUN[entityType] : undefined
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5",
        className
      )}
    >
      {noun ? `unverified ${noun}` : "unverified"}
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
    default: "bg-surface-active text-muted",
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
