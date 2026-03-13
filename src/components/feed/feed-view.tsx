"use client"

import { useMemo, useState } from "react"
import type { Claim, RidingDay } from "@/types"
import { PostCard } from "@/components/feed/post-card"
import { DayPostCard } from "@/components/feed/day-post-card"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddDayModal } from "@/components/ui/add-day-modal"

type FilterType = "all" | "places" | "gear" | "people" | "orgs" | "events" | "days"

const FILTER_PREDICATES: Record<Exclude<FilterType, "days">, string[]> = {
  all: [],
  places: ["rode_at", "worked_at"],
  gear: ["owned_board"],
  people: ["rode_with", "coached_by", "shot_by"],
  orgs: ["sponsored_by", "part_of_team"],
  events: ["competed_at", "spectated_at", "organized_at"],
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: "All",
  places: "Places",
  gear: "Gear",
  people: "People",
  orgs: "Orgs & Sponsors",
  events: "Events",
  days: "Days",
}

type FeedItem =
  | { kind: "claim"; claim: Claim; sortDate: number }
  | { kind: "day"; day: RidingDay; sortDate: number }

function itemDecade(sortDate: number): string {
  if (!sortDate) return "Unknown"
  const year = Math.floor(sortDate / 10000)
  return `${Math.floor(year / 10) * 10}s`
}

function groupByDecade(items: FeedItem[]): Record<string, FeedItem[]> {
  const groups: Record<string, FeedItem[]> = {}
  for (const item of items) {
    const decade = itemDecade(item.sortDate)
    if (!groups[decade]) groups[decade] = []
    groups[decade].push(item)
  }
  return groups
}

export function FeedView({
  claims,
  days = [],
  personName,
  isOwn,
}: {
  claims: Claim[]
  days?: RidingDay[]
  personName: string
  isOwn?: boolean
}) {
  const [filter, setFilter] = useState<FilterType>("all")
  const [addingClaim, setAddingClaim] = useState(false)
  const [addingDay, setAddingDay] = useState(false)

  const items = useMemo((): FeedItem[] => {
    const claimItems: FeedItem[] = (() => {
      if (filter === "days") return []
      const predicates = filter !== "all" ? FILTER_PREDICATES[filter] : []
      const filtered = predicates.length > 0
        ? claims.filter((c) => predicates.includes(c.predicate))
        : claims
      return filtered.map((claim) => ({
        kind: "claim" as const,
        claim,
        sortDate: claim.start_date ? parseInt(claim.start_date.replace(/-/g, "")) : 0,
      }))
    })()

    const dayItems: FeedItem[] = filter === "all" || filter === "days"
      ? days.map((day) => ({
          kind: "day" as const,
          day,
          sortDate: parseInt(day.date.replace(/-/g, "")),
        }))
      : []

    return [...claimItems, ...dayItems].sort((a, b) => a.sortDate - b.sortDate)
  }, [claims, days, filter])

  const grouped = useMemo(() => groupByDecade(items), [items])
  const decades = Object.keys(grouped).sort()

  return (
    <div>
      {addingClaim && isOwn && (
        <AddClaimModal
          defaultFilter={filter === "days" ? "all" : filter}
          onClose={() => setAddingClaim(false)}
        />
      )}
      {addingDay && isOwn && (
        <AddDayModal onClose={() => setAddingDay(false)} />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {claims.length} claims · {days.length} day{days.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOwn && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setAddingDay(true)}
              className="px-3 py-2 rounded-lg bg-emerald-800 text-white text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            >
              ☀️ Log day
            </button>
            <button
              onClick={() => setAddingClaim(true)}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              + Add claim
            </button>
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => {
          const isDaysChip = f === "days"
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter === f
                  ? isDaysChip
                    ? "bg-emerald-700 border-emerald-700 text-foreground"
                    : "bg-blue-600 border-blue-600 text-foreground"
                  : "border-border-default text-muted hover:border-border-default hover:text-foreground"
              }`}
            >
              {isDaysChip && "☀️ "}{FILTER_LABELS[f]}
              {isDaysChip && days.length > 0 && (
                <span className={`ml-1.5 px-1 rounded text-[10px] ${filter === f ? "bg-emerald-600" : "bg-border-default text-muted"}`}>
                  {days.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Feed grouped by decade */}
      {decades.length === 0 && (
        <div className="text-center text-muted py-16">
          <div className="text-3xl mb-3">🏂</div>
          <div className="text-sm">
            {filter === "days"
              ? "No days logged yet. Hit ☀️ Log day to start."
              : isOwn
                ? "No claims yet. Start building your lineage."
                : `${personName} hasn't added any claims yet.`}
          </div>
        </div>
      )}

      {decades.map((decade) => (
        <div key={decade} className="mb-8">
          <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
            <span>{decade}</span>
            <div className="flex-1 h-px bg-surface-active" />
            <span>{grouped[decade].length} entries</span>
          </div>
          <div>
            {grouped[decade].map((item) =>
              item.kind === "claim" ? (
                <PostCard key={item.claim.id} claim={item.claim} isOwn={isOwn} />
              ) : (
                <DayPostCard key={item.day.id} day={item.day} isOwn={isOwn} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
