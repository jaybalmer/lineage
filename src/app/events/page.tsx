"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { EVENTS, EVENT_SERIES, CLAIMS, getPersonById, getPlaceById, eventSlug, seriesSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Event, EventType, EventSeries } from "@/types"

const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"] as const
type EventPredicate = (typeof EVENT_PREDICATES)[number]

type MainTab = "all" | "series"

const ACCENT: Record<EventType, string> = {
  contest: "border-l-amber-700",
  "film-shoot": "border-l-violet-700",
  trip: "border-l-emerald-700",
  camp: "border-l-blue-700",
  gathering: "border-l-zinc-600",
}

const TYPE_LABEL: Record<EventType, string> = {
  contest: "Contest",
  "film-shoot": "Film shoot",
  trip: "Trip",
  camp: "Camp",
  gathering: "Gathering",
}

const TYPE_FILTERS: { value: EventType; label: string }[] = [
  { value: "contest",    label: "Contest" },
  { value: "film-shoot", label: "Film shoot" },
  { value: "trip",       label: "Trip" },
  { value: "camp",       label: "Camp" },
  { value: "gathering",  label: "Gathering" },
]

function getRiderIds(eventId: string): string[] {
  return [
    ...new Set(
      CLAIMS.filter(
        (c) => c.object_id === eventId && EVENT_PREDICATES.includes(c.predicate as EventPredicate)
      ).map((c) => c.subject_id)
    ),
  ]
}

