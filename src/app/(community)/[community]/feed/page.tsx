"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Nav } from "@/components/ui/nav"
import { StoryCard } from "@/components/feed/story-card"
import { PostCard } from "@/components/feed/post-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { nameToSlug, cn } from "@/lib/utils"
import { groupRodeAtCompanions } from "@/lib/companion-grouping"
import type { Story, Claim } from "@/types"

// ── Vague relative time ────────────────────────────────────────────────────────
function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins  = ms / 60_000
  const hours = ms / 3_600_000
  const days  = ms / 86_400_000
  if (mins  <  2)   return "Just now"
  if (hours <  6)   return "Recently"
  if (days  <  3)   return "A couple days ago"
  if (days  < 14)   return "Last week or so"
  if (days  < 60)   return "A while ago"
  if (days  < 365)  return "Earlier this year"
  return "Back in the day"
}

// ── Fun action descriptions ────────────────────────────────────────────────────
// Pick a stable variant from an array using the entry id as a seed
function pick<T>(arr: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

function claimAction(claim: Claim): string {
  const id = claim.id
  switch (claim.predicate) {
    case "rode_at":       return pick(["shredded a spot", "logged a session", "marked a mountain", "hit a place"], id)
    case "owned_board":   return pick(["added a board", "logged a setup", "put a board on the record", "dropped a board"], id)
    case "competed_at":   return pick(["competed at an event", "threw down at a contest", "entered a contest", "went to battle"], id)
    case "spectated_at":  return pick(["watched an event", "witnessed it live", "showed up to watch", "caught an event"], id)
    case "organized_at":  return pick(["organized an event", "put together a session", "made an event happen"], id)
    case "organized":     return pick(["organized something", "put together an event"], id)
    case "worked_at":     return pick(["logged some work history", "repped a brand", "put in time at a brand"], id)
    case "sponsored_by":  return pick(["picked up a sponsor", "got backed", "repped a sponsor"], id)
    case "part_of_team":  return pick(["joined a team", "rode for a crew", "repped a team"], id)
    case "coached_by":    return pick(["trained with a coach", "worked with a coach"], id)
    case "shot_by":       return pick(["got filmed", "got shot by a photographer", "was in front of a lens"], id)
    case "rode_with":     return pick(["tagged a riding partner", "called out a homie", "rode with someone"], id)
    case "fan_of":        return pick(["shouted out a brand", "repped a favourite", "marked a brand they love"], id)
    case "located_at":    return pick(["marked a location", "noted where they were based"], id)
    default:              return pick(["added a claim", "marked something", "logged a memory"], id)
  }
}

function storyAction(story: Story): string {
  const id = story.id
  return pick(["dropped a story", "shared a memory", "wrote something up", "put a story on the record", "added a story"], id)
}

type FeedFilter = "all" | "stories" | "claims"

// BUG-055: "added" sorts by when content was POSTED (created_at) and is the feed
// default so freshly posted entries surface first; "happened" keeps the original
// event-date order (story_date / claim start_date) as a secondary option.
type FeedSort = "added" | "happened"

type FeedEntry =
  | { kind: "story"; story: Story; date: string }
  | { kind: "claim"; claim: Claim; date: string }

const PAGE_SIZE = 30

const SORT_OPTIONS: { value: FeedSort; label: string }[] = [
  { value: "added",    label: "Recently added" },
  { value: "happened", label: "Date happened" },
]

// Sort key per entry for the chosen mode. "added" reads created_at (posted time);
// if a row somehow lacks a parseable created_at it falls back to its event date
// so it is never silently dropped to the bottom.
function entrySortKey(e: FeedEntry, mode: FeedSort): number {
  if (mode === "added") {
    const postedAt = e.kind === "story" ? e.story.created_at : e.claim.created_at
    const t = postedAt ? new Date(postedAt).getTime() : NaN
    if (!Number.isNaN(t)) return t
  }
  const t = e.date ? new Date(e.date).getTime() : NaN
  return Number.isNaN(t) ? 0 : t
}

function ContextLine({ name, href, action, ago }: {
  name?: string
  href?: string
  action: string
  ago: string
}) {
  return (
    <div className="flex items-center justify-between px-1 mb-1.5">
      <div className="flex items-center gap-1 text-xs text-muted min-w-0">
        {name && href ? (
          <Link href={href} className="font-medium text-foreground hover:text-blue-400 transition-colors truncate">
            {name}
          </Link>
        ) : name ? (
          <span className="font-medium text-foreground truncate">{name}</span>
        ) : null}
        <span className="shrink-0">{action}</span>
      </div>
      {ago && <span className="text-[10px] text-muted shrink-0 ml-3">{ago}</span>}
    </div>
  )
}

export default function FeedPage() {
  const { catalog, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const [filter, setFilter] = useState<FeedFilter>("all")
  const [sort, setSort] = useState<FeedSort>("added")
  const [addingStory, setAddingStory] = useState(false)
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [storiesOffset, setStoriesOffset] = useState(0)
  const [claimsOffset, setClaimsOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Fetch a page and return the merged entries; callers apply the result from a
  // .then callback so the mount/refetch effect performs no synchronous setState
  // (react-hooks/set-state-in-effect). Loading flags are set by the callers (the
  // render-time reset for a filter/sort change, the Load more handler for append).
  const fetchPage = useCallback(async (sOffset: number, cOffset: number) => {
    const [storiesRes, claimsRes] = await Promise.all([
      filter !== "claims"
        // sort=recent paginates stories by created_at so the "Recently added"
        // default actually leads with the newest posts (the route otherwise
        // orders by story_date). claims_public is already created_at desc below.
        ? fetch(`/api/stories?limit=${PAGE_SIZE}&offset=${sOffset}${sort === "added" ? "&sort=recent" : ""}`).then((r) => r.json()).catch(() => [])
        : Promise.resolve([]),
      filter !== "stories"
        ? supabase
            // PB-009 Phase 1: feed reads through claims_public.
            .from("claims_public")
            .select("*")
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .range(cOffset, cOffset + PAGE_SIZE - 1)
            .then(({ data }) => data ?? [])
        : Promise.resolve([]),
    ])

    const storyEntries: FeedEntry[] = (Array.isArray(storiesRes) ? storiesRes as Story[] : [])
      .map((s) => ({ kind: "story" as const, story: s, date: s.story_date }))

    const claimEntries: FeedEntry[] = (claimsRes as Claim[])
      .map((c) => ({ kind: "claim" as const, claim: c, date: c.start_date ?? c.created_at ?? "" }))

    const merged = [...storyEntries, ...claimEntries].sort(
      (a, b) => entrySortKey(b, sort) - entrySortKey(a, sort)
    )

    return { merged, sOffset, cOffset, storyLen: storyEntries.length, claimLen: claimEntries.length }
  }, [filter, sort])

  const applyPage = useCallback(
    (r: { merged: FeedEntry[]; sOffset: number; cOffset: number; storyLen: number; claimLen: number }, replace: boolean) => {
      setEntries((prev) => replace ? r.merged : [...prev, ...r.merged])
      setStoriesOffset(r.sOffset + r.storyLen)
      setClaimsOffset(r.cOffset + r.claimLen)
      setHasMore(r.storyLen === PAGE_SIZE || r.claimLen === PAGE_SIZE)
      if (replace) setLoading(false)
      else setLoadingMore(false)
    },
    [],
  )

  // Reset the list + show the loading state when the filter or sort changes,
  // during render rather than with a synchronous setState in the effect below
  // (react-hooks/set-state-in-effect). The effect then fetches the first page.
  const feedKey = `${filter}|${sort}`
  const [prevFeedKey, setPrevFeedKey] = useState(feedKey)
  if (feedKey !== prevFeedKey) {
    setPrevFeedKey(feedKey)
    setEntries([])
    setStoriesOffset(0)
    setClaimsOffset(0)
    setHasMore(true)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    fetchPage(0, 0).then((r) => { if (!cancelled) applyPage(r, true) })
    return () => { cancelled = true }
  }, [fetchPage, applyPage])

  function authorForClaim(claim: Claim) {
    return catalog.people.find((p) => p.id === claim.subject_id)
  }

  // Fold companion `rode_with` rows into their matching `rode_at` row so the
  // feed shows one card per place visit. Pagination can split a rode_at and
  // its rode_with siblings across pages — they were written within ms of each
  // other so this is rare, but when it happens we just leave the orphan
  // rode_with cards in place until the matching rode_at loads.
  const { absorbedIds, companionMap } = useMemo(() => {
    const allClaims = entries.flatMap((e) => (e.kind === "claim" ? [e.claim] : []))
    const result = groupRodeAtCompanions(allClaims)
    const survivors = new Set(result.claims.map((c) => c.id))
    const absorbed = new Set<string>()
    for (const c of allClaims) {
      if (!survivors.has(c.id)) absorbed.add(c.id)
    }
    return { absorbedIds: absorbed, companionMap: result.companionMap }
  }, [entries])

  // BUG-055: re-sort the full accumulated set on each render so the chosen order
  // holds across page boundaries. Each fetched page is independently paginated
  // (stories and claims are separate streams), so a plain append can interleave
  // slightly out of order; sorting the whole list keeps it honest.
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => entrySortKey(b, sort) - entrySortKey(a, sort)),
    [entries, sort],
  )

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-widest uppercase text-foreground mb-1">Feed</h1>
            <p className="text-sm text-muted">Recent stories and claims from the community</p>
          </div>
          {isAuth && (
            <button
              onClick={() => setAddingStory(true)}
              className="px-4 py-2 rounded-lg bg-violet-700 text-sm font-medium text-white hover:bg-violet-600 transition-colors shrink-0"
            >
              ✍ Add story
            </button>
          )}
        </div>

        {/* Filter chips + sort toggle. Wraps on narrow screens so neither row
            pushes the page past the viewport (BUG-055 acceptance: no overflow). */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex gap-2">
            {(["all", "stories", "claims"] as FeedFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                  filter === f
                    ? f === "stories"
                      ? "bg-violet-700 border-violet-700 text-foreground"
                      : "bg-[#1C1917] border-[#1C1917] text-white"
                    : "border-border-default text-muted hover:text-foreground"
                }`}
              >
                {f === "stories" ? "✍ Stories" : f === "claims" ? "📌 Claims" : "All"}
              </button>
            ))}
          </div>

          {/* Posted-order vs event-date order. "Recently added" is the default so
              freshly posted content leads (BUG-055). */}
          <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1">
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
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

        {/* Feed */}
        {loading ? (
          <div className="py-24 text-center text-muted animate-pulse">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-3xl mb-3">🏂</div>
            <div className="text-sm text-muted">Nothing here yet. Be the first to add something.</div>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedEntries.map((entry) => {
              if (entry.kind === "claim" && absorbedIds.has(entry.claim.id)) {
                return null
              }
              if (entry.kind === "story") {
                const authorName = entry.story.author?.display_name
                const ago = timeAgo(entry.story.created_at)
                const action = storyAction(entry.story)
                return (
                  <div key={`story-${entry.story.id}`}>
                    <ContextLine
                      name={authorName}
                      href={authorName ? `/people/${nameToSlug(authorName)}` : undefined}
                      action={action}
                      ago={ago}
                    />
                    <StoryCard
                      story={entry.story}
                      isOwn={entry.story.author_id === activePersonId}
                      onDelete={(id) => setEntries((prev) => prev.filter((e) => !(e.kind === "story" && e.story.id === id)))}
                    />
                  </div>
                )
              }

              const author = authorForClaim(entry.claim)
              const ago = timeAgo(entry.claim.created_at)
              const action = claimAction(entry.claim)
              return (
                <div key={`claim-${entry.claim.id}`}>
                  <ContextLine
                    name={author?.display_name}
                    href={author ? `/people/${nameToSlug(author.display_name)}` : undefined}
                    action={action}
                    ago={ago}
                  />
                  <PostCard
                    claim={entry.claim}
                    isOwn={entry.claim.subject_id === activePersonId}
                    explicitCompanionIds={companionMap.get(entry.claim.id)}
                  />
                </div>
              )
            })}

            {hasMore && (
              <button
                onClick={() => { setLoadingMore(true); fetchPage(storiesOffset, claimsOffset).then((r) => applyPage(r, false)) }}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-muted hover:text-foreground border border-border-default rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

      {addingStory && (
        <AddStoryModal
          onClose={() => setAddingStory(false)}
          onSaved={(s) => {
            setEntries((prev) => [{ kind: "story", story: s, date: s.story_date }, ...prev])
            setAddingStory(false)
          }}
        />
      )}
    </div>
  )
}
