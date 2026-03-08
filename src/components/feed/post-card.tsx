"use client"

import { useState } from "react"
import Link from "next/link"
import type { Claim, EntityType, Event } from "@/types"
import { ConfidenceBadge, UnverifiedBadge } from "@/components/ui/badge"
import { PREDICATE_ICONS, PREDICATE_LABELS, formatDateRange } from "@/lib/utils"
import { getEntityName } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { EditClaimModal } from "@/components/ui/edit-claim-modal"
import { EditEventModal } from "@/components/ui/edit-event-modal"
import { EntityChip } from "@/components/feed/entity-chip"
import { cn } from "@/lib/utils"
import type { Predicate } from "@/types"

// Auto-generated headline sentences
function generateHeadline(predicate: Predicate, entityName: string): string {
  switch (predicate) {
    case "rode_at":      return `Rode at ${entityName}`
    case "worked_at":    return `Worked at ${entityName}`
    case "sponsored_by": return `Sponsored by ${entityName}`
    case "part_of_team": return `Part of ${entityName}`
    case "owned_board":  return `Rode a ${entityName}`
    case "rode_with":    return `Rode with ${entityName}`
    case "competed_at":  return `Competed at ${entityName}`
    case "spectated_at": return `Was at ${entityName}`
    case "organized_at": return `Organized ${entityName}`
    case "shot_by":      return `Shot by ${entityName}`
    case "coached_by":   return `Coached by ${entityName}`
    default:             return entityName
  }
}

// Left border accent color by predicate group
function accentClass(predicate: Predicate): string {
  if (predicate === "rode_at" || predicate === "worked_at") return "border-l-blue-700"
  if (predicate === "owned_board") return "border-l-emerald-700"
  if (predicate === "rode_with" || predicate === "shot_by" || predicate === "coached_by") return "border-l-violet-700"
  if (predicate === "competed_at" || predicate === "spectated_at" || predicate === "organized_at") return "border-l-amber-700"
  return "border-l-zinc-600"
}

function entityHref(id: string, type: EntityType): string {
  if (type === "place") return `/places/${id}`
  if (type === "person") return `/profile/${id}`
  if (type === "org") return `/orgs/${id}`
  if (type === "board") return `/boards/${id}`
  if (type === "event") return `/events/${id}`
  return "#"
}

export function PostCard({ claim, isOwn }: { claim: Claim; isOwn?: boolean }) {
  const { userEntities, removeClaim } = useLineageStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const icon = PREDICATE_ICONS[claim.predicate] ?? "•"
  const predicateLabel = PREDICATE_LABELS[claim.predicate] ?? claim.predicate
  const dateRange = formatDateRange(claim.start_date, claim.end_date)

  // Resolve entity name — check user-created entities first
  const allUserEntities = [
    ...userEntities.places,
    ...userEntities.boards,
    ...userEntities.orgs,
    ...userEntities.events,
  ]
  const userEntity = allUserEntities.find((e) => e.id === claim.object_id)
  const isUnverified = userEntity?.community_status === "unverified"

  const entityName = userEntity
    ? ("brand" in userEntity
        ? `${userEntity.brand} ${userEntity.model} '${String(userEntity.model_year).slice(2)}`
        : (userEntity as { name: string }).name)
    : getEntityName(claim.object_id, claim.object_type)

  const userEvent = userEntities.events.find((e) => e.id === claim.object_id) as Event | undefined

  const headline = generateHeadline(claim.predicate, entityName)
  const href = entityHref(claim.object_id, claim.object_type)
  const hasExtra = !!(claim.note || (claim.sources && claim.sources.length > 0))

  return (
    <>
      {editing && (
        <EditClaimModal
          claim={claim}
          entityName={entityName}
          onClose={() => setEditing(false)}
        />
      )}
      {editingEvent && userEvent && (
        <EditEventModal
          event={userEvent}
          onClose={() => setEditingEvent(false)}
        />
      )}

      <div className={cn(
        "group bg-[#111] border border-[#1e1e1e] border-l-2 rounded-xl p-5 mb-4 hover:border-[#2a2a2a] transition-all",
        accentClass(claim.predicate)
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Predicate label */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">{predicateLabel}</span>
            </div>

            {/* Headline */}
            <Link href={href} className="block mb-2 group/link">
              <p className="text-base font-semibold text-white group-hover/link:text-blue-300 transition-colors leading-snug">
                {headline}
              </p>
            </Link>

            {/* Entity chip */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <EntityChip id={claim.object_id} type={claim.object_type} name={entityName} />
            </div>

            {/* Date + confidence */}
            <div className="flex items-center gap-2 flex-wrap">
              {dateRange && <span className="text-sm text-zinc-400">{dateRange}</span>}
              <ConfidenceBadge level={claim.confidence} />
              {isUnverified && <UnverifiedBadge />}
              {claim.sources && claim.sources.length > 0 && (
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  📎 {claim.sources.length} source{claim.sources.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Expanded: note + sources */}
            {expanded && claim.note && (
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed border-t border-[#1e1e1e] pt-3">
                {claim.note}
              </p>
            )}
            {expanded && claim.sources && claim.sources.length > 0 && (
              <div className="mt-2 space-y-1">
                {claim.sources.map((s) => (
                  <div key={s.id} className="text-xs text-zinc-500">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                        📎 {s.citation}
                      </a>
                    ) : (
                      <span>📎 {s.citation}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {claim.visibility === "private" && (
              <span className="text-xs text-zinc-700" title="Private">🔒</span>
            )}
            {claim.visibility === "shared" && (
              <span className="text-xs text-zinc-600" title="Shared">👥</span>
            )}

            {isOwn && (
              <div className="relative">
                <button
                  onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-[#2a2a2a] transition-all text-sm"
                  title="Options"
                >
                  ⋯
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-7 z-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden w-36">
                      {!confirmDelete ? (
                        <>
                          <button
                            onClick={() => { setMenuOpen(false); setEditing(true) }}
                            className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-[#222] hover:text-white transition-colors flex items-center gap-2"
                          >
                            <span>✏️</span> Edit claim
                          </button>
                          {userEvent && (
                            <button
                              onClick={() => { setMenuOpen(false); setEditingEvent(true) }}
                              className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-[#222] hover:text-white transition-colors flex items-center gap-2"
                            >
                              <span>📋</span> Edit event
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDelete(true)}
                            className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-[#222] hover:text-red-300 transition-colors flex items-center gap-2"
                          >
                            <span>🗑</span> Delete
                          </button>
                        </>
                      ) : (
                        <div className="px-3 py-3">
                          <p className="text-xs text-zinc-400 mb-2">Remove this claim?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="flex-1 px-2 py-1.5 text-xs rounded border border-[#2a2a2a] text-zinc-500 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => { removeClaim(claim.id); setMenuOpen(false) }}
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

        {/* Bottom row: action stubs + expand toggle */}
        <div className="mt-4 pt-3 border-t border-[#1a1a1a] flex items-center justify-between">
          <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              disabled
              title="Coming soon"
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              ✓ Verify
            </button>
            <button
              disabled
              title="Coming soon"
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              ? Challenge
            </button>
            <button
              disabled
              title="Coming soon"
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              ♥ Save
            </button>
          </div>
          {hasExtra && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors ml-auto"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
