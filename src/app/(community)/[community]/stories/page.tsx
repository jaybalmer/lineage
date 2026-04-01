"use client"

import { useState, useEffect, useCallback } from "react"
import { Nav } from "@/components/ui/nav"
import { StoryCard } from "@/components/feed/story-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { Story } from "@/types"

type StoryFilter = "all" | "mine"

const PAGE_SIZE = 20

export default function StoriesPage() {
  const { activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  const [filter, setFilter]     = useState<StoryFilter>("all")
  const [search, setSearch]     = useState("")
  const [stories, setStories]   = useState<Story[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset]     = useState(0)
  const [hasMore, setHasMore]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)

  const fetchPage = useCallback(async (off: number, replace: boolean) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)

    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) })
    if (filter === "mine" && activePersonId) params.set("author_id", activePersonId)

    const data = await fetch(`/api/stories?${params}`).then((r) => r.json()).catch(() => [])
    const rows: Story[] = Array.isArray(data) ? data : []

    setStories((prev) => replace ? rows : [...prev, ...rows])
    setOffset(off + rows.length)
    setHasMore(rows.length === PAGE_SIZE)
    if (replace) setLoading(false)
    else setLoadingMore(false)
  }, [filter, activePersonId])

  useEffect(() => {
    setOffset(0)
    setHasMore(true)
    fetchPage(0, true)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

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
              className="px-4 py-2 rounded-lg bg-violet-700 text-sm font-medium text-foreground hover:bg-violet-600 transition-all"
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
                  ? "bg-violet-700 border-violet-700 text-foreground"
                  : "border-border-default text-muted hover:text-foreground"
              )}
            >
              {f === "mine" ? "My Stories" : "All Stories"}
            </button>
          ))}
        </div>

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
                onClick={() => fetchPage(offset, false)}
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
