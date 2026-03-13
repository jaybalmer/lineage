"use client"

import { use, useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { eventSlug, placeSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"

type PlaceTab = "all" | "riders" | "events"

const EVENT_TYPE_ICON: Record<string, string> = {
  contest: "🏆",
  "film-shoot": "🎬",
  trip: "🏔",
  camp: "🏕",
  gathering: "📅",
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  contest: "border-l-amber-700",
  "film-shoot": "border-l-violet-700",
  trip: "border-l-emerald-700",
  camp: "border-l-blue-700",
  gathering: "border-l-zinc-600",
}

export default function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { catalog } = useLineageStore()
  const place = catalog.places.find((p) => p.id === id || placeSlug(p) === id)
  if (!place) notFound()

  const [tab, setTab] = useState<PlaceTab>("all")

  const rideClaims = catalog.claims.filter((c) => c.object_id === place.id && c.predicate === "rode_at")
  const workClaims = catalog.claims.filter((c) => c.object_id === place.id && c.predicate === "worked_at")
  const placeEvents = catalog.events.filter((e) => e.place_id === place.id)

  const riderIds = [...new Set(rideClaims.map((c) => c.subject_id))]
  const staffIds = [...new Set(workClaims.map((c) => c.subject_id))]

  // Riders grouped by decade (for Riders tab)
  const byDecade = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const claim of rideClaims) {
      const year = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : 0
      const decade = year ? `${Math.floor(year / 10) * 10}s` : "Unknown"
      if (!map[decade]) map[decade] = []
      if (!map[decade].includes(claim.subject_id)) map[decade].push(claim.subject_id)
    }
    return map
  }, [rideClaims])

  // All tab: unified decade feed (riders + events mixed)
  const allDecadeGroups = useMemo(() => {
    type AllItem =
      | { kind: "rider"; year: number; riderId: string; claim: typeof rideClaims[0] }
      | { kind: "event"; year: number; event: typeof placeEvents[0] }

    const items: AllItem[] = []

    rideClaims.forEach((claim) => {
      const y = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : null
      if (y) items.push({ kind: "rider", year: y, riderId: claim.subject_id, claim })
    })
    placeEvents.forEach((event) => {
      if (event.year) items.push({ kind: "event", year: event.year, event })
    })

    const byDecadeMap = new Map<number, AllItem[]>()
    items.forEach((item) => {
      const decade = Math.floor(item.year / 10) * 10
      if (!byDecadeMap.has(decade)) byDecadeMap.set(decade, [])
      byDecadeMap.get(decade)!.push(item)
    })

    return [...byDecadeMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([decade, entries]) => ({
        label: `${decade}s`,
        entries: [...entries].sort((a, b) => b.year - a.year),
      }))
  }, [rideClaims, placeEvents])

  const tabs: { key: PlaceTab; label: string; count: number }[] = [
    { key: "all",    label: "All",    count: riderIds.length + placeEvents.length },
    { key: "riders", label: "Riders", count: riderIds.length },
    { key: "events", label: "Events", count: placeEvents.length },
  ]

  const sortedDecades = Object.keys(byDecade).sort((a, b) => parseInt(b) - parseInt(a))

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/places" className="hover:text-foreground transition-colors">Places</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{place.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted uppercase tracking-widest capitalize">{place.place_type}</span>
                {place.osm_id && <span className="text-[10px] text-muted font-mono">OSM ✓</span>}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{place.name}</h1>
              {place.region && (
                <p className="text-muted mt-0.5 text-sm">{place.region}{place.country ? `, ${place.country}` : ""}</p>
              )}
              {place.description && (
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">{place.description}</p>
              )}
              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-400 mt-2 inline-block transition-colors"
                >
                  {place.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 flex gap-6 text-sm flex-wrap">
            {riderIds.length > 0 && (
              <div>
                <div className="font-bold text-foreground text-xl">{riderIds.length}</div>
                <div className="text-muted text-xs">riders</div>
              </div>
            )}
            {placeEvents.length > 0 && (
              <>
                {riderIds.length > 0 && <div className="w-px bg-border-default" />}
                <div>
                  <div className="font-bold text-foreground text-xl">{placeEvents.length}</div>
                  <div className="text-muted text-xs">events</div>
                </div>
              </>
            )}
            {Object.keys(byDecade).length > 0 && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{Object.keys(byDecade).length}</div>
                  <div className="text-muted text-xs">decades</div>
                </div>
              </>
            )}
            {place.first_snowboard_year && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{place.first_snowboard_year}</div>
                  <div className="text-muted text-xs">first snowboard year</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1 mb-6 w-fit">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                tab === key
                  ? "bg-surface-active text-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn("ml-1.5 text-[11px]", tab === key ? "text-muted" : "text-muted")}>{count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">

          {/* Main feed */}
          <div>

            {/* ── All tab: unified calendar feed ── */}
            {tab === "all" && (
              <div className="space-y-8">
                {allDecadeGroups.length === 0 ? (
                  <div className="text-sm text-muted py-12 text-center border border-dashed border-border-default rounded-xl">
                    No riders or events documented yet for this place.
                  </div>
                ) : allDecadeGroups.map(({ label, entries }) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{label}</span>
                      <div className="flex-1 h-px bg-surface-active" />
                    </div>
                    <div className="space-y-2">
                      {entries.map((item, i) => {
                        if (item.kind === "rider") {
                          const rider = catalog.people.find((p) => p.id === item.riderId)
                          if (!rider) return null
                          return (
                            <Link key={`rider-${item.riderId}-${i}`} href={`/riders/${item.riderId}`}>
                              <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-800/30 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                                  {rider.display_name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground">{rider.display_name}</div>
                                  {(item.claim.start_date || item.claim.end_date) && (
                                    <div className="text-xs text-muted">{formatDateRange(item.claim.start_date, item.claim.end_date)}</div>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted capitalize shrink-0">
                                  {item.claim.predicate.replace("_", " ")}
                                </span>
                              </div>
                            </Link>
                          )
                        }

                        if (item.kind === "event") {
                          const accent = EVENT_TYPE_COLOR[item.event.event_type] ?? "border-l-zinc-600"
                          const icon = EVENT_TYPE_ICON[item.event.event_type] ?? "📅"
                          return (
                            <Link key={`event-${item.event.id}`} href={`/events/${eventSlug(item.event)}`}>
                              <div className={cn(
                                "flex items-center gap-3 px-4 py-3 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                                accent
                              )}>
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-sm">
                                  {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{item.event.name}</div>
                                  <div className="text-xs text-muted capitalize">{item.event.event_type.replace("-", " ")}</div>
                                </div>
                                <span className="text-xs text-muted shrink-0">{item.event.year}</span>
                              </div>
                            </Link>
                          )
                        }

                        return null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Riders tab ── */}
            {tab === "riders" && (
              <div className="space-y-8">
                {riderIds.length === 0 ? (
                  <div className="text-sm text-muted py-12 text-center border border-dashed border-border-default rounded-xl">
                    No riders documented yet for this place.
                  </div>
                ) : sortedDecades.map((decade) => (
                  <div key={decade}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{decade}</span>
                      <div className="flex-1 h-px bg-surface-active" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {byDecade[decade].map((riderId) => {
                        const rider = catalog.people.find((p) => p.id === riderId)
                        if (!rider) return null
                        const claim = rideClaims.find((c) => c.subject_id === riderId)
                        return (
                          <Link key={riderId} href={`/riders/${riderId}`}>
                            <div className="flex items-center gap-2 p-2.5 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-muted flex-shrink-0">
                                {rider.display_name[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">{rider.display_name}</div>
                                {claim?.start_date && (
                                  <div className="text-[10px] text-muted">{formatDateRange(claim.start_date, claim.end_date)}</div>
                                )}
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Events tab ── */}
            {tab === "events" && (
              <div className="space-y-2">
                {placeEvents.length === 0 ? (
                  <div className="text-sm text-muted py-12 text-center border border-dashed border-border-default rounded-xl">
                    No events documented at this place yet.
                  </div>
                ) : [...placeEvents].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).map((event) => {
                  const accent = EVENT_TYPE_COLOR[event.event_type] ?? "border-l-zinc-600"
                  const icon = EVENT_TYPE_ICON[event.event_type] ?? "📅"
                  return (
                    <Link key={event.id} href={`/events/${eventSlug(event)}`}>
                      <div className={cn(
                        "flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                        accent
                      )}>
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{event.name}</div>
                          <div className="text-xs text-muted capitalize mt-0.5">{event.event_type.replace("-", " ")}</div>
                        </div>
                        <span className="text-sm text-muted shrink-0">{event.year}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* About */}
            {(place.first_snowboard_year || place.website || place.wikidata_qid || place.osm_id) && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">About</div>
                <div className="space-y-2 text-sm">
                  {place.first_snowboard_year && (
                    <div className="flex justify-between">
                      <span className="text-muted">Snowboards since</span>
                      <span className="text-muted">{place.first_snowboard_year}</span>
                    </div>
                  )}
                  {place.region && (
                    <div className="flex justify-between">
                      <span className="text-muted">Region</span>
                      <span className="text-muted">{place.region}</span>
                    </div>
                  )}
                  {place.country && (
                    <div className="flex justify-between">
                      <span className="text-muted">Country</span>
                      <span className="text-muted">{place.country}</span>
                    </div>
                  )}
                  {place.website && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Website</span>
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-400 text-xs transition-colors"
                      >
                        {place.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                      </a>
                    </div>
                  )}
                  {place.osm_id && (
                    <div className="flex justify-between">
                      <span className="text-muted">OSM</span>
                      <span className="font-mono text-muted text-xs">{place.osm_id}</span>
                    </div>
                  )}
                  {place.wikidata_qid && (
                    <div className="flex justify-between">
                      <span className="text-muted">Wikidata</span>
                      <span className="font-mono text-muted text-xs">{place.wikidata_qid}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Staff */}
            {staffIds.length > 0 && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">People who worked here</div>
                {staffIds.map((sid) => {
                  const person = catalog.people.find((p) => p.id === sid)
                  if (!person) return null
                  const claim = workClaims.find((c) => c.subject_id === sid)
                  return (
                    <Link key={sid} href={`/riders/${sid}`}>
                      <div className="flex items-center gap-2 py-2 hover:text-blue-300 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-muted">
                          {person.display_name[0]}
                        </div>
                        <div>
                          <div className="text-xs text-foreground">{person.display_name}</div>
                          {claim && <div className="text-[10px] text-muted">{formatDateRange(claim.start_date, claim.end_date)}</div>}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Add claim CTA */}
            <div className="bg-bg-nav border border-border-default rounded-xl p-4">
              <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Add a claim</div>
              <p className="text-xs text-muted mb-3">Did you ride here? Work here? Compete here?</p>
              <Link href="/profile">
                <button className="w-full px-3 py-2 bg-blue-600 rounded-lg text-xs text-foreground font-medium hover:bg-blue-500 transition-colors">
                  + Add to my profile
                </button>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
