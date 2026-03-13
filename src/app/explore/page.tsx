"use client"

import { Nav } from "@/components/ui/nav"
import { PEOPLE, PLACES, ORGS, BOARDS, EVENTS, EVENT_SERIES, CLAIMS, placeSlug, orgSlug, boardSlug, seriesSlug } from "@/lib/mock-data"
import Link from "next/link"
import { useState } from "react"

export default function ExplorePage() {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"all" | "riders" | "places" | "brands" | "boards" | "events">("all")

  const q = query.toLowerCase()
  const filteredPeople = PEOPLE.filter((p) => p.display_name.toLowerCase().includes(q))
  const filteredPlaces = PLACES.filter((p) => p.name.toLowerCase().includes(q) || (p.region ?? "").toLowerCase().includes(q))
  const filteredOrgs = ORGS.filter((o) => o.name.toLowerCase().includes(q) && (o.org_type === "brand" || o.brand_category))
  const filteredBoards = BOARDS.filter((b) => `${b.brand} ${b.model}`.toLowerCase().includes(q))
  const filteredEvents = EVENT_SERIES.filter((s) => s.name.toLowerCase().includes(q))

  // Interesting cross-graph facts
  const mostConnectedPlace = PLACES.map((p) => ({
    place: p,
    count: [...new Set(CLAIMS.filter((c) => c.object_id === p.id && c.predicate === "rode_at").map((c) => c.subject_id))].length
  })).sort((a, b) => b.count - a.count)[0]

  const mostDocumented = PEOPLE.map((p) => ({
    person: p,
    documented: CLAIMS.filter((c) => c.subject_id === p.id && c.confidence === "documented").length
  })).sort((a, b) => b.documented - a.documented)[0]

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Explore</h1>
          <p className="text-sm text-zinc-500 mt-1">Search people, places, and connections across the graph</p>
        </div>

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search riders, resorts, brands…"
          className="w-full bg-surface border border-border-default rounded-xl px-5 py-3.5 text-foreground placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500 mb-8"
        />

        {/* Graph stats banner */}
        {!query && (
          <div className="grid grid-cols-5 gap-3 mb-8">
            {[
              { label: "Riders", value: PEOPLE.length, icon: "🏂" },
              { label: "Places", value: PLACES.length, icon: "🏔" },
              { label: "Brands", value: ORGS.filter(o => o.brand_category).length, icon: "🎽" },
              { label: "Boards", value: BOARDS.length, icon: "🏂" },
              { label: "Events", value: EVENTS.length, icon: "🏆" },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-surface border border-border-default rounded-xl p-4 text-center">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-lg font-bold text-foreground">{value}</div>
                <div className="text-xs text-zinc-600">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Spotlight cards */}
        {!query && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {mostConnectedPlace && (
              <Link href={`/places/${placeSlug(mostConnectedPlace.place)}`}>
                <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-border-default transition-all">
                  <div className="text-xs text-zinc-600 mb-1">Most ridden</div>
                  <div className="font-semibold text-foreground">{mostConnectedPlace.place.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{mostConnectedPlace.count} riders documented</div>
                </div>
              </Link>
            )}
            {mostDocumented && (
              <Link href={`/riders/${mostDocumented.person.id}`}>
                <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-border-default transition-all">
                  <div className="text-xs text-zinc-600 mb-1">Most documented</div>
                  <div className="font-semibold text-foreground">{mostDocumented.person.display_name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{mostDocumented.documented} documented claims</div>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Search results */}
        {query && (
          <div className="space-y-6">
            {filteredPeople.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Riders</div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredPeople.map((p) => (
                    <Link key={p.id} href={`/riders/${p.id}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                          {p.display_name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{p.display_name}</div>
                          {p.birth_year && <div className="text-xs text-zinc-600">b. {p.birth_year}</div>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filteredPlaces.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Places</div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredPlaces.map((p) => (
                    <Link key={p.id} href={`/places/${placeSlug(p)}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <span className="text-lg">🏔</span>
                        <div>
                          <div className="text-sm font-medium text-foreground">{p.name}</div>
                          {p.region && <div className="text-xs text-zinc-600">{p.region}</div>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filteredOrgs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Brands</div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredOrgs.map((o) => (
                    <Link key={o.id} href={`/orgs/${orgSlug(o)}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">{o.name[0]}</div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{o.name}</div>
                          {o.founded_year && <div className="text-xs text-zinc-600">est. {o.founded_year}</div>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filteredBoards.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Boards</div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredBoards.map((b) => (
                    <Link key={b.id} href={`/boards/${boardSlug(b)}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <span className="text-lg">🏂</span>
                        <div>
                          <div className="text-sm font-medium text-foreground">{b.brand} {b.model}</div>
                          <div className="text-xs text-zinc-600">'{String(b.model_year).slice(2)} · {b.shape ?? "–"}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filteredEvents.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Event Series</div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredEvents.map((s) => {
                    const instanceCount = EVENTS.filter((e) => e.series_id === s.id).length
                    return (
                      <Link key={s.id} href={`/events/${seriesSlug(s)}`}>
                        <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                          <span className="text-lg">🏆</span>
                          <div>
                            <div className="text-sm font-medium text-foreground">{s.name}</div>
                            <div className="text-xs text-zinc-600">{instanceCount} years documented</div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredPeople.length === 0 && filteredPlaces.length === 0 && filteredOrgs.length === 0 && filteredBoards.length === 0 && filteredEvents.length === 0 && (
              <div className="text-center text-zinc-600 py-12 text-sm">No results for &ldquo;{query}&rdquo;</div>
            )}
          </div>
        )}

        {/* Browse sections (no query) */}
        {!query && (
          <div className="space-y-8">
            {/* Riders */}
            <div>
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Riders</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PEOPLE.map((p) => {
                  const claimCount = CLAIMS.filter((c) => c.subject_id === p.id).length
                  return (
                    <Link key={p.id} href={`/riders/${p.id}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
                          {p.display_name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{p.display_name}</div>
                          <div className="text-xs text-zinc-600">{claimCount} claims</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Brands */}
            <div>
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Brands</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ORGS.filter((o) => o.brand_category).map((o) => {
                  const riderCount = [...new Set(CLAIMS.filter((c) => c.object_id === o.id && (c.predicate === "sponsored_by" || c.predicate === "part_of_team")).map((c) => c.subject_id))].length
                  return (
                    <Link key={o.id} href={`/orgs/${orgSlug(o)}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">{o.name[0]}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{o.name}</div>
                          <div className="text-xs text-zinc-600">{riderCount > 0 ? `${riderCount} riders` : o.founded_year ? `est. ${o.founded_year}` : ""}</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Event Series */}
            <div>
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Event Series</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EVENT_SERIES.map((s) => {
                  const instanceCount = EVENTS.filter((e) => e.series_id === s.id).length
                  const attendeeCount = new Set(CLAIMS.filter((c) => c.predicate === "competed_at" && EVENTS.filter(e => e.series_id === s.id).some(e => e.id === c.object_id)).map(c => c.subject_id)).size
                  return (
                    <Link key={s.id} href={`/events/${s.id}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                        <span className="text-lg flex-shrink-0">🏆</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                          <div className="text-xs text-zinc-600">{instanceCount} years · {attendeeCount} riders</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
