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
  boardSlug,
  placeSlug,
  orgSlug,
  eventSlug,
} from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { EditClaimModal } from "@/components/ui/edit-claim-modal"
import { EditEventModal } from "@/components/ui/edit-event-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { cn } from "@/lib/utils"
import type { Predicate } from "@/types"
import { useBoardImage } from "@/hooks/use-board-image"

// Left border accent color by predicate group
function accentClass(predicate: Predicate): string {
  if (predicate === "rode_at" || predicate === "worked_at") return "border-blue-700"
  if (predicate === "owned_board") return "border-emerald-700"
  if (predicate === "rode_with" || predicate === "shot_by" || predicate === "coached_by") return "border-violet-700"
  if (predicate === "competed_at" || predicate === "spectated_at" || predicate === "organized_at") return "border-amber-700"
  return "border-zinc-600"
}

// ─── Type-specific entity block ───────────────────────────────────────────────

function BoardGraphic() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(145deg, #052e16 0%, #031a0e 100%)",
        border: "1px solid rgba(52,211,153,0.18)",
        boxShadow: "0 0 18px 2px rgba(52,211,153,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ambient radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 80% 80% at 50% 110%, rgba(52,211,153,0.22) 0%, transparent 65%)",
      }} />
      {/* Board shape */}
      <div style={{
        width: 16,
        height: 38,
        borderRadius: 999,
        background: "linear-gradient(180deg, #6ee7b7 0%, #059669 38%, #065f46 72%, #022c22 100%)",
        boxShadow: "0 0 10px 3px rgba(52,211,153,0.28), inset 1px 0 0 rgba(167,243,208,0.3)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {/* Center spine */}
        <div style={{
          width: 1.5,
          height: 24,
          borderRadius: 999,
          background: "linear-gradient(180deg, rgba(167,243,208,0.9) 0%, rgba(52,211,153,0.4) 60%, transparent 100%)",
        }} />
        {/* Edge highlight */}
        <div style={{
          position: "absolute",
          left: 4,
          top: 6,
          width: 1.5,
          height: 24,
          borderRadius: 999,
          background: "linear-gradient(180deg, rgba(167,243,208,0.35) 0%, transparent 100%)",
        }} />
      </div>
    </div>
  )
}

function PlaceGraphic() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(170deg, #0c1e4a 0%, #071428 55%, #050d1a 100%)",
        border: "1px solid rgba(59,130,246,0.18)",
        boxShadow: "0 0 18px 2px rgba(30,64,175,0.15)",
      }}
    >
      {/* Sky ambient radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(37,99,235,0.38) 0%, transparent 70%)",
      }} />
      {/* Stars */}
      <div style={{
        position: "absolute",
        top: 5, left: 10,
        width: 2, height: 2,
        borderRadius: "50%",
        background: "rgba(219,234,254,0.7)",
        boxShadow: "14px 4px 0 rgba(219,234,254,0.4), 28px 2px 0 rgba(219,234,254,0.5), 8px 10px 0 rgba(219,234,254,0.3)",
      }} />
      {/* Back ridge — farthest */}
      <svg viewBox="0 0 56 56" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M0 40 L8 24 L18 32 L28 18 L38 28 L48 20 L56 26 L56 56 L0 56 Z"
          fill="rgba(30,58,138,0.22)" />
        {/* Mid ridge */}
        <path d="M0 46 L6 32 L16 40 L26 24 L36 36 L46 26 L56 34 L56 56 L0 56 Z"
          fill="rgba(37,99,235,0.3)" />
        {/* Front ridge */}
        <path d="M0 52 L4 40 L12 46 L22 32 L30 42 L42 30 L50 38 L56 36 L56 56 L0 56 Z"
          fill="rgba(59,130,246,0.5)" />
        {/* Snow caps */}
        <path d="M20 35 L22 32 L24 35.5 Z" fill="rgba(219,234,254,0.88)" />
        <path d="M40 33 L42 30 L44.5 33.5 Z" fill="rgba(219,234,254,0.78)" />
      </svg>
      {/* Base haze */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 14,
        background: "linear-gradient(0deg, rgba(37,99,235,0.2) 0%, transparent 100%)",
      }} />
    </div>
  )
}

