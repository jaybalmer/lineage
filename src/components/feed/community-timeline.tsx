"use client"

import { useMemo } from "react"
import { StoryCard } from "@/components/feed/story-card"
import { TimelineEventCard } from "@/components/feed/timeline-event-card"
import { dateToSortNum, groupByDecade } from "@/lib/timeline-grouping"
import { useLineageStore } from "@/store/lineage-store"
import type { Event, Story } from "@/types"

export type CommunityFilter = "all" | "stories" | "events"
// BUG-055: "added" orders by when content was POSTED (story created_at). It is an
// optional tab here; the landing default stays "newest" (event date).
export type CommunitySort = "newest" | "oldest" | "connections" | "added"

// Rider-implicating event predicates (events/page.tsx). A distinct subject_id
// across these counts as one connection toward an event.
const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"]

type TimelineItem =
  | { kind: "story"; story: Story; sortDate: number; connections: number; addedAt: number }
  | { kind: "event"; event: Event; sortDate: number; connections: number; addedAt: number }

// Stories sort ahead of events when their date is identical (brief §4.2).
function kindRank(item: TimelineItem): number {
  return item.kind === "story" ? 0 : 1
}

function toMs(dateStr?: string | null): number {
  if (!dateStr) return NaN
  return new Date(dateStr).getTime()
}

// Posted-order key (epoch ms) for the "added" sort. Stories use created_at (when
// posted); events have no posted timestamp, so they fall back to their event
// date (start_date, then year). A story missing created_at also falls back to
// its story date. Floored to 0 so a row is never silently dropped to the bottom.
function storyAddedAt(story: Story): number {
  const posted = toMs(story.created_at)
  if (!Number.isNaN(posted)) return posted
  const happened = toMs(story.story_date)
  return Number.isNaN(happened) ? 0 : happened
}
function eventAddedAt(event: Event): number {
  const happened = toMs(event.start_date)
  if (!Number.isNaN(happened)) return happened
  const byYear = event.year ? toMs(`${event.year}-01-01`) : NaN
  return Number.isNaN(byYear) ? 0 : byYear
}

function storyConnections(story: Story): number {
  return (
    (story.rider_ids?.length ?? 0) +
    (story.board_ids?.length ?? 0) +
    (story.community_places?.length ?? 0) +
    (story.community_events?.length ?? 0) +
    (story.linked_place_id ? 1 : 0) +
    (story.linked_event_id ? 1 : 0) +
    (story.linked_org_id ? 1 : 0)
  )
}

const EMPTY_MESSAGE: Record<CommunityFilter, string> = {
  all: "No stories or events yet.",
  stories: "No stories yet.",
  events: "No events yet.",
}

/**
 * Read-only community timeline. Renders public stories and historical events on
 * the same decade-grouped vertical scaffold as the personal FeedView (continuous
 * line, coloured nodes, decade headers), with filter + sort applied by the
 * parent page. Pure presentation over data already in hand — no fetching here.
 */
export function CommunityTimeline({
  stories,
  events,
  filter,
  sort,
}: {
  stories: Story[]
  events: Event[] // already filtered to year != null by the caller
  filter: CommunityFilter
  sort: CommunitySort
}) {
  const { catalog } = useLineageStore()

  // event_id → distinct rider count (competed/spectated/organized). One pass.
  const eventRiderCounts = useMemo(() => {
    const sets = new Map<string, Set<string>>()
    for (const c of catalog.claims) {
      if (!EVENT_PREDICATES.includes(c.predicate)) continue
      if (!sets.has(c.object_id)) sets.set(c.object_id, new Set())
      sets.get(c.object_id)!.add(c.subject_id)
    }
    const counts = new Map<string, number>()
    for (const [id, s] of sets) counts.set(id, s.size)
    return counts
  }, [catalog.claims])

  // event_id → number of fetched stories linked to it (author link or community
  // connection). One pass over the stories array.
  const eventStoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of stories) {
      const linked = new Set<string>()
      if (s.linked_event_id) linked.add(s.linked_event_id)
      for (const ce of s.community_events ?? []) linked.add(ce.event_id)
      for (const id of linked) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [stories])

  const grouped = useMemo(() => {
    const storyItems: TimelineItem[] =
      filter === "events"
        ? []
        : stories.map((story) => ({
            kind: "story" as const,
            story,
            sortDate: dateToSortNum(story.story_date),
            connections: storyConnections(story),
            addedAt: storyAddedAt(story),
          }))

    const eventItems: TimelineItem[] =
      filter === "stories"
        ? []
        : events.map((event) => ({
            kind: "event" as const,
            event,
            // Events carry only a year; treat it as Jan 1 so the decade bucket
            // and ordering line up with story dates.
            sortDate: dateToSortNum(String(event.year)),
            connections:
              (eventRiderCounts.get(event.id) ?? 0) +
              (eventStoryCounts.get(event.id) ?? 0) +
              (event.place_id ? 1 : 0) +
              (event.series_id ? 1 : 0),
            addedAt: eventAddedAt(event),
          }))

    const items = [...storyItems, ...eventItems].sort((a, b) => {
      if (sort === "added") {
        if (b.addedAt !== a.addedAt) return b.addedAt - a.addedAt
        if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate
        return kindRank(a) - kindRank(b)
      }
      if (sort === "connections") {
        if (b.connections !== a.connections) return b.connections - a.connections
        if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate
        return kindRank(a) - kindRank(b)
      }
      if (sort === "oldest") {
        if (a.sortDate !== b.sortDate) return a.sortDate - b.sortDate
        return kindRank(a) - kindRank(b)
      }
      // newest
      if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate
      return kindRank(a) - kindRank(b)
    })

    return groupByDecade(items)
  }, [stories, events, filter, sort, eventRiderCounts, eventStoryCounts])

  // Oldest reads top-to-bottom oldest-first; newest and connections lead with
  // the most recent decade.
  const decades = useMemo(
    () =>
      Object.keys(grouped).sort((a, b) =>
        sort === "oldest" ? a.localeCompare(b) : b.localeCompare(a),
      ),
    [grouped, sort],
  )

  if (decades.length === 0) {
    return (
      <div className="text-center text-muted py-16">
        <div className="text-3xl mb-3">🏂</div>
        <div className="text-sm">{EMPTY_MESSAGE[filter]}</div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Continuous vertical timeline line — matches FeedView */}
      <div className="absolute left-[12px] top-6 bottom-6 w-2 bg-border-default rounded-full" />

      {decades.map((decade) => (
        <div key={decade} className="mb-8">
          {/* Decade header — shifted right of the timeline gutter */}
          <div className="pl-9 mb-4 flex items-center gap-3">
            <span className="text-3xl text-foreground" style={{ fontFamily: "var(--font-display)" }}>
              {decade}
            </span>
            <div className="flex-1 h-px bg-surface-active" />
            <span className="text-xs text-muted">{grouped[decade].length} entries</span>
          </div>

          {/* Items with timeline nodes */}
          <div>
            {grouped[decade].map((item) => {
              const key = item.kind === "story" ? `story-${item.story.id}` : `event-${item.event.id}`
              const nodeColor = item.kind === "story" ? "bg-violet-600" : "bg-amber-500"
              return (
                <div key={key} className="relative pl-9">
                  <div
                    className={`absolute left-[7px] top-[20px] w-[22px] h-[22px] rounded-full border-[3px] border-background z-10 ${nodeColor}`}
                  />
                  {item.kind === "story" ? (
                    <StoryCard story={item.story} isOwn={false} />
                  ) : (
                    <TimelineEventCard event={item.event} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
