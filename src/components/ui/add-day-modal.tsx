"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { PLACES, PEOPLE } from "@/lib/mock-data"
import type { PrivacyLevel } from "@/types"

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

interface AddDayModalProps {
  onClose: () => void
}

export function AddDayModal({ onClose }: AddDayModalProps) {
  const { activePersonId, addRidingDay, userEntities } = useLineageStore()

  const [date, setDate] = useState(todayString())
  const [placeQuery, setPlaceQuery] = useState("")
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [riderIds, setRiderIds] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [visibility, setVisibility] = useState<PrivacyLevel>("private")

  const allPlaces = [...PLACES, ...userEntities.places]
  const otherRiders = PEOPLE.filter((p) => p.id !== activePersonId)

  const selectedPlace = placeId ? allPlaces.find((p) => p.id === placeId) : null

  const filteredPlaces = allPlaces.filter((p) =>
    p.name.toLowerCase().includes(placeQuery.toLowerCase())
  )

  const toggleRider = (id: string) => {
    setRiderIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  const canSave = date.length === 10 && placeId !== null

  const handleSave = () => {
    if (!canSave || !placeId) return
    addRidingDay({
      id: generateId("day"),
      date,
      place_id: placeId,
      rider_ids: riderIds,
      note: note.trim() || undefined,
      visibility,
      created_by: activePersonId,
      created_at: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border-default flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">☀️ Log a riding day</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Record when, where, and who</p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Date */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Date <span className="text-blue-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              max={todayString()}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Place */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              Where? <span className="text-blue-500">*</span>
            </label>
            {selectedPlace ? (
              <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-800/30 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>🏔</span>
                  <span className="text-sm font-medium text-emerald-200">{selectedPlace.name}</span>
                </div>
                <button
                  onClick={() => { setPlaceId(null); setPlaceQuery("") }}
                  className="text-xs text-zinc-600 hover:text-foreground transition-colors"
                >
                  change
                </button>
              </div>
            ) : (
              <div>
                <input
                  autoFocus
                  type="text"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="Search resorts, hills, zones…"
                  className={inputCls}
                />
                <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1a1a1a]">
                  {filteredPlaces.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPlaceId(p.id); setPlaceQuery("") }}
                      className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover transition-colors flex items-center justify-between"
                    >
                      <span>{p.name}</span>
                      {p.community_status === "unverified" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">◎ new</span>
                      )}
                    </button>
                  ))}
                  {filteredPlaces.length === 0 && (
                    <div className="px-3 py-2.5 text-xs text-zinc-600">No matches</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Who were you riding with? */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Who were you riding with?</label>
            <div className="flex flex-wrap gap-2">
              {otherRiders.map((rider) => {
                const selected = riderIds.includes(rider.id)
                return (
                  <button
                    key={rider.id}
                    onClick={() => toggleRider(rider.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      selected
                        ? "border-blue-500 bg-blue-950/50 text-blue-200"
                        : "border-border-default text-zinc-400 hover:border-zinc-600 hover:text-foreground"
                    )}
                  >
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      selected ? "bg-blue-600 text-foreground" : "bg-border-default text-zinc-500"
                    )}>
                      {rider.display_name[0]}
                    </span>
                    {rider.display_name.split(" ")[0]}
                  </button>
                )
              })}
            </div>
            {riderIds.length > 0 && (
              <p className="text-[11px] text-zinc-600 mt-2">
                {riderIds.length} rider{riderIds.length > 1 ? "s" : ""} tagged
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Note <span className="text-zinc-700">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How were the conditions? Any highlights?"
              rows={2}
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Visibility</label>
            <div className="flex gap-2">
              {([
                { v: "private", icon: "🔒", label: "Private" },
                { v: "shared", icon: "👥", label: "Shared" },
                { v: "public", icon: "🌐", label: "Public" },
              ] as { v: PrivacyLevel; icon: string; label: string }[]).map(({ v, icon, label }) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all",
                    visibility === v
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-border-default text-zinc-500 hover:border-zinc-600 hover:text-foreground"
                  )}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-foreground border border-border-default hover:border-zinc-600 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSave
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "bg-surface-active text-zinc-600 cursor-not-allowed"
            )}
          >
            Log this day
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