function OrgGraphic({ name }: { name: string }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        position: "relative",
        background: "linear-gradient(145deg, #1c1c1f 0%, #111113 100%)",
        border: "1px solid rgba(161,161,170,0.1)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 16px rgba(0,0,0,0.4)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Dot grid */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(161,161,170,0.18) 1px, transparent 1px)",
        backgroundSize: "8px 8px",
      }} />
      {/* Corner glow */}
      <div style={{
        position: "absolute",
        top: -12, right: -12,
        width: 40, height: 40,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(161,161,170,0.12) 0%, transparent 70%)",
      }} />
      {/* Gradient letter */}
      <span style={{
        position: "relative",
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: -1,
        background: "linear-gradient(140deg, #f4f4f5 0%, #a1a1aa 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        lineHeight: 1,
      }}>
        {name[0].toUpperCase()}
      </span>
    </div>
  )
}

function EventGraphic({ year }: { year?: number | string }) {
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
        background: "linear-gradient(145deg, #1a1000 0%, #0d0800 100%)",
        border: "1px solid rgba(251,191,36,0.16)",
        boxShadow: "0 0 22px 3px rgba(245,158,11,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Diagonal stripe pattern */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "repeating-linear-gradient(45deg, rgba(251,191,36,0.05) 0px, rgba(251,191,36,0.05) 1px, transparent 1px, transparent 9px)",
      }} />
      {/* Radial amber glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 75% 75% at 50% 60%, rgba(245,158,11,0.22) 0%, transparent 70%)",
      }} />
      {/* Year text or calendar icon */}
      {yr ? (
        <span style={{
          position: "relative",
          fontSize: yr.length > 3 ? 16 : 20,
          fontWeight: 800,
          color: "#fbbf24",
          textShadow: "0 0 10px rgba(251,191,36,0.9), 0 0 22px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2)",
          letterSpacing: -0.5,
          lineHeight: 1,
        }}>
          {yr}
        </span>
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{
          position: "relative",
          filter: "drop-shadow(0 0 5px rgba(251,191,36,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.35))",
        }}>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.85"/>
          <path d="M8 2v4M16 2v4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.75"/>
          <path d="M3 9h18" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.4"/>
          <circle cx="8.5" cy="14" r="1.2" fill="#fbbf24" fillOpacity="0.8"/>
          <circle cx="12" cy="14" r="1.2" fill="#fbbf24" fillOpacity="0.8"/>
          <circle cx="15.5" cy="14" r="1.2" fill="#fbbf24" fillOpacity="0.8"/>
        </svg>
      )}
      {/* Bottom edge glow line */}
      <div style={{
        position: "absolute",
        bottom: 0, left: "20%", right: "20%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)",
      }} />
    </div>
  )
}

function PersonGraphic({ name }: { name: string }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        padding: 2,
        background: "conic-gradient(from 200deg at 50% 50%, #7c3aed 0%, #a855f7 30%, #c084fc 50%, #a855f7 70%, #7c3aed 100%)",
        boxShadow: "0 0 18px 4px rgba(139,92,246,0.32), inset 0 0 0 1px rgba(196,132,252,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Inner filled circle */}
      <div style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        background: "linear-gradient(145deg, #2e1065 0%, #1e0b50 45%, #130830 100%)",
        boxShadow: "inset 0 1px 0 rgba(196,132,252,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <span style={{
          fontSize: 22,
          fontWeight: 700,
          background: "linear-gradient(140deg, #ede9fe 0%, #c084fc 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
        }}>
          {name[0].toUpperCase()}
        </span>
      </div>
    </div>
  )
}

