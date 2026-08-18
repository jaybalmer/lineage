"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Small shared pieces for the FTUE. Kept out of the flow file so the flow reads
// as the story it tells rather than as a pile of presentational helpers.

/** Counts up to `value` once, when it first becomes a number. Renders nothing
 *  at all while the value is null — the FTUE hides callouts it cannot source
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
    if (value === null || doneRef.current) return
    doneRef.current = true

    // Respect the same reduced-motion contract as the CSS. Rather than setting
    // state straight from the effect body (react-hooks/set-state-in-effect), a
    // zero duration lands the full number on the very first frame, inside the
    // rAF callback.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const duration = reduced ? 0 : 950
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(value * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  if (value === null) return null

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

/** One tile in a stat row. Renders nothing when its value is unavailable, so a
 *  partially-failed stats fetch degrades to a shorter row, never to "—". */
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
  if (value === null) return null
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
