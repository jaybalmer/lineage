"use client"

import { useEffect, useMemo, useState } from "react"
import type { Claim, Person, RidingDay, Story } from "@/types"
import { PostCard } from "@/components/feed/post-card"
import { DayPostCard } from "@/components/feed/day-post-card"
import { StoryCard } from "@/components/feed/story-card"
import { StartCard } from "@/components/feed/start-card"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { TimelinePrompt } from "@/components/timeline/timeline-prompt"
import { cn } from "@/lib/utils"
import { groupRodeAtCompanions } from "@/lib/companion-grouping"

// Staggered entrance for the first post-signup timeline reveal (Task 4).
// Runtime-injected to match the celebration keyframe pattern; reduced-motion
// shows everything immediately.
const ENTRANCE_KEYFRAMES = `
@keyframes feedItemIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .feed-item-animate { animation: none !important; opacity: 1 !important; transform: none !important; }
}
`

let entranceStyleInjected = false
function injectEntranceStyles() {
  if (entranceStyleInjected || typeof document === "undefined") return
  entranceStyleInjected = true
  const el = document.createElement("style")
  el.textContent = ENTRANCE_KEYFRAMES
  document.head.appendChild(el)
}

type FilterType = "all" | "places" | "gear" | "people" | "orgs" | "events" | "stories"

const FILTER_PREDICATES: Record<Exclude<FilterType, "stories">, string[]> = {
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
  gear: "Boards",
  people: "Riders",
  orgs: "Brands",
  events: "Events",
  stories: "Stories",
}

type FeedItem =
  | { kind: "claim"; claim: Claim; sortDate: number }
  | { kind: "day"; day: RidingDay; sortDate: number }
  | { kind: "story"; story: Story; sortDate: number }
  | { kind: "riding_start"; year: number; sortDate: number }

// Timeline node color keyed to predicate category
function nodeColor(item: FeedItem): string {
  if (item.kind === "riding_start") return "bg-amber-500"
  if (item.kind === "day") return "bg-emerald-600"
  if (item.kind === "story") return "bg-violet-600"
  const p = item.claim.predicate
  if (p === "owned_board") return "bg-emerald-700"
  if (p === "rode_at" || p === "worked_at") return "bg-teal-700"
  if (p === "rode_with" || p === "shot_by" || p === "coached_by") return "bg-violet-700"
  if (p === "competed_at" || p === "spectated_at" || p === "organized_at") return "bg-amber-700"
  if (p === "sponsored_by" || p === "part_of_team" || p === "fan_of") return "bg-zinc-500"
  return "bg-zinc-600"
}

