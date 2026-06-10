"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { STORY_REACTION_TYPES, STORY_REACTION_EMOJI } from "@/lib/story-reactions"
import type { Story, StoryComment, StoryReactionType } from "@/types"

// Reaction bar + flat comment section for a StoryCard. Rendered only for
// story objects that came from GET /api/stories (comment_count present), so
// it never appears on objects that lack the joined counts.

interface StoryInteractionsProps {
  story: Story
  /** Auto-expand the comment section on mount (focus pin on the stories page). */
  defaultExpanded?: boolean
}

function formatCommentDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
}

export function StoryInteractions({ story, defaultExpanded = false }: StoryInteractionsProps) {
  const { activePersonId, membership, addToast } = useLineageStore()
  const signedIn = isAuthUser(activePersonId)
  // Mirrors requireEditor(): is_editor OR founding tier. Server-side checks
  // re-verify; this only decides whether the Delete affordance renders.
  const viewerIsEditor = !!membership?.is_editor || membership?.tier === "founding"

  const [summary, setSummary] = useState<Partial<Record<StoryReactionType, number>>>(
    story.reaction_summary ?? {},
  )
  const [viewerReaction, setViewerReaction] = useState<StoryReactionType | null>(
    story.viewer_reaction ?? null,
  )
  const [commentCount, setCommentCount] = useState(story.comment_count ?? 0)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [comments, setComments] = useState<StoryComment[] | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState(false)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const reactionBusy = useRef(false)

  // Lazy comment load: first expand fetches, later toggles reuse the list.
  useEffect(() => {
    if (!expanded || comments !== null || commentsLoading) return
    let cancelled = false
    setCommentsLoading(true)
    setCommentsError(false)
    fetch(`/api/stories/${story.id}/comments`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const rows = await r.json()
        if (!cancelled) setComments(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setCommentsError(true)
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false)
      })
    return () => { cancelled = true }
  }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  async function tapReaction(type: StoryReactionType) {
    if (!signedIn) {
      addToast("Join Linestry to react to stories.", "info")
      return
    }
    if (reactionBusy.current) return
    reactionBusy.current = true

    const prevSummary = summary
    const prevViewer = viewerReaction
    const removing = viewerReaction === type

    // Optimistic: move/add/remove locally, reconcile with the route's
    // recomputed summary, revert on failure.
    const next: Partial<Record<StoryReactionType, number>> = { ...summary }
    if (viewerReaction) next[viewerReaction] = Math.max(0, (next[viewerReaction] ?? 1) - 1)
    if (!removing) next[type] = (next[type] ?? 0) + 1
    setSummary(next)
    setViewerReaction(removing ? null : type)

    try {
      const r = await fetch(`/api/stories/${story.id}/reactions`, removing
        ? { method: "DELETE" }
        : {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reaction_type: type }),
          })
      if (!r.ok) throw new Error()
      const j = await r.json() as {
        reaction_summary?: Partial<Record<StoryReactionType, number>>
        viewer_reaction?: StoryReactionType | null
      }
      setSummary(j.reaction_summary ?? {})
      setViewerReaction(j.viewer_reaction ?? null)
    } catch {
      setSummary(prevSummary)
      setViewerReaction(prevViewer)
      addToast("Could not save your reaction.", "error")
    } finally {
      reactionBusy.current = false
    }
  }

  async function postComment() {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const r = await fetch(`/api/stories/${story.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!r.ok) throw new Error()
      const created = await r.json() as StoryComment
      setComments((prev) => [...(prev ?? []), created])
      setCommentCount((c) => c + 1)
      setDraft("")
    } catch {
      addToast("Could not post your comment. Please try again.", "error")
    } finally {
      setPosting(false)
    }
  }

  async function deleteComment(commentId: string) {
    setDeletingId(commentId)
    try {
      const r = await fetch(`/api/stories/${story.id}/comments/${commentId}`, { method: "DELETE" })
      if (!r.ok) throw new Error()
      setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId))
      setCommentCount((c) => Math.max(0, c - 1))
      setConfirmDeleteId(null)
    } catch {
      addToast("Could not delete the comment.", "error")
    } finally {
      setDeletingId(null)
    }
  }

  function canDeleteComment(c: StoryComment): boolean {
    if (!signedIn) return false
    return c.author_id === activePersonId
      || story.author_id === activePersonId
      || viewerIsEditor
  }

  const toggleLabel = commentCount === 1 ? "1 comment" : `${commentCount} comments`

  return (
    <div className="mt-3 pt-3 border-t border-border-default">
      {/* ── Interaction row ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {STORY_REACTION_TYPES.map((type) => {
            const count = summary[type] ?? 0
            const active = viewerReaction === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => tapReaction(type)}
                aria-label={`React with ${type}`}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors",
                  active
                    ? "bg-blue-500/10 border-blue-500/30 text-foreground"
                    : count > 0
                      ? "bg-surface-hover border-border-default text-foreground hover:border-blue-500/30"
                      : "border-border-default text-muted opacity-60 hover:opacity-100",
                  !signedIn && "opacity-70",
                )}
              >
                <span>{STORY_REACTION_EMOJI[type]}</span>
                {count > 0 && <span className="font-medium">{count}</span>}
              </button>
            )
          })}
        </div>

        {commentCount > 0 || signedIn ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted hover:text-foreground font-medium transition-colors"
          >
            {commentCount > 0 ? toggleLabel : "Comment"}
          </button>
        ) : (
          <span className="text-xs text-muted opacity-60">No comments yet</span>
        )}
      </div>

      {/* ── Expanded comment section ── */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {commentsLoading ? (
            <div className="text-xs text-muted animate-pulse py-1">Loading comments...</div>
          ) : commentsError ? (
            <div className="text-xs text-muted py-1">Could not load comments.</div>
          ) : (
            (comments ?? []).map((c) => (
              <div key={c.id} className="flex items-start gap-2 group/comment">
                {c.author?.avatar_url ? (
                  <img
                    src={c.author.avatar_url}
                    alt={c.author.display_name}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-bold text-violet-600">
                    {(c.author?.display_name ?? "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {c.author?.display_name ?? "Rider"}
                    </span>
                    <span className="text-[10px] text-muted">{formatCommentDate(c.created_at)}</span>
                    {canDeleteComment(c) && confirmDeleteId !== c.id && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="ml-auto text-[10px] text-muted hover:text-red-400 opacity-0 group-hover/comment:opacity-100 transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  {confirmDeleteId === c.id && (
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xs text-muted flex-1">Delete this comment?</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-muted hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id)}
                        disabled={deletingId === c.id}
                        className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                      >
                        {deletingId === c.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* ── Composer ── */}
          {signedIn ? (
            <div className="flex items-start gap-2 pt-1">
              <textarea
                rows={2}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                placeholder="Add to the story..."
                maxLength={2000}
                className="flex-1 bg-surface-hover border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
              />
              <button
                type="button"
                onClick={postComment}
                disabled={!draft.trim() || posting}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          ) : (
            <div className="text-xs text-muted pt-1">
              Join Linestry to add your voice to this story.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
