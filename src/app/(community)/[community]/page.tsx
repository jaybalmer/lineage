"use client"

import { useState, useEffect, useMemo } from "react"
import { CommunityLink } from "@/components/ui/community-link"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { nameToSlug, formatSmartDate } from "@/lib/utils"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import type { Story, Claim, Person } from "@/types"

// ─── Community emoji lookup ──────────────────────────────────────────────────

const COMMUNITY_META: Record<string, { dotColor: string; tagline: string }> = {
  snowboarding: { dotColor: "#B8862A", tagline: "The living history of snowboarding" },
  surf:         { dotColor: "#78716C", tagline: "The living history of surfing" },
  skate:        { dotColor: "#78716C", tagline: "The living history of skateboarding" },
  ski:          { dotColor: "#78716C", tagline: "The living history of skiing" },
  mtb:          { dotColor: "#78716C", tagline: "The living history of mountain biking" },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = ms / 86_400_000
  if (days < 1) return "Today"
  if (days < 3) return "A couple days ago"
  if (days < 14) return "Last week"
  if (days < 60) return "Recently"
  return "A while ago"
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <CommunityLink href={href} className="bg-surface border border-border-default rounded-xl p-4 hover:border-foreground/30 transition-colors">
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </CommunityLink>
  )
}

// ─── Activity Item ───────────────────────────────────────────────────────────

