"use client"

import { use, useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, getPersonById, getSharedContext } from "@/lib/mock-data"
import { FeedView } from "@/components/feed/feed-view"
import { useLineageStore } from "@/store/lineage-store"
import { getLinkIcon } from "@/components/ui/edit-profile-modal"
import { RiderAvatar, getRiderTier } from "@/components/ui/rider-avatar"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import { nameToSlug } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { InviteRiderModal } from "@/components/ui/invite-rider-modal"
import { HelpConnectCard } from "@/components/ui/help-connect-card"
import { isInvitableNodeStatus, trackInviteEvent } from "@/lib/invite-tracking"
import { isAuthUser } from "@/store/lineage-store"
import { notFound } from "next/navigation"
import { ClaimRequestModal } from "@/components/ui/claim-request-modal"
import { VouchCard, type ClaimRequestWithClaimant } from "@/components/ui/vouch-card"
import { isClaimRequestOpen, userHasOpenClaim, pluralize } from "@/lib/claim-request-helpers"
import type { Claim, ClaimRequestStatus, Story } from "@/types"

const TIER_BADGE: Record<string, { symbol: string; label: string; color: string }> = {
  annual:   { symbol: "◈", label: "MEMBER",    color: "#f97316" },
  lifetime: { symbol: "◆", label: "LIFETIME",  color: "#f97316" },
  founding: { symbol: "✦", label: "FOUNDING",  color: "#f59e0b" },
}

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

  // Fetch Supabase claims for this rider — fires once resolved ID is known
  useEffect(() => {
    if (!catalogLoaded || !resolvedId) return
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
        <div className="text-[#B8862A] text-3xl animate-pulse">⬡</div>
      </div>
    )
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
  const memberBadge = person.membership_tier && TIER_BADGE[person.membership_tier]
    ? TIER_BADGE[person.membership_tier]
    : isCurrentUser && membership.tier !== "free" ? TIER_BADGE[membership.tier] : null

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

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/people" className="hover:text-foreground">Riders</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{person.display_name}</span>
        </div>

        {/* Profile header */}
        <div className="mb-8">
          <div className="flex items-start gap-5">
            {/* Avatar — xl with ring for paid tiers */}
            <RiderAvatar
              person={person}
              size="xl"
              ring={tier !== "catalog"}
              className="flex-shrink-0"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{person.display_name}</h1>
                <button
                  onClick={() => setPlayingTimeline(true)}
                  title="Play timeline"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  <span className="text-[10px]">▶</span>
                  <span>{isCurrentUser ? "My Timeline" : `${person.display_name.split(" ")[0]}'s Timeline`}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                {person.birth_year && <span>b. {person.birth_year}</span>}
                {person.riding_since && <span>Riding since {person.riding_since}</span>}

                {/* Membership badge */}
                {memberBadge && (
                  isCurrentUser ? (
                    <Link
                      href="/account/membership"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-opacity hover:opacity-80"
                      style={{ background: `${memberBadge.color}22`, color: memberBadge.color, border: `1px solid ${memberBadge.color}44` }}
                      title="View membership"
                    >
                      <span>{memberBadge.symbol}</span>
                      <span>{memberBadge.label}</span>
                      {membership.founding_member_number && (
                        <span>#{String(membership.founding_member_number).padStart(3, "0")}</span>
                      )}
                    </Link>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ background: `${memberBadge.color}22`, color: memberBadge.color, border: `1px solid ${memberBadge.color}44` }}
                    >
                      <span>{memberBadge.symbol}</span>
                      <span>{memberBadge.label}</span>
                    </span>
                  )
                )}

                {/* Member card trigger — own profile, paid member only */}
                {isCurrentUser && memberBadge && (
                  <button
                    onClick={() => setShowMemberCard(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-opacity hover:opacity-80"
                    style={{ background: "#f59e0b18", color: "#b45309", border: "1px solid #f59e0b44" }}
                    title="View your member card"
                  >
                    ✦ Member card
                  </button>
                )}
              </div>

              {person.bio && (
                <p className="text-sm text-muted mt-2 leading-relaxed max-w-lg">{person.bio}</p>
              )}

              {person.links && person.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {person.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover border border-border-default rounded-lg text-xs text-muted hover:text-foreground transition-all"
                    >
                      <span>{getLinkIcon(link.url)}</span>
                      <span>{link.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

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
                    Invite to Lineage
                  </button>
                )}
                <Link href={`/compare?b=${resolvedId}`}>
                  <button className="px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-xs text-muted hover:text-foreground transition-all">
                    Compare ⬡
                  </button>
                </Link>
                <CommunityLink href={`/connections/${resolvedId}`}>
                  <button className="px-3 py-2 rounded-lg bg-[#1C1917] text-[#F5F2EE] text-xs font-medium hover:bg-[#292524] transition-all">
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
                    Invite to Lineage →
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
