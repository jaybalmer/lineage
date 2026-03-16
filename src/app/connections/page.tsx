"use client"

import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getSharedContext, getPersonById } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { formatDateRange } from "@/lib/utils"
import Link from "next/link"

function ConnectionCard({ personId, currentUserId }: { personId: string; currentUserId: string }) {
  const person = getPersonById(personId)
  if (!person) return null

  const { sharedPlaces, sharedEvents } = getSharedContext(currentUserId, personId)
  const rodeWithClaims = CLAIMS.filter(
    (c) => c.subject_id === currentUserId && c.predicate === "rode_with" && c.object_id === personId
  )
  const dateRange = rodeWithClaims[0] ? formatDateRange(rodeWithClaims[0].start_date, rodeWithClaims[0].end_date) : ""

  return (
    <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-border-default transition-all">
      <div className="flex items-start gap-3">
        <Link href={`/riders/${personId}`} className="flex-shrink-0">
          <RiderAvatar person={person} size="lg" ring={!!(person.membership_tier && person.membership_tier !== "free")} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/riders/${personId}`}>
            <div className="font-semibold text-foreground text-sm hover:text-blue-300 transition-colors">{person.display_name}</div>
          </Link>
          {dateRange && <div className="text-xs text-muted">{dateRange}</div>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Link href={`/compare?b=${personId}`}>
            <button className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:border-border-default hover:text-foreground transition-all whitespace-nowrap">
              Compare ⬡
            </button>
          </Link>
          <Link href={`/connections/${personId}`}>
            <button className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:border-blue-700/50 hover:text-blue-300 hover:bg-blue-950/30 transition-all whitespace-nowrap">
              View connection →
            </button>
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {sharedPlaces.map(({ place }) => (
          <span key={place.id} className="text-[11px] px-2 py-0.5 bg-surface-hover border border-border-default rounded text-muted">
            🏔 {place.name}
          </span>
        ))}
        {sharedEvents.map(({ event }) => (
          <span key={event.id} className="text-[11px] px-2 py-0.5 bg-surface-hover border border-border-default rounded text-muted">
            🏆 {event.name}
          </span>
        ))}
      </div>

      {(sharedPlaces.length > 0 || sharedEvents.length > 0) && (
        <p className="text-xs text-muted mt-2">
          {sharedPlaces.length} shared place{sharedPlaces.length !== 1 ? "s" : ""}
          {sharedEvents.length > 0 ? ` · ${sharedEvents.length} shared event${sharedEvents.length !== 1 ? "s" : ""}` : ""}
        </p>
      )}
    </div>
  )
}

export default function ConnectionsPage() {
  const { activePersonId } = useLineageStore()

  const directConnections = CLAIMS
    .filter((c) => c.subject_id === activePersonId && c.predicate === "rode_with")
    .map((c) => c.object_id)

  // Also find people who rode the same places
  const myPlaces = CLAIMS
    .filter((c) => c.subject_id === activePersonId && c.predicate === "rode_at")
    .map((c) => c.object_id)

  const sharedPlaceRiders = [...new Set(
    CLAIMS
      .filter((c) => c.predicate === "rode_at" && myPlaces.includes(c.object_id) && c.subject_id !== activePersonId)
      .map((c) => c.subject_id)
  )].filter((id) => !directConnections.includes(id))

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted mt-1">Riders you&apos;ve crossed paths with</p>
        </div>

        {/* Direct connections */}
        {directConnections.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
              <span>Your crew</span>
              <div className="flex-1 h-px bg-surface-active" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {directConnections.map((id) => (
                <ConnectionCard key={id} personId={id} currentUserId={activePersonId} />
              ))}
            </div>
          </div>
        )}

        {/* Shared-place riders */}
        {sharedPlaceRiders.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
              <span>Also rode your mountains</span>
              <div className="flex-1 h-px bg-surface-active" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sharedPlaceRiders.map((id) => (
                <ConnectionCard key={id} personId={id} currentUserId={activePersonId} />
              ))}
            </div>
          </div>
        )}

        {/* Connection invite CTA */}
        <div className="mt-10 border border-dashed border-border-default rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🤙</div>
          <div className="text-sm font-medium text-foreground mb-1">Know someone who should be here?</div>
          <p className="text-xs text-muted mb-4">Invite them to add their lineage, or send them a verification request to confirm an overlap.</p>
          <button className="px-4 py-2 bg-surface-hover border border-border-default rounded-lg text-sm text-muted hover:border-border-default hover:text-foreground transition-all">
            Invite a rider
          </button>
        </div>
      </div>
    </div>
  )
}
