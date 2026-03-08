"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { EVENTS, EVENT_SERIES, CLAIMS, getPersonById, getPlaceById } from "@/lib/mock-data"
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

function AttendeeList({ eventId }: { eventId: string }) {
  const claims = CLAIMS.filter(
    (c) => c.object_id === eventId && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
  )
  const riderIds = [...new Set(claims.map((c) => c.subject_id))]

  if (riderIds.length === 0) {
    return <div className="text-xs text-zinc-700 italic py-2">No attendees documented</div>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {riderIds.map((rid) => {
        const person = getPersonById(rid)
        if (!person) return null
        return (
          <Link key={rid} href={`/riders/${rid}`}>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#161616] border border-[#2a2a2a] rounded-full hover:border-zinc-600 transition-all group">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                {person.display_name[0]}
              </div>
              <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">
                {person.display_name}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function InstanceRow({ event, highlight }: { event: Event; highlight?: boolean }) {
  const place = event.place_id ? getPlaceById(event.place_id) : null
  const attendeeCount = CLAIMS.filter(
    (c) => c.object_id === event.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
  ).length

  return (
    <div
      className={`border rounded-xl overflow-hidden ${
        highlight ? "border-blue-700/50 bg-blue-950/20" : "border-[#1e1e1e] bg-[#0e0e0e]"
      }`}
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{event.name}</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {formatEventDate(event.start_date, event.end_date)}
            {place && <span className="text-zinc-700"> · {place.name}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-white">{attendeeCount}</div>
          <div className="text-[10px] text-zinc-600">rider{attendeeCount !== 1 ? "s" : ""}</div>
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

  // Check if it's a series or an instance
  const series = EVENT_SERIES.find((s) => s.id === id)
  const instance = EVENTS.find((e) => e.id === id)

  if (!series && !instance) notFound()

  // If it's an instance, show its series context
  if (instance && !series) {
    const parentSeries = instance.series_id
      ? EVENT_SERIES.find((s) => s.id === instance.series_id)
      : null
    const seriesInstances = parentSeries
      ? EVENTS.filter((e) => e.series_id === parentSeries.id).sort(
          (a, b) => (a.year ?? 0) - (b.year ?? 0)
        )
      : []
    const place = instance.place_id ? getPlaceById(instance.place_id) : null
    const totalAttendees = CLAIMS.filter(
      (c) => c.object_id === id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
    ).length

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="text-xs text-zinc-600 mb-6">
            {parentSeries ? (
              <>
                <Link href={`/events/${parentSeries.id}`} className="hover:text-zinc-400">{parentSeries.name}</Link>
                <span className="mx-2">/</span>
              </>
            ) : null}
            <span className="text-zinc-400">{instance.name}</span>
          </div>

          {/* Header */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 mb-6">
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span>{instance.event_type}</span>
              {instance.year && <span className="text-zinc-700">· {instance.year}</span>}
            </div>
            <h1 className="text-2xl font-bold text-white">{instance.name}</h1>
            {place && (
              <Link href={`/places/${place.id}`}>
                <p className="text-zinc-400 text-sm mt-1 hover:text-blue-300 transition-colors">
                  🏔 {place.name}
                </p>
              </Link>
            )}
            <p className="text-zinc-600 text-sm mt-0.5">
              {formatEventDate(instance.start_date, instance.end_date)}
            </p>
            <div className="mt-4 flex gap-6">
              <div>
                <div className="font-bold text-white text-xl">{totalAttendees}</div>
                <div className="text-zinc-600 text-xs">documented riders</div>
              </div>
            </div>
          </div>

          {/* Attendees */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Attendees</h2>
            <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-4">
              <AttendeeList eventId={id} />
            </div>
          </section>

          {/* Other years in series */}
          {seriesInstances.length > 1 && (
            <section>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                Other years — {parentSeries?.name}
              </h2>
              <div className="space-y-2">
                {seriesInstances.filter((e) => e.id !== id).map((e) => {
                  const count = CLAIMS.filter(
                    (c) => c.object_id === e.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
                  ).length
                  return (
                    <Link key={e.id} href={`/events/${e.id}`}>
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg hover:border-[#2a2a2a] transition-all">
                        <div>
                          <div className="text-sm text-white">{e.name}</div>
                          <div className="text-xs text-zinc-600">{formatEventDate(e.start_date, e.end_date)}</div>
                        </div>
                        <div className="text-xs text-zinc-600">{count} rider{count !== 1 ? "s" : ""}</div>
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

  // Series view
  const seriesInstances = EVENTS.filter((e) => e.series_id === id).sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0)
  )
  const place = series!.place_id ? getPlaceById(series!.place_id) : null
  const totalAttendees = new Set(
    CLAIMS
      .filter(
        (c) =>
          EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number]) &&
          seriesInstances.some((e) => e.id === c.object_id)
      )
      .map((c) => c.subject_id)
  ).size

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-zinc-600 mb-6">
          <Link href="/events" className="hover:text-zinc-400">Events</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">{series!.name}</span>
        </div>

        {/* Header */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-zinc-600 uppercase tracking-widest">Event Series</span>
            <span className="text-xs text-zinc-700">· {series!.frequency}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{series!.name}</h1>
          {place && (
            <Link href={`/places/${place.id}`}>
              <p className="text-zinc-400 text-sm mt-1 hover:text-blue-300 transition-colors">
                🏔 {place.name}
              </p>
            </Link>
          )}
          {series!.description && (
            <p className="text-zinc-500 text-sm mt-2 leading-relaxed">{series!.description}</p>
          )}

          <div className="mt-5 flex gap-6">
            <div>
              <div className="font-bold text-white text-xl">{seriesInstances.length}</div>
              <div className="text-zinc-600 text-xs">documented years</div>
            </div>
            <div className="w-px bg-[#2a2a2a]" />
            <div>
              <div className="font-bold text-white text-xl">{totalAttendees}</div>
              <div className="text-zinc-600 text-xs">unique riders</div>
            </div>
            {series!.start_year && (
              <>
                <div className="w-px bg-[#2a2a2a]" />
                <div>
                  <div className="font-bold text-white text-base">{series!.start_year}</div>
                  <div className="text-zinc-600 text-xs">since</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Instances by year */}
        {seriesInstances.length === 0 ? (
          <div className="text-sm text-zinc-600 py-8 text-center border border-dashed border-[#2a2a2a] rounded-xl">
            No instances documented yet for this series.
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Editions by year</h2>
            {seriesInstances.map((event) => (
              <InstanceRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
