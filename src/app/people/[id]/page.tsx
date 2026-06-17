"use client"

import { use, useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, getPersonById, getSharedContext } from "@/lib/mock-data"
import { FeedView } from "@/components/feed/feed-view"
import { useLineageStore } from "@/store/lineage-store"
import { getRiderTier } from "@/components/ui/rider-avatar"
import { RiderCard } from "@/components/ui/rider-card"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import { nameToSlug } from "@/lib/utils"
import { personHref } from "@/lib/entity-links"
import { useCanonicalPath } from "@/lib/use-canonical-path"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { BrandMark } from "@/components/ui/brand-mark"
import { StackTimelineToggle } from "@/components/public-timeline/stack-timeline-toggle"
import { OwnerTimelinePanel } from "@/components/profile/owner-timeline-panel"
import { InviteRiderModal } from "@/components/ui/invite-rider-modal"
import { HelpConnectCard } from "@/components/ui/help-connect-card"
import { isInvitableNodeStatus, trackInviteEvent } from "@/lib/invite-tracking"
import { isAuthUser } from "@/store/lineage-store"
import { notFound } from "next/navigation"
import { ClaimRequestModal } from "@/components/ui/claim-request-modal"
import { VouchCard, type ClaimRequestWithClaimant } from "@/components/ui/vouch-card"
import { isClaimRequestOpen, userHasOpenClaim, pluralize } from "@/lib/claim-request-helpers"
import type { Claim, ClaimRequestStatus, MembershipState, Story } from "@/types"