interface EntityBlockProps {
  claim: Claim
  entityName: string
  isOwn?: boolean
}

function EntityBlock({ claim, entityName, isOwn }: EntityBlockProps) {
  const type = claim.object_type
  const id = claim.object_id

  // Resolve entity details — check full Supabase catalog first, then mock-data fallbacks
  const { catalog, userEntities } = useLineageStore()
  const board  = type === "board"
    ? (catalog.boards.find((b) => b.id === id) ?? userEntities.boards.find((b) => b.id === id) ?? getBoardById(id) ?? null)
    : null
  const place  = type === "place"
    ? (catalog.places.find((p) => p.id === id) ?? userEntities.places.find((p) => p.id === id) ?? getPlaceById(id) ?? null)
    : null
  const org    = type === "org"
    ? (catalog.orgs.find((o) => o.id === id) ?? userEntities.orgs.find((o) => o.id === id) ?? getOrgById(id) ?? null)
    : null
  const event  = type === "event"
    ? (catalog.events.find((e) => e.id === id) ?? userEntities.events.find((e) => e.id === id) ?? getEventById(id) ?? null)
    : null
  const person = type === "person" ? getPersonById(id) : null

  // Generate href from catalog-resolved entity (avoids mock-data ID mismatches)
  const href = place  ? `/places/${placeSlug(place)}`
    : board  ? `/boards/${boardSlug(board)}`
    : org    ? `/brands/${orgSlug(org)}`
    : event  ? `/events/${eventSlug(event)}`
    : person ? `/riders/${id}`
    : "#"

  // Auto-fetch board image via search API (hook always called; returns null for non-boards)
  const autoBoard = board as Board | null
  const autoBoardImage = useBoardImage(
    autoBoard?.brand,
    autoBoard?.model,
    autoBoard?.model_year,
  )

  // Resolve final image URL: manually-set image takes priority, then auto-fetched
  const manualImageUrl: string | undefined =
    (board as Board | null)?.image_url ??
    (org as Org | null)?.logo_url ??
    (place as Place | null)?.image_url ??
    (event as Event | null)?.image_url ??
    undefined

  const imageUrl: string | undefined =
    manualImageUrl ??
    (type === "board" && autoBoardImage ? autoBoardImage : undefined)

  const isBoardImageLoading = type === "board" && !manualImageUrl && autoBoardImage === undefined

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
    return { label: (org?.org_type ?? "Org"), cls: "text-muted" }
  })()

  return (
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-default">
      <Link href={href} className="flex-shrink-0">
        {graphic}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={href} className="block">
              <p className="font-bold text-foreground text-base leading-snug hover:text-blue-300 transition-colors truncate">
                {displayName}
              </p>
            </Link>
            {subtitle && (
              <p className="text-xs text-muted mt-0.5 capitalize">{subtitle}</p>
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
          className="w-14 h-14 rounded-lg object-cover border border-border-default flex-shrink-0"
        />
      ) : isBoardImageLoading ? (
        // Shimmer while board image search is in-flight
        <div className="w-14 h-14 rounded-lg border border-border-default flex-shrink-0 bg-surface-hover animate-pulse" />
      ) : isOwn ? (
        <div className="w-14 h-14 rounded-lg border border-dashed border-border-default flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] text-muted text-center leading-tight">Add<br />photo</span>
        </div>
      ) : null}
    </div>
  )
}

// ─── Companion Avatars ────────────────────────────────────────────────────────

const PLACE_PREDICATES_SET = new Set(["rode_at", "worked_at"])
const EVENT_PREDICATES_SET = new Set(["competed_at", "spectated_at", "organized_at"])

