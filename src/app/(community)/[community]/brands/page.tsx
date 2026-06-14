"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { CommunityLink } from "@/components/ui/community-link"
import { Nav } from "@/components/ui/nav"
import { orgSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
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

type BrandSort = "entries" | "category" | "az"

const SORT_OPTIONS: { key: BrandSort; label: string; title: string }[] = [
  { key: "entries",  label: "Most connections", title: "Sort by riders, events & locations" },
  { key: "category", label: "Category",         title: "Group by category" },
  { key: "az",       label: "A-Z",              title: "Sort alphabetically" },
]

// Connection counts per org. `total` includes boards (shown on the card per request);
// `rel` = relationship connections (people + events + places) drives the default ranking,
// so brands with large board catalogs don't dominate over brands with real connections.
type ConnCounts = { people: number; boards: number; events: number; places: number; total: number; rel: number }
const EMPTY_CONN: ConnCounts = { people: 0, boards: 0, events: 0, places: 0, total: 0, rel: 0 }

function OrgCard({ org, conn }: { org: Org; conn: ConnCounts }) {
  const initial = org.name[0].toUpperCase()
  const isUnverified = org.community_status === "unverified"

  // Breakdown of the connection total (only non-zero parts), e.g. "1 rider · 9 events"
  const parts: string[] = []
  if (conn.people > 0) parts.push(`${conn.people} rider${conn.people !== 1 ? "s" : ""}`)
  if (conn.boards > 0) parts.push(`${conn.boards} board${conn.boards !== 1 ? "s" : ""}`)
  if (conn.events > 0) parts.push(`${conn.events} event${conn.events !== 1 ? "s" : ""}`)
  if (conn.places > 0) parts.push(`${conn.places} location${conn.places !== 1 ? "s" : ""}`)

  return (
    <div className="flex items-center gap-2">
      <CommunityLink href={`/brands/${orgSlug(org)}`} className="flex-1 min-w-0 block">
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
            {conn.total > 0 && (
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-foreground">{conn.total}</div>
                <div className="text-[10px] text-muted">connection{conn.total !== 1 ? "s" : ""}</div>
                {parts.length > 0 && (
                  <div className="text-[10px] text-muted mt-0.5">{parts.join(" · ")}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </CommunityLink>
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
  const [sort, setSort] = useState<BrandSort>("entries")
  const { catalog, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  // Connection counts per org, mirroring the brand detail page:
  //  people  = unique subjects of sponsored_by / worked_at / part_of_team claims (org is object)
  //  boards  = board models whose brand name matches the org
  //  events  = organized claims + events/series linked via brand_ids (deduped)
  //  places  = located_at claims (org is subject)
  const connCounts = useMemo(() => {
    const m = new Map<string, ConnCounts>()
    for (const org of catalog.orgs) {
      const people = new Set(
        catalog.claims
          .filter(
            (c) =>
              c.object_id === org.id &&
              c.object_type === "org" &&
              (c.predicate === "sponsored_by" || c.predicate === "worked_at" || c.predicate === "part_of_team")
          )
          .map((c) => c.subject_id)
      ).size

      const full = org.name.toLowerCase()
      const first = org.name.split(" ")[0].toLowerCase()
      const boards = catalog.boards.filter((b) => {
        const bn = b.brand.toLowerCase()
        return bn === full || bn === first
      }).length

      const organizedIds = new Set(
        catalog.claims.filter((c) => c.subject_id === org.id && c.predicate === "organized").map((c) => c.object_id)
      )
      const extraEvents = catalog.events.filter((e) => e.brand_ids?.includes(org.id) && !organizedIds.has(e.id)).length
      const series = catalog.eventSeries.filter((s) => s.brand_ids?.includes(org.id)).length
      const events = organizedIds.size + extraEvents + series

      const places = catalog.claims.filter((c) => c.subject_id === org.id && c.predicate === "located_at").length

      m.set(org.id, {
        people,
        boards,
        events,
        places,
        total: people + boards + events + places,
        rel: people + events + places,
      })
    }
    return m
  }, [catalog.claims, catalog.boards, catalog.events, catalog.eventSeries, catalog.orgs])

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
  const shops = allOrgs.filter((o) => o.org_type === "shop")
  // event-series orgs are intentionally not surfaced here: they belong to the
  // Events surface, not the Brands list. Anything in neither bucket (brand /
  // magazine / team / shop) is excluded by design, and the header count below
  // counts only what renders so the two never diverge (BUG-027).

  // Group brands by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Org[]>>((acc, cat) => {
    const items = brandOrgs.filter((o) => (o.brand_category ?? "other") === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})
  const uncategorized = brandOrgs.filter((o) => !o.brand_category || !CATEGORY_ORDER.includes(o.brand_category))
  if (uncategorized.length > 0) grouped["other"] = [...(grouped["other"] ?? []), ...uncategorized]

  // Flat-list comparator. "Most connections" ranks by relationship connections
  // (people + events + places) so big board catalogs don't dominate; ties break on name.
  const conn = (id: string) => connCounts.get(id) ?? EMPTY_CONN
  const cmp = (a: Org, b: Org) =>
    sort === "entries"
      ? conn(b.id).rel - conn(a.id).rel || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name)
  const sortedBrands = [...brandOrgs].sort(cmp)
  const sortedTeams = [...teams].sort(cmp)
  const sortedShops = [...shops].sort(cmp)

  // Count the displayed set (brands + teams + shops), not allOrgs, so the
  // header number matches the cards on screen (BUG-027 / cf. BUG-019).
  const totalBrands = brandOrgs.length + teams.length + shops.length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Brands & Orgs</h1>
            <p className="text-sm text-muted">
              {totalBrands} brands, media outlets, and collectives in the community
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAuth && (
              <button
                onClick={() => setMyOnly(!myOnly)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                  myOnly
                    ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
                    : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
                )}
              >
                My Brands{myOnly && myOrgIds.size > 0 ? ` · ${myOrgIds.size}` : ""}
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#1C1917] text-sm font-medium text-white hover:bg-[#292524] transition-all"
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

        {/* Sort control */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1">
            {SORT_OPTIONS.map(({ key, label, title }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                title={title}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  sort === key
                    ? "bg-surface-active text-foreground"
                    : "text-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          {sort === "category" ? (
            Object.entries(grouped).map(([cat, orgs]) => (
              <section key={cat}>
                <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                <div className="space-y-2">
                  {orgs.map((org) => (
                    <OrgCard key={org.id} org={org} conn={conn(org.id)} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="space-y-2">
              {sortedBrands.map((org) => (
                <OrgCard key={org.id} org={org} conn={conn(org.id)} />
              ))}
            </div>
          )}

          {sortedTeams.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
                Teams & Collectives
              </h2>
              <div className="space-y-2">
                {sortedTeams.map((org) => (
                  <OrgCard key={org.id} org={org} conn={conn(org.id)} />
                ))}
              </div>
            </section>
          )}

          {sortedShops.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
                Shops & Retailers
              </h2>
              <div className="space-y-2">
                {sortedShops.map((org) => (
                  <OrgCard key={org.id} org={org} conn={conn(org.id)} />
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
