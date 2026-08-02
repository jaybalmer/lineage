"use client"

// Podcast pass Session B: one mention, rendered two ways.
//
// A mention is an "audio memory": someone was talked about on an episode, at a
// moment, and here is the line. The same row serves two surfaces, so it carries
// a `context` prop rather than being forked into two components:
//
//   context="episode"   the episode page. The SUBJECT leads ("Ken Achenbach"),
//                       because the reader already knows the episode. Editors
//                       additionally get the draft badge, edit, and remove.
//   context="timeline"  a person's timeline. The EPISODE leads ("Mentioned on
//                       FNRad #142"), because the reader already knows who.
//
// Compact row, deliberately NOT a .postcard: mentions are third-party pointers,
// not authored moments, and should read lighter than a story card.

import { useState } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { EntityChip } from "@/components/feed/entity-chip"
import { useLineageStore } from "@/store/lineage-store"
import { usePersonHref } from "@/lib/use-person-href"
import { formatTimestamp } from "@/lib/mentions"
import { parseYouTubeId, formatSmartDate } from "@/lib/utils"
import { entityHref } from "@/lib/entity-links"
import type { Mention } from "@/types"

/**
 * Link to the episode media, deep-linked to the mentioned moment when we can.
 *
 * `seeks` is what the label keys on, and it is deliberately NOT the same as
 * "there is a timestamp": plenty of episodes are Apple Podcasts links, and
 * only YouTube takes a `t=` offset. Promising "Watch at 12:34" on a link that
 * opens at 0:00 is a lie the reader catches immediately, so a non-YouTube
 * media_url degrades to a plain "Open episode".
 */
function watchLink(mention: Mention): { href: string; seeks: boolean } | null {
  const url = mention.episode?.media_url
  if (!url) return null
  const id = parseYouTubeId(url)
  if (!id) return { href: url, seeks: false }
  return mention.timestamp_seconds != null
    ? { href: `https://www.youtube.com/watch?v=${id}&t=${mention.timestamp_seconds}s`, seeks: true }
    : { href: `https://www.youtube.com/watch?v=${id}`, seeks: false }
}

/** "FNRad #142" when both are known, degrading to whatever we do have. */
function episodeLabel(mention: Mention): string {
  const ep = mention.episode
  if (!ep) return "an episode"
  const show = ep.show_name
  const num = ep.episode_number != null ? `#${ep.episode_number}` : null
  if (show && num) return `${show} ${num}`
  if (show) return show
  return ep.name
}

export function MentionRow({
  mention,
  context,
  isEditor = false,
  onEdit,
  onRemove,
}: {
  mention: Mention
  context: "episode" | "timeline"
  isEditor?: boolean
  onEdit?: (mention: Mention) => void
  onRemove?: (mention: Mention) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const catalog = useLineageStore((s) => s.catalog)
  const personHref = usePersonHref()

  const stamp = mention.timestamp_seconds != null ? formatTimestamp(mention.timestamp_seconds) : null
  const watch = watchLink(mention)
  const hasDetail = Boolean(mention.excerpt) || Boolean(watch)

  const subject =
    mention.subject_type === "person"
      ? catalog.people.find((p) => p.id === mention.subject_id)
      : null
  const subjectName =
    mention.subject_type === "person"
      ? subject?.display_name ?? "Someone"
      : resolveEntityName(catalog, mention)

  return (
    <div className="rounded-xl border border-border-default bg-surface px-4 py-3 mb-2">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => hasDetail && setExpanded((v) => !v)}
          className={`flex-1 text-left min-w-0 ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
          aria-expanded={hasDetail ? expanded : undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-fuchsia-500" aria-hidden>🎙</span>

            {context === "timeline" ? (
              <span className="text-sm text-foreground">
                Mentioned on <span className="font-semibold">{episodeLabel(mention)}</span>
              </span>
            ) : mention.subject_type === "person" ? (
              <span className="text-sm font-semibold text-foreground">{subjectName}</span>
            ) : (
              <EntityChip id={mention.subject_id} type={mention.subject_type} name={subjectName} />
            )}

            {stamp && (
              <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-surface-hover border border-border-default text-muted">
                {stamp}
              </span>
            )}
            {mention.status === "draft" && isEditor && (
              <span
                title="Only editors can see this"
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover border border-border-default text-muted"
              >
                Draft
              </span>
            )}
          </div>

          {context === "timeline" ? (
            <>
              {mention.story_title && (
                <p className="text-sm font-semibold text-foreground mt-1 leading-snug">{mention.story_title}</p>
              )}
              <p className="text-xs text-muted mt-1 truncate">
                {mention.episode?.name}
                {mention.episode?.start_date ? ` · ${formatSmartDate(mention.episode.start_date)}` : ""}
              </p>
            </>
          ) : null}

          {hasDetail && !expanded && (
            <p className="text-[11px] text-muted mt-1">{mention.excerpt ? "Read the line" : "Listen"} →</p>
          )}
        </button>

        {context === "episode" && isEditor && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(mention)}
                className="text-[11px] text-muted hover:text-foreground transition-colors"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(mention)}
                className="text-[11px] text-muted hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border-default">
          {mention.excerpt && (
            <blockquote className="text-sm text-foreground leading-relaxed border-l-2 border-fuchsia-500 pl-3 italic">
              {mention.excerpt}
            </blockquote>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {watch && (
              <a
                href={watch.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-accent-strong hover:underline"
              >
                {watch.seeks && stamp ? `Watch at ${stamp}` : "Open episode"} ↗
              </a>
            )}
            {mention.episode && (
              <CommunityLink
                href={entityHref(mention.episode.id, "event", catalog)}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Episode page
              </CommunityLink>
            )}
            {context === "episode" && mention.subject_type === "person" && subject && (
              <Link
                href={personHref(subject)}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                View rider
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Name lookup for non-person subjects, falling back to the raw id. */
function resolveEntityName(
  catalog: ReturnType<typeof useLineageStore.getState>["catalog"],
  mention: Mention,
): string {
  const { subject_type: type, subject_id: id } = mention
  const list =
    type === "place" ? catalog.places
      : type === "org" ? catalog.orgs
      : type === "event" ? catalog.events
      : type === "board" ? catalog.boards
      : []
  const hit = (list as { id: string; name?: string; model?: string; brand?: string }[]).find((e) => e.id === id)
  if (!hit) return id
  if (type === "board") return [hit.brand, hit.model].filter(Boolean).join(" ") || id
  return hit.name ?? id
}
