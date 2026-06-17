"use client"

// PB-010A Phase 3: one Stack card. Six entry types render through here as pure,
// read-only art with a colored left edge keyed to the entity type. Decoupled and
// store-free (acceptance §6): the payload is fully resolved server-side; the only
// client work is the board-thumbnail auto-search (useBoardImage, itself store-free)
// and the inline expand. There is intentionally NO "+" claim affordance in Phase 3
// (decision D3) — that is the Phase 4 tag-to-claim surface, built for both views
// at once. The card layout leaves room for it and stops there.

import { useState } from "react"
import type { ResolvedStackEntry, StackAccent, PublicTimelineOwner, PublicTimelineEntities } from "@/lib/public-timeline-read"
import type { Story } from "@/types"
import { useBoardImage } from "@/hooks/use-board-image"
import { EntityGraphic } from "@/components/public-timeline/entity-graphic"
import { IWasThere, type TagMoment } from "@/components/public-timeline/i-was-there"
import { StoryMedia } from "@/components/public-timeline/story-media"
import { cn } from "@/lib/utils"

// Only story / place / event stack entries are taggable (brief §5). Board,
// rider and category_summary entries get no "I was there" affordance.
const TAGGABLE = new Set<TagMoment["kind"]>(["story", "place", "event"])

const ACCENT_EDGE: Record<StackAccent, string> = {
  violet: "bg-violet-600", teal: "bg-teal-600", amber: "bg-amber-500",
  emerald: "bg-emerald-600", cyan: "bg-cyan-600",
}
const ACCENT_TEXT: Record<StackAccent, string> = {
  violet: "text-violet-700", teal: "text-teal-700", amber: "text-amber-700",
  emerald: "text-emerald-700", cyan: "text-cyan-700",
}
const ACCENT_DOT: Record<StackAccent, string> = {
  violet: "bg-violet-500", teal: "bg-teal-500", amber: "bg-amber-500",
  emerald: "bg-emerald-500", cyan: "bg-cyan-500",
}

// Violet story tile — the EntityGraphic set has no "story" art (story is not an
// EntityType), so the fallback lives here, matching the violet story accent.
function StoryTile() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56, height: 56, borderRadius: 14,
        background: "linear-gradient(145deg, #2e1065 0%, #1e0b50 45%, #130830 100%)",
        boxShadow: "inset 0 1px 0 rgba(196,132,252,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="#c4b5fd" strokeWidth="1.4" strokeOpacity="0.85" />
        <path d="M14 4v5h5" stroke="#c4b5fd" strokeWidth="1.4" strokeOpacity="0.7" />
        <path d="M7.5 13h7M7.5 16.5h5" stroke="#ddd6fe" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
      </svg>
    </div>
  )
}

function StackThumb({ entry }: { entry: ResolvedStackEntry }) {
  const isBoard = entry.entry_type === "board"
  const auto = useBoardImage(
    isBoard ? entry.board?.brand : undefined,
    isBoard ? entry.board?.model : undefined,
    isBoard ? entry.board?.year ?? undefined : undefined,
  )

  if (entry.entry_type === "category_summary") {
    return (
      <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center bg-surface-hover">
        <span className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          {entry.count}
        </span>
      </div>
    )
  }

  const photo = entry.thumbPhotoUrl ?? (isBoard ? auto || null : null)
  const loading = isBoard && !entry.thumbPhotoUrl && auto === undefined

  if (photo) {
    return (
      <div className="w-[72px] h-[72px] flex-shrink-0 overflow-hidden bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={entry.title} className="w-full h-full object-cover" />
      </div>
    )
  }
  if (loading) {
    return <div className="w-[72px] h-[72px] flex-shrink-0 bg-surface-hover animate-pulse" />
  }
  return (
    <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center bg-surface-hover">
      {entry.thumbEntity ? (
        <EntityGraphic type={entry.thumbEntity} name={entry.thumbName} year={entry.thumbYear ?? undefined} />
      ) : (
        <StoryTile />
      )}
    </div>
  )
}

