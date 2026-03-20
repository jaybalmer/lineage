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

// ─── Origin Graphic ───────────────────────────────────────────────────────────

function OriginGraphic({ year }: { year?: number }) {
  const yr = year ? `'${String(year).slice(2)}` : null
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(145deg, #0a1628 0%, #060d1a 100%)",
        border: "1px solid rgba(148,163,184,0.14)",
        boxShadow: "0 0 18px 2px rgba(100,116,139,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Stars */}
      <div style={{
        position: "absolute",
        top: 5, left: 8,
        width: 1.5, height: 1.5,
        borderRadius: "50%",
        background: "rgba(226,232,240,0.6)",
        boxShadow: "18px 3px 0 rgba(226,232,240,0.4), 10px 8px 0 rgba(226,232,240,0.3), 32px 6px 0 rgba(226,232,240,0.35)",
      }} />
      {/* Mountain SVG */}
      <svg viewBox="0 0 56 56" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {/* Back ridge */}
        <path d="M0 42 L10 26 L20 34 L30 18 L40 30 L50 22 L56 28 L56 56 L0 56 Z"
          fill="rgba(71,85,105,0.25)" />
        {/* Main peak */}
        <path d="M4 52 L16 30 L24 40 L28 20 L34 36 L44 24 L56 38 L56 56 L0 56 Z"
          fill="rgba(100,116,139,0.4)" />
        {/* Snow cap */}
        <path d="M25 23 L28 20 L31 24 L29 27 L27 27 Z" fill="rgba(226,232,240,0.9)" />
      </svg>
      {/* Snowboarder icon */}
      <div style={{ position: "relative", zIndex: 10, marginTop: 4 }}>
        <span style={{ fontSize: 20, lineHeight: 1, filter: "drop-shadow(0 0 4px rgba(148,163,184,0.6))" }}>
          🏂
        </span>
      </div>
      {/* Year badge */}
      {yr && (
        <div style={{
          position: "absolute",
          bottom: 5,
          right: 5,
          fontSize: 9,
          fontWeight: 700,
          color: "rgba(148,163,184,0.9)",
          letterSpacing: 0.5,
          lineHeight: 1,
        }}>
          {yr}
        </div>
      )}
    </div>
  )
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
      "postcard group bg-surface border-2 rounded-xl p-5 mb-4 transition-all",
      editing ? "border-blue-700" : "border-zinc-600"
    )}>
      {/* ── Entity block (display mode) ── */}
      {!editing && (
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-default">
          <OriginGraphic year={person.riding_since} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground text-base leading-snug">
                  {person.riding_since ? `Riding since ${person.riding_since}` : "Your origin"}
                </p>
                {(boardName || placeName) ? (
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {boardName && firstBoardClaim && (
                      <Link
                        href={boardDetail ? `/boards/${boardSlug(boardDetail)}` : `/boards/${firstBoardClaim.object_id}`}
                        className="text-xs text-muted hover:text-foreground transition-colors"
                      >
                        {boardName}{boardDetail ? ` '${String(boardDetail.model_year).slice(2)}` : ""}
                      </Link>
                    )}
                    {boardName && placeName && (
                      <span className="text-muted text-xs">·</span>
                    )}
                    {placeName && firstPlaceClaim && (
                      <Link
                        href={(() => { const p = getPlaceById(firstPlaceClaim.object_id); return p ? `/places/${placeSlug(p)}` : `/places/${firstPlaceClaim.object_id}` })()}
                        className="text-xs text-muted hover:text-foreground transition-colors"
                      >
                        {placeName}
                      </Link>
                    )}
                  </div>
                ) : isOwn ? (
                  <button
                    onClick={openEdit}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + add first board &amp; mountain
                  </button>
                ) : null}
              </div>
              <span className="text-[10px] uppercase tracking-widest font-medium text-zinc-600 shrink-0 mt-0.5">
                Origin
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit mode entity block ── */}
      {editing && (
        <div className="flex items-start gap-3 mb-4 pb-4 border-b border-border-default">
          <OriginGraphic year={typeof draftYear === "number" ? draftYear : person.riding_since} />
          <div className="flex-1 min-w-0 space-y-4">
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
        </div>
      )}

      {/* ── Metadata row ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted bg-surface-hover border border-border-default rounded px-1.5 py-0.5">
            First season
          </span>
          {person.riding_since && (
            <span className="text-xs text-muted">{person.riding_since}</span>
          )}
          <span className="text-[10px] uppercase tracking-widest text-zinc-700 bg-surface-hover border border-border-default rounded px-1.5 py-0.5">
            self-reported
          </span>
        </div>
        {isOwn && !editing && (
          <button
            onClick={openEdit}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-muted hover:text-foreground transition-all px-2 py-0.5 rounded hover:bg-surface-active"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
