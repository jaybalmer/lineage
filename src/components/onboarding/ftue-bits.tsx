"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Small shared pieces for the FTUE. Kept out of the flow file so the flow reads
// as the story it tells rather than as a pile of presentational helpers.

/** Counts up to `value` once, when it first becomes a number. Renders nothing
 *  at all while the value is null. The FTUE hides callouts it cannot source
 *  rather than showing a zero or a placeholder. */
export function BigNumber({
  value,
  tone = "plain",
  className,
  grouped = true,
}: {
  value: number | null
  tone?: "plain" | "accent" | "violet"
  className?: string
  grouped?: boolean
}) {
  const [shown, setShown] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (value === null || value === 0 || doneRef.current) return
    doneRef.current = true

    // Show the final value immediately when we cannot run a frame loop: a
    // reduced-motion preference, or a page that is not currently visible.
    // requestAnimationFrame is paused while the tab is hidden, so a pure rAF
    // count-up would otherwise leave the number stuck on its initial 0 (the beat
    // rendered in a background tab, a preview pane, or before first paint). The
    // count-up is a flourish; it must never be the thing that decides whether the
    // real number appears.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced || (typeof document !== "undefined" && document.hidden)) {
      // Land the final value now. This is a one-shot assignment guarded by
      // doneRef, not a render loop; a deferred timer/rAF is the wrong tool here
      // because it is paused (rAF) or cleared by the dev strict-mode remount
      // (timer), either of which would leave the number stuck on 0.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value)
      return
    }

    const duration = 950
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(value * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  if (value === null || value === 0) return null

  const gradient =
    tone === "accent"
      ? "linear-gradient(160deg,#8ab4ff 10%,#3B82F6 95%)"
      : tone === "violet"
        ? "linear-gradient(160deg,#c4b5fd 10%,#8b5cf6 95%)"
        : "linear-gradient(160deg,#ffffff 20%,#9aa7b8 105%)"

  return (
    <div
      className={cn("leading-[0.92] tabular-nums", className)}
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: "clamp(3.4rem,17vw,4.8rem)",
        letterSpacing: "-0.045em",
        backgroundImage: gradient,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {grouped ? shown.toLocaleString() : String(shown)}
    </div>
  )
}

/** One tile in a stat row. Renders nothing when its value is unavailable OR
 *  zero, so a partially-failed stats fetch degrades to a shorter row and a
 *  genuine zero (e.g. no peers started that exact year) is hidden rather than
 *  shown, never a dash and never a deflating "0" on a celebration beat. */
export function StatTile({
  value,
  label,
  tone,
  grouped = true,
}: {
  value: number | null
  label: React.ReactNode
  tone?: string
  grouped?: boolean
}) {
  if (value === null || value === 0) return null
  return (
    <div className="flex-1 bg-surface border border-border-default rounded-2xl px-2.5 py-3 text-center">
      <div
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 21,
          letterSpacing: "-0.02em",
          color: tone ?? "var(--foreground)",
        }}
      >
        {grouped ? value.toLocaleString() : String(value)}
      </div>
      <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
    </div>
  )
}

/** Uppercase kicker above a headline. */
export function Eyebrow({
  children,
  accent = false,
  className,
}: {
  children: React.ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "text-[10.5px] font-semibold uppercase tracking-[0.16em]",
        accent ? "text-accent-strong" : "text-muted",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Section divider used on the welcome screen ("Here is the start" / "…what you can add"). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
      <span>{children}</span>
      <span className="flex-1 h-px bg-border-default" />
    </div>
  )
}

/** Accent-ruled aside. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-accent pl-3.5 py-0.5 text-[13.5px] leading-relaxed text-muted">
      {children}
    </div>
  )
}
