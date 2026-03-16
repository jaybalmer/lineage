"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, getPersonById, getSharedContext } from "@/lib/mock-data"
import { FeedView } from "@/components/feed/feed-view"
import { StartCard } from "@/components/feed/start-card"
import { useLineageStore } from "@/store/lineage-store"
import { getLinkIcon } from "@/components/ui/edit-profile-modal"
import { RiderAvatar, getRiderTier, getInitials } from "@/components/ui/rider-avatar"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import Link from "next/link"
import { notFound } from "next/navigation"

// Convert a display name to URL slug: "Sean Balmer" → "sean_balmer"
export function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

const TIER_BADGE: Record<string, { symbol: string; label: string; color: string }> = {
  annual:   { symbol: "◈", label: "MEMBER",    color: "#3b82f6" },
  lifetime: { symbol: "◆", label: "LIFETIME",  color: "#8b5cf6" },
  founding: { symbol: "✦", label: "FOUNDING",  color: "#f59e0b" },
}

export default function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { activePersonId, profileOverride, membership, catalogLoaded, catalog } = useLineageStore()
  const [playingTimeline, setPlayingTimeline] = useState(false)

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