function ActivityItem({ person, text, time }: { person: Person | null; text: string; time: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-default/50 last:border-0">
      {person && (
        <CommunityLink href={`/riders/${nameToSlug(person.display_name)}`} className="flex-shrink-0">
          <RiderAvatar person={person} size="sm" />
        </CommunityLink>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground leading-snug">{text}</div>
        <div className="text-xs text-muted mt-0.5">{time}</div>
      </div>
    </div>
  )
}

// ─── Top Connection Pair ─────────────────────────────────────────────────────

function ConnectionPair({
  personA,
  personB,
  sharedCount,
  label,
}: {
  personA: Person | null
  personB: Person | null
  sharedCount: number
  label: string
}) {
  if (!personA || !personB) return null
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-default/50 last:border-0">
      <div className="flex items-center -space-x-2">
        <RiderAvatar person={personA} size="sm" />
        <RiderAvatar person={personB} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">
          <CommunityLink href={`/riders/${nameToSlug(personA.display_name)}`} className="font-medium hover:text-blue-400 transition-colors">
            {personA.display_name}
          </CommunityLink>
          {" & "}
          <CommunityLink href={`/riders/${nameToSlug(personB.display_name)}`} className="font-medium hover:text-blue-400 transition-colors">
            {personB.display_name}
          </CommunityLink>
        </div>
        <div className="text-xs text-muted mt-0.5">{sharedCount} {label}</div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CommunityHome() {
  const { catalog, catalogLoaded, activeCommunitySlug, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  const meta = COMMUNITY_META[activeCommunitySlug] ?? { dotColor: "#78716C", tagline: "Welcome to this community" }

  // ── Recent activity (stories + claims) ──────────────────────────────────
  const [recentStories, setRecentStories] = useState<Story[]>([])
  useEffect(() => {
    supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentStories(data as Story[])
      })
  }, [])

  // ── Collective stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!catalogLoaded) return null
    return {
      riders: catalog.people.length,
      places: catalog.places.length,
      events: catalog.events.length,
      boards: catalog.boards.length,
      brands: catalog.orgs.length,
      stories: recentStories.length > 0 ? recentStories.length + "+" : "0",
    }
  }, [catalogLoaded, catalog, recentStories])

  // ── Top connections (people with most shared places) ────────────────────
  const topConnections = useMemo(() => {
    if (!catalogLoaded || catalog.claims.length === 0) return []

    // Build person → places map from rode_at claims
    const personPlaces = new Map<string, Set<string>>()
    for (const claim of catalog.claims) {
      if (claim.predicate === "rode_at" && claim.subject_id && claim.object_id) {
        if (!personPlaces.has(claim.subject_id)) personPlaces.set(claim.subject_id, new Set())
        personPlaces.get(claim.subject_id)!.add(claim.object_id)
      }
    }

    // Find pairs with most overlap
    const entries = [...personPlaces.entries()]
    const pairs: { a: string; b: string; shared: number }[] = []
    for (let i = 0; i < entries.length && i < 50; i++) {
      for (let j = i + 1; j < entries.length && j < 50; j++) {
        const [idA, placesA] = entries[i]
        const [idB, placesB] = entries[j]
        let shared = 0
        for (const p of placesA) if (placesB.has(p)) shared++
        if (shared > 0) pairs.push({ a: idA, b: idB, shared })
      }
    }
    pairs.sort((a, b) => b.shared - a.shared)
    return pairs.slice(0, 4)
  }, [catalogLoaded, catalog.claims])

  // ── Recent claims for activity feed ─────────────────────────────────────
  const recentClaims = useMemo(() => {
    if (!catalogLoaded) return []
    return [...catalog.claims]
      .filter((c) => c.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
  }, [catalogLoaded, catalog.claims])

  const findPerson = (id: string): Person | null =>
    catalog.people.find((p) => p.id === id) ?? null

  const predicateLabel = (pred: string) => {
    const labels: Record<string, string> = {
      rode_at: "logged a session at", owned_board: "added a board",
      competed_at: "competed at", spectated_at: "spectated",
      sponsored_by: "picked up a sponsor", worked_at: "worked at",
      part_of_team: "joined a team", organized_at: "organized",
      coached_by: "trained with", fan_of: "follows", rode_with: "rode with",
    }
    return labels[pred] ?? pred.replace(/_/g, " ")
  }

  const entityName = (id: string, type: string) => {
    if (type === "place") return catalog.places.find((p) => p.id === id)?.name ?? "a place"
    if (type === "event") return catalog.events.find((e) => e.id === id)?.name ?? "an event"
    if (type === "board") {
      const b = catalog.boards.find((b) => b.id === id)
      return b ? `${b.brand} ${b.model}` : "a board"
    }
    if (type === "org") return catalog.orgs.find((o) => o.id === id)?.name ?? "a brand"
    if (type === "person") return catalog.people.find((p) => p.id === id)?.display_name ?? "someone"
    return id
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Community header */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: meta.dotColor }} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {activeCommunitySlug.charAt(0).toUpperCase() + activeCommunitySlug.slice(1)}
            </h1>
            <p className="text-muted text-sm mt-1">{meta.tagline}</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          {isAuth ? (
            <CommunityLink
              href="/profile"
              className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-[#F5F2EE] font-semibold text-sm hover:bg-[#292524] transition-colors"
            >
              My Timeline
            </CommunityLink>
          ) : (
            <Link
              href="/onboarding"
              className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-[#F5F2EE] font-semibold text-sm hover:bg-[#292524] transition-colors"
            >
              Start Your Timeline
            </Link>
          )}
          <CommunityLink
            href="/collective"
            className="px-6 py-2.5 rounded-lg border border-border-default text-muted font-semibold text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Collective Timeline
          </CommunityLink>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-8">
            <StatCard label="Riders" value={stats.riders} href="/riders" />
            <StatCard label="Places" value={stats.places} href="/places" />
            <StatCard label="Events" value={stats.events} href="/events" />
            <StatCard label="Boards" value={stats.boards} href="/boards" />
            <StatCard label="Brands" value={stats.brands} href="/brands" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Recent Activity</h2>
              <CommunityLink href="/feed" className="text-xs text-muted hover:text-foreground transition-colors">
                View all
              </CommunityLink>
            </div>
            <div className="bg-surface border border-border-default rounded-xl p-4">
              {recentClaims.length === 0 && (
                <div className="text-sm text-muted py-4 text-center">Loading activity...</div>
              )}
              {recentClaims.map((claim) => {
                const person = findPerson(claim.subject_id)
                const displayName = person?.display_name ?? "Someone"
                const action = predicateLabel(claim.predicate)
                const target = entityName(claim.object_id, claim.object_type)
                return (
                  <ActivityItem
                    key={claim.id}
                    person={person}
                    text={`${displayName} ${action} ${target}`}
                    time={timeAgo(claim.created_at)}
                  />
                )
              })}
            </div>
          </div>

          {/* Top connections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Top Connections</h2>
              <CommunityLink href="/connections" className="text-xs text-muted hover:text-foreground transition-colors">
                View all
              </CommunityLink>
            </div>
            <div className="bg-surface border border-border-default rounded-xl p-4">
              {topConnections.length === 0 && (
                <div className="text-sm text-muted py-4 text-center">Loading connections...</div>
              )}
              {topConnections.map(({ a, b, shared }) => (
                <ConnectionPair
                  key={`${a}-${b}`}
                  personA={findPerson(a)}
                  personB={findPerson(b)}
                  sharedCount={shared}
                  label={shared === 1 ? "shared place" : "shared places"}
                />
              ))}
            </div>

            {/* Recent stories */}
            {recentStories.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Latest Stories</h2>
                  <CommunityLink href="/stories" className="text-xs text-muted hover:text-foreground transition-colors">
                    View all
                  </CommunityLink>
                </div>
                <div className="bg-surface border border-border-default rounded-xl p-4">
                  {recentStories.map((story) => (
                    <div key={story.id} className="py-3 border-b border-border-default/50 last:border-0">
                      <div className="text-sm font-medium text-foreground leading-snug">
                        {story.title || "Untitled story"}
                      </div>
                      <div className="text-xs text-muted mt-1 flex items-center gap-2">
                        {story.author?.display_name && (
                          <span>by {story.author.display_name}</span>
                        )}
                        {story.story_date && (
                          <span>{formatSmartDate(story.story_date)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8">
        <p className="text-muted text-xs">
          Lineage Community Technologies Ltd.
        </p>
      </div>
    </div>
  )
}
