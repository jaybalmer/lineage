"use client"

import { useMemo, useState } from "react"
import type { Claim, RidingDay } from "@/types"
import { PostCard } from "@/components/feed/post-card"
import { DayPostCard } from "@/components/feed/day-post-card"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddDayModal } from "@/components/ui/add-day-modal"
import { cn } from "@/lib/utils"

type FilterType = "all" | "places" | "gear" | "people" | "orgs" | "events" | "days"

const FILTER_PREDICATES: Record<Exclude<FilterType, "days">, string[]> = {
  all: [],
  places: ["rode_at", "worked_at"],
  gear: ["owned_board"],
  people: ["rode_with", "coached_by", "shot_by"],
  orgs: ["sponsored_by", "part_of_team", "fan_of"],
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

// Timeline node color keyed to predicate category
function nodeColor(item: FeedItem): string {
  if (item.kind === "day") return "bg-emerald-600"
  const p = item.claim.predicate
  if (p === "owned_board") return "bg-emerald-700"
  if (p === "rode_at" || p === "worked_at") return "bg-blue-700"
  if (p === "rode_with" || p === "shot_by" || p === "coached_by") return "bg-violet-700"
  if (p === "competed_at" || p === "spectated_at" || p === "organized_at") return "bg-amber-700"
  if (p === "sponsored_by" || p === "part_of_team" || p === "fan_of") return "bg-zinc-500"
  return "bg-zinc-600"
}

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
  hideActionButtons = false,
}: {
  claims: Claim[]
  days?: RidingDay[]
  personName: string
  isOwn?: boolean
  hideActionButtons?: boolean
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

  // Count per filter tab
  const filterCounts = useMemo((): Record<FilterType, number> => {
    const countFor = (preds: string[]) => claims.filter((c) => preds.includes(c.predicate)).length
    return {
      all: claims.length + days.length,
      places: countFor(FILTER_PREDICATES.places),
      gear: countFor(FILTER_PREDICATES.gear),
      people: countFor(FILTER_PREDICATES.people),
      orgs: countFor(FILTER_PREDICATES.orgs),
      events: countFor(FILTER_PREDICATES.events),
      days: days.length,
    }
  }, [claims, days])

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

      {/* Header — only shown when action buttons are present (non-profile contexts) */}
      {!hideActionButtons && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {claims.length} claims · {days.length} day{days.length !== 1 ? "s" : ""}
          </p>
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
      )}

      {/* Filter chips with counts */}
      <div className="flex gap-2 flex-wrap mb-6">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => {
          const isDaysChip = f === "days"
          const count = filterCounts[f]
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                active
                  ? isDaysChip
                    ? "bg-emerald-700 border-emerald-700 text-foreground"
                    : "bg-blue-600 border-blue-600 text-foreground"
                  : "border-border-default text-muted hover:border-border-default hover:text-foreground"
              }`}
            >
              {isDaysChip && "☀️ "}{FILTER_LABELS[f]}
              {count > 0 && (
                <span className={`text-[10px] tabular-nums ${
                  active
                    ? isDaysChip ? "text-emerald-200" : "text-blue-200"
                    : "text-muted"
                }`}>
                  {count}
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

      {decades.length > 0 && (
        <div className="relative">
          {/* Continuous vertical timeline line */}
          <div className="absolute left-[12px] top-6 bottom-6 w-2 bg-border-default rounded-full" />

          {decades.map((decade) => (
            <div key={decade} className="mb-8">
              {/* Decade header — shifted right of timeline gutter */}
              <div className="pl-9 text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
                <span>{decade}</span>
                <div className="flex-1 h-px bg-surface-active" />
                <span>{grouped[decade].length} entries</span>
              </div>

              {/* Items with timeline nodes */}
              <div>
                {grouped[decade].map((item) => {
                  const key = item.kind === "claim" ? item.claim.id : item.day.id
                  return (
                    <div key={key} className="relative pl-9">
                      {/* Node circle */}
                      <div className={cn(
                        "absolute left-[7px] top-[20px] w-[22px] h-[22px] rounded-full border-[3px] border-background z-10",
                        nodeColor(item)
                      )} />
                      {item.kind === "claim" ? (
                        <PostCard claim={item.claim} isOwn={isOwn} />
                      ) : (
                        <DayPostCard day={item.day} isOwn={isOwn} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
