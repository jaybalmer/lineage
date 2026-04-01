"use client"

import { useState, useEffect, useCallback } from "react"
import { Nav } from "@/components/ui/nav"
import { StoryCard } from "@/components/feed/story-card"
import { PostCard } from "@/components/feed/post-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { nameToSlug } from "@/lib/utils"
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

type FeedEntry =
  | { kind: "story"; story: Story; date: string }
  | { kind: "claim"; claim: Claim; date: string }

const PAGE_SIZE = 30

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
  const [addingStory, setAddingStory] = useState(false)
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [storiesOffset, setStoriesOffset] = useState(0)
  const [claimsOffset, setClaimsOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const fetchPage = useCallback(async (sOffset: number, cOffset: number, replace: boolean) => {
    const isLoadingMore = !replace
    if (isLoadingMore) setLoadingMore(true)
    else setLoading(true)

    const [storiesRes, claimsRes] = await Promise.all([
      filter !== "claims"
        ? fetch(`/api/stories?limit=${PAGE_SIZE}&offset=${sOffset}`).then((r) => r.json()).catch(() => [])
        : Promise.resolve([]),
      filter !== "stories"
        ? supabase
            .from("claims")
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
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    setEntries((prev) => replace ? merged : [...prev, ...merged])
    setStoriesOffset(sOffset + storyEntries.length)
    setClaimsOffset(cOffset + claimEntries.length)
    setHasMore(storyEntries.length === PAGE_SIZE || claimEntries.length === PAGE_SIZE)
    if (isLoadingMore) setLoadingMore(false)
    else setLoading(false)
  }, [filter])

  useEffect(() => {
    setEntries([])
    setStoriesOffset(0)
    setClaimsOffset(0)
    setHasMore(true)
    fetchPage(0, 0, true)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  function authorForClaim(claim: Claim) {
    return catalog.people.find((p) => p.id === claim.subject_id)
  }

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

        {/* Filter chips */}
        <div className="flex gap-2 mb-6">
          {(["all", "stories", "claims"] as FeedFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                filter === f
                  ? f === "stories"
                    ? "bg-violet-700 border-violet-700 text-foreground"
                    : "bg-blue-600 border-blue-600 text-foreground"
                  : "border-border-default text-muted hover:text-foreground"
              }`}
            >
              {f === "stories" ? "✍ Stories" : f === "claims" ? "📌 Claims" : "All"}
            </button>
          ))}
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
            {entries.map((entry) => {
              if (entry.kind === "story") {
                const authorName = entry.story.author?.display_name
                const ago = timeAgo(entry.story.created_at)
                const action = storyAction(entry.story)
                return (
                  <div key={`story-${entry.story.id}`}>
                    <ContextLine
                      name={authorName}
                      href={authorName ? `/riders/${nameToSlug(authorName)}` : undefined}
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
                    href={author ? `/riders/${nameToSlug(author.display_name)}` : undefined}
                    action={action}
                    ago={ago}
                  />
                  <PostCard claim={entry.claim} isOwn={entry.claim.subject_id === activePersonId} />
                </div>
              )
            })}

            {hasMore && (
              <button
                onClick={() => fetchPage(storiesOffset, claimsOffset, false)}
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
