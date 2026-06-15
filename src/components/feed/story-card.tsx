"use client"

import { useState } from "react"
import { CommunityLink } from "@/components/ui/community-link"
import { cn, parseYouTubeId } from "@/lib/utils"
import { orgSlug, placeSlug, eventSlug, boardSlug } from "@/lib/mock-data"
import { personHref } from "@/lib/entity-links"
import { ImageLightbox } from "@/components/ui/image-lightbox"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { ReportTagModal } from "@/components/ui/report-tag-modal"
import { StoryInteractions } from "@/components/feed/story-interactions"
import { AddConnectionsPopover, type StoryConnectionType } from "@/components/feed/add-connections-popover"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getRiderTier } from "@/components/ui/rider-avatar"
import type { Story, TagEventDeclineCategory } from "@/types"

interface StoryCardProps {
  story: Story
  isOwn?: boolean
  onDelete?: (id: string) => void
  /** Auto-expand the comment section (focus pin on the stories page). */
  expandComments?: boolean
}

function formatStoryDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
}

export function StoryCard({ story, isOwn, onDelete, expandComments }: StoryCardProps) {
  const { catalog, activePersonId, addToast, membership } = useLineageStore()
  const [displayStory, setDisplayStory] = useState(story)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)

  // Story Connections: + Connect popover + community chip removal state.
  const [connectOpen, setConnectOpen] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)

  // PB-009 Phase 3 — per-rider abuse-report flow. Any signed-in member (other
  // than the rider themselves) can report a tag they see on the card. The
  // lookup endpoint resolves (story_id, rider_id) → tag_event_id; the report
  // endpoint posts the category. Author can also report — Q1 said "any
  // logged-in member can report any tag" without an author carve-out.
  const [reportTarget, setReportTarget] = useState<{ tagEventId: string; riderName: string } | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportOpening, setReportOpening] = useState<string | null>(null)  // rider id while loading
  const viewerSignedIn = isAuthUser(activePersonId)

  async function openReportForRider(riderId: string, riderName: string) {
    setReportOpening(riderId)
    try {
      const r = await fetch(`/api/me/lookup-tag-event?story_id=${displayStory.id}&rider_id=${riderId}`)
      if (!r.ok) {
        addToast("Couldn't find a tag to report for this rider.", "error")
        return
      }
      const j = await r.json() as { tag_event_id: string }
      setReportTarget({ tagEventId: j.tag_event_id, riderName })
    } catch {
      addToast("Report lookup failed.", "error")
    } finally {
      setReportOpening(null)
    }
  }

  async function submitReport(category: TagEventDeclineCategory, note?: string) {
    if (!reportTarget) return
    setReportSubmitting(true)
    try {
      const r = await fetch(`/api/me/tags/${reportTarget.tagEventId}/report`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ category, note }),
      })
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "Report failed" }))
        addToast(error ?? "Report failed", "error")
        return
      }
      const j = await r.json() as { already_reported?: boolean }
      if (j.already_reported) {
        addToast("You've already reported this tag.")
      } else {
        addToast("Thanks — your report is in the editor queue.")
      }
      setReportTarget(null)
    } finally {
      setReportSubmitting(false)
    }
  }

  const photos = displayStory.photos ?? []

  // Resolve linked entities for chips
  const linkedPlace = displayStory.linked_place_id
    ? catalog.places.find((p) => p.id === displayStory.linked_place_id)
    : null
  const linkedEvent = displayStory.linked_event_id
    ? catalog.events.find((e) => e.id === displayStory.linked_event_id)
    : null
  const linkedOrg = displayStory.linked_org_id
    ? catalog.orgs.find((o) => o.id === displayStory.linked_org_id)
    : null
  const linkedBoards = (displayStory.board_ids ?? [])
    .map((id) => catalog.boards.find((b) => b.id === id))
    .filter(Boolean)
  const taggedRiders = (displayStory.rider_ids ?? [])
    .map((id) => catalog.people.find((p) => p.id === id))
    .filter(Boolean)

  // Story Connections: community-added chips render the union with the
  // author's own links, deduped by id, identical styling. Attribution lives
  // in a title tooltip; the adder resolves through the catalog (no tooltip
  // when unresolved, e.g. a deleted profile).
  const communityPlaceChips = (displayStory.community_places ?? [])
    .filter((cp) => cp.place_id !== displayStory.linked_place_id)
    .flatMap((cp) => {
      const place = catalog.places.find((p) => p.id === cp.place_id)
      return place ? [{ conn: cp, place }] : []
    })
  const communityEventChips = (displayStory.community_events ?? [])
    .filter((ce) => ce.event_id !== displayStory.linked_event_id)
    .flatMap((ce) => {
      const event = catalog.events.find((e) => e.id === ce.event_id)
      return event ? [{ conn: ce, event }] : []
    })

  // Removal rights. Rider chips deliberately skip the adder lookup (the GET
  // payload carries no asserter info in v1): author, editor, and the viewer's
  // own chip get the x; an adder removing their own pick on someone else
  // folds into /me/tags and editor surfaces. The whole affordance sits behind
  // the same came-from-the-API gate as the interaction row.
  const interactive = displayStory.comment_count !== undefined
  const viewerIsEditor = !!membership?.is_editor || membership?.tier === "founding"
  const isAuthorViewer = viewerSignedIn && displayStory.author_id === activePersonId
  const canRemoveCommunityLink = (addedBy: string | null) =>
    interactive && viewerSignedIn && (addedBy === activePersonId || isAuthorViewer || viewerIsEditor)
  const canRemoveRiderChip = (riderId: string) =>
    interactive && viewerSignedIn && (isAuthorViewer || viewerIsEditor || riderId === activePersonId)

  const adderName = (addedBy: string | null) =>
    addedBy ? catalog.people.find((p) => p.id === addedBy)?.display_name : undefined

  function handleConnectionAdded(type: StoryConnectionType, entityId: string) {
    setDisplayStory((prev) => {
      if (type === "rider") {
        if ((prev.rider_ids ?? []).includes(entityId)) return prev
        return { ...prev, rider_ids: [...(prev.rider_ids ?? []), entityId] }
      }
      if (type === "place") {
        if (entityId === prev.linked_place_id) return prev
        if ((prev.community_places ?? []).some((p) => p.place_id === entityId)) return prev
        return {
          ...prev,
          community_places: [...(prev.community_places ?? []), { place_id: entityId, added_by: activePersonId }],
        }
      }
      if (entityId === prev.linked_event_id) return prev
      if ((prev.community_events ?? []).some((e) => e.event_id === entityId)) return prev
      return {
        ...prev,
        community_events: [...(prev.community_events ?? []), { event_id: entityId, added_by: activePersonId }],
      }
    })
  }

  async function removeConnection(type: StoryConnectionType, entityId: string) {
    if (removingKey) return
    setRemovingKey(`${type}:${entityId}`)
    const prev = displayStory
    setDisplayStory((p) =>
      type === "rider"
        ? { ...p, rider_ids: (p.rider_ids ?? []).filter((r) => r !== entityId) }
        : type === "place"
          ? { ...p, community_places: (p.community_places ?? []).filter((c) => c.place_id !== entityId) }
          : { ...p, community_events: (p.community_events ?? []).filter((c) => c.event_id !== entityId) })
    try {
      const r = await fetch(
        `/api/stories/${displayStory.id}/connections?type=${type}&entity_id=${encodeURIComponent(entityId)}`,
        { method: "DELETE" },
      )
      if (!r.ok) {
        setDisplayStory(prev)
        if (r.status === 403 && type === "rider" && entityId === activePersonId) {
          // The viewer is the tagged subject but not the adder: undoing is a
          // decline, which lives in the tag inbox rather than this route.
          addToast("This tag was added by someone else. You can decline it from your tag inbox at /me/tags.", "info")
        } else {
          const { error } = await r.json().catch(() => ({ error: null }))
          addToast(error ?? "Could not remove the connection.", "error")
        }
      }
    } catch {
      setDisplayStory(prev)
      addToast("Could not remove the connection.", "error")
    } finally {
      setRemovingKey(null)
    }
  }

  const hasLinks = linkedPlace || linkedEvent || linkedOrg || linkedBoards.length > 0
    || taggedRiders.length > 0 || communityPlaceChips.length > 0 || communityEventChips.length > 0

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/stories?id=${displayStory.id}`, { method: "DELETE" })
    onDelete?.(displayStory.id)
    setDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <>
    {editing && (
      <AddStoryModal
        editStory={displayStory}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          // The PATCH response carries no reaction/comment joins; keep the
          // counts from the pre-edit story so the interaction row survives
          // an edit (the rows themselves are untouched by edits).
          setDisplayStory((prev) => ({
            ...updated,
            reaction_summary: updated.reaction_summary ?? prev.reaction_summary,
            viewer_reaction: updated.viewer_reaction ?? prev.viewer_reaction,
            comment_count: updated.comment_count ?? prev.comment_count,
          }))
          setEditing(false)
        }}
      />
    )}

    <div className="postcard group bg-surface border-2 border-violet-700 rounded-xl p-5 mb-4 transition-all">

      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Author avatar */}
          {displayStory.author?.avatar_url ? (
            <img
              src={displayStory.author.avatar_url}
              alt={displayStory.author.display_name}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-violet-600">
              {(displayStory.author?.display_name ?? "?")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted">
              {displayStory.author?.display_name ?? "Rider"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted bg-surface-hover border border-border-default rounded px-1.5 py-0.5">
            Story
          </span>
          <span className="text-xs text-muted">{formatStoryDate(displayStory.story_date)}</span>

          {isOwn && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                // BUG-044: the owner's edit/delete trigger is always visible (no
                // hover gate). The earlier hover-reveal was invisible on touch
                // (no hover state), and the (hover:hover)/(hover:none) opacity
                // juggling that tried to fix that left it hidden even on desktop.
                // Only the owner sees this control, so a persistent muted ⋯ that
                // darkens on hover is the simplest reliable affordance everywhere.
                className="text-muted hover:text-foreground transition-colors text-lg leading-none px-1"
                aria-label="Story menu"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 z-50 bg-surface border border-border-default rounded-lg shadow-xl min-w-[130px] py-1">
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true) }}
                    className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-surface-hover transition-colors"
                  >
                    Edit story
                  </button>
                  <div className="border-t border-border-default mx-2" />
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-surface-hover transition-colors"
                  >
                    Delete story
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Title ── */}
      {displayStory.title && (
        <h3 className="font-bold text-foreground text-base leading-snug mb-2">{displayStory.title}</h3>
      )}

      {/* ── Body text ── */}
      {displayStory.body && (
        <p className="text-sm text-muted leading-relaxed mb-3 whitespace-pre-wrap">{displayStory.body}</p>
      )}

      {/* ── URL link ── */}
      {displayStory.url && (
        <a
          href={displayStory.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-3 break-all"
        >
          🔗 {displayStory.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </a>
      )}

      {/* ── YouTube embed ── */}
      {displayStory.youtube_url && parseYouTubeId(displayStory.youtube_url) && (
        <div className="mt-3 mb-3 rounded-xl overflow-hidden aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${parseYouTubeId(displayStory.youtube_url)}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            title="Story video"
          />
        </div>
      )}

      {/* ── Photo grid ── */}
      {photos.length > 0 && (
        <div className={cn(
          "grid gap-1.5 mb-3 rounded-lg overflow-hidden",
          photos.length === 1 ? "grid-cols-1" :
          photos.length === 2 ? "grid-cols-2" :
          photos.length >= 3 ? "grid-cols-3" : "grid-cols-2"
        )}>
          {photos.slice(0, 6).map((photo, i) => (
            <div
              key={photo.id}
              className={cn(
                "relative cursor-pointer overflow-hidden bg-surface-hover",
                photos.length === 1 ? "aspect-[16/9]" : "aspect-square",
                // First photo spans 2 cols when there are 3+ photos
                i === 0 && photos.length === 3 ? "col-span-2 row-span-1" : ""
              )}
              onClick={() => setLightboxIdx(i)}
            >
              <img
                src={photo.url}
                alt={photo.caption ?? `Photo ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
              {i === 5 && photos.length > 6 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">+{photos.length - 6}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Linked entity chips ── */}
      {hasLinks && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {linkedPlace && (
            <CommunityLink
              href={`/places/${placeSlug(linkedPlace)}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-[#292524]/20 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" /> {linkedPlace.name}
            </CommunityLink>
          )}
          {communityPlaceChips.map(({ conn, place }) => {
            const canRemove = canRemoveCommunityLink(conn.added_by)
            const busy = removingKey === `place:${place.id}`
            const connectedBy = adderName(conn.added_by)
            return (
              <span key={`cp-${place.id}`} className="inline-flex items-center">
                <CommunityLink
                  href={`/places/${placeSlug(place)}`}
                  title={connectedBy ? `Connected by ${connectedBy}` : undefined}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-[#292524]/20 transition-colors",
                    canRemove && "rounded-r-none",
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" /> {place.name}
                </CommunityLink>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => removeConnection("place", place.id)}
                    disabled={busy}
                    className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full rounded-l-none border-l-0 bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 transition-colors"
                    title={`Remove ${place.name} from this story`}
                    aria-label={`Remove ${place.name} from this story`}
                  >
                    {busy ? "…" : "×"}
                  </button>
                )}
              </span>
            )
          })}
          {linkedEvent && (
            <CommunityLink
              href={`/events/${eventSlug(linkedEvent)}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0" /> {linkedEvent.name}
            </CommunityLink>
          )}
          {communityEventChips.map(({ conn, event }) => {
            const canRemove = canRemoveCommunityLink(conn.added_by)
            const busy = removingKey === `event:${event.id}`
            const connectedBy = adderName(conn.added_by)
            return (
              <span key={`ce-${event.id}`} className="inline-flex items-center">
                <CommunityLink
                  href={`/events/${eventSlug(event)}`}
                  title={connectedBy ? `Connected by ${connectedBy}` : undefined}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors",
                    canRemove && "rounded-r-none",
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0" /> {event.name}
                </CommunityLink>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => removeConnection("event", event.id)}
                    disabled={busy}
                    className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full rounded-l-none border-l-0 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                    title={`Remove ${event.name} from this story`}
                    aria-label={`Remove ${event.name} from this story`}
                  >
                    {busy ? "…" : "×"}
                  </button>
                )}
              </span>
            )
          })}
          {linkedOrg && (
            <CommunityLink
              href={`/brands/${orgSlug(linkedOrg)}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-600 flex-shrink-0" /> {linkedOrg.name}
            </CommunityLink>
          )}
          {linkedBoards.map((board) => board && (
            <CommunityLink
              key={board.id}
              href={`/boards/${boardSlug(board)}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              🏂 {board.brand} {board.model} &apos;{String(board.model_year).slice(2)}
            </CommunityLink>
          ))}
          {taggedRiders.map((rider) => {
            if (!rider) return null
            const riderTier = getRiderTier(rider)
            const isUnclaimed = riderTier === "unclaimed" || riderTier === "catalog"
            const canReport = viewerSignedIn && activePersonId !== rider.id
            const canRemove = canRemoveRiderChip(rider.id)
            const isLoading = reportOpening === rider.id
            const removeBusy = removingKey === `rider:${rider.id}`
            const appendageCls = isUnclaimed
              ? "bg-blue-500/5 border border-dashed border-blue-500/30 text-blue-400/70 hover:bg-blue-500/10"
              : "bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20"
            return (
              <span key={rider.id} className="inline-flex items-center">
                <CommunityLink
                  href={personHref(rider, catalog.people)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors",
                    (canReport || canRemove) ? "rounded-r-none" : "",
                    isUnclaimed
                      ? "bg-blue-500/5 border border-dashed border-blue-500/30 text-blue-400/70 hover:bg-blue-500/10"
                      : "bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20"
                  )}
                  title={isUnclaimed ? `${rider.display_name} hasn't joined yet` : undefined}
                >
                  👤 {rider.display_name}
                </CommunityLink>
                {canReport && (
                  <button
                    type="button"
                    onClick={() => openReportForRider(rider.id, rider.display_name)}
                    disabled={isLoading}
                    className={cn(
                      "inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full rounded-l-none border-l-0 transition-colors",
                      canRemove && "rounded-r-none",
                      appendageCls
                    )}
                    title={`Report tag of ${rider.display_name}`}
                    aria-label={`Report tag of ${rider.display_name}`}
                  >
                    {isLoading ? "…" : "⚑"}
                  </button>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => removeConnection("rider", rider.id)}
                    disabled={removeBusy}
                    className={cn(
                      "inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full rounded-l-none border-l-0 transition-colors",
                      appendageCls
                    )}
                    title={`Remove tag of ${rider.display_name}`}
                    aria-label={`Remove tag of ${rider.display_name}`}
                  >
                    {removeBusy ? "…" : "×"}
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* ── Reactions + comments + connect ── */}
      {displayStory.comment_count !== undefined && (
        <div className="relative">
          <StoryInteractions
            story={displayStory}
            defaultExpanded={expandComments}
            showConnect={viewerSignedIn}
            onConnect={() => setConnectOpen((o) => !o)}
          />
          {connectOpen && (
            <AddConnectionsPopover
              story={displayStory}
              onClose={() => setConnectOpen(false)}
              onAdded={handleConnectionAdded}
            />
          )}
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="mt-3 pt-3 border-t border-border-default flex items-center gap-3">
          <span className="text-xs text-muted flex-1">Delete this story?</span>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxIdx !== null && (
        <ImageLightbox
          src={photos[lightboxIdx].url}
          alt={photos[lightboxIdx].caption ?? "Story photo"}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* ── PB-009 Phase 3 — report tag modal ── */}
      <ReportTagModal
        open={reportTarget !== null}
        onCancel={() => setReportTarget(null)}
        onConfirm={async (category, note) => submitReport(category, note)}
        submitting={reportSubmitting}
      />
    </div>
    </>
  )
}
