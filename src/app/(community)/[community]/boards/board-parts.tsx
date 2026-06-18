"use client"

// Presentational + helper module for the /boards catalog page. Kept beside the
// page so the page file stays focused on state, navigation, and layout. All
// pieces here are pure-ish: they take data via props and read only leaf concerns
// (useBoardImage for a cover, the store for the claim affordance).

import { useState, useRef, useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { useBoardImage } from "@/hooks/use-board-image"
import { BrandMark } from "@/components/ui/brand-mark"
import { BoardRelationshipToggles } from "@/components/ui/board-relationship-toggles"
import { boardSlug } from "@/lib/mock-data"
import { toBoardRelationship, boardRelationshipBadges } from "@/lib/board-relationship"
import { cn } from "@/lib/utils"
import { CommunityLink } from "@/components/ui/community-link"
import type { Board } from "@/types"

// ─── Shared types ────────────────────────────────────────────────────────────

export type BoardSort =
  | "newest"
  | "oldest"
  | "mostRode"
  | "leastRode"
  | "mostOwned"
  | "leastOwned"
export type ViewMode = "card" | "list"
export type BrandSort = "count" | "az"

export type BoardCounts = { rode: Map<string, number>; own: Map<string, number> }

// ─── Sorting + decade grouping ───────────────────────────────────────────────

export function sortBoards(boards: Board[], sort: BoardSort, counts: BoardCounts): Board[] {
  const r = (b: Board) => counts.rode.get(b.id) ?? 0
  const o = (b: Board) => counts.own.get(b.id) ?? 0
  const arr = [...boards]
  switch (sort) {
    case "oldest":
      return arr.sort((a, b) => a.model_year - b.model_year || a.brand.localeCompare(b.brand))
    case "mostRode":
      return arr.sort((a, b) => r(b) - r(a) || b.model_year - a.model_year)
    case "leastRode":
      return arr.sort((a, b) => r(a) - r(b) || b.model_year - a.model_year)
    case "mostOwned":
      return arr.sort((a, b) => o(b) - o(a) || b.model_year - a.model_year)
    case "leastOwned":
      return arr.sort((a, b) => o(a) - o(b) || b.model_year - a.model_year)
    case "newest":
    default:
      return arr.sort((a, b) => b.model_year - a.model_year || a.brand.localeCompare(b.brand))
  }
}

/** Decade dividers only make sense for the chronological sorts. */
export function isChronoSort(sort: BoardSort): boolean {
  return sort === "newest" || sort === "oldest"
}

/** Group an already-sorted board list into decade sections, ordered to match. */
export function groupByDecade(boards: Board[], ascending: boolean): { decade: number; label: string; boards: Board[] }[] {
  const map = new Map<number, Board[]>()
  for (const b of boards) {
    const d = Math.floor(b.model_year / 10) * 10
    const bucket = map.get(d)
    if (bucket) bucket.push(b)
    else map.set(d, [b])
  }
  const decades = [...map.keys()].sort((a, b) => (ascending ? a - b : b - a))
  return decades.map((d) => ({ decade: d, label: `${d}s`, boards: map.get(d)! }))
}

function countParts(rode: number, own: number): string | null {
  const parts: string[] = []
  if (rode > 0) parts.push(`${rode} rode`)
  if (own > 0) parts.push(`${own} own`)
  return parts.length ? parts.join(" · ") : null
}

// ─── Icons (no emoji on this page) ──────────────────────────────────────────

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

// ─── Board cover: the image fallback chain ──────────────────────────────────
// 1. board.image_url (manual)  2. useBoardImage (auto)  3. brand logo (contain)
// 4. greyed BrandMark on a muted field. No emoji. Loading shows a pulse box.
// useBoardImage is a hook, so this is called once per rendered board.

export function BoardCover({
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

// ─── Board actions menu: the tile / row "+" affordance ──────────────────────
// Always offers "View board page". When signed in and the board is not yet on
// the user's timeline, it offers the Rode it / In my collection toggles and
// writes an owned_board claim with the matching board_relationship. When it is
// already on the timeline, it shows the current marks and links to the board
// page to manage (edit lives there, on the shelf).

function generateClaimId() {
  return `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function BoardActionsMenu({ board, align = "right" }: { board: Board; align?: "right" | "left" }) {
  const { activePersonId, addClaim, catalog, sessionClaims, dbClaims, addToast } = useLineageStore()
  const [open, setOpen] = useState(false)
  const [rode, setRode] = useState(true)
  const [own, setOwn] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const allClaims = [...catalog.claims, ...sessionClaims, ...dbClaims]
  const existing = allClaims.find(
    (c) => c.subject_id === activePersonId && c.object_id === board.id && c.predicate === "owned_board"
  )
  const claimed = !!existing || justAdded
  const badges = existing ? boardRelationshipBadges(existing.board_relationship) : justAdded ? boardRelationshipBadges(toBoardRelationship(rode, own)) : []

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const href = `/boards/${boardSlug(board)}`
  const isAuth = !!activePersonId

  function handleAdd() {
    const rel = toBoardRelationship(rode, own)
    if (!rel || !activePersonId) return
    addClaim({
      id: generateClaimId(),
      subject_id: activePersonId,
      subject_type: "person",
      predicate: "owned_board",
      object_id: board.id,
      object_type: "board",
      board_relationship: rel,
      confidence: "self-reported",
      visibility: "public",
      asserted_by: activePersonId,
      created_at: new Date().toISOString(),
    })
    setJustAdded(true)
    addToast(rel === "own" ? "Added to your collection." : "Added to your timeline.", "info")
    setTimeout(() => setOpen(false), 600)
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        title={claimed ? "On your timeline" : "Add to your timeline"}
        aria-label={claimed ? "On your timeline" : "Add to your timeline"}
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all border",
          claimed
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500"
            : open
              ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
              : "bg-background/80 backdrop-blur-sm border-border-default text-muted hover:border-accent hover:text-accent"
        )}
      >
        {claimed ? "✓" : "+"}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-9 z-50 w-56 bg-surface border border-border-default rounded-xl shadow-xl p-3",
            align === "right" ? "right-0" : "left-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium text-foreground mb-2 truncate">
            {board.brand} {board.model}
          </div>

          {isAuth && !claimed && (
            <>
              <BoardRelationshipToggles size="sm" rode={rode} own={own} onChange={({ rode, own }) => { setRode(rode); setOwn(own) }} />
              <button
                onClick={handleAdd}
                disabled={!rode && !own}
                className={cn(
                  "w-full mt-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  rode || own ? "bg-[#1C1917] text-white hover:bg-[#292524]" : "bg-surface-hover text-muted cursor-not-allowed"
                )}
              >
                Add to timeline
              </button>
            </>
          )}

          {isAuth && claimed && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {badges.map((b) => (
                  <span key={b} className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800/40">
                    {b}
                  </span>
                ))}
                <span className="text-[11px] text-emerald-500">on your timeline</span>
              </div>
            </div>
          )}

          <CommunityLink
            href={href}
            className="mt-2 block text-center text-xs text-accent-strong hover:underline"
          >
            View board page →
          </CommunityLink>
        </div>
      )}
    </div>
  )
}

// ─── Portrait product tile (card view) ──────────────────────────────────────

export function BoardTile({
  board,
  orgLogoUrl,
  rodeCount,
  ownCount,
  addedByName,
}: {
  board: Board
  orgLogoUrl?: string
  rodeCount: number
  ownCount: number
  addedByName?: string
}) {
  const isUnverified = board.community_status === "unverified"
  const yearShort = `'${String(board.model_year).slice(2)}`
  const href = `/boards/${boardSlug(board)}`
  const counts = countParts(rodeCount, ownCount)

  return (
    <div>
      <div className="relative">
        <CommunityLink href={href} className="block">
          <BoardCover board={board} orgLogoUrl={orgLogoUrl} className="aspect-[3/4] rounded-xl border border-border-default" markSize={48} />
        </CommunityLink>
        {isUnverified && (
          <span className="absolute top-2 left-2 text-[10px] text-amber-600 bg-background/80 backdrop-blur-sm border border-amber-500/40 rounded px-1.5 py-0.5 pointer-events-none">
            unverified
          </span>
        )}
        <div className="absolute top-2 right-2">
          <BoardActionsMenu board={board} align="right" />
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
        {counts && <div className="text-[11px] text-muted mt-1">{counts}</div>}
        {isUnverified && addedByName && (
          <div className="text-[10px] text-muted mt-1 truncate">Added by {addedByName}</div>
        )}
      </CommunityLink>
    </div>
  )
}

// ─── Compact row (list view) ────────────────────────────────────────────────

export function BoardListRow({
  board,
  orgLogoUrl,
  rodeCount,
  ownCount,
  addedByName,
}: {
  board: Board
  orgLogoUrl?: string
  rodeCount: number
  ownCount: number
  addedByName?: string
}) {
  const isUnverified = board.community_status === "unverified"
  const yearShort = `'${String(board.model_year).slice(2)}`
  const href = `/boards/${boardSlug(board)}`
  const counts = countParts(rodeCount, ownCount)

  return (
    <div className="flex items-center gap-3 py-2.5">
      <CommunityLink href={href} className="flex items-center gap-3 min-w-0 flex-1 group">
        <BoardCover board={board} orgLogoUrl={orgLogoUrl} className="w-11 h-14 rounded-lg border border-border-default shrink-0" markSize={18} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate group-hover:text-accent-strong transition-colors">
              {board.brand} {board.model}
            </span>
            {isUnverified && (
              <span className="text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5">unverified</span>
            )}
          </div>
          <div className="text-xs text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="tabular-nums">{yearShort}</span>
            {board.shape && <span className="capitalize">· {board.shape.replace("-", " ")}</span>}
            {counts && <span>· {counts}</span>}
            {isUnverified && addedByName && <span className="truncate">· Added by {addedByName}</span>}
          </div>
        </div>
      </CommunityLink>
      <BoardActionsMenu board={board} align="right" />
    </div>
  )
}

// ─── Brand index card ────────────────────────────────────────────────────────

export function BrandIndexCard({
  brand,
  boards,
  orgLogoUrl,
  onOpen,
}: {
  brand: string
  boards: Board[] // newest model year first
  orgLogoUrl?: string
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
          <BoardCover key={b.id} board={b} orgLogoUrl={orgLogoUrl} className="w-12 h-16 rounded-lg border border-border-default shrink-0" markSize={18} />
        ))}
      </div>
    </button>
  )
}

