"use client"

import { use, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { ImageLightbox } from "@/components/ui/image-lightbox"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { boardSlug, orgSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardStory {
  id: string
  board_id: string
  user_id: string
  story_text: string
  year_ridden?: number
  location?: string
  created_at: string
}

interface BoardLink {
  id: string
  board_id: string
  user_id: string
  url: string
  og_title?: string
  og_image?: string
  og_description?: string
  created_at: string
}

interface ImageVoteState {
  up: number
  flag: number
  userVote: "up" | "flag" | null
  userVoteId: string | null
}

// ─── Story card ───────────────────────────────────────────────────────────────

function StoryCard({ story, authorName, isOwn, onDelete }: {
  story: BoardStory
  authorName: string
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from("board_stories").delete().eq("id", story.id)
    onDelete(story.id)
  }

  return (
    <div className="bg-surface border border-border-default rounded-xl p-4">
      <p className="text-sm text-foreground leading-relaxed">{story.story_text}</p>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href={`/riders/${story.user_id}`} className="hover:text-foreground transition-colors font-medium">
            {authorName}
          </Link>
          {story.year_ridden && <span>· {story.year_ridden}</span>}
          {story.location && <span>· {story.location}</span>}
        </div>
        {isOwn && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-[10px] text-muted hover:text-red-400 transition-colors"
          >
            {deleting ? "removing…" : "remove"}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Link card ────────────────────────────────────────────────────────────────

function LinkCard({ link, isOwn, onDelete }: {
  link: BoardLink
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const hostname = (() => { try { return new URL(link.url).hostname.replace(/^www\./, "") } catch { return link.url } })()

  async function handleDelete() {
    setDeleting(true)
    await supabase.from("board_links").delete().eq("id", link.id)
    onDelete(link.id)
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-surface border border-border-default rounded-xl overflow-hidden hover:border-blue-700/50 transition-colors"
    >
      <div className="flex gap-3 p-3">
        {link.og_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.og_image}
            alt=""
            className="w-16 h-16 object-cover rounded-lg shrink-0 bg-surface-hover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors truncate">
            {link.og_title ?? hostname}
          </div>
          {link.og_description && (
            <div className="text-xs text-muted mt-0.5 line-clamp-2">{link.og_description}</div>
          )}
          <div className="text-[10px] text-muted mt-1">{hostname}</div>
        </div>
        {isOwn && (
          <button
            onClick={(e) => { e.preventDefault(); handleDelete() }}
            disabled={deleting}
            className="text-[10px] text-muted hover:text-red-400 transition-colors shrink-0 self-start"
          >
            {deleting ? "…" : "×"}
          </button>
        )}
      </div>
    </a>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { catalog, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)

  const allBoards = catalog.boards
  const board = allBoards.find((b) => b.id === id) ?? allBoards.find((b) => boardSlug(b) === id)
  if (!board) notFound()
  // Capture id/brand/model so TypeScript narrows correctly inside async closures
  const boardId    = board!.id
  const boardBrand = board!.brand
  const boardModel = board!.model
  const boardYear  = board!.model_year

  const ownedClaims = catalog.claims.filter((c) => c.object_id === boardId && c.predicate === "owned_board")
  const riderIds = [...new Set(ownedClaims.map((c) => c.subject_id))]
  const sameBrand = catalog.boards.filter((b) => b.brand === board.brand && b.id !== board.id).sort((a, b) => b.model_year - a.model_year)
  const brandOrg = catalog.orgs.find((o) => o.name.toLowerCase().startsWith(boardBrand.toLowerCase()))

  // ── Community content state ──────────────────────────────────────────────
  const [stories, setStories] = useState<BoardStory[]>([])
  const [links, setLinks] = useState<BoardLink[]>([])
  const [imageVotes, setImageVotes] = useState<ImageVoteState>({ up: 0, flag: 0, userVote: null, userVoteId: null })
  const [boardImageUrl, setBoardImageUrl] = useState<string | null>(null)
  // Community-suggested image takes priority over auto-fetched Serper image
  const [suggestedImageUrl, setSuggestedImageUrl] = useState<string | null>(null)
  const displayImageUrl = suggestedImageUrl ?? boardImageUrl
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // Story form state
  const [storyText, setStoryText] = useState("")
  const [storyYear, setStoryYear] = useState("")
  const [storyLocation, setStoryLocation] = useState("")
  const [storySubmitting, setStorySubmitting] = useState(false)
  const [showStoryForm, setShowStoryForm] = useState(false)

  // Link form state
  const [linkUrl, setLinkUrl] = useState("")
  const [linkSubmitting, setLinkSubmitting] = useState(false)
  const [linkError, setLinkError] = useState("")
  const [showLinkForm, setShowLinkForm] = useState(false)

  // Image suggestion state
  const [suggestUrl, setSuggestUrl] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [showSuggestForm, setShowSuggestForm] = useState(false)

  const fetchedForBoard = useRef<string | null>(null)

  // Load community content + board image on mount
  useEffect(() => {
    if (fetchedForBoard.current === boardId) return
    fetchedForBoard.current = boardId

    supabase.from("board_stories").select("*").eq("board_id", boardId).order("created_at", { ascending: false })
      .then(({ data }) => data && setStories(data as BoardStory[]))

    supabase.from("board_links").select("*").eq("board_id", boardId).order("created_at", { ascending: false })
      .then(({ data }) => data && setLinks(data as BoardLink[]))

    supabase.from("board_image_votes").select("id, vote, user_id, suggested_image_url").eq("board_id", boardId).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return
        type VoteRow = { id: string; vote: string; user_id: string; suggested_image_url?: string | null }
        const rows = data as VoteRow[]
        const up = rows.filter((v) => v.vote === "up").length
        const flag = rows.filter((v) => v.vote === "flag").length
        const mine = rows.find((v) => v.user_id === activePersonId)
        setImageVotes({ up, flag, userVote: (mine?.vote as "up" | "flag") ?? null, userVoteId: mine?.id ?? null })
        // Use the most recently suggested image URL if one exists
        const suggested = rows.find((v) => v.suggested_image_url)?.suggested_image_url
        if (suggested) setSuggestedImageUrl(suggested)
      })

    fetch(`/api/board-image?brand=${encodeURIComponent(boardBrand)}&model=${encodeURIComponent(boardModel)}&year=${boardYear}`)
      .then((r) => r.json())
      .then(({ url }) => url && setBoardImageUrl(url))
      .catch(() => {})
  }, [boardId, boardBrand, boardModel, boardYear, activePersonId])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleStorySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storyText.trim() || storySubmitting) return
    setStorySubmitting(true)
    const { data, error } = await supabase.from("board_stories").insert({
      board_id: boardId,
      user_id: activePersonId,
      story_text: storyText.trim(),
      year_ridden: storyYear ? parseInt(storyYear) : null,
      location: storyLocation.trim() || null,
    }).select().single()
    if (!error && data) {
      setStories((prev) => [data as BoardStory, ...prev])
      setStoryText(""); setStoryYear(""); setStoryLocation("")
      setShowStoryForm(false)
    }
    setStorySubmitting(false)
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!linkUrl.trim() || linkSubmitting) return
    setLinkSubmitting(true)
    setLinkError("")
    try {
      const res = await fetch("/api/boards/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, url: linkUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setLinkError(data.error ?? "Something went wrong"); return }
      setLinks((prev) => [data as BoardLink, ...prev])
      setLinkUrl("")
      setShowLinkForm(false)
    } catch {
      setLinkError("Network error — try again")
    } finally {
      setLinkSubmitting(false)
    }
  }

  async function handleVote(vote: "up" | "flag") {
    if (!isAuth) return
    if (imageVotes.userVote === vote) {
      if (imageVotes.userVoteId) {
        await supabase.from("board_image_votes").delete().eq("id", imageVotes.userVoteId)
        setImageVotes((v) => ({ ...v, [vote]: v[vote] - 1, userVote: null, userVoteId: null }))
      }
      return
    }
    const prev = imageVotes.userVote
    const { data } = await supabase.from("board_image_votes").upsert(
      { board_id: boardId, user_id: activePersonId, vote },
      { onConflict: "board_id,user_id" }
    ).select("id").single()
    setImageVotes((v) => ({
      up:   vote === "up"   ? v.up + 1   : prev === "up"   ? v.up - 1   : v.up,
      flag: vote === "flag" ? v.flag + 1 : prev === "flag" ? v.flag - 1 : v.flag,
      userVote: vote,
      userVoteId: (data as { id: string } | null)?.id ?? v.userVoteId,
    }))
  }

  async function handleSuggestImage(e: React.FormEvent) {
    e.preventDefault()
    if (!suggestUrl.trim() || suggesting) return
    setSuggesting(true)
    const { error } = await supabase.from("board_image_votes").upsert(
      { board_id: boardId, user_id: activePersonId, vote: "up", suggested_image_url: suggestUrl.trim() },
      { onConflict: "board_id,user_id" }
    )
    if (!error) {
      // Show the suggested image immediately — no page reload needed
      setSuggestedImageUrl(suggestUrl.trim())
    }
    setSuggestUrl(""); setShowSuggestForm(false); setSuggesting(false)
  }

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* Image lightbox */}
      {lightboxOpen && displayImageUrl && (
        <ImageLightbox
          src={displayImageUrl}
          alt={`${boardBrand} ${boardModel}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/boards" className="hover:text-foreground">Boards</Link>
          <span className="mx-2">/</span>
          {brandOrg ? (
            <>
              <Link href={`/brands/${orgSlug(brandOrg)}`} className="hover:text-foreground">{boardBrand}</Link>
              <span className="mx-2">/</span>
            </>
          ) : (
            <><span className="text-muted">{boardBrand}</span><span className="mx-2">/</span></>
          )}
          <span className="text-muted">{boardModel}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-start gap-5">
            {/* Board image with vote buttons */}
            <div className="shrink-0">
              {displayImageUrl ? (
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="block w-24 h-24 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 group relative"
                  title="Click to enlarge"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImageUrl}
                    alt={`${boardBrand} ${boardModel}`}
                    className="w-full h-full object-cover bg-surface-hover transition-transform group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).closest("button")!.style.display = "none" }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium transition-opacity drop-shadow">⤢ enlarge</span>
                  </div>
                </button>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-4xl">🏂</div>
              )}
              {/* Image vote buttons */}
              {isAuth && (
                <div className="flex gap-1 mt-2 justify-center">
                  <button
                    onClick={() => handleVote("up")}
                    title="Confirm image is correct"
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors ${imageVotes.userVote === "up" ? "bg-emerald-800/60 text-emerald-300 border border-emerald-700/50" : "bg-surface border border-border-default text-muted hover:text-foreground"}`}
                  >
                    👍{imageVotes.up > 0 && <span className="ml-0.5">{imageVotes.up}</span>}
                  </button>
                  <button
                    onClick={() => handleVote("flag")}
                    title="Flag as wrong image"
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors ${imageVotes.userVote === "flag" ? "bg-red-900/60 text-red-300 border border-red-800/50" : "bg-surface border border-border-default text-muted hover:text-foreground"}`}
                  >
                    🚩{imageVotes.flag > 0 && <span className="ml-0.5">{imageVotes.flag}</span>}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted uppercase tracking-widest">Snowboard</span>
                {board!.shape && <span className="text-xs text-muted">· {board!.shape}</span>}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{boardBrand} {boardModel}</h1>
              <p className="text-muted text-sm mt-1">{boardYear}</p>

              <div className="mt-4 flex gap-6">
                <div>
                  <div className="font-bold text-foreground text-xl">{riderIds.length}</div>
                  <div className="text-muted text-xs">riders</div>
                </div>
                {stories.length > 0 && (
                  <>
                    <div className="w-px bg-border-default" />
                    <div>
                      <div className="font-bold text-foreground text-xl">{stories.length}</div>
                      <div className="text-muted text-xs">stories</div>
                    </div>
                  </>
                )}
                {board!.shape && (
                  <>
                    <div className="w-px bg-border-default" />
                    <div>
                      <div className="font-bold text-foreground text-base capitalize">{board!.shape.replace("-", " ")}</div>
                      <div className="text-muted text-xs">shape</div>
                    </div>
                  </>
                )}
              </div>

              {/* Suggest better image (shown when flagged or no image) */}
              {isAuth && (imageVotes.userVote === "flag" || !displayImageUrl) && (
                <div className="mt-3">
                  {!showSuggestForm ? (
                    <button onClick={() => setShowSuggestForm(true)} className="text-xs text-muted hover:text-foreground transition-colors">
                      + Suggest a better image URL
                    </button>
                  ) : (
                    <form onSubmit={handleSuggestImage} className="flex gap-2 mt-1">
                      <input
                        value={suggestUrl}
                        onChange={(e) => setSuggestUrl(e.target.value)}
                        placeholder="https://…"
                        className="flex-1 bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-600 outline-none focus:border-blue-600"
                      />
                      <button type="submit" disabled={suggesting} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
                        Submit
                      </button>
                      <button type="button" onClick={() => setShowSuggestForm(false)} className="px-2 py-1.5 text-xs text-muted hover:text-foreground">Cancel</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6">
          <div className="space-y-8">

            {/* Riders list */}
            <div>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Riders who owned this board
              </h2>
              {riderIds.length === 0 ? (
                <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">
                  No riders documented yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {riderIds.map((rid) => {
                    const person = catalog.people.find((p) => p.id === rid)
                    if (!person) return null
                    const claim = ownedClaims.find((c) => c.subject_id === rid)
                    return (
                      <Link key={rid} href={`/riders/${rid}`}>
                        <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all group">
                          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                            {initials(person.display_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">
                              {person.display_name}
                            </div>
                            {person.birth_year && <div className="text-xs text-muted">b. {person.birth_year}</div>}
                          </div>
                          {claim && <div className="text-xs text-muted shrink-0">{formatDateRange(claim.start_date, claim.end_date)}</div>}
                          {claim?.confidence === "documented" && (
                            <div className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 shrink-0">doc</div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Rider Stories ─────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Rider stories</h2>
                {isAuth && !showStoryForm && (
                  <button onClick={() => setShowStoryForm(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    + Add your story
                  </button>
                )}
              </div>

              {isAuth && showStoryForm && (
                <form onSubmit={handleStorySubmit} className="mb-4 bg-surface border border-border-default rounded-xl p-4 space-y-3">
                  <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Share a memory of riding this board…"
                    rows={4}
                    maxLength={2000}
                    required
                    className="w-full bg-surface-hover border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-blue-600 resize-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={storyYear}
                      onChange={(e) => setStoryYear(e.target.value)}
                      placeholder="Year (optional)"
                      min={1960}
                      max={new Date().getFullYear() + 1}
                      className="w-36 bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-600 outline-none focus:border-blue-600"
                    />
                    <input
                      value={storyLocation}
                      onChange={(e) => setStoryLocation(e.target.value)}
                      placeholder="Location (optional)"
                      maxLength={120}
                      className="flex-1 bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-600 outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={storySubmitting || !storyText.trim()} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
                      {storySubmitting ? "Saving…" : "Save story"}
                    </button>
                    <button type="button" onClick={() => setShowStoryForm(false)} className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {stories.length === 0 && !showStoryForm ? (
                <div className="py-8 text-center border border-dashed border-border-default rounded-xl">
                  <div className="text-sm text-muted mb-1">No stories yet</div>
                  {isAuth
                    ? <button onClick={() => setShowStoryForm(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Be the first to share a memory →</button>
                    : <div className="text-xs text-muted"><Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">Sign in</Link> to share your story</div>
                  }
                </div>
              ) : (
                <div className="space-y-3">
                  {stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      authorName={catalog.people.find((p) => p.id === story.user_id)?.display_name ?? "Rider"}
                      isOwn={story.user_id === activePersonId}
                      onDelete={(sid) => setStories((prev) => prev.filter((s) => s.id !== sid))}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Links ─────────────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Links</h2>
                {isAuth && !showLinkForm && (
                  <button onClick={() => setShowLinkForm(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    + Add a link
                  </button>
                )}
              </div>

              {isAuth && showLinkForm && (
                <form onSubmit={handleLinkSubmit} className="mb-4">
                  <div className="flex gap-2">
                    <input
                      value={linkUrl}
                      onChange={(e) => { setLinkUrl(e.target.value); setLinkError("") }}
                      placeholder="eBay listing, magazine scan, YouTube review…"
                      type="url"
                      required
                      className="flex-1 bg-surface-hover border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-blue-600"
                    />
                    <button type="submit" disabled={linkSubmitting} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0">
                      {linkSubmitting ? "Fetching…" : "Add"}
                    </button>
                    <button type="button" onClick={() => { setShowLinkForm(false); setLinkError("") }} className="px-2 py-2 text-xs text-muted hover:text-foreground transition-colors">
                      Cancel
                    </button>
                  </div>
                  {linkError && <p className="mt-1.5 text-xs text-red-400">{linkError}</p>}
                  {linkSubmitting && <p className="mt-1.5 text-xs text-muted">Fetching preview from URL…</p>}
                </form>
              )}

              {links.length === 0 && !showLinkForm ? (
                <div className="py-8 text-center border border-dashed border-border-default rounded-xl">
                  <div className="text-sm text-muted mb-1">No links yet</div>
                  {isAuth
                    ? <button onClick={() => setShowLinkForm(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Add an eBay listing, magazine scan, or review →</button>
                    : <div className="text-xs text-muted"><Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">Sign in</Link> to add a link</div>
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {links.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      isOwn={link.user_id === activePersonId}
                      onDelete={(lid) => setLinks((prev) => prev.filter((l) => l.id !== lid))}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {brandOrg && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Brand</div>
                <Link href={`/brands/${orgSlug(brandOrg)}`}>
                  <div className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                    <div className="w-7 h-7 rounded bg-surface-active border border-border-default flex items-center justify-center text-xs font-bold text-muted">
                      {brandOrg.name[0]}
                    </div>
                    <div>
                      <div className="text-sm text-foreground">{brandOrg.name}</div>
                      {brandOrg.founded_year && <div className="text-[11px] text-muted">est. {brandOrg.founded_year}</div>}
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {sameBrand.length > 0 && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                  Other {boardBrand} models
                </div>
                <div className="space-y-2">
                  {sameBrand.slice(0, 6).map((b) => {
                    const ownerCount = catalog.claims.filter((c) => c.object_id === b.id && c.predicate === "owned_board").length
                    return (
                      <Link key={b.id} href={`/boards/${boardSlug(b)}`}>
                        <div className="flex items-center justify-between py-1.5 hover:text-blue-300 transition-colors group">
                          <div>
                            <div className="text-sm text-foreground group-hover:text-blue-300">{b.model}</div>
                            <div className="text-[11px] text-muted">&apos;{String(b.model_year).slice(2)}</div>
                          </div>
                          {ownerCount > 0 && <div className="text-[10px] text-muted">{ownerCount} rider{ownerCount !== 1 ? "s" : ""}</div>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-surface border border-border-default rounded-xl p-4">
              <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Add to profile</div>
              <p className="text-xs text-muted mb-3">Did you ride this board?</p>
              <Link href="/profile">
                <button className="w-full px-3 py-2 bg-blue-600 rounded-lg text-xs text-foreground font-medium hover:bg-blue-500 transition-colors">
                  + Add to my profile
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