function AvatarStack({ riderIds }: { riderIds: string[] }) {
  const shown = riderIds.slice(0, 3)
  const extra = riderIds.length - shown.length
  if (shown.length === 0) return null
  return (
    <div className="flex items-center">
      {shown.map((rid, i) => {
        const person = getPersonById(rid)
        if (!person) return null
        return (
          <div
            key={rid}
            style={{ marginLeft: i === 0 ? 0 : -6 }}
            className="w-5 h-5 rounded-full bg-blue-600 border border-[#111] flex items-center justify-center text-[8px] font-bold text-white"
            title={person.display_name}
          >
            {person.display_name[0]}
          </div>
        )
      })}
      {extra > 0 && (
        <div
          style={{ marginLeft: -6 }}
          className="w-5 h-5 rounded-full bg-[#2a2a2a] border border-[#111] flex items-center justify-center text-[8px] text-zinc-400"
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const place = event.place_id ? getPlaceById(event.place_id) : null
  const riderIds = getRiderIds(event.id)
  const accent = ACCENT[event.event_type] ?? "border-l-zinc-600"
  const addedByPerson = event.added_by ? getPersonById(event.added_by) : null
  const isUnverified = event.community_status === "unverified"

  return (
    <Link href={`/events/${eventSlug(event)}`}>
      <div className={cn(
        "bg-[#111] border border-[#1e1e1e] border-l-2 rounded-xl p-4 hover:border-[#2a2a2a] transition-colors",
        accent
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                {TYPE_LABEL[event.event_type]}
              </span>
              {isUnverified && (
                <span className="text-[10px] text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5">unverified</span>
              )}
            </div>
            <div className="font-medium text-white text-sm leading-snug">{event.name}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {event.year}
              {place && <span className="text-zinc-700"> · {place.name}</span>}
            </div>
            {isUnverified && addedByPerson && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-700">
                <div className="w-3 h-3 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold">
                  {addedByPerson.display_name[0]}
                </div>
                Added by {addedByPerson.display_name}
              </div>
            )}
          </div>
          {riderIds.length > 0 && (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <AvatarStack riderIds={riderIds} />
              <div className="text-[10px] text-zinc-600">
                {riderIds.length} rider{riderIds.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// Series tab — overview card linking to series detail
function SeriesCard({ series, filteredEventCount }: { series: EventSeries; filteredEventCount: number }) {
  const place = series.place_id ? getPlaceById(series.place_id) : null
  const allInstances = EVENTS.filter((e) => e.series_id === series.id)
  const totalRiders = new Set(
    CLAIMS.filter(
      (c) =>
        EVENT_PREDICATES.includes(c.predicate as EventPredicate) &&
        allInstances.some((e) => e.id === c.object_id)
    ).map((c) => c.subject_id)
  ).size

  return (
    <Link href={`/events/${seriesSlug(series)}`}>
      <div className="bg-[#111] border border-[#1e1e1e] border-l-2 border-l-amber-700 rounded-xl p-4 hover:border-[#2a2a2a] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
              Event series · {series.frequency}
            </div>
            <div className="font-medium text-white text-sm leading-snug">{series.name}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {series.start_year && <span>Since {series.start_year}</span>}
              {place && <span className="text-zinc-700"> · {place.name}</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-bold text-white">{filteredEventCount}</div>
            <div className="text-[10px] text-zinc-600">edition{filteredEventCount !== 1 ? "s" : ""}</div>
            {totalRiders > 0 && (
              <div className="text-[10px] text-zinc-600 mt-0.5">{totalRiders} riders</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// Horizontal divider with label
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 h-px bg-[#1e1e1e]" />
    </div>
  )
}

export default function EventsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("all")
  const [typeFilter, setTypeFilter] = useState<EventType | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const { userEntities } = useLineageStore()

  const allEvents = [...EVENTS, ...(userEntities.events ?? [])]

  // Apply type filter across both tabs
  const visibleEvents = useMemo(
    () => typeFilter ? allEvents.filter((e) => e.event_type === typeFilter) : allEvents,
    [typeFilter, allEvents.length]
  )

  // ── All tab: group by decade ──────────────────────────────────────────────
  const decadeGroups = useMemo(() => {
    const byDecade = new Map<number, Event[]>()
    visibleEvents.forEach((e) => {
      if (e.year == null) return
      const decade = Math.floor(e.year / 10) * 10
      if (!byDecade.has(decade)) byDecade.set(decade, [])
      byDecade.get(decade)!.push(e)
    })
    return [...byDecade.entries()]
      .sort(([a], [b]) => b - a)   // newest decade first
      .map(([decade, events]) => ({
        label: `${decade}s`,
        events: [...events].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
      }))
  }, [visibleEvents])

  // ── Series tab: group by series ───────────────────────────────────────────
  const seriesGroups = useMemo(() => {
    return EVENT_SERIES.map((series) => ({
      series,
      events: visibleEvents
        .filter((e) => e.series_id === series.id)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    })).filter((g) => g.events.length > 0)
  }, [visibleEvents])

  const standaloneEvents = useMemo(
    () => visibleEvents.filter((e) => !e.series_id).sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    [visibleEvents]
  )

  const isEmpty = visibleEvents.length === 0

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Events</h1>
            <p className="text-sm text-zinc-500 mt-1">Contests, trips, film shoots, and gatherings</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 transition-all"
          >
            + Add event
          </button>
        </div>

        {/* Main tab bar + type filter row */}
        <div className="flex items-center justify-between gap-4 mb-5">
          {/* Main tabs: All / Series */}
          <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-1">
            {([
              { key: "all" as MainTab, label: "All" },
              { key: "series" as MainTab, label: "Series" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMainTab(key)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  mainTab === key
                    ? "bg-[#2a2a2a] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Type filter chips — click to toggle, click active to clear */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(typeFilter === value ? null : value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  typeFilter === value
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-zinc-500 hover:text-zinc-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── All tab: decade groups ── */}
        {mainTab === "all" && (
          <div className="space-y-8">
            {isEmpty ? (
              <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-[#2a2a2a] rounded-xl">
                No events found.{" "}
                <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
              </div>
            ) : (
              decadeGroups.map(({ label, events }) => (
                <div key={label}>
                  <SectionDivider label={label} />
                  <div className="space-y-2 mt-3">
                    {events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Series tab: grouped by series ── */}
        {mainTab === "series" && (
          <div className="space-y-8">
            {isEmpty ? (
              <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-[#2a2a2a] rounded-xl">
                No events found for this filter.
              </div>
            ) : (
              <>
                {/* Series groups */}
                {seriesGroups.map(({ series, events }) => (
                  <div key={series.id}>
                    <div className="flex items-center gap-3 mb-3">
                      <SeriesCard series={series} filteredEventCount={events.length} />
                    </div>
                    <div className="space-y-2 mt-2 pl-2 border-l border-[#1e1e1e]">
                      {events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Standalone events without a series */}
                {standaloneEvents.length > 0 && (
                  <div>
                    <SectionDivider label="Standalone events" />
                    <div className="space-y-2 mt-3">
                      {standaloneEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {addOpen && (
        <AddEntityModal
          entityType="event"
          onClose={() => setAddOpen(false)}
          onAdded={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