// ─── Small controls ──────────────────────────────────────────────────────────

export function StatButton({ label, value, active, onClick }: { label: string; value: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left bg-surface border rounded-xl px-4 py-3 transition-colors",
        active ? "border-foreground/40" : "border-border-default hover:border-foreground/30"
      )}
    >
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </button>
  )
}

const BOARD_SORT_OPTIONS: [BoardSort, string][] = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["mostRode", "Most rode"],
  ["leastRode", "Least rode"],
  ["mostOwned", "Most owned"],
  ["leastOwned", "Least owned"],
]

export function BoardSortSelect({ value, onChange }: { value: BoardSort; onChange: (v: BoardSort) => void }) {
  return (
    <label className="relative inline-flex items-center shrink-0">
      <span className="sr-only">Sort boards</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BoardSort)}
        className="appearance-none bg-surface border border-border-default rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-accent cursor-pointer"
      >
        {BOARD_SORT_OPTIONS.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 w-3 h-3 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  )
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: [ViewMode, string][] = [
    ["card", "Card view"],
    ["list", "List view"],
  ]
  return (
    <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1 shrink-0">
      {opts.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={label}
          aria-label={label}
          aria-pressed={value === v}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-all",
            value === v ? "bg-surface-active text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          {v === "card" ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

export function DecadeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 h-px bg-surface-active" />
    </div>
  )
}
