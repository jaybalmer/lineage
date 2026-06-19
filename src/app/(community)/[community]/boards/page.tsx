"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { orgSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { boardRelationshipFlags } from "@/lib/board-relationship"
import { cn } from "@/lib/utils"
import { CommunityLink } from "@/components/ui/community-link"
import type { Board, Org } from "@/types"
import {
  BoardTile,
  BoardListRow,
  BrandIndexCard,
  StatButton,
  BoardSortSelect,
  ViewToggle,
  DecadeDivider,
  SearchIcon,
  ChevronLeft,
  sortBoards,
  groupByDecade,
  isChronoSort,
  type BoardSort,
  type BrandSort,
  type ViewMode,
  type BoardCounts,
} from "./board-parts"

const GRID_CLASS = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function BoardsPageInner() {
  const searchParams = useSearchParams()
  const yearParam = searchParams.get("year")

  const [level, setLevel] = useState<"brands" | "all">("brands")
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [search, setSearch] = useState(yearParam ?? "")
  const [myOnly, setMyOnly] = useState(false)
  const [brandSort, setBrandSort] = useState<BrandSort>("count")
  const [boardSort, setBoardSort] = useState<BoardSort>("newest")
  const [viewMode, setViewMode] = useState<ViewMode>("card")
  const [addOpen, setAddOpen] = useState(false)
  const [addBrandOpen, setAddBrandOpen] = useState(false)

  const { catalog, activePersonId, communities, activeCommunitySlug } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  // Fresh map of board_id -> community-added image URL, loaded once per page
  // mount (not localStorage-cached), so an image added on a board page surfaces
  // here on the next load and is never masked by a stale "no image" probe cache.
  const [communityBoardImages, setCommunityBoardImages] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    fetch("/api/board-image/list")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const m = new Map<string, string>()
        for (const [id, url] of Object.entries((d?.images ?? {}) as Record<string, string>)) m.set(id, url)
        setCommunityBoardImages(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const community = communities.find((c) => c.slug === activeCommunitySlug)
  const bannerUrl = community?.boards_banner_url

  // Display totals for the intro card — always the full catalog, never filtered.
  const totalBoards = catalog.boards.length
  const totalBrands = useMemo(() => new Set(catalog.boards.map((b) => b.brand)).size, [catalog.boards])

  // IDs of boards the active user owns.
  const myBoardIds = useMemo(() => {
    if (!activePersonId) return new Set<string>()
    return new Set(
      catalog.claims
        .filter((c) => c.subject_id === activePersonId && c.predicate === "owned_board")
        .map((c) => c.object_id)
    )
  }, [activePersonId, catalog.claims])

  // Distinct riders / owners per board, split by board_relationship. Powers the
  // rode/own counts on the tiles and the most/least rode/owned sorts.
  const counts: BoardCounts = useMemo(() => {
    const rode = new Map<string, Set<string>>()
    const own = new Map<string, Set<string>>()
    const any = new Map<string, Set<string>>()
    const bump = (m: Map<string, Set<string>>, k: string, v: string) => {
      let s = m.get(k)
      if (!s) {
        s = new Set()
        m.set(k, s)
      }
      s.add(v)
    }
    for (const c of catalog.claims) {
      if (c.predicate !== "owned_board") continue
      const f = boardRelationshipFlags(c.board_relationship)
      bump(any, c.object_id, c.subject_id)
      if (f.rode) bump(rode, c.object_id, c.subject_id)
      if (f.own) bump(own, c.object_id, c.subject_id)
    }
    const toCount = (m: Map<string, Set<string>>) => {
      const r = new Map<string, number>()
      for (const [k, v] of m) r.set(k, v.size)
      return r
    }
    return { rode: toCount(rode), own: toCount(own), any: toCount(any) }
  }, [catalog.claims])

  // Display name lookup for unverified "Added by" attribution.
  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    catalog.people.forEach((p) => m.set(p.id, p.display_name))
    return m
  }, [catalog.people])

  // Brand → org match (lowercased exact-or-prefix), precomputed once per brand.
  const orgByBrand = useMemo(() => {
    const map = new Map<string, Org>()
    const brands = new Set(catalog.boards.map((b) => b.brand))
    brands.forEach((brand) => {
      const org = catalog.orgs.find(
        (o) =>
          o.name.toLowerCase() === brand.toLowerCase() ||
          o.name.toLowerCase().startsWith(brand.toLowerCase() + " ")
      )
      if (org) map.set(brand, org)
    })
    return map
  }, [catalog.boards, catalog.orgs])

  // My Boards scope (no search). All listings derive from this.
  const scopedBoards = useMemo(
    () => (myOnly ? catalog.boards.filter((b) => myBoardIds.has(b.id)) : catalog.boards),
    [myOnly, catalog.boards, myBoardIds]
  )

  const searchActive = search.trim().length > 0
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scopedBoards
    return scopedBoards.filter((b) => {
      const haystack = [b.brand, b.model, String(b.model_year), b.shape ?? ""].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [scopedBoards, search])

  // Brand index entries (default level).
  const brandIndex = useMemo(() => {
    const byBrand = new Map<string, Board[]>()
    scopedBoards.forEach((b) => {
      const bucket = byBrand.get(b.brand)
      if (bucket) bucket.push(b)
      else byBrand.set(b.brand, [b])
    })
    const entries = [...byBrand.entries()].map(([brand, boards]) => ({
      brand,
      boards: [...boards].sort((a, b) => b.model_year - a.model_year),
    }))
    if (brandSort === "az") entries.sort((a, b) => a.brand.localeCompare(b.brand))
    else entries.sort((a, b) => b.boards.length - a.boards.length || a.brand.localeCompare(b.brand))
    return entries
  }, [scopedBoards, brandSort])

  // Years available within the drilled-in brand (for the breadcrumb year filter).
  const brandYears = useMemo(() => {
    if (!selectedBrand) return []
    return [...new Set(scopedBoards.filter((b) => b.brand === selectedBrand).map((b) => b.model_year))].sort(
      (a, b) => b - a
    )
  }, [scopedBoards, selectedBrand])

  // Sorted board lists per view.
  const flatSearch = useMemo(() => sortBoards(searchResults, boardSort, counts), [searchResults, boardSort, counts])
  const allSorted = useMemo(() => sortBoards(scopedBoards, boardSort, counts), [scopedBoards, boardSort, counts])
  const brandBoards = useMemo(() => {
    if (!selectedBrand) return []
    let bs = scopedBoards.filter((b) => b.brand === selectedBrand)
    if (selectedYear != null) bs = bs.filter((b) => b.model_year === selectedYear)
    return sortBoards(bs, boardSort, counts)
  }, [scopedBoards, selectedBrand, selectedYear, boardSort, counts])

  // Navigation. Level clicks clear search so the chosen level is authoritative.
  const goBrands = () => { setLevel("brands"); setSelectedBrand(null); setSelectedYear(null); setSearch("") }
  const goAll = () => { setLevel("all"); setSelectedBrand(null); setSelectedYear(null); setSearch("") }
  const openBrand = (brand: string) => { setLevel("brands"); setSelectedBrand(brand); setSelectedYear(null) }
  const backToBrands = () => { setSelectedBrand(null); setSelectedYear(null) }

  const selectedOrg = selectedBrand ? orgByBrand.get(selectedBrand) : undefined
  const catalogEmpty = catalog.boards.length === 0

  // Per-board props shared by card + list renderers.
  const boardProps = (board: Board) => ({
    board,
    orgLogoUrl: orgByBrand.get(board.brand)?.logo_url,
    imageOverride: communityBoardImages.get(board.id),
    rodeCount: counts.rode.get(board.id) ?? 0,
    ownCount: counts.own.get(board.id) ?? 0,
    addedByName: board.added_by ? nameById.get(board.added_by) : undefined,
  })

  const renderBoardGrid = (boards: Board[]) =>
    viewMode === "card" ? (
      <div className={GRID_CLASS}>
        {boards.map((b) => (
          <BoardTile key={b.id} {...boardProps(b)} />
        ))}
      </div>
    ) : (
      <div className="divide-y divide-border-default">
        {boards.map((b) => (
          <BoardListRow key={b.id} {...boardProps(b)} />
        ))}
      </div>
    )

  // Decade dividers when sorted chronologically (and not a single-year view).
  const renderBoards = (boards: Board[], allowDecades: boolean) => {
    if (!(allowDecades && isChronoSort(boardSort))) return renderBoardGrid(boards)
    const sections = groupByDecade(boards, boardSort === "oldest")
    return (
      <div className="space-y-8">
        {sections.map((s) => (
          <div key={s.decade}>
            <DecadeDivider label={s.label} />
            {renderBoardGrid(s.boards)}
          </div>
        ))}
      </div>
    )
  }

  const listingControls = (count: number) =>
    count > 1 ? (
      <div className="flex items-center gap-2 shrink-0">
        <BoardSortSelect value={boardSort} onChange={setBoardSort} />
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
    ) : null

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Admin-set boards-page banner band (optional) */}
      {bannerUrl && (
        <div className="w-full relative h-36 sm:h-44 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.30) 100%)" }}
          />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Intro card */}
        <div className="bg-surface border border-border-default rounded-xl p-5 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-wordmark)" }}>
              The Snowboard Catalog
            </h1>
            <p className="text-sm text-muted mt-1 max-w-md">
              Built together by the community. {totalBoards.toLocaleString()} boards across{" "}
              {totalBrands.toLocaleString()} brands mapped so far — help us catalog every board ever ridden.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <StatButton label="Boards" value={totalBoards} active={level === "all" && !searchActive} onClick={goAll} />
              <StatButton label="Brands" value={totalBrands} active={level === "brands" && !searchActive} onClick={goBrands} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-[#1C1917] text-sm font-medium text-white hover:bg-[#292524] transition-all whitespace-nowrap"
              >
                + Add a board
              </button>
              <button
                onClick={() => setAddBrandOpen(true)}
                className="px-4 py-2.5 rounded-lg border border-border-default text-sm font-medium text-foreground hover:bg-surface-hover transition-all whitespace-nowrap"
              >
                + Add a brand
              </button>
            </div>
          </div>
        </div>

        {/* Level switch + My Boards */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1">
            {([
              ["brands", "Brands"],
              ["all", "All boards"],
            ] as const).map(([v, label]) => {
              const active = !searchActive && level === v
              return (
                <button
                  key={v}
                  onClick={() => (v === "brands" ? goBrands() : goAll())}
                  className={cn(
                    "px-3.5 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                    active ? "bg-surface-active text-foreground" : "text-muted hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {isAuth && (
            <button
              onClick={() => setMyOnly(!myOnly)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors border shrink-0 whitespace-nowrap",
                myOnly
                  ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
                  : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              My Boards{myOnly && myBoardIds.size > 0 ? ` · ${myBoardIds.size}` : ""}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by brand, model, or year"
            className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-lg leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        {catalogEmpty ? (
          <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
            No boards yet.{" "}
            <button onClick={() => setAddOpen(true)} className="text-accent-strong hover:underline">
              Add one.
            </button>
          </div>
        ) : searchActive ? (
          /* ── Flat search grid across all brands ── */
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-sm text-muted">
                {flatSearch.length} result{flatSearch.length !== 1 ? "s" : ""}
              </span>
              {listingControls(flatSearch.length)}
            </div>
            {flatSearch.length === 0 ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
                No boards match “{search.trim()}”.
              </div>
            ) : (
              renderBoards(flatSearch, true)
            )}
          </div>
        ) : level === "brands" && selectedBrand ? (
          /* ── Brand detail ── */
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              {/* Breadcrumb: Boards / Brand / year filter */}
              <div className="flex items-center gap-2 text-sm min-w-0 flex-wrap">
                <button
                  onClick={backToBrands}
                  className="inline-flex items-center gap-1 text-muted hover:text-foreground transition-colors shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Boards
                </button>
                <span className="text-muted shrink-0">/</span>
                <span className="font-semibold text-foreground truncate">{selectedBrand}</span>
                <span className="text-muted shrink-0">/</span>
                <label className="relative inline-flex items-center shrink-0">
                  <span className="sr-only">Filter by year</span>
                  <select
                    value={selectedYear ?? ""}
                    onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                    className="appearance-none bg-surface border border-border-default rounded-lg pl-2.5 pr-7 py-1 text-sm font-medium text-foreground focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">All time</option>
                    {brandYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 w-3 h-3 text-muted" />
                </label>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedOrg && (
                  <CommunityLink
                    href={`/brands/${orgSlug(selectedOrg)}`}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-border-default text-xs font-medium text-foreground hover:bg-surface-hover hover:border-foreground/30 transition-colors whitespace-nowrap"
                  >
                    View brand page →
                  </CommunityLink>
                )}
                {listingControls(brandBoards.length)}
              </div>
            </div>
            {brandBoards.length === 0 ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
                No boards in this brand for this view.
              </div>
            ) : (
              renderBoards(brandBoards, selectedYear == null)
            )}
          </div>
        ) : level === "brands" ? (
          /* ── Brand index (default landing) ── */
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-sm text-muted">
                {brandIndex.length} brand{brandIndex.length !== 1 ? "s" : ""}
              </span>
              {brandIndex.length > 1 && (
                <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1 shrink-0">
                  {([
                    ["count", "Most boards"],
                    ["az", "A–Z"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setBrandSort(v)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                        brandSort === v ? "bg-surface-active text-foreground" : "text-muted hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {brandIndex.length === 0 ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
                {myOnly ? "You have not added any boards yet." : "No boards yet."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {brandIndex.map(({ brand, boards }) => (
                  <BrandIndexCard
                    key={brand}
                    brand={brand}
                    boards={boards}
                    orgLogoUrl={orgByBrand.get(brand)?.logo_url}
                    communityImages={communityBoardImages}
                    riderCounts={counts.any}
                    onOpen={() => openBrand(brand)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── All boards (flat) ── */
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-sm text-muted">
                {allSorted.length} board{allSorted.length !== 1 ? "s" : ""}
              </span>
              {listingControls(allSorted.length)}
            </div>
            {allSorted.length === 0 ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
                {myOnly ? "You have not added any boards yet." : "No boards yet."}
              </div>
            ) : (
              renderBoards(allSorted, true)
            )}
          </div>
        )}
      </div>

      {addOpen && (
        <AddEntityModal entityType="board" onClose={() => setAddOpen(false)} onAdded={() => setAddOpen(false)} />
      )}
      {addBrandOpen && (
        <AddEntityModal
          entityType="org"
          initialOrgType="brand"
          onClose={() => setAddBrandOpen(false)}
          onAdded={() => setAddBrandOpen(false)}
        />
      )}
    </div>
  )
}

export default function BoardsPage() {
  return (
    <Suspense>
      <BoardsPageInner />
    </Suspense>
  )
}
