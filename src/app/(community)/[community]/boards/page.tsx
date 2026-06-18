"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { boardSlug, orgSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { useBoardImage } from "@/hooks/use-board-image"
import { BrandMark } from "@/components/ui/brand-mark"
import { cn } from "@/lib/utils"
import { CommunityLink } from "@/components/ui/community-link"
import type { Board, Org } from "@/types"

type BrandSort = "count" | "az"
type BoardSort = "newest" | "collected"

// ─── Icons (no emoji on this page) ──────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

// ─── Board cover: the image fallback chain ──────────────────────────────────
// 1. board.image_url (manual)  2. useBoardImage (auto)  3. brand logo (contain)
// 4. greyed BrandMark on a muted field. No emoji. Loading shows a pulse box.
// useBoardImage is a hook, so this is called once per rendered board — never
// in a loop. Brand-index strips render it only for the 2-3 thumbnails shown.

function BoardCover({
  board,
  orgLogoUrl,
  className,
  markSize = 44,
}: {
  board: Board
  orgLogoUrl?: string
  className?: string
  markSize?: number
}) {
  const manualImage = board.image_url
  const autoImage = useBoardImage(board.brand, board.model, board.model_year, board.id)
  const imageUrl = manualImage ?? (autoImage || undefined)
  const loading = !manualImage && autoImage === undefined

  if (imageUrl) {
    return (
      <div className={cn("bg-surface-2 overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={`${board.brand} ${board.model}`} className="w-full h-full object-cover" />
      </div>
    )
  }
  if (loading) {
    return <div className={cn("bg-surface-hover animate-pulse", className)} />
  }
  if (orgLogoUrl) {
    return (
      <div className={cn("bg-surface-2 overflow-hidden flex items-center justify-center p-4", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={orgLogoUrl} alt={board.brand} className="max-w-full max-h-full object-contain opacity-90" />
      </div>
    )
  }
  return (
    <div className={cn("bg-surface-2 flex items-center justify-center", className)}>
      <BrandMark size={markSize} color="var(--muted)" dotColor="var(--muted)" className="opacity-30" />
    </div>
  )
}

// ─── Portrait product tile ──────────────────────────────────────────────────

function BoardTile({
  board,
  orgLogoUrl,
  collectorCount,
  addedByName,
}: {
  board: Board
  orgLogoUrl?: string
  collectorCount: number
  addedByName?: string
}) {
  const isUnverified = board.community_status === "unverified"
  const yearShort = `'${String(board.model_year).slice(2)}`
  const href = `/boards/${boardSlug(board)}`

  return (
    <div>
      {/* Cover + overlaid chrome. The cover wrapper is position:relative with
          z-auto so it never traps the QuickClaim popover (z-50) under a
          neighbouring tile. */}
      <div className="relative">
        <CommunityLink href={href} className="block">
          <BoardCover
            board={board}
            orgLogoUrl={orgLogoUrl}
            className="aspect-[3/4] rounded-xl border border-border-default"
            markSize={48}
          />
        </CommunityLink>
        {isUnverified && (
          <span className="absolute top-2 left-2 text-[10px] text-amber-600 bg-background/80 backdrop-blur-sm border border-amber-500/40 rounded px-1.5 py-0.5 pointer-events-none">
            unverified
          </span>
        )}
        <div className="absolute top-2 right-2">
          <QuickClaimPopover
            entityId={board.id}
            entityType="board"
            entityName={`${board.brand} ${board.model} ${yearShort}`}
          />
        </div>
      </div>

      <CommunityLink href={href} className="block mt-2 group">
        <div className="text-sm font-medium text-foreground truncate group-hover:text-accent-strong transition-colors">
          {board.brand} {board.model}
        </div>
        <div className="text-xs text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="tabular-nums">{yearShort}</span>
          {board.shape && <span className="capitalize">· {board.shape.replace("-", " ")}</span>}
        </div>
        {collectorCount > 0 && (
          <div className="text-[11px] text-muted mt-1">
            {collectorCount} collector{collectorCount !== 1 ? "s" : ""}
          </div>
        )}
        {isUnverified && addedByName && (
          <div className="text-[10px] text-muted mt-1 truncate">Added by {addedByName}</div>
        )}
      </CommunityLink>
    </div>
  )
}

// ─── Brand index card (default landing) ─────────────────────────────────────

function BrandIndexCard({
  brand,
  boards,
  org,
  onOpen,
}: {
  brand: string
  boards: Board[] // newest model year first
  org?: Org
  onOpen: () => void
}) {
  const thumbs = boards.slice(0, 3)
  return (
    <button
      onClick={onOpen}
      className="text-left w-full bg-surface border border-border-default rounded-xl p-3 hover:border-foreground/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="font-semibold text-foreground truncate">{brand}</span>
        <span className="text-[11px] text-muted tabular-nums shrink-0">
          {boards.length} board{boards.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex gap-1.5">
        {thumbs.map((b) => (
          <BoardCover
            key={b.id}
            board={b}
            orgLogoUrl={org?.logo_url}
            className="w-12 h-16 rounded-lg border border-border-default shrink-0"
            markSize={18}
          />
        ))}
      </div>
    </button>
  )
}

// ─── Small shared controls ──────────────────────────────────────────────────

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-border-default rounded-xl px-4 py-3">
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  )
}

function SortToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1 shrink-0 overflow-x-auto scrollbar-none">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0",
            value === v ? "bg-surface-active text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function sortBoards(boards: Board[], sort: BoardSort, counts: Map<string, number>): Board[] {
  if (sort === "collected") {
    return [...boards].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || b.model_year - a.model_year
    )
  }
  return [...boards].sort((a, b) => b.model_year - a.model_year)
}

// ─── Page ────────────────────────────────────────────────────────────────────

function BoardsPageInner() {
  const searchParams = useSearchParams()
  const yearParam = searchParams.get("year")
  const [myOnly, setMyOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState(yearParam ?? "")
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [brandSort, setBrandSort] = useState<BrandSort>("count")
  const [boardSort, setBoardSort] = useState<BoardSort>("newest")
  const { catalog, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

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

  // Distinct owners (owned_board) per board — powers the collector count.
  const boardRiderCounts = useMemo(() => {
    const sets = new Map<string, Set<string>>()
    for (const c of catalog.claims) {
      if (c.predicate !== "owned_board") continue
      if (!sets.has(c.object_id)) sets.set(c.object_id, new Set())
      sets.get(c.object_id)!.add(c.subject_id)
    }
    const counts = new Map<string, number>()
    for (const [id, s] of sets) counts.set(id, s.size)
    return counts
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

  // My Boards scope (no search). Brand index + brand detail derive from this.
  const scopedBoards = useMemo(
    () => (myOnly ? catalog.boards.filter((b) => myBoardIds.has(b.id)) : catalog.boards),
    [myOnly, catalog.boards, myBoardIds]
  )

  // Search results — flat grid across all brands. Same haystack as before.
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
      if (!byBrand.has(b.brand)) byBrand.set(b.brand, [])
      byBrand.get(b.brand)!.push(b)
    })
    const entries = [...byBrand.entries()].map(([brand, boards]) => ({
      brand,
      boards: [...boards].sort((a, b) => b.model_year - a.model_year),
    }))
    if (brandSort === "az") {
      entries.sort((a, b) => a.brand.localeCompare(b.brand))
    } else {
      entries.sort((a, b) => b.boards.length - a.boards.length || a.brand.localeCompare(b.brand))
    }
    return entries
  }, [scopedBoards, brandSort])

  // Boards for the drilled-in brand, sortable, newest model year first by default.
  const brandDetailBoards = useMemo(() => {
    if (!selectedBrand) return []
    const boards = scopedBoards.filter((b) => b.brand === selectedBrand)
    return sortBoards(boards, boardSort, boardRiderCounts)
  }, [scopedBoards, selectedBrand, boardSort, boardRiderCounts])

  const flatBoards = useMemo(
    () => sortBoards(searchResults, boardSort, boardRiderCounts),
    [searchResults, boardSort, boardRiderCounts]
  )

  const renderTile = (board: Board) => (
    <BoardTile
      key={board.id}
      board={board}
      orgLogoUrl={orgByBrand.get(board.brand)?.logo_url}
      collectorCount={boardRiderCounts.get(board.id) ?? 0}
      addedByName={board.added_by ? nameById.get(board.added_by) : undefined}
    />
  )

  const selectedOrg = selectedBrand ? orgByBrand.get(selectedBrand) : undefined
  const catalogEmpty = catalog.boards.length === 0
  const gridClass = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Intro card — community framing */}
        <div className="bg-surface border border-border-default rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-wordmark)" }}>
              The Snowboard Catalog
            </h1>
            <p className="text-sm text-muted mt-1 max-w-md">
              Built together by the community. Add the boards you have ridden and the ones in your collection.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Boards" value={totalBoards} />
              <StatBlock label="Brands" value={totalBrands} />
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-[#1C1917] text-sm font-medium text-white hover:bg-[#292524] transition-all whitespace-nowrap"
            >
              + Add a board
            </button>
          </div>
        </div>

        {/* Search + My Boards */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-0">
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
          {isAuth && (
            <button
              onClick={() => setMyOnly(!myOnly)}
              className={cn(
                "px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border shrink-0 whitespace-nowrap",
                myOnly
                  ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
                  : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              My Boards{myOnly && myBoardIds.size > 0 ? ` · ${myBoardIds.size}` : ""}
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
                {flatBoards.length} result{flatBoards.length !== 1 ? "s" : ""}
              </span>
              {flatBoards.length > 1 && (
                <SortToggle
                  value={boardSort}
                  onChange={setBoardSort}
                  options={[
                    ["newest", "Newest"],
                    ["collected", "Most collected"],
                  ]}
                />
              )}
            </div>
            {flatBoards.length === 0 ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
                No boards match “{search.trim()}”.
              </div>
            ) : (
              <div className={gridClass}>{flatBoards.map(renderTile)}</div>
            )}
          </div>
        ) : selectedBrand ? (
          /* ── Brand detail ── */
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <button
                  onClick={() => setSelectedBrand(null)}
                  className="inline-flex items-center gap-1 text-muted hover:text-foreground transition-colors shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Boards
                </button>
                <span className="text-muted shrink-0">/</span>
                {selectedOrg ? (
                  <CommunityLink
                    href={`/brands/${orgSlug(selectedOrg)}`}
                    className="font-semibold text-foreground hover:text-accent-strong transition-colors truncate"
                  >
                    {selectedBrand}
                  </CommunityLink>
                ) : (
                  <span className="font-semibold text-foreground truncate">{selectedBrand}</span>
                )}
              </div>
              {brandDetailBoards.length > 1 && (
                <SortToggle
                  value={boardSort}
                  onChange={setBoardSort}
                  options={[
                    ["newest", "Newest"],
                    ["collected", "Most collected"],
                  ]}
                />
              )}
            </div>
            {brandDetailBoards.length === 0 ? (
              <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
                No boards in this brand for this view.
              </div>
            ) : (
              <div className={gridClass}>{brandDetailBoards.map(renderTile)}</div>
            )}
          </div>
        ) : (
          /* ── Brand index (default landing) ── */
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-sm text-muted">
                {brandIndex.length} brand{brandIndex.length !== 1 ? "s" : ""}
              </span>
              {brandIndex.length > 1 && (
                <SortToggle
                  value={brandSort}
                  onChange={setBrandSort}
                  options={[
                    ["count", "Most boards"],
                    ["az", "A–Z"],
                  ]}
                />
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
                    org={orgByBrand.get(brand)}
                    onOpen={() => setSelectedBrand(brand)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {addOpen && (
        <AddEntityModal entityType="board" onClose={() => setAddOpen(false)} onAdded={() => setAddOpen(false)} />
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
