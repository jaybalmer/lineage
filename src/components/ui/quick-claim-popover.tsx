"use client"

import { useState, useRef, useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { Predicate, EntityType } from "@/types"

// Predicates available per entity type (from the user's perspective)
const ENTITY_PREDICATES: Record<string, { value: Predicate; label: string; icon: string }[]> = {
  person: [{ value: "rode_with",    label: "Rode with",    icon: "🤝" }],
  board:  [{ value: "owned_board",  label: "Owned",        icon: "🏂" }],
  place:  [{ value: "rode_at",      label: "Rode at",      icon: "🏔" }],
  event:  [
    { value: "competed_at",  label: "Competed",   icon: "🏆" },
    { value: "spectated_at", label: "Spectated",  icon: "👀" },
    { value: "organized_at", label: "Organized",  icon: "📋" },
  ],
  org: [
    { value: "fan_of",        label: "Fan",        icon: "❤️" },
    { value: "sponsored_by",  label: "Sponsored",  icon: "💰" },
    { value: "part_of_team",  label: "On team",    icon: "👕" },
    { value: "worked_at",     label: "Worked at",  icon: "🔧" },
  ],
}

const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  person: "person",
  board:  "board",
  place:  "place",
  event:  "event",
  org:    "org",
}

function generateId() {
  return `qc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

interface QuickClaimPopoverProps {
  entityId: string
  entityType: "person" | "event" | "board" | "org" | "place"
  entityName: string
}

export function QuickClaimPopover({ entityId, entityType, entityName }: QuickClaimPopoverProps) {
  const { activePersonId, addClaim, catalog, sessionClaims, dbClaims } = useLineageStore()
  const [open, setOpen] = useState(false)
  const [predicate, setPredicate] = useState<Predicate | null>(null)
  const [year, setYear] = useState("")
  const [added, setAdded] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const options = ENTITY_PREDICATES[entityType] ?? []
  const isSingle = options.length === 1

  // Auto-select the only predicate for single-predicate types
  useEffect(() => {
    if (isSingle) setPredicate(options[0].value)
  }, [isSingle, entityType])

  // Check if the user already has ANY claim for this entity
  const allClaims = [...catalog.claims, ...sessionClaims, ...dbClaims]
  const existingClaims = allClaims.filter(
    (c) => c.subject_id === activePersonId && c.object_id === entityId
  )
  const alreadyClaimed = existingClaims.length > 0

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  if (!activePersonId) return null

  function handleAdd() {
    if (!predicate || !activePersonId) return
    const startDate = year.length === 4 ? `${year}-01-01` : `${new Date().getFullYear()}-01-01`
    addClaim({
      id: generateId(),
      subject_id: activePersonId,
      subject_type: "person",
      predicate,
      object_id: entityId,
      object_type: ENTITY_TYPE_MAP[entityType],
      start_date: startDate,
      confidence: "self-reported",
      visibility: "public",
      asserted_by: activePersonId,
      created_at: new Date().toISOString(),
    })
    setAdded(true)
    setTimeout(() => {
      setOpen(false)
      setAdded(false)
    }, 1000)
  }

  const canAdd = predicate !== null

  return (
    <div ref={wrapperRef} className="relative shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!alreadyClaimed && !added) setOpen(!open)
        }}
        title={alreadyClaimed ? "Already in your timeline" : `Add ${entityName} to your timeline`}
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all border",
          alreadyClaimed || added
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 cursor-default"
            : open
              ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
              : "bg-surface-hover border-border-default text-muted hover:border-accent hover:text-accent hover:bg-blue-600/10"
        )}
      >
        {alreadyClaimed || added ? "✓" : "+"}
      </button>

      {/* Popover */}
      {open && !alreadyClaimed && (
        <div
          className="absolute right-0 top-9 z-50 w-56 bg-surface border border-border-default rounded-xl shadow-xl p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-muted uppercase tracking-widest mb-2">
            Add to your timeline
          </div>
          <div className="text-xs font-medium text-foreground mb-3 truncate">{entityName}</div>

          {/* Predicate selection (multi only) */}
          {!isSingle && (
            <div className="flex flex-wrap gap-1 mb-3">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPredicate(opt.value)}
                  className={cn(
                    "px-2 py-1 rounded-md text-xs border transition-all flex items-center gap-1",
                    predicate === opt.value
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                      : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Year input */}
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder={`${new Date().getFullYear()}`}
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full px-2.5 py-1.5 bg-surface-hover border border-border-default rounded-lg text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent mb-3"
          />

          {/* Add button */}
          <button
            disabled={!canAdd}
            onClick={handleAdd}
            className={cn(
              "w-full py-1.5 rounded-lg text-xs font-medium transition-all",
              canAdd
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-surface-hover text-muted cursor-not-allowed"
            )}
          >
            {added ? "Added ✓" : isSingle ? `${options[0].icon} ${options[0].label}` : "Add"}
          </button>
        </div>
      )}
    </div>
  )
}
