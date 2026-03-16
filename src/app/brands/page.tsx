"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { orgSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { Org } from "@/types"

const CATEGORY_LABELS: Record<string, string> = {
  board_brand: "Board Brands",
  outerwear: "Apparel & Outerwear",
  bindings: "Bindings",
  boots: "Boots",
  retailer: "Retailers",
  media: "Media & Magazines",
  other: "Other",
}

const CATEGORY_ORDER = ["board_brand", "outerwear", "media", "other"]

function OrgCard({ org }: { org: Org }) {
  const { catalog } = useLineageStore()

  const riders = new Set(
    catalog.claims.filter(
      (c) => c.object_id === org.id &&
        (c.predicate === "sponsored_by" || c.predicate === "worked_at" || c.predicate === "part_of_team")
    ).map((c) => c.subject_id)
  ).size

  const firstName = org.name.split(" ")[0]
  const boards = catalog.boards.filter(
    (b) => b.brand.toLowerCase() === org.name.toLowerCase() ||
      b.brand.toLowerCase() === firstName.toLowerCase()
  ).length

  const initial = org.name[0].toUpperCase()
  const isUnverified = org.community_status === "unverified"
  const addedByPerson = org.added_by ? catalog.people.find((p) => p.id === org.added_by) : null

  return (
    <div className="flex items-center gap-2">
      <Link href={`/brands/${orgSlug(org)}`} className="flex-1 min-w-0 block">
        <div className="group bg-surface border-2 border-violet-600 rounded-xl p-4 hover:opacity-90 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate">
                  {org.name}
                </span>
                {isUnverified && (
                  <span className="text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5 shrink-0">unverified</span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {org.founded_year ? `Est. ${org.founded_year}` : ""}
                {org.founded_year && org.country ? " · " : ""}
                {org.country ?? ""}
                {org.description && (
                  <span className="ml-1 text-muted">· {org.description.slice(0, 60)}{org.description.length > 60 ? "…" : ""}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {riders > 0 && <div className="text-[11px] text-muted">{riders} rider{riders !== 1 ? "s" : ""}</div>}
              {boards > 0 && <div className="text-[11px] text-muted">{boards} board{boards !== 1 ? "s" : ""}</div>}
            </div>
          </div>
        </div>
      </Link>
      <QuickClaimPopover
        entityId={org.id}
        entityType="org"
        entityName={org.name}
      />
    </div>
  )
}

const BRAND_PREDICATES = ["sponsored_by", "worked_at", "part_of_team"] as const

function BrandsPageInner() {
  const searchParams = useSearchParams()
  const yearParam = searchParams.get("year")
  const [addOpen, setAddOpen] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
  const [search, setSearch] = useState(yearParam ?? "")
  const { catalog, activePersonId } = useLineageStore()

  // IDs of orgs the active user is connected to
  const myOrgIds = useMemo(() => {
    if (!activePersonId) return new Set<string>()
    return new Set(
      catalog.claims
        .filter((c) => c.subject_id === activePersonId && BRAND_PREDICATES.includes(c.predicate as typeof BRAND_PREDICATES[number]))
        .map((c) => c.object_id)
    )
  }, [activePersonId, catalog.claims])

  const allOrgs = useMemo(() => {
    const base = myOnly ? catalog.orgs.filter((o) => myOrgIds.has(o.id)) : catalog.orgs
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter((o) => {
      const haystack = [o.name, o.description ?? "", o.country ?? "", o.brand_category ?? "", String(o.founded_year ?? "")].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [myOnly, search, catalog.orgs, myOrgIds])

  const brandOrgs = allOrgs.filter((o) => o.org_type === "brand" || o.org_type === "magazine")
  const teams = allOrgs.filter((o) => o.org_type === "team")

  // Group brands by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Org[]>>((acc, cat) => {
    const items = brandOrgs.filter((o) => (o.brand_category ?? "other") === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})
  const uncategorized = brandOrgs.filter((o) => !o.brand_category || !CATEGORY_ORDER.includes(o.brand_category))
  if (uncategorized.length > 0) grouped["other"] = [...(grouped["other"] ?? []), ...uncategorized]

  const totalBrands = allOrgs.length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Brands & Orgs</h1>
            <p className="text-sm text-muted">
              {totalBrands} brands, media outlets, and collectives in the community graph
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMyOnly(!myOnly)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                myOnly
                  ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                  : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              My Brands{myOnly && myOrgIds.size > 0 ? ` · ${myOrgIds.size}` : ""}
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-foreground hover:bg-blue-500 transition-all"
            >
              + Add brand
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands by name, category, or country…"
            className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-lg leading-none">×</button>
          )}
        </div>

        <div className="space-y-10">
          {Object.entries(grouped).map(([cat, orgs]) => (
            <section key={cat}>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="space-y-2">
                {orgs.map((org) => (
                  <OrgCard key={org.id} org={org} />
                ))}
              </div>
            </section>
          ))}

          {teams.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
                Teams & Collectives
              </h2>
              <div className="space-y-2">
                {teams.map((org) => (
                  <OrgCard key={org.id} org={org} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {addOpen && (
        <AddEntityModal
          entityType="org"
          onClose={() => setAddOpen(false)}
          onAdded={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

export default function BrandsPage() {
  return (
    <Suspense>
      <BrandsPageInner />
    </Suspense>
  )
}
