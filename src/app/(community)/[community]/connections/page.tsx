"use client"

import { useState, useEffect, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, PEOPLE, getPlaceById, getEventById } from "@/lib/mock-data"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import type { Claim, Person, Place, Event } from "@/types"

// ─── helpers ──────────────────────────────────────────────────────────────────

/** All claims for a given person — checks catalog (DB) first, then mock CLAIMS. */
function claimsFor(personId: string, catalogClaims: Claim[]): Claim[] {
  const fromCatalog = catalogClaims.filter((c) => c.subject_id === personId)
  const fromMock    = CLAIMS.filter((c) => c.subject_id === personId)
  const seenIds     = new Set(fromCatalog.map((c) => c.id))
  return [...fromCatalog, ...fromMock.filter((c) => !seenIds.has(c.id))]
}

/** Look up a Person — catalog first (includes real DB users), then static PEOPLE. */
function personFromCatalog(id: string, catalogPeople: Person[]): Person | null {
  return catalogPeople.find((p) => p.id === id) ?? PEOPLE.find((p) => p.id === id) ?? null
}

// ─── ConnectionCard ───────────────────────────────────────────────────────────

function ConnectionCard({
  personId,
  myClaims,
}: {
  personId: string
  myClaims: Claim[]
}) {
  const { catalog } = useLineageStore()
  const person = personFromCatalog(personId, catalog.people)
  if (!person) return null

  const otherClaims = claimsFor(personId, catalog.claims)

  // Shared places
  const myPlaceIds = new Set(myClaims.filter((c) => c.predicate === "rode_at").map((c) => c.object_id))
  const sharedPlaceIds = [...new Set(
    otherClaims
      .filter((c) => c.predicate === "rode_at" && myPlaceIds.has(c.object_id))
      .map((c) => c.object_id)
  )]
  const sharedPlaces: Place[] = sharedPlaceIds
    .map((id) => catalog.places.find((p) => p.id === id) ?? getPlaceById(id))
    .filter((p): p is Place => p != null)

  // Shared events (competed_at)
  const myEventIds = new Set(myClaims.filter((c) => c.predicate === "competed_at").map((c) => c.object_id))
  const sharedEventIds = [...new Set(
    otherClaims
      .filter((c) => c.predicate === "competed_at" && myEventIds.has(c.object_id))
      .map((c) => c.object_id)
  )]
  const sharedEvents: Event[] = sharedEventIds
    .map((id) => catalog.events.find((e) => e.id === id) ?? getEventById(id))
    .filter((e): e is Event => e != null)

  return (
    <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-border-default transition-all">
      <div className="flex items-start gap-3">
        <CommunityLink href={`/riders/${personId}`} className="flex-shrink-0">
          <RiderAvatar
            person={person}
            size="lg"
            ring={!!(person.membership_tier && person.membership_tier !== "free")}
          />
        </CommunityLink>
        <div className="min-w-0 flex-1">
          <CommunityLink href={`/riders/${personId}`}>
            <div className="font-semibold text-foreground text-sm hover:text-blue-300 transition-colors">
              {person.display_name}
            </div>
          </CommunityLink>
          {person.riding_since && (
            <div className="text-xs text-muted">Riding since {person.riding_since}</div>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Link href={`/compare?b=${personId}`}>
            <button className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:text-foreground transition-all whitespace-nowrap">
              Compare ⬡
            </button>
          </Link>
          <CommunityLink href={`/connections/${personId}`}>
            <button className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:text-blue-300 hover:bg-blue-950/30 transition-all whitespace-nowrap">
              View connection →
            </button>
          </CommunityLink>
        </div>
      </div>

      {(sharedPlaces.length > 0 || sharedEvents.length > 0) && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sharedPlaces.map((place) => (
              <span key={place.id} className="text-[11px] px-2 py-0.5 bg-surface-hover border border-border-default rounded text-muted">
                🏔 {place.name}
              </span>
            ))}
            {sharedEvents.map((event) => (
              <span key={event.id} className="text-[11px] px-2 py-0.5 bg-surface-hover border border-border-default rounded text-muted">
                🏆 {event.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            {sharedPlaces.length > 0 && `${sharedPlaces.length} shared place${sharedPlaces.length !== 1 ? "s" : ""}`}
            {sharedPlaces.length > 0 && sharedEvents.length > 0 && " · "}
            {sharedEvents.length > 0 && `${sharedEvents.length} shared event${sharedEvents.length !== 1 ? "s" : ""}`}
          </p>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const {
    activePersonId,
    membership,
    sessionClaims,
    dbClaims,
    deletedClaimIds,
    claimOverrides,
    catalog,
  } = useLineageStore()

  const [connectionCtaDismissed, setConnectionCtaDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (localStorage.getItem("lineage_connection_cta_dismissed") === "1") {
      setConnectionCtaDismissed(true)
    }
  }, [])

  const dismissConnectionCta = () => {
    setConnectionCtaDismissed(true)
    if (typeof window !== "undefined") {
      localStorage.setItem("lineage_connection_cta_dismissed", "1")
    }
  }

  const isMember = membership.tier !== "free"

  // Real claims for the logged-in user (DB + session, with deletions/overrides applied)
  const myClaims = useMemo(
    () => getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId),
    [sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId]
  )

  // Direct rode_with connections
  const directConnections = useMemo(
    () => [...new Set(
      myClaims
        .filter((c) => c.predicate === "rode_with")
        .map((c) => c.object_id)
        .filter((id) => id !== activePersonId)
    )],
    [myClaims, activePersonId]
  )

  // Places I've ridden
  const myPlaceIds = useMemo(
    () => new Set(myClaims.filter((c) => c.predicate === "rode_at").map((c) => c.object_id)),
    [myClaims]
  )

  // Events I've competed at
  const myEventIds = useMemo(
    () => new Set(myClaims.filter((c) => c.predicate === "competed_at").map((c) => c.object_id)),
    [myClaims]
  )

  // All other riders' claims — catalog (DB) + static CLAIMS, deduplicated
  const allOtherClaims = useMemo(() => {
    const fromCatalog = catalog.claims.filter((c) => c.subject_id !== activePersonId)
    const seenIds = new Set(fromCatalog.map((c) => c.id))
    const fromMock = CLAIMS.filter(
      (c) => c.subject_id !== activePersonId && !seenIds.has(c.id)
    )
    return [...fromCatalog, ...fromMock]
  }, [catalog.claims, activePersonId])

  // Riders who share at least one of my mountains (exclude direct connections + self)
  const directSet = useMemo(() => new Set(directConnections), [directConnections])

  const sharedPlaceRiders = useMemo(
    () => [...new Set(
      allOtherClaims
        .filter((c) => c.predicate === "rode_at" && myPlaceIds.has(c.object_id))
        .map((c) => c.subject_id)
        .filter((id) => id !== activePersonId && !directSet.has(id))
    )],
    [allOtherClaims, myPlaceIds, activePersonId, directSet]
  )

  // Riders who share at least one event (exclude above sections + self)
  const knownSet = useMemo(
    () => new Set([...directConnections, ...sharedPlaceRiders]),
    [directConnections, sharedPlaceRiders]
  )

  const sharedEventRiders = useMemo(
    () => [...new Set(
      allOtherClaims
        .filter((c) => c.predicate === "competed_at" && myEventIds.has(c.object_id))
        .map((c) => c.subject_id)
        .filter((id) => id !== activePersonId && !knownSet.has(id))
    )],
    [allOtherClaims, myEventIds, activePersonId, knownSet]
  )

  const totalConnections = directConnections.length + sharedPlaceRiders.length + sharedEventRiders.length

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted mt-1">Riders you&apos;ve crossed paths with</p>
        </div>

        {/* Direct — rode with */}
        {directConnections.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
              <span>Your crew</span>
              <div className="flex-1 h-px bg-surface-active" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {directConnections.map((id) => (
                <ConnectionCard key={id} personId={id} myClaims={myClaims} />
              ))}
            </div>
          </div>
        )}

        {/* Shared mountains */}
        {sharedPlaceRiders.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
              <span>Also rode your mountains</span>
              <div className="flex-1 h-px bg-surface-active" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sharedPlaceRiders.map((id) => (
                <ConnectionCard key={id} personId={id} myClaims={myClaims} />
              ))}
            </div>
          </div>
        )}

        {/* Shared events */}
        {sharedEventRiders.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
              <span>Also competed at your events</span>
              <div className="flex-1 h-px bg-surface-active" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sharedEventRiders.map((id) => (
                <ConnectionCard key={id} personId={id} myClaims={myClaims} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalConnections === 0 && (
          <div className="text-center py-16 text-muted">
            <div className="text-4xl mb-4">⬡</div>
            <p className="text-sm font-medium text-foreground mb-1">No connections yet</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Add places you&apos;ve ridden, events you&apos;ve competed at, or riders you&apos;ve ridden with — and anyone who shares those moments will appear here.
            </p>
          </div>
        )}

        {/* Membership CTA */}
        {!isMember && !connectionCtaDismissed && totalConnections > 0 && (
          <div className="mt-8 rounded-xl border border-border-default bg-surface p-5">
            <div className="h-px bg-border-default mb-4" />
            <p className="text-sm text-foreground mb-1">
              Connections like this get stronger when they&apos;re verified.
            </p>
            <p className="text-xs text-muted mb-4">
              Members can confirm shared moments and link your histories officially.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/membership"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Become a member →
              </Link>
              <button
                onClick={dismissConnectionCta}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {/* Invite CTA */}
        <div className="mt-10 border border-dashed border-border-default rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🤙</div>
          <div className="text-sm font-medium text-foreground mb-1">Know someone who should be here?</div>
          <p className="text-xs text-muted mb-4">
            Invite them to add their lineage, or send them a verification request to confirm an overlap.
          </p>
          <button className="px-4 py-2 bg-surface-hover border border-border-default rounded-lg text-sm text-muted hover:text-foreground transition-all">
            Invite a rider
          </button>
        </div>
      </div>
    </div>
  )
}