export function StackEntryCard({ entry, owner, story, entities }: {
  entry: ResolvedStackEntry
  owner: PublicTimelineOwner
  /** Full story behind a story entry — drives the rich in-place expansion. */
  story?: Story
  entities?: PublicTimelineEntities
}) {
  const [expanded, setExpanded] = useState(false)
  const isSummary = entry.entry_type === "category_summary"
  const hasItems = isSummary && entry.items.length > 0
  const taggable =
    TAGGABLE.has(entry.entry_type as TagMoment["kind"]) && !!entry.refId

  // An event-linked story offers spectator / competitor / organizer in its tag
  // panel, tagged on the story and the event.
  const linkedEventEntity = story?.linked_event_id && entities
    ? entities.events[story.linked_event_id]
    : undefined
  const linkedEvent = story?.linked_event_id && linkedEventEntity
    ? { id: story.linked_event_id, name: linkedEventEntity.name }
    : undefined
  // Story entries expand to show their full media inline (photos / video / link).
  const storyHasMedia = !!story &&
    (((story.photos?.length ?? 0) > 0) || !!story.youtube_url || !!story.url)

  // The chevron reveals the card's hidden detail: the item list (summary cards),
  // the full summary text when it is long enough to clamp, the story's media,
  // and — for taggable cards — the "I was there" affordance (hidden by default).
  const canExpand =
    hasItems || (!isSummary && !!entry.summary && entry.summary.length > 70) ||
    storyHasMedia || taggable

  return (
    <div>
      <div
        className={cn(
          "postcard flex items-stretch bg-surface rounded-xl overflow-hidden shadow-sm",
          canExpand && "cursor-pointer",
        )}
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
        {...(canExpand
          ? { role: "button" as const, tabIndex: 0, "aria-expanded": expanded,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v) }
              } }
          : {})}
      >
        <div className={cn("w-1 flex-shrink-0", ACCENT_EDGE[entry.accent])} />
        <StackThumb entry={entry} />

        <div className="flex-1 min-w-0 px-3.5 py-2.5 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", ACCENT_TEXT[entry.accent])}>
              {entry.kicker}
            </span>
            {entry.kickerMeta && (
              <span className="text-[10px] text-muted tracking-wide">· {entry.kickerMeta}</span>
            )}
          </div>
          <p className="font-bold text-foreground text-[15px] leading-snug truncate">{entry.title}</p>
          {entry.summary && (
            <p className={cn("text-xs text-muted leading-relaxed mt-0.5", !expanded && "line-clamp-2")}>
              {entry.summary}
            </p>
          )}
        </div>

        {canExpand && (
          <div className="self-center pr-3 pl-1 flex-shrink-0">
            <span
              className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-full border border-border-default text-muted text-sm transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden
            >
              ⌄
            </span>
          </div>
        )}
      </div>

      {/* Category-summary inline expansion: the top items of that category, each
          in the stack's own flow. No "+" on the items in Phase 3 (D3). */}
      {isSummary && expanded && hasItems && (
        <div className="postcard bg-surface rounded-xl mt-1.5 px-4 py-1 shadow-sm">
          {entry.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-t border-border-default first:border-t-0">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", ACCENT_DOT[entry.accent])} />
              <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{item.name}</span>
              {item.meta && <span className="text-[11px] text-muted tracking-wide flex-shrink-0">{item.meta}</span>}
            </div>
          ))}
          {entry.count !== null && entry.count > entry.items.length && (
            <div className="py-2.5 text-center text-[10px] uppercase tracking-widest text-muted border-t border-border-default">
              + {entry.count - entry.items.length} more
            </div>
          )}
        </div>
      )}

      {/* Story entries expand to the full story media in place (photos / video
          / link), on a light panel above the tag affordance. */}
      {entry.entry_type === "story" && expanded && story && storyHasMedia && (
        <div className="postcard bg-surface rounded-xl mt-1.5 px-3.5 py-3 shadow-sm">
          <StoryMedia story={story} />
        </div>
      )}

      {/* PB-010 Phase 4: tag-to-claim affordance (story / place / event only),
          hidden until the visitor opens the card via the chevron. Event-linked
          stories carry the event so the panel can offer the role choices. */}
      {taggable && expanded && (
        <IWasThere
          ownerSlug={owner.slug}
          ownerName={owner.display_name}
          moment={{ kind: entry.entry_type as TagMoment["kind"], id: entry.refId! }}
          linkedEvent={linkedEvent}
          variant="panel"
        />
      )}
    </div>
  )
}
