"use client"

import { use, useState } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { EVENTS, EVENT_SERIES, eventSlug, seriesSlug, placeSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import type { Event } from "@/types"

function formatEventDate(start: string, end?: string): string {
  const [sy, sm, sd] = start.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const startStr = `${sd} ${months[sm - 1]} ${sy}`
  if (!end || end === start) return startStr
  const [ey, em, ed] = end.split("-").map(Number)
  if (sy === ey && sm === em) return `${sd}–${ed} ${months[sm - 1]} ${sy}`
  return `${startStr} – ${ed} ${months[em - 1]} ${ey}`
}

const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"] as const

function parseResult(result?: string): number {
  if (!result) return 9999
  const n = parseInt(result)
  return isNaN(n) ? 9999 : n
}

function AttendeeList({ eventId }: { eventId: string }) {
  const { catalog } = useLineageStore()
  const claims = catalog.claims.filter(
    (c) => c.object_id === eventId && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
  )

  const competitors = claims
    .filter((c) => c.predicate === "competed_at")
    .sort((a, b) => parseResult(a.result) - parseResult(b.result))
  const attendees = claims.filter((c) => c.predicate === "spectated_at")
  const organizers = claims.filter((c) => c.predicate === "organized_at")

  if (claims.length === 0) {
    return <div className="text-xs text-muted italic py-2">No participants documented</div>
  }

  const RiderChip = ({ claim }: { claim: typeof claims[0] }) => {
    const person = catalog.people.find((p) => p.id === claim.subject_id)
    if (!person) return null
    return (
      <Link href={`/riders/${claim.subject_id}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-default rounded-xl hover:border-blue-500/40 transition-all group">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {person.display_name[0]}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-foreground group-hover:text-blue-400 transition-colors leading-tight">
              {person.display_name}
            </div>
            {(claim.division || claim.result) && (
              <div className="text-[10px] text-muted leading-tight mt-0.5 flex items-center gap-1">
                {claim.result && (
                  <span className="font-semibold text-amber-400">{claim.result}</span>
                )}
                {claim.result && claim.division && <span>·</span>}
                {claim.division && <span>{claim.division}</span>}
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-5">
      {competitors.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="text-amber-400">🏆</span> Competitors
            <span className="text-muted font-normal">({competitors.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {competitors.map((c) => <RiderChip key={c.id} claim={c} />)}
          </div>
        </div>
      )}
      {attendees.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span>👁</span> Attendees
            <span className="text-muted font-normal">({attendees.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {attendees.map((c) => <RiderChip key={c.id} claim={c} />)}
          </div>
        </div>
      )}
      {organizers.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span>🎬</span> Organizers
            <span className="text-muted font-normal">({organizers.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {organizers.map((c) => <RiderChip key={c.id} claim={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function InstanceRow({ event }: { event: Event }) {
  const { catalog } = useLineageStore()
  const place = event.place_id ? catalog.places.find((p) => p.id === event.place_id) : null
  const attendeeCount = catalog.claims.filter(
    (c) => c.object_id === event.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
  ).length

  return (
    <div className="border border-border-default bg-background rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{event.name}</div>
          <div className="text-xs text-muted mt-0.5">
            {formatEventDate(event.start_date, event.end_date)}
            {place && <span className="text-muted"> · {place.name}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-foreground">{attendeeCount}</div>
          <div className="text-[10px] text-muted">participant{attendeeCount !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="px-4 py-3">
        <AttendeeList eventId={event.id} />
      </div>
    </div>
  )
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { catalog, userEntities } = useLineageStore()
  const [showAddEdition, setShowAddEdition] = useState(false)

  // Look up from all sources: mock-data, catalog (Supabase), and user-added entities
  const allSeries = [
    ...EVENT_SERIES,
    ...catalog.eventSeries.filter((s) => !EVENT_SERIES.some((m) => m.id === s.id)),
  ]
  const allEvents = [
    ...EVENTS,
    ...catalog.events.filter((e) => !EVENTS.some((m) => m.id === e.id)),
    ...userEntities.events,
  ]

  const series =
    allSeries.find((s) => s.id === id) ??
    allSeries.find((s) => seriesSlug(s) === id)

  const instance = series
    ? undefined
    : allEvents.find((e) => e.id === id) ??
      allEvents.find((e) => eventSlug(e) === id)

  if (!series && !instance) notFound()

  // ── Instance view ────────────────────────────────────────────────────────
  if (instance && !series) {
    const parentSeries = instance.series_id
      ? catalog.eventSeries.find((s) => s.id === instance.series_id)
      : null
    const seriesInstances = parentSeries
      ? catalog.events.filter((e) => e.series_id === parentSeries.id).sort(
          (a, b) => (a.year ?? 0) - (b.year ?? 0)
        )
      : []
    const place = instance.place_id ? catalog.places.find((p) => p.id === instance.place_id) : null
    const totalAttendees = catalog.claims.filter(
      (c) => c.object_id === instance.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
    ).length

    return (
      <div className="min-h-screen bg-background text-foreground">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="text-xs text-muted mb-6">
            <Link href="/events" className="hover:text-foreground">Events</Link>
            <span className="mx-2">/</span>
            {parentSeries ? (
              <>
                <Link href={`/events/${seriesSlug(parentSeries)}`} className="hover:text-foreground">{parentSeries.name}</Link>
                <span className="mx-2">/</span>
              </>
            ) : null}
            <span className="text-muted">{instance.name}</span>
          </div>

          {/* Header */}
          <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
            <div className="text-xs text-muted uppercase tracking-widest mb-1 flex items-center gap-2">
              <span>{instance.event_type}</span>
              {instance.year && <span className="text-muted">· {instance.year}</span>}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{instance.name}</h1>
            {place && (
              <Link href={`/places/${placeSlug(place)}`}>
                <p className="text-muted text-sm mt-1 hover:text-blue-300 transition-colors">
                  🏔 {place.name}
                </p>
              </Link>
            )}
            <p className="text-muted text-sm mt-0.5">
              {formatEventDate(instance.start_date, instance.end_date)}
            </p>
            <div className="mt-4 flex gap-6">
              <div>
                <div className="font-bold text-foreground text-xl">{totalAttendees}</div>
                <div className="text-muted text-xs">documented participants</div>
              </div>
            </div>
          </div>

          {/* Participants */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Participants</h2>
            <div className="bg-background border border-border-default rounded-xl p-4">
              <AttendeeList eventId={instance.id} />
            </div>
          </section>

          {/* Other years in series */}
          {seriesInstances.length > 1 && (
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Other years — {parentSeries?.name}
              </h2>
              <div className="space-y-2">
                {seriesInstances.filter((e) => e.id !== instance.id).map((e) => {
                  const count = catalog.claims.filter(
                    (c) => c.object_id === e.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
                  ).length
                  return (
                    <Link key={e.id} href={`/events/${eventSlug(e)}`}>
                      <div className="flex items-center justify-between px-4 py-2.5 bg-background border border-border-default rounded-lg hover:border-border-default transition-all">
                        <div>
                          <div className="text-sm text-foreground">{e.name}</div>
                          <div className="text-xs text-muted">{formatEventDate(e.start_date, e.end_date)}</div>
                        </div>
                        <div className="text-xs text-muted">{count} rider{count !== 1 ? "s" : ""}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    )
  }

  // ── Series view ──────────────────────────────────────────────────────────
  const seriesInstances = allEvents
    .filter((e) => e.series_id === series!.id)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

  const place = series!.place_id ? catalog.places.find((p) => p.id === series!.place_id) : null

  const totalAttendees = new Set(
    catalog.claims
      .filter(
        (c) =>
          EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number]) &&
          seriesInstances.some((e) => e.id === c.object_id)
      )
      .map((c) => c.subject_id)
  ).size

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/events" className="hover:text-foreground">Events</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{series!.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted uppercase tracking-widest">Event Series</span>
            <span className="text-xs text-muted">· {series!.frequency}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{series!.name}</h1>
          {place && (
            <Link href={`/places/${placeSlug(place)}`}>
              <p className="text-muted text-sm mt-1 hover:text-blue-300 transition-colors">
                🏔 {place.name}
              </p>
            </Link>
          )}
          {series!.description && (
            <p className="text-muted text-sm mt-2 leading-relaxed">{series!.description}</p>
          )}

          <div className="mt-5 flex gap-6">
            <div>
              <div className="font-bold text-foreground text-xl">{seriesInstances.length}</div>
              <div className="text-muted text-xs">documented years</div>
            </div>
            <div className="w-px bg-border-default" />
            <div>
              <div className="font-bold text-foreground text-xl">{totalAttendees}</div>
              <div className="text-muted text-xs">unique riders</div>
            </div>
            {series!.start_year && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-base">{series!.start_year}</div>
                  <div className="text-muted text-xs">since</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Instances by year */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Editions by year</h2>
            <button
              onClick={() => setShowAddEdition(true)}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
            >
              + Add edition
            </button>
          </div>
          {seriesInstances.length === 0 ? (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">
              No editions documented yet.{" "}
              <button onClick={() => setShowAddEdition(true)} className="text-blue-400 hover:text-blue-300 transition-colors">
                Add the first one →
              </button>
            </div>
          ) : (
            seriesInstances.map((event) => (
              <InstanceRow key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

      {showAddEdition && (
        <AddEntityModal
          entityType="event"
          initialSeriesId={series!.id}
          initialPlaceId={series!.place_id ?? ""}
          onClose={() => setShowAddEdition(false)}
          onAdded={() => setShowAddEdition(false)}
        />
      )}
    </div>
  )
}
