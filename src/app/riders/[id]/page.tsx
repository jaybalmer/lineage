"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, getPersonById, getSharedContext } from "@/lib/mock-data"
import { FeedView } from "@/components/feed/feed-view"
import { StartCard } from "@/components/feed/start-card"
import { useLineageStore } from "@/store/lineage-store"
import { getLinkIcon } from "@/components/ui/edit-profile-modal"
import { RiderAvatar, getRiderTier, getInitials } from "@/components/ui/rider-avatar"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import { nameToSlug } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const TIER_BADGE: Record<string, { symbol: string; label: string; color: string }> = {
  annual:   { symbol: "◈", label: "MEMBER",    color: "#3b82f6" },
  lifetime: { symbol: "◆", label: "LIFETIME",  color: "#8b5cf6" },
  founding: { symbol: "✦", label: "FOUNDING",  color: "#f59e0b" },
}

export default function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { activePersonId, profileOverride, membership, catalogLoaded, catalog, setShowMemberCard } = useLineageStore()
  const [playingTimeline, setPlayingTimeline] = useState(false)
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false)
  const [milestoneDismissed, setMilestoneDismissed] = useState(false)

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

  // Wait for catalog + session to hydrate before deciding the page doesn't exist.
  if (!catalogLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-blue-400 text-3xl animate-pulse">⬡</div>
      </div>
    )
  }

  // ── Slug resolution ─────────────────────────────────────────────────────────
  // If id looks like a slug (not a UUID), find the matching person and redirect
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)
  if (!isUuid) {
    const matched = catalog.people.find((p) => nameToSlug(p.display_name) === id)
    if (matched) {
      router.replace(`/riders/${matched.id}`)
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-blue-400 text-3xl animate-pulse">⬡</div>
        </div>
      )
    }
    notFound()
  }

  const isCurrentUser = id === activePersonId

  // Look in catalog.people first (covers DB people + registered profiles)
  const basePerson = catalog.people.find((p) => p.id === id) ?? getPersonById(id)
  if (!basePerson && !isCurrentUser) notFound()

  const person = isCurrentUser
    ? {
        id,
        display_name:   profileOverride.display_name ?? "Rider",
        birth_year:     profileOverride.birth_year,
        riding_since:   profileOverride.riding_since,
        privacy_level:  (profileOverride.privacy_level ?? "public") as "public" | "private" | "shared",
        membership_tier: membership.tier !== "free" ? membership.tier : undefined,
        ...(basePerson ?? {}),
        ...profileOverride,
      }
    : basePerson!

  const personClaims = CLAIMS.filter((c) => c.subject_id === id)

  const { sharedPlaces, sharedEvents } = isCurrentUser
    ? { sharedPlaces: [], sharedEvents: [] }
    : getSharedContext(activePersonId, id)

  const tier = getRiderTier(person)
  const memberBadge = person.membership_tier && TIER_BADGE[person.membership_tier]
    ? TIER_BADGE[person.membership_tier]
    : isCurrentUser && membership.tier !== "free" ? TIER_BADGE[membership.tier] : null

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
          <Link href="/riders" className="hover:text-foreground">Riders</Link>
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
              ring={tier !== "catalog" && tier !== "free-account"}
              className="flex-shrink-0"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{person.display_name}</h1>
                <button
                  onClick={() => setPlayingTimeline(true)}
                  title="Play timeline"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-opacity"
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
                <Link href={`/compare?b=${id}`}>
                  <button className="px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-xs text-muted hover:text-foreground transition-all">
                    Compare ⬡
                  </button>
                </Link>
                <Link href={`/connections/${id}`}>
                  <button className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-all">
                    View connection →
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Post-onboarding welcome banner (Section 6.1) ── */}
        {isCurrentUser && showWelcomeBanner && membership.tier === "free" && (
          <div className="mb-6 rounded-xl border border-border-default bg-surface p-4 flex items-start gap-3">
            <span className="text-lg shrink-0">🏂</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-0.5">
                Your timeline is live. You&apos;re part of 40 years of snowboarding history.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Link href="/connections" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Explore your connections →
                </Link>
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

        {/* ── Member token stats row (Section 5.4) — own profile, paid member ── */}
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

        {/* ── Non-member contribution prompt (Section 5.4 / 6.4) ── */}
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

        {/* Origin card */}
        <StartCard person={person} claims={personClaims} isOwn={false} />

        {/* Feed */}
        <FeedView
          claims={personClaims}
          personName={person.display_name}
          isOwn={false}
          hideActionButtons={true}
        />

      </div>
    </div>
  )
}
