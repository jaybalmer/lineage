"use client"

import { useState } from "react"
import type { RidingDay } from "@/types"
import { useLineageStore } from "@/store/lineage-store"
import { PLACES, PEOPLE, placeSlug } from "@/lib/mock-data"
import { CommunityLink } from "@/components/ui/community-link"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function formatDayDate(dateStr: string): { weekday: string; display: string } {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return {
    weekday: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()],
    display: `${d} ${MONTHS[m - 1]} ${y}`,
  }
}

export function DayCard({ day, isOwn }: { day: RidingDay; isOwn?: boolean }) {
  const { userEntities, removeRidingDay } = useLineageStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allPlaces = [...PLACES, ...userEntities.places]
  const place = allPlaces.find((p) => p.id === day.place_id)
  const riders = PEOPLE.filter((p) => day.rider_ids.includes(p.id))

  const { weekday, display } = formatDayDate(day.date)

  return (
    <div className="relative pl-10 pb-5 timeline-line last:pb-0 group">
      {/* Calendar dot */}
      <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-surface-2 border border-border-default flex items-center justify-center text-sm z-10">
        ☀️
      </div>

      <div className="bg-emerald-950/30 dark:bg-[#0f1a0f] border border-emerald-900/30 dark:border-[#1a2e1a] rounded-xl p-4 hover:border-emerald-800/50 dark:hover:border-[#2a3e2a] transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Date + place */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest">{weekday}</span>
              <span className="text-xs text-muted">{display}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-sm">🏔</span>
              {place ? (
                <CommunityLink
                  href={`/places/${placeSlug(place)}`}
                  className="font-medium text-foreground hover:text-emerald-400 transition-colors text-sm"
                >
                  {place.name}
                </CommunityLink>
              ) : (
                <span className="font-medium text-muted text-sm">Unknown place</span>
              )}
            </div>

            {/* Riders */}
            {riders.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted">with</span>
                {riders.map((r, i) => (
                  <span key={r.id}>
                    <CommunityLink
                      href={`/riders/${r.id}`}
                      className="text-[11px] text-muted hover:text-foreground transition-colors"
                    >
                      {r.display_name}
                    </CommunityLink>
                    {i < riders.length - 1 && (
                      <span className="text-muted">, </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Note */}
            {day.note && (
              <p className="mt-2 text-xs text-muted leading-relaxed">{day.note}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {day.visibility === "private" && (
              <span className="text-xs text-muted" title="Private">🔒</span>
            )}

            {isOwn && (
              <div className="relative">
                <button
                  onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-border-default transition-all text-sm"
                  title="Options"
                >
                  ⋯
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-7 z-20 bg-surface-hover border border-border-default rounded-lg shadow-xl overflow-hidden w-36">
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-surface-active hover:text-red-300 transition-colors flex items-center gap-2"
                        >
                          <span>🗑</span> Delete
                        </button>
                      ) : (
                        <div className="px-3 py-3">
                          <p className="text-xs text-muted mb-2">Remove this day?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="flex-1 px-2 py-1.5 text-xs rounded border border-border-default text-muted hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => { removeRidingDay(day.id); setMenuOpen(false) }}
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
        </div>
      </div>
    </div>
  )
}
