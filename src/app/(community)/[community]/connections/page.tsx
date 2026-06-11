"use client"

import { useState, useEffect, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, PEOPLE, getPlaceById, getEventById } from "@/lib/mock-data"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { personHref } from "@/lib/entity-links"
import { supabase } from "@/lib/supabase"
import { RiderAvatar, getRiderTier } from "@/components/ui/rider-avatar"
import { InviteRiderModal } from "@/components/ui/invite-rider-modal"
import { isInvitableNodeStatus } from "@/lib/invite-tracking"
import { deriveStoryConnectionCandidates } from "@/lib/connection-derived"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { BrandMark } from "@/components/ui/brand-mark"
import type { Claim, Person, Place, Event } from "@/types"

// Shared event attendance counts the same whether competed / spectated /
// organized (BUG-014 §3).
const EVENT_PREDICATES = new Set(["competed_at", "spectated_at", "organized_at"])

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
  onInvite,
}: {
  personId: string
  myClaims: Claim[]
  onInvite?: (p: Person) => void
}) {
  const { catalog } = useLineageStore()
  const person = personFromCatalog(personId, catalog.people)
  if (!person) return null

  const tier = getRiderTier(person)
  // Ghost (unclaimed/catalog) riders get an Invite CTA; unclaimed also gets the
  // blue dashed ring treatment (BUG-014 §4).
  const invitable = isInvitableNodeStatus(person.node_status)
  const showRing = tier === "unclaimed" || !!(person.membership_tier && person.membership_tier !== "free")

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

  // Shared events (competed / spectated / organized)
  const myEventIds = new Set(myClaims.filter((c) => EVENT_PREDICATES.has(c.predicate)).map((c) => c.object_id))
  const sharedEventIds = [...new Set(
    otherClaims
      .filter((c) => EVENT_PREDICATES.has(c.predicate) && myEventIds.has(c.object_id))
      .map((c) => c.object_id)
  )]
  const sharedEvents: Event[] = sharedEventIds
    .map((id) => catalog.events.find((e) => e.id === id) ?? getEventById(id))
    .filter((e): e is Event => e != null)

  return (
    <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-border-default transition-all">
      <div className="flex items-start gap-3">
        <CommunityLink href={personHref(person, catalog.people)} className="flex-shrink-0">
          <RiderAvatar person={person} size="lg" ring={showRing} />
        </CommunityLink>
        <div className="min-w-0 flex-1">
          <CommunityLink href={personHref(person, catalog.people)}>
            <div className="font-semibold text-foreground text-sm hover:text-blue-300 transition-colors">
              {person.display_name}
            </div>
          </CommunityLink>
          {person.riding_since && (
            <div className="text-xs text-muted">Riding since {person.riding_since}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 flex-shrink-0 justify-end">
          <Link href={`/compare?b=${personId}`}>
            <button className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:text-foreground transition-all whitespace-nowrap inline-flex items-center gap-1">
              Compare <BrandMark size={12} />
            </button>
          </Link>
          {invitable && onInvite ? (
            <button
              onClick={() => onInvite(person)}
              className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:text-foreground transition-all whitespace-nowrap"
              title="Invite this rider to claim their profile"
            >
              Invite
            </button>
          ) : (
            <CommunityLink href={`/connections/${personId}`}>
              <button className="px-2.5 py-1 bg-surface-hover border border-border-default rounded-lg text-[11px] text-muted hover:text-blue-300 hover:bg-blue-950/30 transition-all whitespace-nowrap">
                View connection →
              </button>
            </CommunityLink>
          )}
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
    authReady,
    membership,
    sessionClaims,
    dbClaims,
    setDbClaims,
    deletedClaimIds,
    claimOverrides,
    catalog,
  } = useLineageStore()

  const [connectionCtaDismissed, setConnectionCtaDismissed] = useState(false)
  const [invitePerson, setInvitePerson] = useState<Person | null>(null)

  // BUG-014 symmetric/derived inputs: claims where I am the OBJECT (incoming
  // rode_with), and people co-tagged with me through stories. Kept out of
  // dbClaims so the rest of the app's reads stay subject-only.
  const [incomingClaims, setIncomingClaims] = useState<Claim[]>([])
  const [storyCandidates, setStoryCandidates] = useState<string[]>([])

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

  // Load this user's own claims into the store. The connection lists derive from
  // getAllClaims(), which reads dbClaims; previously only the profile page loaded
  // dbClaims, so landing here first showed an empty page until a later visit.
  const [claimsLoaded, setClaimsLoaded] = useState(false)

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) {
      setClaimsLoaded(true)
      setIncomingClaims([])
      setStoryCandidates([])
      return
    }
    let cancelled = false
    supabase
      .from("claims_public")
      .select("*")
      .eq("subject_id", activePersonId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) setDbClaims(data as Claim[])
        setClaimsLoaded(true)
      })
    // Symmetric read (BUG-014 §3): claims where I am the OBJECT. Kept separate
    // from dbClaims (subject-only, app-wide) so another rider's claim never
    // leaks onto my timeline. Only the connection derivation reads it.
    supabase
      .from("claims_public")
      .select("*")
      .eq("object_id", activePersonId)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setIncomingClaims(data as Claim[])
      })
    // Story-co-tagged candidates (BUG-014 §4).
    deriveStoryConnectionCandidates(activePersonId!)
      .then((ids) => { if (!cancelled) setStoryCandidates(ids) })
      .catch(() => { if (!cancelled) setStoryCandidates([]) })
    return () => { cancelled = true }
  }, [authReady, activePersonId, setDbClaims])

  const isMember = membership.tier !== "free"

  // Real claims for the logged-in user (DB + session, with deletions/overrides applied).
  // Held empty until authReady so a signed-in user never briefly sees the mock graph
  // that getAllClaims() returns while activePersonId is still resolving.
  const myClaims = useMemo(
    () => authReady
      ? getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
      : [],
    [authReady, sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId]
  )

  // Direct rode_with connections, symmetric: people I tagged (I'm subject) plus
  // people who tagged me (I'm object). Fixes Cory's approved member-to-member
  // tag showing nothing (BUG-014 §3).
  const directConnections = useMemo(
    () => [...new Set([
      ...myClaims.filter((c) => c.predicate === "rode_with").map((c) => c.object_id),
      ...incomingClaims.filter((c) => c.predicate === "rode_with").map((c) => c.subject_id),
    ].filter((id) => id && id !== activePersonId))],
    [myClaims, incomingClaims, activePersonId]
  )

  // Places I've ridden
  const myPlaceIds = useMemo(
    () => new Set(myClaims.filter((c) => c.predicate === "rode_at").map((c) => c.object_id)),
    [myClaims]
  )

  // Events I've attended (competed / spectated / organized)
  const myEventIds = useMemo(
    () => new Set(myClaims.filter((c) => EVENT_PREDICATES.has(c.predicate)).map((c) => c.object_id)),
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
        .filter((c) => EVENT_PREDICATES.has(c.predicate) && myEventIds.has(c.object_id))
        .map((c) => c.subject_id)
        .filter((id) => id !== activePersonId && !knownSet.has(id))
    )],
    [allOtherClaims, myEventIds, activePersonId, knownSet]
  )

  // Story-co-tagged riders not already surfaced through a claim overlap. Ghosts
  // included. They render with the unclaimed treatment + Invite (BUG-014 §4).
  const shownSet = useMemo(
    () => new Set([...directConnections, ...sharedPlaceRiders, ...sharedEventRiders]),
    [directConnections, sharedPlaceRiders, sharedEventRiders]
  )
  const storyConnections = useMemo(
    () => storyCandidates.filter((id) => id !== activePersonId && !shownSet.has(id)),
    [storyCandidates, shownSet, activePersonId]
  )

  const totalConnections =
    directConnections.length + sharedPlaceRiders.length + sharedEventRiders.length + storyConnections.length

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
                <ConnectionCard key={id} personId={id} myClaims={myClaims} onInvite={setInvitePerson} />
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
                <ConnectionCard key={id} personId={id} myClaims={myClaims} onInvite={setInvitePerson} />
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
                <ConnectionCard key={id} personId={id} myClaims={myClaims} onInvite={setInvitePerson} />
              ))}
            </div>
          </div>
        )}

        {/* Tagged together in stories (BUG-014) */}
        {storyConnections.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
              <span>Tagged together in stories</span>
              <div className="flex-1 h-px bg-surface-active" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {storyConnections.map((id) => (
                <ConnectionCard key={id} personId={id} myClaims={myClaims} onInvite={setInvitePerson} />
              ))}
            </div>
          </div>
        )}

        {/* Loading state: own claims still resolving, nothing to show yet */}
        {totalConnections === 0 && !claimsLoaded && (
          <div className="text-center py-16 text-muted">
            <div className="mb-4 flex justify-center"><BrandMark size={36} /></div>
            <p className="text-sm text-muted">Loading your connections...</p>
          </div>
        )}

        {/* Empty state: claims loaded, genuinely no overlaps yet */}
        {totalConnections === 0 && claimsLoaded && (
          <div className="text-center py-16 text-muted">
            <div className="mb-4 flex justify-center"><BrandMark size={36} /></div>
            <p className="text-sm font-medium text-foreground mb-1">No connections yet</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Add places you&apos;ve ridden, events you&apos;ve competed at, or riders you&apos;ve ridden with, and anyone who shares those moments will appear here.
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
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1C1917] text-white hover:bg-[#292524] transition-colors"
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
            Invite them to add their linestry, or send them a verification request to confirm an overlap.
          </p>
          <button className="px-4 py-2 bg-surface-hover border border-border-default rounded-lg text-sm text-muted hover:text-foreground transition-all">
            Invite a rider
          </button>
        </div>
      </div>

      {invitePerson && (
        <InviteRiderModal
          personId={invitePerson.id}
          personName={invitePerson.display_name}
          predicate="rode_with"
          surface="help_connect_card"
          onClose={() => setInvitePerson(null)}
        />
      )}
    </div>
  )
}
