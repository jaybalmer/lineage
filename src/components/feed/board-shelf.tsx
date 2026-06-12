"use client"

import { useMemo, useState } from "react"
import type { Claim, Board, BoardRelationship } from "@/types"
import { useLineageStore } from "@/store/lineage-store"
import { useBoardImage } from "@/hooks/use-board-image"
import { CommunityLink } from "@/components/ui/community-link"
import { boardSlug } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { BoardRelationshipToggles } from "@/components/ui/board-relationship-toggles"
import {
  type BoardShelfFilter,
  toBoardRelationship,
  boardRelationshipFlags,
  normalizeBoardRelationship,
  mergeBoardRelationships,
  matchesBoardFilter,
  boardRelationshipBadges,
  boardYearLabel,
} from "@/lib/board-relationship"

// One row per distinct board. Multiple owned_board claims for the same board (a
// transient state the upsert path can briefly produce on another device) collapse
// into a single representative claim with the merged relationship.
type ShelfRow = {
  claim: Claim
  board: Board | undefined
  relationship: BoardRelationship
  year: string | undefined
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────

function BoardThumb({ imageUrl, loading, brand }: { imageUrl?: string; loading?: boolean; brand: string }) {
  if (imageUrl) {
    return (
      <div className="w-12 h-16 rounded-lg overflow-hidden border border-border-default flex-shrink-0 bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={brand} className="w-full h-full object-cover" />
      </div>
    )
  }
  if (loading) {
    return <div className="w-12 h-16 rounded-lg border border-border-default flex-shrink-0 bg-surface-hover animate-pulse" />
  }
  return (
    <div
      className="w-12 h-16 rounded-lg border border-emerald-800/40 flex-shrink-0 flex items-center justify-center"
      style={{ background: "linear-gradient(160deg,#052e16,#022c22)" }}
    >
      <span className="text-emerald-300 font-bold text-lg">{brand[0]?.toUpperCase() ?? "?"}</span>
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function BoardShelfRow({ row, isOwn, readOnly }: { row: ShelfRow; isOwn?: boolean; readOnly?: boolean }) {
  const { removeClaim, updateClaim } = useLineageStore()
  const board = row.board

  const manualImage = board?.image_url
  const autoImage = useBoardImage(board?.brand, board?.model, board?.model_year, board?.id)
  const imageUrl = manualImage ?? (autoImage || undefined)
  const imageLoading = !!board && !manualImage && autoImage === undefined

  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  const flags = boardRelationshipFlags(row.relationship)
  const [editRode, setEditRode] = useState(flags.rode)
  const [editOwn, setEditOwn] = useState(flags.own)
  const [editYear, setEditYear] = useState(row.year ?? "")

  const brand = board?.brand ?? "Board"
  const model = board?.model ?? ""
  const yearShort = board?.model_year ? `'${String(board.model_year).slice(2)}` : ""
  const badges = boardRelationshipBadges(row.relationship)

  const startEditing = () => {
    setEditRode(flags.rode)
    setEditOwn(flags.own)
    setEditYear(row.year ?? "")
    setEditing(true)
    setMenuOpen(false)
  }

  const saveEdit = () => {
    const rel = toBoardRelationship(editRode, editOwn)
    if (!rel) return
    updateClaim(row.claim.id, {
      board_relationship: rel,
      ...(editYear.length === 4 ? { start_date: `${editYear}-01-01` } : {}),
    })
    setEditing(false)
  }

  const titleNode = (
    <span className="text-sm font-medium text-foreground truncate">
      {brand} {model} {yearShort && <span className="text-muted font-normal">{yearShort}</span>}
    </span>
  )

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-default last:border-0">
      <BoardThumb imageUrl={imageUrl} loading={imageLoading} brand={brand} />

      <div className="flex-1 min-w-0">
        {board && !readOnly ? (
          <CommunityLink href={`/boards/${boardSlug(board)}`} className="hover:text-blue-400 transition-colors block truncate">
            {titleNode}
          </CommunityLink>
        ) : (
          <div className="truncate">{titleNode}</div>
        )}

        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {badges.map((b) => (
            <span
              key={b}
              className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800/40"
            >
              {b}
            </span>
          ))}
          {row.year && (
            <span className="text-[11px] text-muted">{boardYearLabel(row.relationship, row.year)}</span>
          )}
        </div>

        {editing && (
          <div className="mt-3 space-y-2">
            <BoardRelationshipToggles
              size="sm"
              rode={editRode}
              own={editOwn}
              onChange={({ rode, own }) => { setEditRode(rode); setEditOwn(own) }}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editYear}
                onChange={(e) => setEditYear(e.target.value)}
                placeholder="Year (optional)"
                min={1965}
                max={2030}
                className="w-32 bg-background border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={saveEdit}
                disabled={!editRode && !editOwn}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  editRode || editOwn
                    ? "bg-[#1C1917] text-white hover:bg-[#292524]"
                    : "bg-surface-active text-muted cursor-not-allowed",
                )}
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground border border-border-default transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {isOwn && !readOnly && !editing && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }}
            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-border-default transition-all text-sm"
            title="Options"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 bg-surface-hover border border-border-default rounded-lg shadow-xl overflow-hidden w-36">
                {!confirmDelete ? (
                  <>
                    <button
                      onClick={startEditing}
                      className="w-full text-left px-4 py-2.5 text-xs text-muted hover:bg-surface-active hover:text-foreground transition-colors flex items-center gap-2"
                    >
                      <span>✏️</span> Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-surface-active hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                      <span>🗑</span> Delete
                    </button>
                  </>
                ) : (
                  <div className="px-3 py-3">
                    <p className="text-xs text-muted mb-2">Remove this board?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 px-2 py-1.5 text-xs rounded border border-border-default text-muted hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { removeClaim(row.claim.id); setMenuOpen(false) }}
                        className="flex-1 px-2 py-1.5 text-xs rounded bg-red-900 text-red-200 hover:bg-red-800 transition-colors font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shelf ─────────────────────────────────────────────────────────────────────

export function BoardShelf({
  claims,
  isOwn,
  readOnly,
  personName,
}: {
  claims: Claim[]
  isOwn?: boolean
  readOnly?: boolean
  personName: string
}) {
  const { catalog, userEntities } = useLineageStore()
  const [filter, setFilter] = useState<BoardShelfFilter>("all")
  const [addingBoard, setAddingBoard] = useState(false)

  const rows = useMemo<ShelfRow[]>(() => {
    const findBoard = (id: string): Board | undefined =>
      catalog.boards.find((b) => b.id === id) ?? userEntities.boards.find((b) => b.id === id)

    const byBoard = new Map<string, ShelfRow>()
    for (const c of claims) {
      if (c.predicate !== "owned_board") continue
      const existing = byBoard.get(c.object_id)
      if (existing) {
        existing.relationship = mergeBoardRelationships(existing.relationship, c.board_relationship)
        if (!existing.year && c.start_date) existing.year = c.start_date.slice(0, 4)
      } else {
        byBoard.set(c.object_id, {
          claim: c,
          board: findBoard(c.object_id),
          relationship: normalizeBoardRelationship(c.board_relationship),
          year: c.start_date ? c.start_date.slice(0, 4) : undefined,
        })
      }
    }

    return [...byBoard.values()].sort((a, b) => {
      const ya = a.board?.model_year ?? 0
      const yb = b.board?.model_year ?? 0
      if (ya !== yb) return yb - ya // newest model year first
      const brandCmp = (a.board?.brand ?? "").localeCompare(b.board?.brand ?? "")
      if (brandCmp !== 0) return brandCmp
      return (a.board?.model ?? "").localeCompare(b.board?.model ?? "")
    })
  }, [claims, catalog.boards, userEntities.boards])

  const visible = rows.filter((r) => matchesBoardFilter(r.relationship, filter))

  const subToggles: [BoardShelfFilter, string][] = [["all", "All"], ["rode", "Rode"], ["collection", "Collection"]]

  return (
    <div>
      {addingBoard && <AddClaimModal defaultFilter="gear" onClose={() => setAddingBoard(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-foreground">{isOwn ? "My Boards" : `${personName}'s boards`}</h3>
        {isOwn && !readOnly && (
          <button
            onClick={() => setAddingBoard(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
          >
            + Add a board
          </button>
        )}
      </div>

      {/* Sub-toggle */}
      {rows.length > 0 && (
        <div className="flex gap-2 mb-4">
          {subToggles.map(([f, label]) => {
            const active = filter === f
            const count = f === "all" ? rows.length : rows.filter((r) => matchesBoardFilter(r.relationship, f)).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                  active
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "border-border-default text-muted hover:text-foreground",
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn("text-[10px] tabular-nums", active ? "text-emerald-100" : "text-muted")}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Rows / empty states */}
      {rows.length === 0 ? (
        <div className="text-center text-muted py-12">
          <div className="text-3xl mb-3">🏂</div>
          {isOwn ? (
            <>
              <div className="text-sm mb-3">Add the boards you have ridden and the ones in your collection.</div>
              {!readOnly && (
                <button
                  onClick={() => setAddingBoard(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                  + Add a board
                </button>
              )}
            </>
          ) : (
            <div className="text-sm">No boards yet.</div>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center text-muted py-10 text-sm">No boards in this view.</div>
      ) : (
        <div>
          {visible.map((row) => (
            <BoardShelfRow key={row.claim.id} row={row} isOwn={isOwn} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  )
}