// Within the same date, riding_start (-1) comes before boards (0), then places, people, events, orgs
function predicateRank(item: FeedItem): number {
  if (item.kind === "riding_start") return -1
  if (item.kind === "day") return 9
  if (item.kind === "story") return 8
  const p = item.claim.predicate
  if (p === "owned_board") return 0
  if (p === "rode_at" || p === "worked_at") return 2
  if (p === "rode_with" || p === "shot_by" || p === "coached_by") return 3
  if (p === "competed_at" || p === "spectated_at" || p === "organized_at") return 4
  if (p === "sponsored_by" || p === "part_of_team" || p === "fan_of") return 5
  return 6
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
  stories = [],
  personName,
  isOwn,
  hideActionButtons = false,
  hideFilters = false,
  readOnly = false,
  ridingSince,
  person,
  onStoryAdded,
  onStoryDeleted,
  order = "desc",
  animateEntrance = false,
  showCurrentYearPrompt = false,
  onCurrentYearPromptClick,
}: {
  claims: Claim[]
  days?: RidingDay[]
  stories?: Story[]
  personName: string
  isOwn?: boolean
  hideActionButtons?: boolean
  hideFilters?: boolean
  readOnly?: boolean
  ridingSince?: number
  person?: Person
  onStoryAdded?: (s: Story) => void
  onStoryDeleted?: (id: string) => void
  order?: "asc" | "desc"
  animateEntrance?: boolean
  showCurrentYearPrompt?: boolean
  onCurrentYearPromptClick?: () => void
}) {
  const [filter, setFilter] = useState<FilterType>("all")
  const [addingClaim, setAddingClaim] = useState(false)
  const [addingStory, setAddingStory] = useState(false)
  const [entranceDone, setEntranceDone] = useState(false)

  // Bake the staggered entrance into its final state once the stagger window
  // elapses, so later re-renders (a queued celebration, a freshly added claim)
  // do not replay the whole reveal.
  useEffect(() => {
    if (!animateEntrance || entranceDone) return
    const t = setTimeout(() => setEntranceDone(true), 2600)
    return () => clearTimeout(t)
  }, [animateEntrance, entranceDone])

  // Fold companion `rode_with` rows into their matching `rode_at` row so the
  // timeline renders one card per place visit. See companion-grouping.ts.
  const { groupedClaims, companionMap } = useMemo(() => {
    const result = groupRodeAtCompanions(claims)
    return { groupedClaims: result.claims, companionMap: result.companionMap }
  }, [claims])

  const items = useMemo((): FeedItem[] => {
    const claimItems: FeedItem[] = (() => {
      if (filter === "stories") return []
      const predicates = filter !== "all" ? FILTER_PREDICATES[filter as Exclude<FilterType, "stories">] : []
      const filtered = predicates.length > 0
        ? groupedClaims.filter((c) => predicates.includes(c.predicate))
        : groupedClaims
      return filtered.map((claim) => ({
        kind: "claim" as const,
        claim,
        sortDate: claim.start_date ? parseInt(claim.start_date.replace(/-/g, "")) : 0,
      }))
    })()

    const dayItems: FeedItem[] = filter === "all"
      ? days.map((day) => ({
          kind: "day" as const,
          day,
          sortDate: parseInt(day.date.replace(/-/g, "")),
        }))
      : []

    const storyItems: FeedItem[] = filter === "all" || filter === "stories"
      ? stories.map((story) => ({
          kind: "story" as const,
          story,
          sortDate: parseInt(story.story_date.replace(/-/g, "")),
        }))
      : []

    // Inject "Riding Since" milestone at Jan 1 of that year — visible on "all" filter only
    const ridingStartItem: FeedItem[] =
      ridingSince && filter === "all"
        ? [{ kind: "riding_start" as const, year: ridingSince, sortDate: ridingSince * 10000 + 101 }]
        : []

    return [...claimItems, ...dayItems, ...storyItems, ...ridingStartItem].sort((a, b) => {
      const dir = order === "asc" ? 1 : -1
      if (a.sortDate !== b.sortDate) return dir * (a.sortDate - b.sortDate)
      return predicateRank(a) - predicateRank(b)
    })
  }, [groupedClaims, days, stories, filter, ridingSince, order])

  const grouped = useMemo(() => groupByDecade(items), [items])
  const decades = Object.keys(grouped).sort((a, b) =>
    order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
  )

  const hasPrompt = showCurrentYearPrompt && !!onCurrentYearPromptClick
  const emitEntrance = animateEntrance && !entranceDone
  if (emitEntrance) injectEntranceStyles()

  // Running stagger index for the first-visit reveal. Mutated during this
  // single synchronous render pass; the current-year prompt takes slot 0 so it
  // leads, then each timeline item follows 150ms behind the last (capped 2.4s).
  let entranceIdx = 0
  const entranceClass = () => (emitEntrance ? "feed-item-animate" : undefined)
  const entranceStyle = () =>
    emitEntrance ? { animation: `feedItemIn 0.45s ease ${Math.min(entranceIdx++ * 150, 2400)}ms both` } : undefined

  const promptRow = hasPrompt ? (
    <div className={cn("relative pl-9 mb-4", entranceClass())} style={entranceStyle()}>
      <div className="absolute left-[7px] top-[20px] w-[22px] h-[22px] rounded-full border-[3px] border-background z-10 bg-[#3b82f6]" />
      <TimelinePrompt onClick={onCurrentYearPromptClick!} />
    </div>
  ) : null

  // Count per filter tab — uses the grouped claim set so the counts match
  // what the user sees after the rode_with fold.
  const filterCounts = useMemo((): Record<FilterType, number> => {
    const countFor = (preds: string[]) => groupedClaims.filter((c) => preds.includes(c.predicate)).length
    return {
      all: groupedClaims.length + days.length + stories.length,
      places: countFor(FILTER_PREDICATES.places),
      gear: countFor(FILTER_PREDICATES.gear),
      people: countFor(FILTER_PREDICATES.people),
      orgs: countFor(FILTER_PREDICATES.orgs),
      events: countFor(FILTER_PREDICATES.events),
      stories: stories.length,
    }
  }, [groupedClaims, days, stories])

  return (
    <div>
      {addingClaim && isOwn && (
        <AddClaimModal
          defaultFilter={filter}
          onClose={() => setAddingClaim(false)}
        />
      )}
      {addingStory && isOwn && onStoryAdded && (
        <AddStoryModal onClose={() => setAddingStory(false)} onSaved={(s) => { onStoryAdded(s); setAddingStory(false) }} />
      )}

      {/* Header — only shown when action buttons are present (non-profile contexts) */}
      {!hideActionButtons && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {claims.length} claims · {stories.length} stor{stories.length !== 1 ? "ies" : "y"}
          </p>
          {isOwn && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setAddingStory(true)}
                className="px-3 py-2 rounded-lg bg-violet-700 text-white text-sm font-medium hover:bg-violet-600 transition-colors"
              >
                ✍ Add story
              </button>
              <button
                onClick={() => setAddingClaim(true)}
                className="px-3 py-2 rounded-lg bg-[#1C1917] text-white text-sm font-medium hover:bg-[#292524] transition-colors"
              >
                + Add claim
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter chips with counts */}
      {!hideFilters && (
      <div className="flex gap-2 flex-wrap mb-6">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => {
          const isStoriesChip = f === "stories"
          const count = filterCounts[f]
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                active
                  ? isStoriesChip
                    ? "bg-violet-700 border-violet-700 text-foreground"
                    : "bg-[#1C1917] border-[#1C1917] text-white"
                  : "border-border-default text-muted hover:border-border-default hover:text-foreground"
              }`}
            >
              {FILTER_LABELS[f]}
              {count > 0 && (
                <span className={`text-[10px] tabular-nums ${
                  active ? "text-blue-200" : "text-muted"
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      )}

      {/* Feed grouped by decade */}
      {decades.length === 0 && !hasPrompt && (
        <div className="text-center text-muted py-16">
          <div className="text-3xl mb-3">🏂</div>
          <div className="text-sm">
            {filter === "stories"
                ? isOwn ? "No stories yet. Add one to capture a moment." : `${personName} hasn't added any stories yet.`
                : isOwn
                  ? "No claims yet. Start building your linestry."
                  : `${personName} hasn't added any claims yet.`}
          </div>
        </div>
      )}

      {(decades.length > 0 || hasPrompt) && (
        <div className="relative">
          {/* Continuous vertical timeline line */}
          <div className="absolute left-[12px] top-6 bottom-6 w-2 bg-border-default rounded-full" />

          {/* Current-year "add your board" slot, leading the timeline in desc order */}
          {order !== "asc" && promptRow}

          {decades.map((decade) => (
            <div key={decade} className="mb-8">
              {/* Decade header — shifted right of timeline gutter */}
              <div className="pl-9 mb-4 flex items-center gap-3">
                <span className="text-3xl text-foreground" style={{ fontFamily: "var(--font-display)" }}>{decade}</span>
                <div className="flex-1 h-px bg-surface-active" />
                <span className="text-xs text-muted">{grouped[decade].length} entries</span>
              </div>

              {/* Items with timeline nodes */}
              <div>
                {grouped[decade].map((item) => {
                  const key = item.kind === "claim" ? item.claim.id
                    : item.kind === "day" ? item.day.id
                    : item.kind === "story" ? `story-${item.story.id}`
                    : `riding-start-${item.year}`
                  return (
                    <div key={key} className={cn("relative pl-9", entranceClass())} style={entranceStyle()}>
                      {/* Node — amber star for riding_start, coloured circle for everything else */}
                      {item.kind === "riding_start" ? (
                        <div className="absolute left-[7px] top-[18px] w-[22px] h-[22px] rounded-full bg-background border-[3px] border-amber-500 flex items-center justify-center z-10 text-amber-400 text-[11px] leading-none">
                          ★
                        </div>
                      ) : (
                        <div className={cn(
                          "absolute left-[7px] top-[20px] w-[22px] h-[22px] rounded-full border-[3px] border-background z-10",
                          nodeColor(item)
                        )} />
                      )}
                      {item.kind === "claim" ? (
                        <PostCard
                          claim={item.claim}
                          isOwn={isOwn}
                          readOnly={readOnly}
                          explicitCompanionIds={companionMap.get(item.claim.id)}
                        />
                      ) : item.kind === "day" ? (
                        <DayPostCard day={item.day} isOwn={isOwn} />
                      ) : item.kind === "story" ? (
                        <StoryCard story={item.story} isOwn={isOwn} onDelete={onStoryDeleted} />
                      ) : person ? (
                        <StartCard person={person} claims={claims} isOwn={isOwn} />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Current-year "add your board" slot, trailing the timeline in asc order */}
          {order === "asc" && promptRow}
        </div>
      )}
    </div>
  )
}