function CompanionAvatars({ claim }: { claim: Claim }) {
  const { catalog } = useLineageStore()

  const isPlace = PLACE_PREDICATES_SET.has(claim.predicate)
  const isEvent = EVENT_PREDICATES_SET.has(claim.predicate)
  if (!isPlace && !isEvent) return null

  const relevantPredicates = isPlace
    ? [...PLACE_PREDICATES_SET]
    : [...EVENT_PREDICATES_SET]

  const claimYear = claim.start_date?.slice(0, 4)
  if (!claimYear) return null

  // Find other riders who have claims at the same place/event in the same year
  const companionIds = [
    ...new Set(
      catalog.claims
        .filter(
          (c) =>
            c.object_id === claim.object_id &&
            relevantPredicates.includes(c.predicate) &&
            c.subject_id !== claim.subject_id &&
            c.start_date?.slice(0, 4) === claimYear
        )
        .map((c) => c.subject_id)
    ),
  ].slice(0, 6)

  if (companionIds.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-border-default flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-muted uppercase tracking-widest shrink-0">With</span>
      <div className="flex items-center gap-1 flex-wrap">
        {companionIds.map((pid) => {
          const person = catalog.people.find((p) => p.id === pid)
          const initials = (person?.display_name ?? "?")[0].toUpperCase()
          const name = person?.display_name ?? "Rider"
          return (
            <Link key={pid} href={`/riders/${pid}`} title={name}>
              <div className="w-6 h-6 rounded-full bg-violet-700 border border-violet-600 flex items-center justify-center text-[9px] font-bold text-white hover:bg-violet-500 transition-colors">
                {initials}
              </div>
            </Link>
          )
        })}
        <span className="text-[11px] text-muted ml-0.5">
          {companionIds
            .map((pid) => catalog.people.find((p) => p.id === pid)?.display_name)
            .filter(Boolean)
            .slice(0, 3)
            .join(", ")}
          {companionIds.length > 3 ? ` +${companionIds.length - 3} more` : ""}
        </span>
      </div>
    </div>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

export function PostCard({ claim, isOwn }: { claim: Claim; isOwn?: boolean }) {
  const { userEntities, removeClaim, membership } = useLineageStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showVerifyGate, setShowVerifyGate] = useState(false)
  const [verifyGateShownThisSession, setVerifyGateShownThisSession] = useState(false)

  const isMember = membership.tier !== "free"

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
        "group bg-surface border-2 rounded-xl p-5 mb-4 transition-all",
        accentClass(claim.predicate)
      )}>
        {/* Entity visual block */}
        <EntityBlock
          claim={claim}
          entityName={entityName}
          isOwn={isOwn}
        />

        {/* Metadata row: predicate + date + badges + privacy + menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Predicate pill */}
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted bg-surface-hover border border-border-default rounded px-1.5 py-0.5">
              {predicateLabel}
            </span>
            {dateRange && (
              <span className="text-xs text-muted">{dateRange}</span>
            )}
            <ConfidenceBadge level={claim.confidence} />
            {isUnverified && <UnverifiedBadge />}
            {claim.sources && claim.sources.length > 0 && (
              <span className="text-[10px] text-muted flex items-center gap-1">
                📎 {claim.sources.length} source{claim.sources.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

            {/* Right: expand toggle + privacy + menu */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasExtra && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-[11px] text-muted hover:text-foreground transition-colors px-1"
                title={expanded ? "Show less" : "Show more"}
              >
                {expanded ? "▲" : "▼"}
              </button>
            )}
            {claim.visibility === "private" && (
              <span className="text-xs text-muted" title="Private">🔒</span>
            )}
            {claim.visibility === "shared" && (
              <span className="text-xs text-muted" title="Shared">👥</span>
            )}

            {!isOwn && claim.object_type && claim.object_id && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <QuickClaimPopover
                  entityId={claim.object_id}
                  entityType={claim.object_type as "person" | "event" | "board" | "org" | "place"}
                  entityName={entityName}
                />
              </div>
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
                        <>
                          <button
                            onClick={() => { setMenuOpen(false); setEditing(true) }}
                            className="w-full text-left px-4 py-2.5 text-xs text-muted hover:bg-surface-active hover:text-foreground transition-colors flex items-center gap-2"
                          >
                            <span>✏️</span> Edit claim
                          </button>
                          {userEvent && (
                            <button
                              onClick={() => { setMenuOpen(false); setEditingEvent(true) }}
                              className="w-full text-left px-4 py-2.5 text-xs text-muted hover:bg-surface-active hover:text-foreground transition-colors flex items-center gap-2"
                            >
                              <span>📋</span> Edit event
                            </button>
                          )}
                          <div className="h-px bg-border-default mx-2" />
                          <button
                            onClick={() => {
                              setMenuOpen(false)
                              if (isMember) {
                                // TODO: member verification flow
                                alert("Verification coming soon for members!")
                              } else if (!verifyGateShownThisSession) {
                                setShowVerifyGate(true)
                                setVerifyGateShownThisSession(true)
                              }
                            }}
                            title={isMember ? "Verify this entry" : "Members can verify entries"}
                            className="w-full text-left px-4 py-2.5 text-xs text-muted hover:text-foreground hover:bg-surface-hover flex items-center gap-2 transition-colors"
                          >
                            <span>✓</span> Verify
                          </button>
                          <button
                            disabled
                            title="Coming soon"
                            className="w-full text-left px-4 py-2.5 text-xs text-muted opacity-40 cursor-not-allowed flex items-center gap-2"
                          >
                            <span>?</span> Challenge
                          </button>
                          <button
                            disabled
                            title="Coming soon"
                            className="w-full text-left px-4 py-2.5 text-xs text-muted opacity-40 cursor-not-allowed flex items-center gap-2"
                          >
                            <span>♥</span> Save
                          </button>
                          <div className="h-px bg-border-default mx-2" />
                          <button
                            onClick={() => setConfirmDelete(true)}
                            className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-surface-active hover:text-red-300 transition-colors flex items-center gap-2"
                          >
                            <span>🗑</span> Delete
                          </button>
                        </>
                      ) : (
                        <div className="px-3 py-3">
                          <p className="text-xs text-muted mb-2">Remove this claim?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="flex-1 px-2 py-1.5 text-xs rounded border border-border-default text-muted hover:text-foreground transition-colors"
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
          <p className="mt-3 text-sm text-muted leading-relaxed border-t border-border-default pt-3">
            {claim.note}
          </p>
        )}
        {expanded && claim.sources && claim.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            {claim.sources.map((s) => (
              <div key={s.id} className="text-xs text-muted">
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

        {/* Companion avatars — other riders tagged at same place/event/year */}
        <CompanionAvatars claim={claim} />
      </div>

      {/* ── Verification gate modal (Section 6.3) ── */}
      {showVerifyGate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={(e) => e.target === e.currentTarget && setShowVerifyGate(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm bg-surface border border-border-default rounded-2xl shadow-2xl p-6 text-center">
            <div className="text-3xl mb-3">✓</div>
            <h3 className="text-base font-bold text-foreground mb-2">
              Verification builds our collective record
            </h3>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Verifying entries is how we keep the history trustworthy.
              It&apos;s a responsibility — and a recognition that you were there.
            </p>
            <p className="text-xs text-muted leading-relaxed mb-5">
              Members can verify entries and earn contribution tokens.
              This is the only feature behind membership.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/membership"
                className="block w-full px-4 py-2.5 rounded-lg text-xs font-bold text-center transition-colors"
                style={{ background: "#3b82f6", color: "#fff" }}
              >
                Become a member — $25/year
              </a>
              <a
                href="/membership"
                onClick={() => setShowVerifyGate(false)}
                className="block w-full px-4 py-2 rounded-lg text-xs text-muted hover:text-foreground border border-border-default transition-colors"
              >
                Learn more about membership
              </a>
              <button
                onClick={() => setShowVerifyGate(false)}
                className="block w-full px-4 py-2 text-xs text-muted hover:text-foreground transition-colors"
              >
                Not right now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
