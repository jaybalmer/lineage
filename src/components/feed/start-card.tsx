"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useLineageStore } from "@/store/lineage-store"
import { getBoardById, getPlaceById, boardSlug, placeSlug } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { Person, Claim, Board, Place } from "@/types"

interface StartCardProps {
  person: Person
  claims: Claim[]
  isOwn?: boolean
}

function yearOf(dateStr?: string): number {
  if (!dateStr) return Infinity
  const y = parseInt(dateStr.substring(0, 4))
  return isNaN(y) ? Infinity : y
}

// ─── Inline search dropdown ───────────────────────────────────────────────────

function InlineSearch<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  getLabel,
  placeholder,
  emptyLabel,
}: {
  items: T[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
  getLabel: (item: T) => string
  placeholder: string
  emptyLabel: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const selected = items.find((i) => i.id === selectedId)
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter((i) => getLabel(i).toLowerCase().includes(q)).slice(0, 10)
  }, [query, items, getLabel])

  return (
    <div className="relative">
      {selected && !open ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-foreground bg-surface-hover border border-border-default rounded-lg px-2 py-1 truncate max-w-[200px]">
            {getLabel(selected)}
          </span>
          <button
            onClick={() => { setOpen(true); setQuery("") }}
            className="text-[10px] text-muted hover:text-foreground transition-colors shrink-0"
          >
            change
          </button>
          <button
            onClick={() => onSelect(undefined)}
            className="text-[10px] text-muted hover:text-red-400 transition-colors shrink-0"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            autoFocus={open}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {open && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-border-default rounded-lg shadow-xl max-h-44 overflow-y-auto divide-y divide-[#1e1e1e]">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onSelect(item.id); setOpen(false); setQuery("") }}
                  className="w-full text-left px-3 py-2 text-xs text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
                >
                  {getLabel(item)}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted">{emptyLabel}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StartCard({ person, claims, isOwn = false }: StartCardProps) {
  const { userEntities, catalog, setProfileOverride, updateClaim, addClaim, activePersonId } = useLineageStore()
  const [editing, setEditing] = useState(false)
  const [draftYear, setDraftYear] = useState<number | "">(person.riding_since ?? "")
  const [draftBoardId, setDraftBoardId] = useState<string | undefined>(undefined)
  const [draftPlaceId, setDraftPlaceId] = useState<string | undefined>(undefined)

  // ── Full catalog lookups (Supabase + mock + user-created) ────────────────

  const allBoards: Board[] = useMemo(
    () => [...catalog.boards, ...userEntities.boards].sort((a, b) => b.model_year - a.model_year),
    [catalog.boards, userEntities.boards]
  )
  const allPlaces: Place[] = useMemo(
    () => [...catalog.places, ...userEntities.places],
    [catalog.places, userEntities.places]
  )

  // ── Resolve display data ─────────────────────────────────────────────────

  const firstBoardClaim = claims
    .filter((c) => c.predicate === "owned_board")
    .sort((a, b) => yearOf(a.start_date) - yearOf(b.start_date))[0] ?? null

  const firstPlaceClaim = claims
    .filter((c) => c.predicate === "rode_at" && c.object_type === "place")
    .sort((a, b) => yearOf(a.start_date) - yearOf(b.start_date))[0] ?? null

  // Look up from full catalog first, then fall back to mock-data helpers
  const boardDetail = firstBoardClaim
    ? (allBoards.find((b) => b.id === firstBoardClaim.object_id) ?? getBoardById(firstBoardClaim.object_id) ?? null)
    : null

  const placeDetail = firstPlaceClaim
    ? (allPlaces.find((p) => p.id === firstPlaceClaim.object_id) ?? getPlaceById(firstPlaceClaim.object_id) ?? null)
    : null

  const boardName = boardDetail
    ? `${boardDetail.brand} ${boardDetail.model}`
    : null

  const placeName = placeDetail?.name ?? null

  const openEdit = () => {
    setDraftYear(person.riding_since ?? "")
    setDraftBoardId(firstBoardClaim?.object_id)
    setDraftPlaceId(firstPlaceClaim?.object_id)
    setEditing(true)
  }

  const handleSave = () => {
    const year = typeof draftYear === "number" && !isNaN(draftYear) ? draftYear : person.riding_since
    const startDate = year ? `${year}-01-01` : undefined

    // Update riding_since
    if (year) setProfileOverride({ riding_since: year })

    // Update or create first board claim
    if (draftBoardId) {
      if (firstBoardClaim) {
        updateClaim(firstBoardClaim.id, {
          object_id: draftBoardId,
          object_type: "board",
          ...(startDate && { start_date: startDate }),
        })
      } else if (activePersonId && startDate) {
        addClaim({
          id: `origin-board-${Date.now()}`,
          subject_id: activePersonId,
          subject_type: "person",
          predicate: "owned_board",
          object_id: draftBoardId,
          object_type: "board",
          start_date: startDate,
          confidence: "self-reported",
          visibility: "public",
          asserted_by: activePersonId,
          created_at: new Date().toISOString(),
        })
      }
    }

    // Update or create first place claim
    if (draftPlaceId) {
      if (firstPlaceClaim) {
        updateClaim(firstPlaceClaim.id, {
          object_id: draftPlaceId,
          object_type: "place",
          ...(startDate && { start_date: startDate }),
        })
      } else if (activePersonId && startDate) {
        addClaim({
          id: `origin-place-${Date.now()}`,
          subject_id: activePersonId,
          subject_type: "person",
          predicate: "rode_at",
          object_id: draftPlaceId,
          object_type: "place",
          start_date: startDate,
          confidence: "self-reported",
          visibility: "public",
          asserted_by: activePersonId,
          created_at: new Date().toISOString(),
        })
      }
    }

    setEditing(false)
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!person.riding_since && !isOwn) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn(
      "bg-surface border border-border-default rounded-xl px-3 py-2.5 mb-3 transition-all",
      editing ? "border-blue-900/40" : ""
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">🏂</span>
        <div className="min-w-0 flex-1">

          {/* ── Display mode: single compact line ── */}
          {!editing && (
            <div className="flex items-center gap-2 min-w-0">
              {/* Scrollable info strip */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                <span className="text-[10px] text-muted uppercase tracking-widest shrink-0">Origin</span>
                {person.riding_since && (
                  <span className="text-xs text-foreground font-medium shrink-0">{person.riding_since}</span>
                )}
                {boardName && firstBoardClaim && (
                  <>
                    <span className="text-muted text-xs shrink-0">·</span>
                    <Link
                      href={boardDetail ? `/boards/${boardSlug(boardDetail)}` : `/boards/${firstBoardClaim.object_id}`}
                      className="text-xs text-muted hover:text-foreground transition-colors shrink-0"
                    >
                      {boardName}{boardDetail ? ` '${String(boardDetail.model_year).slice(2)}` : ""}
                    </Link>
                  </>
                )}
                {placeName && firstPlaceClaim && (
                  <>
                    <span className="text-muted text-xs shrink-0">·</span>
                    <Link
                      href={(() => { const p = getPlaceById(firstPlaceClaim.object_id); return p ? `/places/${placeSlug(p)}` : `/places/${firstPlaceClaim.object_id}` })()}
                      className="text-xs text-muted hover:text-foreground transition-colors shrink-0"
                    >
                      {placeName}
                    </Link>
                  </>
                )}
                {isOwn && !boardName && !placeName && (
                  <button onClick={openEdit} className="text-xs text-blue-400 hover:underline shrink-0">
                    + add first board &amp; mountain
                  </button>
                )}
              </div>
              {/* Edit button pinned to right */}
              {isOwn && (
                <button
                  onClick={openEdit}
                  className="text-[10px] text-muted hover:text-foreground transition-colors shrink-0"
                >
                  Edit
                </button>
              )}
            </div>
          )}

          {/* ── Edit mode ── */}
          {editing && (
            <div className="space-y-4 mt-1">
              {/* Edit header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted uppercase tracking-widest">Edit Origin</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="text-[10px] text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors px-2 py-0.5 rounded bg-blue-950/40 border border-blue-900/50"
                  >
                    Save
                  </button>
                </div>
              </div>
              {/* Year started */}
              <div>
                <label className="text-[10px] text-muted uppercase tracking-widest block mb-1.5">
                  Year started
                </label>
                <input
                  type="number"
                  value={draftYear}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setDraftYear(isNaN(v) ? "" : v)
                  }}
                  min={1960}
                  max={new Date().getFullYear()}
                  placeholder="e.g. 1998"
                  className="w-28 bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* First board */}
              <div>
                <label className="text-[10px] text-muted uppercase tracking-widest block mb-1.5">
                  First board
                </label>
                <InlineSearch
                  items={allBoards}
                  selectedId={draftBoardId}
                  onSelect={setDraftBoardId}
                  getLabel={(b) => `${b.brand} ${b.model} '${String(b.model_year).slice(2)}`}
                  placeholder="Search boards…"
                  emptyLabel="No boards found"
                />
              </div>

              {/* First mountain */}
              <div>
                <label className="text-[10px] text-muted uppercase tracking-widest block mb-1.5">
                  First mountain
                </label>
                <InlineSearch
                  items={allPlaces}
                  selectedId={draftPlaceId}
                  onSelect={setDraftPlaceId}
                  getLabel={(p) => p.name}
                  placeholder="Search resorts, mountains…"
                  emptyLabel="No places found"
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
