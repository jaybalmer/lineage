"use client"

import { useState } from "react"
import { Nav } from "@/components/ui/nav"
import { PLACES, CLAIMS } from "@/lib/mock-data"
import Link from "next/link"
import type { Place } from "@/types"

const PLACE_TYPE_ICONS: Record<string, string> = {
  resort: "🏔",
  shop: "🏪",
  zone: "🗺",
  city: "🏙",
  venue: "🏟",
}

function PlaceCard({ place }: { place: Place }) {
  const riderCount = [...new Set(
    CLAIMS.filter((c) => c.object_id === place.id && c.predicate === "rode_at").map((c) => c.subject_id)
  )].length

  const decades = [...new Set(
    CLAIMS
      .filter((c) => c.object_id === place.id && c.predicate === "rode_at" && c.start_date)
      .map((c) => `${Math.floor(parseInt(c.start_date!.slice(0, 4)) / 10) * 10}s`)
  )].sort()

  return (
    <Link href={`/places/${place.id}`}>
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#333] transition-all cursor-pointer group h-full">
        <div className="flex items-start justify-between mb-3">
          <span className="text-2xl">{PLACE_TYPE_ICONS[place.place_type] ?? "📍"}</span>
          {place.osm_id && (
            <span className="text-[10px] text-zinc-700 font-mono">OSM ✓</span>
          )}
        </div>
        <div className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors">
          {place.name}
        </div>
        {place.region && (
          <div className="text-xs text-zinc-500 mt-0.5">{place.region}{place.country ? `, ${place.country}` : ""}</div>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600">
          {riderCount > 0 && <span>{riderCount} rider{riderCount !== 1 ? "s" : ""}</span>}
          {decades.length > 0 && <span>{decades[0]}–{decades[decades.length - 1]}</span>}
        </div>
        {decades.length > 0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {decades.map((d) => (
              <span key={d} className="text-[10px] px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-zinc-500">
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function PlacesPage() {
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const filtered = PLACES.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.region ?? "").toLowerCase().includes(query.toLowerCase())
    const matchesType = typeFilter === "all" || p.place_type === typeFilter
    return matchesQuery && matchesType
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Places</h1>
            <p className="text-sm text-zinc-500 mt-1">Resorts, shops, and zones in the lineage</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
            + Add place
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places..."
            className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            {["all", "resort", "shop", "zone"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                  typeFilter === t
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-[#2a2a2a] text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-zinc-600 py-12 text-sm">
              No places found. Try a different search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
