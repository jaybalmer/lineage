"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
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
    <div className="flex items-center gap-2">
      <Link href={`/places/${placeSlug(place)}`} className="flex-1 min-w-0 block">
        <div className="bg-surface border-2 border-blue-600 rounded-xl p-4 hover:opacity-90 transition-all">
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">{PLACE_TYPE_ICONS[place.place_type] ?? "📍"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{place.name}</span>
                {isUnverified && (
                  <span className="text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5">unverified</span>
                )}
                {place.osm_id && (
                  <span className="text-[10px] text-muted font-mono">OSM ✓</span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {place.region && <span>{place.region}{place.country ? `, ${place.country}` : ""}</span>}
                {decades.length > 0 && <span className="ml-1">· {decades[0]}–{decades[decades.length - 1]}</span>}
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
            {riderCount > 0 && (
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-muted">{riderCount} rider{riderCount !== 1 ? "s" : ""}</div>
              </div>
            )}
          </div>
        </div>
      </Link>
      <QuickClaimPopover
        entityId={place.id}
        entityType="place"
        entityName={place.name}
      />
    </div>
  )
}

function PlacesPageInner() {
  const searchParams = useSearchParams()
  const yearParam = searchParams.get("year")
  const [query, setQuery] = useState(yearParam ?? "")
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
      if (q && !p.name.toLowerCase().includes(q) && !(p.region ?? "").toLowerCase().includes(q) && !String(p.first_snowboard_year ?? "").includes(q)) return false
      return true
    })
  }, [catalog.places, myOnly, myPlaceIds, typeFilter, query])

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">
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

        <div className="space-y-2">
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

export default function PlacesPage() {
  return (
    <Suspense>
      <PlacesPageInner />
    </Suspense>
  )
}
