"use client"

import { useState } from "react"
import { cn, type StoryDatePrecision } from "@/lib/utils"

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
 * By default the value is only emitted once all three parts are chosen; an
 * incomplete selection emits "" so required-date validation still fires.
 *
 * In `partial` mode (stories: many old dates are only known to the year), the
 * control emits as soon as a year is picked. It reports a padded anchor plus a
 * precision through `onPartialChange`: year-only 1998 -> ("1998-01-01", "year"),
 * month-only -> ("1998-03-01", "month"), full -> ("1998-03-15", "day"). Month
 * and day are optional; a month picked without a year still emits nothing.
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

// Tolerant of partial ISO strings so a precision-trimmed value initializes the
// right parts: "1998" -> year only, "1998-03" -> year+month, and a full
// "1998-03-15" -> all three. This is what lets an edited year-only story show
// Year filled with Month/Day empty (rather than the stored Jan 1 anchor).
function parse(value: string): { year: Part; month: Part; day: Part } {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value || "")
  if (!m) return { year: "", month: "", day: "" }
  return {
    year:  Number(m[1]),
    month: m[2] ? Number(m[2]) : "",
    day:   m[3] ? Number(m[3]) : "",
  }
}

// Trim a padded anchor to only the parts a precision says are real, so edit-
// init in partial mode does not re-surface the Jan 1 / day-1 padding.
function trimByPrecision(value: string, precision?: StoryDatePrecision): string {
  if (precision === "year")  return value.slice(0, 4)
  if (precision === "month") return value.slice(0, 7)
  return value
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

interface DateSelectProps {
  value: string                       // "YYYY-MM-DD" or "" (padded anchor in partial mode)
  onChange: (value: string) => void
  /** Earliest selectable year. Defaults to 1960 (pre-dates modern snowboarding). */
  minYear?: number
  /** Latest selectable year. Defaults to the current year. */
  maxYear?: number
  className?: string
  /** id for the year <select>, so an external <label> can point at it. */
  id?: string
  /** Opt-in: emit as soon as a year is chosen (month + day optional). */
  partial?: boolean
  /** Current precision of `value`, used only to init the parts in partial mode. */
  precision?: StoryDatePrecision
  /** Partial-mode emit: (padded anchor, derived precision). Empty year -> ("", "day"). */
  onPartialChange?: (value: string, precision: StoryDatePrecision) => void
}

export function DateSelect({ value, onChange, minYear = 1960, maxYear, className, id, partial = false, precision, onPartialChange }: DateSelectProps) {
  const initial = parse(partial ? trimByPrecision(value, precision) : value)
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
    // A month picked without a day (partial mode) can't clamp, but must still
    // reset a stale day if the month later narrows; nothing to do here since
    // day is already "".
    setYear(nextYear)
    setMonth(nextMonth)
    setDay(d)

    if (partial && onPartialChange) {
      // Emit the widest complete prefix: year -> anchor+year, +month -> +month,
      // +day -> full day. No year emits nothing so required validation fires.
      if (nextYear === "") { onPartialChange("", "day"); return }
      if (nextMonth === "") { onPartialChange(`${nextYear}-01-01`, "year"); return }
      if (d === "") { onPartialChange(`${nextYear}-${pad(nextMonth)}-01`, "month"); return }
      onPartialChange(`${nextYear}-${pad(nextMonth)}-${pad(d)}`, "day")
      return
    }

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
