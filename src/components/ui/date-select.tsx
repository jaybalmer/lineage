"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Year / Month / Day picker built from three native <select>s.
 *
 * Why not <input type="date">? Linestry is a *history* app: most story dates
 * sit decades in the past, and the native date control opens on the current
 * month and forces the user to tap a calendar back 30+ years. Native selects,
 * by contrast, render as the iOS wheel picker and the Android scroll list, so
 * jumping straight to 1995 is one scroll. This is purely an input-ergonomics
 * swap — it emits the exact same "YYYY-MM-DD" string the date input did, so
 * the `stories.story_date` (a strict `date NOT NULL` column) contract and
 * every downstream sort/group/format stay untouched.
 *
 * The value is only emitted once all three parts are chosen; an incomplete
 * selection emits "" so existing required-date validation still fires.
 */

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const fieldCls =
  "bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 cursor-pointer appearance-none bg-no-repeat"

// A small chevron so the native control reads as a picker in both themes.
const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 0.5rem center",
  paddingRight: "1.75rem",
}

type Part = number | ""

function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the next month is the last day of this month.
  return new Date(year, month, 0).getDate()
}

function parse(value: string): { year: Part; month: Part; day: Part } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "")
  if (!m) return { year: "", month: "", day: "" }
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

interface DateSelectProps {
  value: string                       // "YYYY-MM-DD" or ""
  onChange: (value: string) => void
  /** Earliest selectable year. Defaults to 1960 (pre-dates modern snowboarding). */
  minYear?: number
  /** Latest selectable year. Defaults to the current year. */
  maxYear?: number
  className?: string
  /** id for the year <select>, so an external <label> can point at it. */
  id?: string
}

export function DateSelect({ value, onChange, minYear = 1960, maxYear, className, id }: DateSelectProps) {
  const initial = parse(value)
  const [year, setYear]   = useState<Part>(initial.year)
  const [month, setMonth] = useState<Part>(initial.month)
  const [day, setDay]     = useState<Part>(initial.day)

  const thisYear = new Date().getFullYear()
  // Always include an out-of-range value's year (e.g. editing an old story)
  // so the existing date stays selectable.
  const hi = Math.max(maxYear ?? thisYear, typeof year === "number" ? year : 0)
  const lo = Math.min(minYear, typeof year === "number" ? year : minYear)
  const years: number[] = []
  for (let y = hi; y >= lo; y--) years.push(y)

  // Days available for the chosen month. When the year is unknown, assume a
  // leap year so 29 Feb stays reachable; the real value is clamped on emit.
  const maxDay = month === "" ? 31 : daysInMonth(year === "" ? 2024 : year, month)
  const days: number[] = []
  for (let d = 1; d <= maxDay; d++) days.push(d)

  function commit(nextYear: Part, nextMonth: Part, nextDay: Part) {
    // Clamp the day to the selected month (e.g. 31 → 28 when switching to Feb).
    let d = nextDay
    if (d !== "" && nextMonth !== "") {
      const max = daysInMonth(nextYear === "" ? 2024 : nextYear, nextMonth)
      if (d > max) d = max
    }
    setYear(nextYear)
    setMonth(nextMonth)
    setDay(d)
    onChange(nextYear !== "" && nextMonth !== "" && d !== "" ? `${nextYear}-${pad(nextMonth)}-${pad(d)}` : "")
  }

  const selCls = (part: Part) => cn(fieldCls, part === "" ? "text-muted" : "text-foreground")

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <select
        id={id}
        aria-label="Year"
        value={year}
        onChange={(e) => commit(e.target.value === "" ? "" : Number(e.target.value), month, day)}
        className={selCls(year)}
        style={chevronStyle}
      >
        <option value="" disabled hidden>Year</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        aria-label="Month"
        value={month}
        onChange={(e) => commit(year, e.target.value === "" ? "" : Number(e.target.value), day)}
        className={selCls(month)}
        style={chevronStyle}
      >
        <option value="" disabled hidden>Month</option>
        {MONTHS_SHORT.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
      </select>

      <select
        aria-label="Day"
        value={day}
        onChange={(e) => commit(year, month, e.target.value === "" ? "" : Number(e.target.value))}
        className={selCls(day)}
        style={chevronStyle}
      >
        <option value="" disabled hidden>Day</option>
        {days.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  )
}
