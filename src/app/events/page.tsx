"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { EVENTS, EVENT_SERIES, CLAIMS, getPersonById, getPlaceById } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Event, EventType, EventSeries } from "@/types"

const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"] as const
type EventPredicate = (typeof EVENT_PREDICATES)[number]

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

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "contest", label: "Contest" },
  { value: "film-shoot", label: "Film shoot" },
  { value: "trip", label: "Trip" },
  { value: "camp", label: "Camp" },
  { value: "gathering", label: "Gathering" },
] as const

function getRiderIds(eventId: string): string[] {
  return [
    ...new Set(
      CLAIMS.filter(
        (c) =>
          c.object_id === eventId &&
          EVENT_PREDICATES.includes(c.predicate as EventPredicate)
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

  return (
    <Link href={`/events/${event.id}`}>
      <div
        className={cn(
          "bg-[#111] border border-[#1e1e1e] border-l-2 rounded-xl p-4 hover:border-[#2a2a2a] transition-colors",
          accent
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
              {TYPE_LABEL[event.event_type]}
            </div>
            <div className="font-medium text-white text-sm leading-snug">{event.name}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {event.year}
              {place && <span className="text-zinc-700"> · {place.name}</span>}
            </div>
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

function SeriesCard({ series }: { series: EventSeries }) {
  const place = series.place_id ? getPlaceById(series.place_id) : null
  const instances = EVENTS.filter((e) => e.series_id === series.id)
  const totalRiders = new Set(
    CLAIMS.filter(
      (c) =>
        EVENT_PREDICATES.includes(c.predicate as EventPredicate) &&
        instances.some((e) => e.id === c.object_id)
    ).map((c) => c.subject_id)
  ).size

  return (
    <Link href={`/events/${series.id}`}>
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
            <div className="text-base font-bold text-white">{instances.length}</div>
            <div className="text-[10px] text-zinc-600">editions</div>
            {totalRiders > 0 && (
              <div className="text-[10px] text-zinc-600 mt-0.5">{totalRiders} riders</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function EventsPage() {
  const [filter, setFilter] = useState<EventType | "all">("all")

  const filteredEvents = useMemo(
    () => (filter === "all" ? EVENTS : EVENTS.filter((e) => e.event_type === filter)),
    [filter]
  )

  const seriesGroups = useMemo(() => {
    return EVENT_SERIES.map((series) => ({
      series,
      events: filteredEvents
        .filter((e) => e.series_id === series.id)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    })).filter((g) => g.events.length > 0)
  }, [filteredEvents])

  const standaloneEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => !e.series_id)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    [filteredEvents]
  )

  // When "All" filter: show series overview cards
  const showSeriesOverview = filter === "all"

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Events</h1>
          <p className="text-sm text-zinc-500 mt-1">Contests, trips, film shoots, and gatherings</p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value as EventType | "all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                filter === value
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-zinc-500 hover:text-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* "All" view — series cards at top, then events grouped under series */}
        {showSeriesOverview ? (
          <div className="space-y-8">
            {/* Series overview */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Event series</h2>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>
              <div className="space-y-2">
                {EVENT_SERIES.map((series) => (
                  <SeriesCard key={series.id} series={series} />
                ))}
              </div>
            </div>

            {/* All events grouped under their series */}
            {seriesGroups.map(({ series, events }) => (
              <div key={series.id}>
                <Link href={`/events/${series.id}`}>
                  <div className="flex items-center gap-3 mb-3 group">
                    <h2 className="text-sm font-semibold text-zinc-400 group-hover:text-white transition-colors">
                      {series.name}
                    </h2>
                    <div className="flex-1 h-px bg-[#1e1e1e]" />
                    <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      All editions →
                    </span>
                  </div>
                </Link>
                <div className="space-y-2">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}

            {standaloneEvents.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-zinc-400">Standalone events</h2>
                  <div className="flex-1 h-px bg-[#1e1e1e]" />
                </div>
                <div className="space-y-2">
                  {standaloneEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Filtered view — just event cards */
          <div className="space-y-2">
            {filteredEvents.length === 0 ? (
              <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-[#2a2a2a] rounded-xl">
                No events found for this filter
              </div>
            ) : (
              filteredEvents
                .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
                .map((event) => <EventCard key={event.id} event={event} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}
