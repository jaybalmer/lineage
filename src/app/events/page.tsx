"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { eventSlug, seriesSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Event, EventType, EventSeries } from "@/types"

const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"] as const
type EventPredicate = (typeof EVENT_PREDICATES)[number]

type MainTab = "all" | "series"

const ACCENT: Record<EventType, string> = {
  contest: "border-amber-600",
  "film-shoot": "border-violet-600",
  trip: "border-emerald-600",
  camp: "border-blue-600",
  gathering: "border-zinc-400",
}

const ICON: Record<EventType, string> = {
  contest: "🏆",
  "film-shoot": "🎬",
  trip: "🚐",
  camp: "⛺",
  gathering: "🤝",
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

function AvatarStack({ riderIds }: { riderIds: string[] }) {
  const { catalog } = useLineageStore()
  const shown = riderIds.slice(0, 3)
  const extra = riderIds.length - shown.length
  if (shown.length === 0) return null
  return (
    <div className="flex items-center">
      {shown.map((rid, i) => {
        const person = catalog.people.find((p) => p.id === rid)
        if (!person) return null
        return (
          <div
            key={rid}
            style={{ marginLeft: i === 0 ? 0 : -6 }}
            className="w-5 h-5 rounded-full bg-blue-600 border border-border-default flex items-center justify-center text-[8px] font-bold text-foreground"
            title={person.display_name}
          >
            {person.display_name[0]}
          </div>
        )
      })}
      {extra > 0 && (
        <div
          style={{ marginLeft: -6 }}
          className="w-5 h-5 rounded-full bg-border-default border border-border-default flex items-center justify-center text-[8px] text-muted"
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const { catalog } = useLineageStore()
  const place = event.place_id ? catalog.places.find((p) => p.id === event.place_id) : null
  const riderIds = [...new Set(
    catalog.claims.filter(
      (c) => c.object_id === event.id && EVENT_PREDICATES.includes(c.predicate as EventPredicate)
    ).map((c) => c.subject_id)
  )]
  const accent = ACCENT[event.event_type] ?? "border-zinc-400"
  const icon = ICON[event.event_type] ?? "📅"
  const addedByPerson = event.added_by ? catalog.people.find((p) => p.id === event.added_by) : null
  const isUnverified = event.community_status === "unverified"

  return (
    <div className="flex items-center gap-2">
      <Link href={`/events/${eventSlug(event)}`} className="flex-1 min-w-0 block">
        <div className={cn(
          "bg-surface border-2 rounded-xl p-4 hover:opacity-90 transition-all",
          accent
        )}>
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-semibold text-foreground text-sm leading-snug">{event.name}</span>
                {isUnverified && (
                  <span className="text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5">unverified</span>
                )}
              </div>
              <div className="text-xs text-muted">
                <span className="uppercase tracking-widest mr-2">{TYPE_LABEL[event.event_type]}</span>
                {event.year}
                {place && <span> · {place.name}</span>}
              </div>
              {isUnverified && addedByPerson && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted">
                  <div className="w-3 h-3 rounded-full bg-zinc-300 flex items-center justify-center text-[8px] font-bold">
                    {addedByPerson.display_name[0]}
                  </div>
                  Added by {addedByPerson.display_name}
                </div>
              )}
            </div>
            {riderIds.length > 0 && (
              <div className="shrink-0 flex flex-col items-end gap-1">
                <AvatarStack riderIds={riderIds} />
                <div className="text-[10px] text-muted">
                  {riderIds.length} rider{riderIds.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
      <QuickClaimPopover
        entityId={event.id}
        entityType="event"
        entityName={event.name}
      />
    </div>
  )
}

// Series tab — overview card linking to series detail
function SeriesCard({ series, filteredEventCount }: { series: EventSeries; filteredEventCount: number }) {
  const { catalog } = useLineageStore()
  const place = series.place_id ? catalog.places.find((p) => p.id === series.place_id) : null
  const allInstances = catalog.events.filter((e) => e.series_id === series.id)
  const totalRiders = new Set(
    catalog.claims.filter(
      (c) =>
        EVENT_PREDICATES.includes(c.predicate as EventPredicate) &&
        allInstances.some((e) => e.id === c.object_id)
    ).map((c) => c.subject_id)
  ).size

  return (
    <Link href={`/events/${seriesSlug(series)}`}>
      <div className="bg-surface border border-border-default border-l-2 border-l-amber-700 rounded-xl p-4 hover:border-border-default transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-1">
              Event series · {series.frequency}
            </div>
            <div className="font-medium text-foreground text-sm leading-snug">{series.name}</div>
            <div className="text-xs text-muted mt-1">
              {series.start_year && <span>Since {series.start_year}</span>}
              {place && <span className="text-muted"> · {place.name}</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-bold text-foreground">{filteredEventCount}</div>
            <div className="text-[10px] text-muted">edition{filteredEventCount !== 1 ? "s" : ""}</div>
            {totalRiders > 0 && (
              <div className="text-[10px] text-muted mt-0.5">{totalRiders} riders</div>
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
      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 h-px bg-surface-active" />
    </div>
  )
}

export default function EventsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("all")
  const [typeFilter, setTypeFilter] = useState<EventType | null>(null)
  const [myOnly, setMyOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { catalog, activePersonId } = useLineageStore()

  const allEvents = catalog.events

  // IDs of events the active user has a claim for
  const myEventIds = useMemo(() => {
    if (!activePersonId) return new Set<string>()
    return new Set(
      catalog.claims
        .filter((c) => c.subject_id === activePersonId && EVENT_PREDICATES.includes(c.predicate as EventPredicate))
        .map((c) => c.object_id)
    )
  }, [activePersonId, catalog.claims])

  // Apply search + type + mine filters
  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allEvents.filter((e) => {
      if (myOnly && !myEventIds.has(e.id)) return false
      if (typeFilter && e.event_type !== typeFilter) return false
      if (q) {
        const place = e.place_id ? catalog.places.find((p) => p.id === e.place_id) : null
        const haystack = [
          e.name,
          String(e.year ?? ""),
          place?.name ?? "",
          e.event_type,
        ].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [search, typeFilter, myOnly, allEvents, myEventIds, catalog.places])

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
    return catalog.eventSeries.map((series) => ({
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
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Events</h1>
            <p className="text-sm text-muted mt-1">Contests, trips, film shoots, and gatherings</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-foreground hover:bg-blue-500 transition-all"
          >
            + Add event
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events by name, year, or location…"
            className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-lg leading-none">×</button>
          )}
        </div>

        {/* Controls row: main tabs + type filters + mine toggle */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Main tabs: All / Series */}
            <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1">
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
                      ? "bg-surface-active text-foreground"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Type filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {TYPE_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTypeFilter(typeFilter === value ? null : value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    typeFilter === value
                      ? "bg-surface-active border-border-default text-foreground"
                      : "bg-transparent text-muted border-border-default hover:border-border-default hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mine filter */}
          <button
            onClick={() => setMyOnly(!myOnly)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border shrink-0",
              myOnly
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
            )}
          >
            My Events{myOnly && myEventIds.size > 0 ? ` · ${myEventIds.size}` : ""}
          </button>
        </div>

        {/* ── All tab: decade groups ── */}
        {mainTab === "all" && (
          <div className="space-y-8">
            {isEmpty ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
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
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
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
                    <div className="space-y-2 mt-2 pl-2 border-l border-border-default">
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
