"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { PLACES, EVENT_SERIES } from "@/lib/mock-data"
import type { Event, EventType, EventSeries } from "@/types"

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "contest", label: "Contest" },
  { value: "film-shoot", label: "Film shoot" },
  { value: "trip", label: "Trip" },
  { value: "camp", label: "Camp" },
  { value: "gathering", label: "Gathering" },
]

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5">
        {label}{required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

interface EditEventModalProps {
  event: Event
  onClose: () => void
}

export function EditEventModal({ event, onClose }: EditEventModalProps) {
  const { updateUserEvent, addUserSeries, catalog } = useLineageStore()

  const [name, setName] = useState(event.name)
  const [eventType, setEventType] = useState<EventType>(event.event_type)

  // Parse existing start_date into year / month / specific date
  const existingYear = event.year ? String(event.year) : event.start_date?.slice(0, 4) ?? ""
  const existingMonth = event.start_date?.length >= 7 ? String(parseInt(event.start_date.slice(5, 7))) : ""
  const existingStartDate = event.start_date?.length === 10 ? event.start_date : ""
  const existingEndDate = event.end_date ?? ""

  const [eventYear, setEventYear] = useState(existingYear)
  const [eventMonth, setEventMonth] = useState(existingMonth)
  const [showExactDates, setShowExactDates] = useState(existingStartDate.length === 10)
  const [startDate, setStartDate] = useState(existingStartDate)
  const [endDate, setEndDate] = useState(existingEndDate)

  // Place
  const [eventPlaceId, setEventPlaceId] = useState(event.place_id ?? "")
  const [eventPlaceQuery, setEventPlaceQuery] = useState("")

  // Series
  const [eventSeriesId, setEventSeriesId] = useState(event.series_id ?? "")
  const [eventSeriesQuery, setEventSeriesQuery] = useState("")
  const [showCreateSeries, setShowCreateSeries] = useState(false)
  const [newSeriesName, setNewSeriesName] = useState("")
  const [newSeriesFreq, setNewSeriesFreq] = useState<EventSeries["frequency"]>("annual")
  const [newSeriesStartYear, setNewSeriesStartYear] = useState("")

  // Combined series list (mock + catalog)
  const allSeries = catalog.eventSeries?.length ? catalog.eventSeries : EVENT_SERIES

  // Combined places list (mock + catalog)
  const allPlaces = catalog.places?.length ? catalog.places : PLACES

  const canSubmit = () => {
    const y = parseInt(eventYear)
    return name.trim().length > 0 && eventYear.length === 4 && y >= 1950 && y <= 2030
  }

  const handleSave = () => {
    if (!canSubmit()) return

    // Create series inline if needed
    let resolvedSeriesId = eventSeriesId
    if (!resolvedSeriesId && showCreateSeries && newSeriesName.trim()) {
      const sid = generateId("series")
      addUserSeries({
        id: sid,
        name: newSeriesName.trim(),
        frequency: newSeriesFreq,
        start_year: newSeriesStartYear ? parseInt(newSeriesStartYear) : undefined,
        place_id: eventPlaceId || undefined,
      })
      resolvedSeriesId = sid
    }

    const year = parseInt(eventYear)
    let computedStart = eventYear
    if (eventMonth) computedStart = `${eventYear}-${eventMonth.padStart(2, "0")}`
    if (showExactDates && startDate) computedStart = startDate

    updateUserEvent(event.id, {
      name: name.trim(),
      event_type: eventType,
      year,
      start_date: computedStart,
      end_date: showExactDates && endDate ? endDate : undefined,
      place_id: eventPlaceId || undefined,
      series_id: resolvedSeriesId || undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-foreground">Edit event</h2>
        </div>

        <div className="space-y-3">
          <Field label="Event name" required>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Type">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className={inputCls}
            >
              {EVENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" required>
              <input
                type="number"
                value={eventYear}
                onChange={(e) => setEventYear(e.target.value)}
                min={1950}
                max={2030}
                className={inputCls}
              />
            </Field>
            <Field label="Month">
              <select
                value={eventMonth}
                onChange={(e) => setEventMonth(e.target.value)}
                className={inputCls}
              >
                <option value="">— optional —</option>
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={String(i + 1)}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            onClick={() => setShowExactDates(!showExactDates)}
            className="text-xs text-muted hover:text-foreground transition-colors text-left"
          >
            {showExactDates ? "− Remove specific dates" : "+ Add specific start / end dates"}
          </button>
          {showExactDates && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (!endDate) setEndDate(e.target.value)
                    const d = new Date(e.target.value)
                    if (!isNaN(d.getTime())) {
                      setEventYear(String(d.getUTCFullYear()))
                      setEventMonth(String(d.getUTCMonth() + 1))
                    }
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {/* Place picker */}
          <Field label="Place">
            {eventPlaceId ? (
              <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">
                  🏔 {allPlaces.find((p) => p.id === eventPlaceId)?.name ?? eventPlaceId}
                </span>
                <button onClick={() => setEventPlaceId("")} className="text-xs text-muted hover:text-foreground ml-2">×</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={eventPlaceQuery}
                  onChange={(e) => setEventPlaceQuery(e.target.value)}
                  placeholder="Search places…"
                  className={inputCls}
                />
                {eventPlaceQuery.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-surface border border-border-default rounded-lg shadow-xl max-h-36 overflow-y-auto">
                    {allPlaces.filter((p) => p.name.toLowerCase().includes(eventPlaceQuery.toLowerCase())).slice(0, 6).map((p) => (
                      <button key={p.id} onClick={() => { setEventPlaceId(p.id); setEventPlaceQuery("") }}
                        className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors">
                        {p.name}
                      </button>
                    ))}
                    {allPlaces.filter((p) => p.name.toLowerCase().includes(eventPlaceQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted">No places found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* Series picker */}
          <Field label="Part of a series?">
            {eventSeriesId && !showCreateSeries ? (
              <div className="flex items-center justify-between bg-blue-950/30 border border-blue-800/40 rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">
                  📅 {allSeries.find((s) => s.id === eventSeriesId)?.name ?? eventSeriesId}
                </span>
                <button onClick={() => setEventSeriesId("")} className="text-xs text-muted hover:text-foreground ml-2">×</button>
              </div>
            ) : !showCreateSeries ? (
              <div className="relative">
                <input
                  type="text"
                  value={eventSeriesQuery}
                  onChange={(e) => setEventSeriesQuery(e.target.value)}
                  placeholder="Search or create a series…"
                  className={inputCls}
                />
                {eventSeriesQuery.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-surface border border-border-default rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {allSeries.filter((s) => s.name.toLowerCase().includes(eventSeriesQuery.toLowerCase())).slice(0, 5).map((s) => (
                      <button key={s.id} onClick={() => { setEventSeriesId(s.id); setEventSeriesQuery("") }}
                        className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors">
                        {s.name}
                        {s.start_year && <span className="text-xs text-muted/60 ml-2">since {s.start_year}</span>}
                      </button>
                    ))}
                    <button
                      onClick={() => { setNewSeriesName(eventSeriesQuery); setShowCreateSeries(true); setEventSeriesQuery("") }}
                      className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2">
                      <span className="font-bold">+</span> Create &ldquo;{eventSeriesQuery.trim()}&rdquo; as new series
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Inline series creation */
              <div className="border border-blue-800/40 rounded-lg p-3 bg-blue-950/20 space-y-2">
                <div className="text-xs font-medium text-blue-300 mb-2">New series</div>
                <input
                  autoFocus
                  type="text"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  placeholder="Series name…"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select value={newSeriesFreq} onChange={(e) => setNewSeriesFreq(e.target.value as EventSeries["frequency"])} className={inputCls}>
                    <option value="annual">Annual</option>
                    <option value="tour">Tour</option>
                    <option value="irregular">Irregular</option>
                  </select>
                  <input
                    type="number"
                    value={newSeriesStartYear}
                    onChange={(e) => setNewSeriesStartYear(e.target.value)}
                    placeholder="Start year"
                    min={1950} max={2030}
                    className={inputCls}
                  />
                </div>
                <button onClick={() => { setShowCreateSeries(false); setNewSeriesName("") }} className="text-xs text-muted hover:text-foreground transition-colors">
                  ← Cancel
                </button>
              </div>
            )}
          </Field>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted hover:text-foreground border border-border-default hover:border-border-default transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSubmit()}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSubmit()
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-surface-active text-muted cursor-not-allowed"
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