export default function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { activePersonId, profileOverride, membership, catalogLoaded, catalog, userEntities, setShowMemberCard, sessionClaims } = useLineageStore()
  const allPeople = [...catalog.people, ...(userEntities.people ?? [])]
  const [playingTimeline, setPlayingTimeline] = useState(false)
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false)
  const [milestoneDismissed, setMilestoneDismissed] = useState(false)
  const [dbClaims, setDbClaims] = useState<Claim[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [claimRequests, setClaimRequests] = useState<ClaimRequestWithClaimant[]>([])
  const [showClaimModal, setShowClaimModal] = useState(false)
  // Public Stack (/t/[slug]) availability for this person — drives the
  // Stack/Timeline toggle. Null until resolved; only shown when enabled.
  const [publicTimeline, setPublicTimeline] = useState<{ enabled: boolean; slug: string | null } | null>(null)

  // Show post-onboarding welcome banner (once, on first profile visit after signup)
  useEffect(() => {
    if (typeof window === "undefined") return
    const pending = localStorage.getItem("lineage_onboarding_banner_pending")
    if (pending === "1") {
      setShowWelcomeBanner(true)
      localStorage.removeItem("lineage_onboarding_banner_pending")
    }
    const dismissed = localStorage.getItem("lineage_milestone_dismissed")
    if (dismissed === "1") setMilestoneDismissed(true)
  }, [])

  // ── Resolve person from slug, short-ID, or UUID ─────────────────────────────
  // slug  e.g. "jay_balmer"  → match by nameToSlug(display_name)
  // uuid  e.g. "0394914d-…"  → direct catalog lookup
  // short e.g. "u2"          → mock-data fallback
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)

  const resolvedPerson = catalogLoaded
    ? (isUuid
        ? (allPeople.find((p) => p.id === id) ?? getPersonById(id) ?? null)
        : (allPeople.find((p) => nameToSlug(p.display_name) === id) ??
           allPeople.find((p) => p.id === id) ??
           getPersonById(id) ??
           null))
    : null

  // The canonical UUID (or short mock ID) used for DB queries and store checks
  const resolvedId = resolvedPerson?.id ?? id

  // Rewrite the address bar to the name-based slug (/people/jay_balmer) when
  // reached via a UUID or stale slug. Falls back to the id for colliding names.
  useCanonicalPath(resolvedPerson ? personHref(resolvedPerson, allPeople) : null)

  // Fetch Supabase claims for this rider — fires once resolved ID is known
  useEffect(() => {
    if (!catalogLoaded || !resolvedId) return
    // The owner's own profile renders <OwnerTimelinePanel/> below, which does its
    // own claims read (unfiltered by visibility). Skip the public read here so we
    // don't fetch a visibility-filtered set the owner never sees.
    if (isAuthUser(activePersonId) && resolvedId === activePersonId) return
    // PB-009 Phase 1: person-detail public read through claims_public.
    supabase
      .from("claims_public")
      .select("*")
      .eq("subject_id", resolvedId)
      .eq("visibility", "public")
      .then(({ data }) => setDbClaims((data ?? []) as Claim[]))

    // PB-009 Phase 2: public person profile shows stories authored by + tagged-in.
    // Tagged-in reads through story_riders_public, so pending tags stay hidden
    // until the tagged rider approves them via /me/tags.
    const isProperUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(resolvedId)

    // PB-010 cleanup: does this person have a live public Stack at /t/[slug]?
    // profiles is the source of truth for public_slug (the catalog `people`
    // table has no such column), so read it directly. Only members (UUID ids)
    // can have one; mock/catalog people never do.
    setPublicTimeline(null)
    if (isProperUuid) {
      supabase
        .from("profiles")
        .select("public_slug, public_timeline_enabled")
        .eq("id", resolvedId)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as { public_slug: string | null; public_timeline_enabled: boolean | null } | null
          setPublicTimeline({
            enabled: row?.public_timeline_enabled === true && !!row?.public_slug,
            slug: row?.public_slug ?? null,
          })
        })
    }

    if (isProperUuid) {
      Promise.all([
        fetch(`/api/stories?author_id=${resolvedId}&limit=100`).then((r) => r.json()).catch(() => []),
        fetch(`/api/stories?rider_id=${resolvedId}&limit=100`).then((r) => r.json()).catch(() => []),
      ]).then(([authored, taggedIn]) => {
        const byId = new Map<string, Story>()
        for (const s of (Array.isArray(authored) ? authored : []) as Story[]) byId.set(s.id, s)
        for (const s of (Array.isArray(taggedIn) ? taggedIn : []) as Story[]) byId.set(s.id, s)
        const merged = Array.from(byId.values()).sort((a, b) =>
          (b.story_date ?? "").localeCompare(a.story_date ?? "")
        )
        setStories(merged)
      })
    }

    fetch(`/api/claim-requests?node_id=${encodeURIComponent(resolvedId)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setClaimRequests(data as ClaimRequestWithClaimant[]) })
      .catch(() => {})
  }, [catalogLoaded, resolvedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for catalog to hydrate before 404-ing
  if (!catalogLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-accent"><BrandMark size={30} /></div>
      </div>
    )
  }

  // Unified profile: the viewer's own /people page renders owner mode — the full
  // timeline toolkit, claims read unfiltered by visibility, and optimistic adds
  // via getAllClaims. Placed before the notFound() guard so the owner reaching
  // their page by UUID (the redirect target from /me/timeline and
  // /{community}/profile) never 404s if their profile row is not yet in the
  // merged catalog. Everyone else falls through to the read-only public view.
  if (isAuthUser(activePersonId) && resolvedId === activePersonId) {
    return <OwnerTimelinePanel />
  }

  if (!resolvedPerson) notFound()

  const isCurrentUser = resolvedId === activePersonId

  const person = isCurrentUser
    ? {
        ...(resolvedPerson ?? {}),
        ...profileOverride,
        ...(membership.tier !== "free" ? { membership_tier: membership.tier } : {}),
      }
    : resolvedPerson

  // Merge Supabase claims + session claims + mock claims (deduplicate by id)
  const mockClaims = CLAIMS.filter((c) => c.subject_id === resolvedId)
  const riderSessionClaims = sessionClaims.filter((c) => c.subject_id === resolvedId)
  const allRiderClaims = [...dbClaims, ...riderSessionClaims, ...mockClaims]
  const personClaims = Array.from(new Map(allRiderClaims.map((c) => [c.id, c])).values())

  const { sharedPlaces, sharedEvents } = isCurrentUser
    ? { sharedPlaces: [], sharedEvents: [] }
    : getSharedContext(activePersonId, resolvedId)

  const tier = getRiderTier(person)

  // ── Summary card props (BUG-035) ────────────────────────────────────────────
  // The public profile now renders the same RiderCard the owner sees. The card's
  // tier badge reads the VIEWED person's tier (not the viewer's), so build a
  // minimal membership from person.membership_tier rather than the store viewer.
  const viewedMembership: MembershipState = {
    tier: person.membership_tier ?? "free",
    status: "active",
    founding_badge: person.membership_tier === "founding",
    token_balance: { founder: 0, member: 0, contribution: 0 },
    gift_codes: [],
    pending_credit: 0,
    is_editor: false,
  }
  const homeResort = person.home_resort_id
    ? (catalog.places.find((p) => p.id === person.home_resort_id) ?? null)
    : null

  // ── Claim-request gating (PB-008 Phase 2 Session 2) ──────────────────────
  const openClaimRequests = claimRequests.filter(isClaimRequestOpen)
  const isAuth = isAuthUser(activePersonId)
  const nodeIsClaimable = person.node_status === "catalog" || person.node_status === "unclaimed"
  const showThisIsMe =
    isAuth &&
    !isCurrentUser &&
    nodeIsClaimable &&
    !userHasOpenClaim(openClaimRequests, activePersonId)
  const showVouchSurface = isAuth && openClaimRequests.length > 0

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {playingTimeline && (
        <TimelinePlayer
          person={person}
          claims={personClaims}
          onClose={() => setPlayingTimeline(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Breadcrumb + Stack/Timeline toggle (toggle only when this person has
            a live public Stack at /t/[slug]). */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="text-xs text-muted">
            <Link href="/people" className="hover:text-foreground">Riders</Link>
            <span className="mx-2">/</span>
            <span className="text-muted">{person.display_name}</span>
          </div>
          {publicTimeline?.enabled && publicTimeline.slug && (
            <StackTimelineToggle
              active="timeline"
              stackHref={`/t/${publicTimeline.slug}`}
              variant="light"
            />
          )}
        </div>

        {/* Profile header */}
        <div className="mb-8">
          {/* Public summary card (BUG-035). Same RiderCard the owner sees on their
              My Timeline; non-owners get background, avatar, tier badge, identity,
              and stat tiles, with precise location hidden (gated inside RiderCard).
              Stat tiles stay non-interactive here (no onStatClick) per BUG-034. */}
          <RiderCard
            person={person}
            claims={personClaims}
            membership={viewedMembership}
            homeResort={homeResort}
            isOwn={isCurrentUser}
            userId={isCurrentUser ? activePersonId : undefined}
            onPlayTimeline={() => setPlayingTimeline(true)}
            onMemberCard={isCurrentUser ? () => setShowMemberCard(true) : undefined}
          />

          {/* Action row */}
          {!isCurrentUser && (
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-border-default">
              <span className="text-sm text-muted">
                <span className="text-foreground font-bold">{personClaims.length}</span> claims
              </span>
              <div className="flex gap-2">
                {isInvitableNodeStatus(person.node_status) && isAuthUser(activePersonId) && (
                  <button
                    onClick={() => {
                      trackInviteEvent("invite_prompt_clicked", {
                        surface: "person_profile",
                        person_id: resolvedId,
                        node_status: person.node_status,
                      })
                      setShowInviteModal(true)
                    }}
                    className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                    style={{ borderColor: "#3b82f640", color: "#3b82f6", background: "#3b82f610" }}
                  >
                    Invite to Linestry
                  </button>
                )}
                <Link href={`/compare?b=${resolvedId}`}>
                  <button className="px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-xs text-muted hover:text-foreground transition-all inline-flex items-center gap-1">
                    Compare <BrandMark size={12} dotColor="#3b82f6" />
                  </button>
                </Link>
                <CommunityLink href={`/connections/${resolvedId}`}>
                  <button className="px-3 py-2 rounded-lg bg-[#1C1917] text-white text-xs font-medium hover:bg-[#292524] transition-all">
                    View connection →
                  </button>
                </CommunityLink>
              </div>
            </div>
          )}
        </div>

        {/* ── Unclaimed profile banner ── */}
        {!isCurrentUser && tier === "unclaimed" && (
          <div
            className="mb-6 rounded-xl p-4 flex items-start gap-3"
            style={{ background: "#3b82f608", border: "1px dashed #3b82f640" }}
          >
            <span className="text-base shrink-0" style={{ color: "#3b82f6" }}>👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-0.5">
                This profile hasn&apos;t been claimed yet
              </p>
              <p className="text-xs text-muted leading-relaxed">
                {person.display_name} exists in the graph because another member mentioned them.
                {person.added_by && (() => {
                  const addedBy = allPeople.find((p) => p.id === person.added_by)
                  return addedBy ? ` Added by ${addedBy.display_name}.` : ""
                })()}
              </p>
              {isAuthUser(activePersonId) && (
                <div className="flex items-center gap-3 mt-2">
                  {showThisIsMe && (
                    <button
                      onClick={() => setShowClaimModal(true)}
                      className="text-xs font-semibold transition-colors hover:opacity-80"
                      style={{ color: "#3b82f6" }}
                    >
                      This is me →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      trackInviteEvent("invite_prompt_clicked", {
                        surface: "person_profile_banner",
                        person_id: resolvedId,
                        node_status: person.node_status,
                      })
                      setShowInviteModal(true)
                    }}
                    className="text-xs font-medium transition-colors hover:opacity-80"
                    style={{ color: "#3b82f6" }}
                  >
                    Invite to Linestry →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── "This is me" CTA when banner not shown (e.g. catalog tier) ── */}
        {!isCurrentUser && tier !== "unclaimed" && showThisIsMe && (
          <div className="mb-6 rounded-xl p-4 flex items-start gap-3 border border-blue-200 bg-blue-50">
            <span className="text-base shrink-0 text-blue-600">👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Is this you?</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Claim this profile to add your timeline and verify the connections others have made.
              </p>
              <button
                onClick={() => setShowClaimModal(true)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors mt-2"
              >
                This is me →
              </button>
            </div>
          </div>
        )}

        {/* ── Help connect this person (Session 4 Item 2) ──────────────────
            Shown to any authed visitor (not the subject themselves) when the
            profile is invitable. Sits alongside "This is me" — copy-link and
            email-share are always visible, no extra click required. */}
        {!isCurrentUser && isAuth && isInvitableNodeStatus(person.node_status) && (
          <HelpConnectCard
            personId={resolvedId}
            personName={person.display_name}
            inviterName={
              (profileOverride?.display_name as string | undefined) ??
              catalog.people.find((p) => p.id === activePersonId)?.display_name ??
              "Someone"
            }
          />
        )}

        {/* ── Vouch surface: open claim requests on this profile ── */}
        {showVouchSurface && (
          <div className="mb-6">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">
              Open claim {pluralize(openClaimRequests.length, "request", "requests")}
            </div>
            {openClaimRequests.map((r) => (
              <VouchCard
                key={r.id}
                request={r}
                currentUserId={activePersonId}
                onVouched={(next: { status: ClaimRequestStatus; vouch_count: number }) => {
                  setClaimRequests((prev) =>
                    prev.map((p) =>
                      p.id === r.id
                        ? {
                            ...p,
                            status: next.status,
                            vouches_received: [
                              ...(p.vouches_received ?? []),
                              { voucher_id: activePersonId, relationship: "rode_with", note: null, created_at: new Date().toISOString() },
                            ],
                          }
                        : p,
                    ),
                  )
                }}
              />
            ))}
          </div>
        )}

        {/* ── Post-onboarding welcome banner ── */}
        {isCurrentUser && showWelcomeBanner && membership.tier === "free" && (
          <div className="mb-6 rounded-xl border border-border-default bg-surface p-4 flex items-start gap-3">
            <span className="text-lg shrink-0">🏂</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-0.5">
                Your timeline is live. You&apos;re part of 40 years of snowboarding history.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <CommunityLink href="/connections" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Explore your connections →
                </CommunityLink>
                <Link href="/membership" className="text-xs text-muted hover:text-foreground transition-colors">
                  Learn about membership →
                </Link>
              </div>
            </div>
            <button
              onClick={() => setShowWelcomeBanner(false)}
              className="text-muted hover:text-foreground transition-colors shrink-0 text-lg leading-none"
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* ── Member token stats row — own profile, paid member ── */}
        {isCurrentUser && membership.tier !== "free" && (
          <div className="mb-6 rounded-xl border border-border-default bg-surface px-4 py-3 flex items-center gap-4 text-xs text-muted flex-wrap">
            <span>
              <span className="font-bold text-foreground">
                {(membership.token_balance?.founder ?? 0) * 2 +
                 (membership.token_balance?.member ?? 0) +
                 (membership.token_balance?.contribution ?? 0)}
              </span>{" "}
              weighted tokens
            </span>
            <span className="text-border-default">·</span>
            <span>Next distribution: <span className="text-foreground">April 2026</span></span>
            <span className="text-border-default">·</span>
            <Link href="/account/membership" className="text-blue-400 hover:text-blue-300 transition-colors">
              View dashboard →
            </Link>
          </div>
        )}

        {/* ── Non-member contribution prompt ── */}
        {isCurrentUser && membership.tier === "free" && !milestoneDismissed && personClaims.length >= 5 && (
          <div className="mb-6 rounded-xl border border-border-default bg-surface p-4 flex items-start gap-3">
            <span className="text-muted text-base shrink-0">◎</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground mb-0.5">
                You&apos;ve added <span className="font-bold">{personClaims.length}</span> entries to the collective history.
              </p>
              <p className="text-xs text-muted mt-0.5 mb-2">
                Members earn tokens for every verified entry — including these.
              </p>
              <Link href="/membership" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                What is membership? →
              </Link>
            </div>
            <button
              onClick={() => {
                setMilestoneDismissed(true)
                if (typeof window !== "undefined") localStorage.setItem("lineage_milestone_dismissed", "1")
              }}
              className="text-muted hover:text-foreground transition-colors shrink-0 text-lg leading-none"
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* Shared context */}
        {!isCurrentUser && (sharedPlaces.length > 0 || sharedEvents.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">You both…</div>
            <div className="flex flex-wrap gap-2">
              {sharedPlaces.map(({ place }) => (
                <span key={place.id} className="text-xs px-3 py-1.5 bg-blue-100 border border-blue-200 rounded-lg text-blue-700">
                  🏔 Rode {place.name}
                </span>
              ))}
              {sharedEvents.map(({ event }) => (
                <span key={event.id} className="text-xs px-3 py-1.5 bg-blue-100 border border-blue-200 rounded-lg text-blue-700">
                  🏆 {event.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feed */}
        <FeedView
          claims={personClaims}
          stories={stories}
          personName={person.display_name}
          isOwn={false}
          hideActionButtons={true}
          ridingSince={person.riding_since}
          person={person}
        />

      </div>

      {showInviteModal && (
        <InviteRiderModal
          personId={resolvedId}
          personName={person.display_name}
          predicate="rode_with"
          surface="person_profile"
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showClaimModal && (
        <ClaimRequestModal
          personId={resolvedId}
          personName={person.display_name}
          onClose={() => setShowClaimModal(false)}
          onCreated={(req) => {
            setClaimRequests((prev) => [
              ...prev,
              { ...req, claimant: { display_name: "You", avatar_url: null } },
            ])
            setShowClaimModal(false)
          }}
        />
      )}
    </div>
  )
}
