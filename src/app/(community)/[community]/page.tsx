"use client"

import { useState, useEffect, useMemo } from "react"
import { CommunityLink } from "@/components/ui/community-link"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import {
  CommunityTimeline,
  type CommunityFilter,
  type CommunitySort,
} from "@/components/feed/community-timeline"
import { cn } from "@/lib/utils"
import type { Story } from "@/types"

// ─── Community emoji lookup ──────────────────────────────────────────────────

const COMMUNITY_META: Record<string, { dotColor: string; tagline: string }> = {
  snowboarding: { dotColor: "#3b82f6", tagline: "The living history of snowboarding" },
  surf:         { dotColor: "#78716C", tagline: "The living history of surfing" },
  skate:        { dotColor: "#78716C", tagline: "The living history of skateboarding" },
  ski:          { dotColor: "#78716C", tagline: "The living history of skiing" },
  mtb:          { dotColor: "#78716C", tagline: "The living history of mountain biking" },
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

// ─── Timeline controls ───────────────────────────────────────────────────────

const FILTER_TABS: { value: CommunityFilter; label: string; activeClass: string }[] = [
  { value: "all",     label: "All",     activeClass: "bg-[#1C1917] border-[#1C1917] text-white" },
  { value: "stories", label: "Stories", activeClass: "bg-violet-700 border-violet-700 text-white" },
  { value: "events",  label: "Events",  activeClass: "bg-amber-600 border-amber-600 text-white" },
]

const SORT_TABS: { value: CommunitySort; label: string }[] = [
  { value: "newest",      label: "Newest" },
  { value: "oldest",      label: "Oldest" },
  { value: "connections", label: "Most connections" },
]

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CommunityHome() {
  const { catalog, catalogLoaded, activeCommunitySlug, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  const meta = COMMUNITY_META[activeCommunitySlug] ?? { dotColor: "#78716C", tagline: "Welcome to this community" }

  // ── Stories: full public set for the timeline ───────────────────────────
  // At launch every public story is the snowboarding set (phase-1 community
  // backfill), so no community filter is applied here. Stories come straight
  // from GET /api/stories so each carries comment_count and renders its
  // interaction row.
  // Phase 2: filter stories by community_id once POST /api/stories stamps it
  // (the column is nullable today and the write path leaves it unset, so a
  // community filter would silently hide newly created stories).
  const [stories, setStories] = useState<Story[]>([])
  const [storiesLoaded, setStoriesLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch("/api/stories?limit=100")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setStories(Array.isArray(data) ? (data as Story[]) : [])
        setStoriesLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setStoriesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Historical events: catalog events placeable on the timeline ─────────
  // Events without a year cannot be positioned, so they are excluded (matching
  // the events page).
  const timelineEvents = useMemo(
    () => (catalogLoaded ? catalog.events.filter((e) => e.year != null) : []),
    [catalogLoaded, catalog.events],
  )

  // ── Collective stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!catalogLoaded) return null
    return {
      riders: catalog.people.length,
      places: catalog.places.length,
      events: catalog.events.length,
      boards: catalog.boards.length,
      brands: catalog.orgs.length,
    }
  }, [catalogLoaded, catalog])

  // ── Timeline filter + sort ──────────────────────────────────────────────
  const [filter, setFilter] = useState<CommunityFilter>("all")
  const [sort, setSort] = useState<CommunitySort>("newest")

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Community header */}
      {/* Phase 2: community background + profile image and a community "play"
          button land in this header (community-setup screen). */}
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
              className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
            >
              My Timeline
            </CommunityLink>
          ) : (
            <Link
              href="/onboarding"
              className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
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
        {/* Stats grid — quick navigation to the category pages */}
        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-8">
            <StatCard label="Riders" value={stats.riders} href="/people" />
            <StatCard label="Places" value={stats.places} href="/places" />
            <StatCard label="Events" value={stats.events} href="/events" />
            <StatCard label="Boards" value={stats.boards} href="/boards" />
            <StatCard label="Brands" value={stats.brands} href="/brands" />
          </div>
        )}

        {/* Timeline section */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-foreground mb-4">Timeline</h2>

          {/* Controls: category pills + sort tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Category pills */}
            <div className="flex gap-2 flex-wrap">
              {FILTER_TABS.map(({ value, label, activeClass }) => {
                const active = filter === value
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      active
                        ? activeClass
                        : "bg-transparent border-border-default text-muted hover:text-foreground hover:border-foreground/30",
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Sort tabs — segmented control, matching the events page */}
            <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1">
              {SORT_TABS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSort(value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    sort === value
                      ? "bg-surface-active text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline body — gated on both catalog and the stories fetch so node
            counts and avatar stacks never compute against an empty catalog. */}
        {catalogLoaded && storiesLoaded ? (
          <CommunityTimeline
            stories={stories}
            events={timelineEvents}
            filter={filter}
            sort={sort}
          />
        ) : (
          <div className="text-center text-muted py-16 text-sm">Loading timeline…</div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8">
        <p className="text-muted text-xs">
          Lineage Community Technologies Inc.
        </p>
      </div>
    </div>
  )
}
