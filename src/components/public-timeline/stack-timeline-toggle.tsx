"use client"

// PB-010 cleanup: the shared Stack ↔ Timeline segmented control.
//
// Both public surfaces toggle between the curated Stack at /t/[slug] and the
// full profile timeline at /people/[id]. They are two URLs, so the control is
// navigation, not in-page view state: the active segment renders as a static
// indicator and the other as a <Link>. Light variant adapts to theme (used on
// the in-app profile page and the timeline fallback); dark variant sits on the
// Stack's #1C1917 ground.

import Link from "next/link"
import { cn } from "@/lib/utils"

type Mode = "stack" | "timeline"

export function StackTimelineToggle({
  active,
  stackHref,
  timelineHref,
  variant = "light",
}: {
  active: Mode
  /** Where "Stack" navigates. Omit when Stack is the active surface. */
  stackHref?: string
  /** Where "Timeline" navigates. Omit when Timeline is the active surface. */
  timelineHref?: string
  variant?: "light" | "dark"
}) {
  const dark = variant === "dark"
  const segBase = "px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors"
  const segActive = dark ? "bg-white text-[#1C1917]" : "bg-foreground text-background"
  const segIdle = dark ? "text-white/60 hover:text-white" : "text-muted hover:text-foreground"

  function seg(mode: Mode, label: string, href?: string) {
    const isActive = active === mode
    const cls = cn(segBase, isActive ? segActive : segIdle)
    // The current surface is a static indicator; the other links away.
    if (isActive || !href) {
      return (
        <span role="tab" aria-selected={isActive} className={cls}>
          {label}
        </span>
      )
    }
    return (
      <Link role="tab" aria-selected={false} href={href} className={cls}>
        {label}
      </Link>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-full p-0.5 border",
        dark ? "border-white/15 bg-white/5" : "border-border-default bg-surface",
      )}
      role="tablist"
      aria-label="View"
    >
      {seg("stack", "Stack", stackHref)}
      {seg("timeline", "Timeline", timelineHref)}
    </div>
  )
}
