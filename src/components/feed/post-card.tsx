"use client"

import { useState } from "react"
import Link from "next/link"
import type { Claim, EntityType, Event, Board, Place, Org, Person } from "@/types"
import { ConfidenceBadge, UnverifiedBadge } from "@/components/ui/badge"
import { PREDICATE_LABELS, formatDateRange } from "@/lib/utils"
import {
  getEntityName,
  getBoardById,
  getPlaceById,
  getOrgById,
  getEventById,
  getPersonById,
  getEntityHref,
} from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { EditClaimModal } from "@/components/ui/edit-claim-modal"
import { EditEventModal } from "@/components/ui/edit-event-modal"
import { cn } from "@/lib/utils"
import type { Predicate } from "@/types"

// Left border accent color by predicate group
function accentClass(predicate: Predicate): string {
  if (predicate === "rode_at" || predicate === "worked_at") return "border-l-blue-700"
  if (predicate === "owned_board") return "border-l-emerald-700"
  if (predicate === "rode_with" || predicate === "shot_by" || predicate === "coached_by") return "border-l-violet-700"
  if (predicate === "competed_at" || predicate === "spectated_at" || predicate === "organized_at") return "border-l-amber-700"
  return "border-l-zinc-600"
}

// ─── Type-specific entity block ───────────────────────────────────────────────

function BoardGraphic() {
  return (
    <div className="w-8 h-16 rounded-full bg-emerald-950/50 border border-emerald-800/30 flex items-center justify-center flex-shrink-0">
      <div className="w-2 h-11 bg-emerald-700/60 rounded-full" />
    </div>
  )
}

function PlaceGraphic() {
  return (
    <div className="w-12 h-12 rounded-xl bg-blue-950/40 border border-blue-800/20 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600/80" fill="currentColor">
        <path d="M12 2L2 19h20L12 2zm0 4l6.5 11H5.5L12 6z" />
      </svg>
    </div>
  )
}

function OrgGraphic({ name }: { name: string }) {
  return (
    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700/30 flex items-center justify-center flex-shrink-0 text-lg font-bold text-zinc-400">
      {name[0]}
    </div>
  )
}

function EventGraphic({ year }: { year?: number | string }) {
  const yr = year ? `'${String(year).slice(2)}` : "?"
  return (
    <div className="w-12 h-12 rounded-xl bg-amber-950/40 border border-amber-800/20 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-amber-500">{yr}</span>
    </div>
  )
}

function PersonGraphic({ name }: { name: string }) {
  return (
    <div className="w-12 h-12 rounded-full bg-violet-950/40 border border-violet-800/20 flex items-center justify-center flex-shrink-0 text-base font-bold text-violet-300">
      {name[0]}
    </div>
  )
}

interface EntityBlockProps {
  claim: Claim
  entityName: string
  href: string
  isOwn?: boolean
}

function EntityBlock({ claim, entityName, href, isOwn }: EntityBlockProps) {
  const type = claim.object_type
  const id = claim.object_id

  // Resolve entity details
  const board  = type === "board"  ? getBoardById(id)  : null
  const place  = type === "place"  ? getPlaceById(id)  : null
  const org    = type === "org"    ? getOrgById(id)    : null
  const event  = type === "event"  ? getEventById(id)  : null
  const person = type === "person" ? getPersonById(id) : null

  const imageUrl: string | undefined =
    (board as Board | null)?.image_url ??
    (org as Org | null)?.logo_url ??
    (place as Place | null)?.image_url ??
    (event as Event | null)?.image_url ??
    undefined

  // Graphic
  const graphic = (() => {
    if (type === "board")  return <BoardGraphic />
    if (type === "place")  return <PlaceGraphic />
    if (type === "org")    return <OrgGraphic name={entityName} />
    if (type === "event")  return <EventGraphic year={event?.year ?? (parseInt(event?.start_date?.slice(0, 4) ?? "0") || undefined)} />
    if (type === "person") return <PersonGraphic name={entityName} />
    return null
  })()

  // Primary display name
  const displayName = (() => {
    if (board)  return `${board.brand} ${board.model}`
    if (place)  return place.name
    if (org)    return org.name
    if (event)  return event.name
    if (person) return person.display_name
    return entityName
  })()

  // Subtitle line
  const subtitle = (() => {
    if (board) {
      const parts: string[] = []
      if (board.model_year) parts.push(`'${String(board.model_year).slice(2)}`)
      if (board.shape)      parts.push(board.shape.replace(/-/g, " "))
      return parts.join(" · ")
    }
    if (place) return [place.region, place.country].filter(Boolean).join(", ")
    if (org)   return [
      org.brand_category?.replace(/_/g, " ") ?? org.org_type,
      org.founded_year ? `Est. ${org.founded_year}` : null,
    ].filter(Boolean).join(" · ")
    if (event) return event.event_type.replace(/-/g, " ")
    if (person && person.riding_since) return `Riding since ${person.riding_since}`
    return ""
  })()

  // Type badge
  const badge = (() => {
    if (type === "board")  return { label: "Snowboard", cls: "text-emerald-700" }
    if (type === "place")  return { label: (place?.place_type ?? "Place"), cls: "text-blue-700" }
    if (type === "event")  return { label: (event?.event_type?.replace(/-/g, " ") ?? "Event"), cls: "text-amber-700" }
    if (type === "person") return { label: "Rider", cls: "text-violet-700" }
    return { label: (org?.org_type ?? "Org"), cls: "text-zinc-500" }
  })()

  return (
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#1a1a1a]">
      <Link href={href} className="flex-shrink-0">
        {graphic}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={href} className="block">
              <p className="font-bold text-white text-base leading-snug hover:text-blue-300 transition-colors truncate">
                {displayName}
              </p>
            </Link>
            {subtitle && (
              <p className="text-xs text-zinc-500 mt-0.5 capitalize">{subtitle}</p>
            )}
          </div>
          <span className={cn("text-[10px] uppercase tracking-widest font-medium shrink-0 capitalize mt-0.5", badge.cls)}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Thumbnail slot */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={displayName}
          className="w-14 h-14 rounded-lg object-cover border border-[#2a2a2a] flex-shrink-0"
        />
      ) : isOwn ? (
        <div className="w-14 h-14 rounded-lg border border-dashed border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] text-zinc-700 text-center leading-tight">Add<br />photo</span>
        </div>
      ) : null}
    </div>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

export function PostCard({ claim, isOwn }: { claim: Claim; isOwn?: boolean }) {
  const { userEntities, removeClaim } = useLineageStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)

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

  const href = getEntityHref(claim.object_id, claim.object_type)
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
        {/* Entity visual block */}
        <EntityBlock
          claim={claim}
          entityName={entityName}
          href={href}
          isOwn={isOwn}
        />

        {/* Metadata row: predicate + date + badges + privacy + menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Predicate pill */}
            <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-600 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5">
              {predicateLabel}
            </span>
            {dateRange && (
              <span className="text-xs text-zinc-400">{dateRange}</span>
            )}
            <ConfidenceBadge level={claim.confidence} />
            {isUnverified && <UnverifiedBadge />}
            {claim.sources && claim.sources.length > 0 && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                📎 {claim.sources.length} source{claim.sources.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Right: privacy + menu */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
