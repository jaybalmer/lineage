"use client"

import { useState, useMemo } from "react"
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
    <Link href={`/brands/${orgSlug(org)}`}>
      <div className="group flex flex-col gap-3 p-4 bg-surface border border-border-default rounded-xl hover:border-border-default hover:bg-surface transition-all h-full">
        <div className="flex items-start gap-3">
          {/* Logo / initials */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0"
            style={{
              background: "linear-gradient(145deg, #1c1c1f 0%, #111113 100%)",
              border: "1px solid rgba(161,161,170,0.12)",
              backgroundImage: "radial-gradient(circle, rgba(161,161,170,0.12) 1px, transparent 1px)",
              backgroundSize: "7px 7px",
              color: "#a1a1aa",
            }}
          >
            <span style={{
              background: "linear-gradient(140deg, #f4f4f5 0%, #a1a1aa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              {initial}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">
                {org.name}
              </div>
              {isUnverified && (
                <span className="text-[10px] text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5 shrink-0">unverified</span>
              )}
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              {org.founded_year ? `Est. ${org.founded_year}` : ""}
              {org.founded_year && org.country ? " · " : ""}
              {org.country ?? ""}
            </div>
          </div>
        </div>

        {org.description && (
          <p className="text-xs text-muted leading-relaxed line-clamp-2 flex-1">
            {org.description}
          </p>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted mt-auto pt-1 border-t border-border-default">
          <div className="flex items-center gap-3">
            {riders > 0 && <span>{riders} rider{riders !== 1 ? "s" : ""}</span>}
            {boards > 0 && <span>{boards} board{boards !== 1 ? "s" : ""}</span>}
            {riders === 0 && boards === 0 && (
              <span className="text-muted">No claims yet</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isUnverified && addedByPerson && (
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <div className="w-3 h-3 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold">
                  {addedByPerson.display_name[0]}
                </div>
                {addedByPerson.display_name.split(" ")[0]}
              </div>
            )}
            <QuickClaimPopover
              entityId={org.id}
              entityType="org"
              entityName={org.name}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

const BRAND_PREDICATES = ["sponsored_by", "worked_at", "part_of_team"] as const

export default function BrandsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
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

  const allOrgs = useMemo(
    () => myOnly ? catalog.orgs.filter((o) => myOrgIds.has(o.id)) : catalog.orgs,
    [myOnly, catalog.orgs, myOrgIds]
  )

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
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
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

        <div className="space-y-10">
          {Object.entries(grouped).map(([cat, orgs]) => (
            <section key={cat}>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
