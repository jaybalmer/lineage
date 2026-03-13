"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { placeSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
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
  const { catalog } = useLineageStore()

  const riderCount = [...new Set(
    catalog.claims.filter((c) => c.object_id === place.id && c.predicate === "rode_at").map((c) => c.subject_id)
  )].length

  const decades = [...new Set(
    catalog.claims
      .filter((c) => c.object_id === place.id && c.predicate === "rode_at" && c.start_date)
      .map((c) => `${Math.floor(parseInt(c.start_date!.slice(0, 4)) / 10) * 10}s`)
  )].sort()

  const addedByPerson = place.added_by ? catalog.people.find((p) => p.id === place.added_by) : null
  const isUnverified = place.community_status === "unverified"

  return (
    <Link href={`/places/${placeSlug(place)}`}>
      <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-border-default transition-all cursor-pointer group h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <span className="text-2xl">{PLACE_TYPE_ICONS[place.place_type] ?? "📍"}</span>
          <div className="flex items-center gap-1.5">
            {isUnverified && (
              <span className="text-[10px] text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5">unverified</span>
            )}
            {place.osm_id && (
              <span className="text-[10px] text-muted font-mono">OSM ✓</span>
            )}
            <QuickClaimPopover
              entityId={place.id}
              entityType="place"
              entityName={place.name}
            />
          </div>
        </div>
        <div className="font-semibold text-foreground text-sm group-hover:text-blue-300 transition-colors">
          {place.name}
        </div>
        {place.region && (
          <div className="text-xs text-muted mt-0.5">{place.region}{place.country ? `, ${place.country}` : ""}</div>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted">
          {riderCount > 0 && <span>{riderCount} rider{riderCount !== 1 ? "s" : ""}</span>}
          {decades.length > 0 && <span>{decades[0]}–{decades[decades.length - 1]}</span>}
        </div>
        {decades.length > 0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {decades.map((d) => (
              <span key={d} className="text-[10px] px-1.5 py-0.5 bg-surface-hover border border-border-default rounded text-muted">
                {d}
              </span>
            ))}
          </div>
        )}
        {isUnverified && addedByPerson && (
          <div className="mt-auto pt-2 flex items-center gap-1 text-[10px] text-muted">
            <div className="w-3 h-3 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold">
              {addedByPerson.display_name[0]}
            </div>
            Added by {addedByPerson.display_name}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function PlacesPage() {
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [myOnly, setMyOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const { catalog, activePersonId } = useLineageStore()

  // IDs of places the active user rode at
  const myPlaceIds = useMemo(() => {
    if (!activePersonId) return new Set<string>()
    return new Set(
      catalog.claims
        .filter((c) => c.subject_id === activePersonId && c.predicate === "rode_at")
        .map((c) => c.object_id)
    )
  }, [activePersonId, catalog.claims])

  const filtered = useMemo(() => {
    return catalog.places.filter((p) => {
      if (myOnly && !myPlaceIds.has(p.id)) return false
      if (typeFilter !== "all" && p.place_type !== typeFilter) return false
      const q = query.toLowerCase()
      if (q && !p.name.toLowerCase().includes(q) && !(p.region ?? "").toLowerCase().includes(q)) return false
      return true
    })
  }, [catalog.places, myOnly, myPlaceIds, typeFilter, query])

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Places</h1>
            <p className="text-sm text-muted mt-1">Resorts, shops, and zones in the lineage</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-foreground hover:bg-blue-500 transition-all"
          >
            + Add place
          </button>
        </div>

        {/* Search + type filter + mine toggle */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places..."
            className="flex-1 min-w-0 bg-surface border border-border-default rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2 items-center flex-wrap">
            {["all", "resort", "shop", "zone"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition-all capitalize",
                  typeFilter === t
                    ? "bg-surface-active border-border-default text-foreground"
                    : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setMyOnly(!myOnly)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                myOnly
                  ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                  : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              My Places{myOnly && myPlaceIds.size > 0 ? ` · ${myPlaceIds.size}` : ""}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-muted py-12 text-sm">
              No places found.{" "}
              <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <AddEntityModal
          entityType="place"
          onClose={() => setAddOpen(false)}
          onAdded={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
