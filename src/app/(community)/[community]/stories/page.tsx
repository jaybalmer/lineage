"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { StoryCard } from "@/components/feed/story-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { Story } from "@/types"

type StoryFilter = "all" | "mine"

const PAGE_SIZE = 20

// useSearchParams() needs a Suspense boundary at build time; wrap the body,
// not the whole route.
export default function StoriesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StoriesPageBody />
    </Suspense>
  )
}

function StoriesPageBody() {
  const { activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  // ?focus=<storyId> is the v1 story permalink (comment emails link here).
  // The focused story pins above the list with a highlight ring and its
  // comments auto-expanded. It may appear again in the list below; that
  // duplication is accepted for v1.
  const searchParams = useSearchParams()
  const focusId = searchParams.get("focus")
  const [focusStory, setFocusStory] = useState<Story | null>(null)
  const [focusMissing, setFocusMissing] = useState(false)

  // Clear the focused story when the permalink is removed. Done during render on a
  // focusId change rather than with a synchronous setState in the effect below
  // (react-hooks/set-state-in-effect).
  const [prevFocusId, setPrevFocusId] = useState(focusId)
  if (focusId !== prevFocusId) {
    setPrevFocusId(focusId)
    if (!focusId) {
      setFocusStory(null)
      setFocusMissing(false)
    }
  }

  useEffect(() => {
    if (!focusId) return
    let cancelled = false
    fetch(`/api/stories?id=${encodeURIComponent(focusId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const rows: Story[] = Array.isArray(data) ? data : []
        if (rows.length > 0) setFocusStory(rows[0])
        else setFocusMissing(true)
      })
      .catch(() => { if (!cancelled) setFocusMissing(true) })
    return () => { cancelled = true }
  }, [focusId])

  const [filter, setFilter]     = useState<StoryFilter>("all")
  const [search, setSearch]     = useState("")
  const [stories, setStories]   = useState<Story[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset]     = useState(0)
  const [hasMore, setHasMore]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)

  // Fetch a page and return the rows; callers apply the result from a .then
  // callback so the mount/refetch effect performs no synchronous setState
  // (react-hooks/set-state-in-effect). Loading flags are set by the callers (the
  // render-time reset for a filter change, the Load more handler for append).
  const fetchPage = useCallback(async (off: number) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) })
    if (filter === "mine" && activePersonId) params.set("author_id", activePersonId)

    const data = await fetch(`/api/stories?${params}`).then((r) => r.json()).catch(() => [])
    const rows: Story[] = Array.isArray(data) ? data : []
    return { rows, off }
  }, [filter, activePersonId])

  const applyPage = useCallback((r: { rows: Story[]; off: number }, replace: boolean) => {
    setStories((prev) => replace ? r.rows : [...prev, ...r.rows])
    setOffset(r.off + r.rows.length)
    setHasMore(r.rows.length === PAGE_SIZE)
    if (replace) setLoading(false)
    else setLoadingMore(false)
  }, [])

  // Reset pagination + show the loading state when the filter changes, during
  // render rather than with a synchronous setState in the effect below
  // (react-hooks/set-state-in-effect). The effect then fetches the first page.
  const [prevFilter, setPrevFilter] = useState(filter)
  if (filter !== prevFilter) {
    setPrevFilter(filter)
    setOffset(0)
    setHasMore(true)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    fetchPage(0).then((r) => { if (!cancelled) applyPage(r, true) })
    return () => { cancelled = true }
  }, [fetchPage, applyPage])

  // Client-side search filter (searches loaded stories)
  const visible = search.trim()
    ? stories.filter((s) => {
        const q = search.toLowerCase()
        return (
          s.title?.toLowerCase().includes(q) ||
          s.body.toLowerCase().includes(q) ||
          s.author?.display_name?.toLowerCase().includes(q)
        )
      })
    : stories

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Stories</h1>
            <p className="text-sm text-muted mt-1">Firsthand accounts from the community</p>
          </div>
          {isAuth && (
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-lg bg-violet-700 text-sm font-medium text-white hover:bg-violet-600 transition-all"
            >
              ✍ Add story
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, content, or author…"
            className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-violet-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-6">
          {(["all", "mine"] as StoryFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              disabled={f === "mine" && !isAuth}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize disabled:opacity-40",
                filter === f
                  ? "bg-violet-700 border-violet-700 text-white"
                  : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {f === "mine" ? "My Stories" : "All Stories"}
            </button>
          ))}
        </div>

        {/* Focused story (email link target) */}
        {focusId && focusStory && (
          <div className="mb-6 rounded-2xl ring-2 ring-blue-500/40 p-1 [&_.postcard]:mb-0">
            <StoryCard
              story={focusStory}
              isOwn={focusStory.author_id === activePersonId}
              expandComments
              onDelete={(id) => {
                setFocusStory(null)
                setStories((prev) => prev.filter((s) => s.id !== id))
              }}
            />
          </div>
        )}
        {focusId && focusMissing && (
          <div className="mb-6 py-3 text-center text-sm text-muted border border-dashed border-border-default rounded-xl">
            That story is no longer available.
          </div>
        )}

        {/* Story list */}
        {loading ? (
          <div className="py-24 text-center text-muted animate-pulse">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border-default rounded-xl">
            <div className="text-3xl mb-3">✍</div>
            <div className="text-sm text-muted mb-2">
              {search ? "No stories match your search." : filter === "mine" ? "You haven't written any stories yet." : "No stories yet."}
            </div>
            {isAuth && !search && (
              <button
                onClick={() => setAddOpen(true)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Share the first one →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                isOwn={story.author_id === activePersonId}
                onDelete={(id) => setStories((prev) => prev.filter((s) => s.id !== id))}
              />
            ))}

            {hasMore && !search && (
              <button
                onClick={() => { setLoadingMore(true); fetchPage(offset).then((r) => applyPage(r, false)) }}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-muted hover:text-foreground border border-border-default rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

      {addOpen && (
        <AddStoryModal
          onClose={() => setAddOpen(false)}
          onSaved={(s) => { setStories((prev) => [s, ...prev]); setAddOpen(false) }}
        />
      )}
    </div>
  )
}
