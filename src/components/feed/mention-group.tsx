"use client"

// One MOMENT of an episode, with its whole cast.
//
// The transcript workflow writes a story once per subject, so the episode page
// was printing the same paragraph once for every name in it. This renders the
// moment instead: the line is stated once, and the people, places, brands and
// events it establishes are chips beneath it.
//
// The subject-led MentionRow is still the right shape on a person's timeline
// (they see the story once, and the episode is the news). This is its episode
// counterpart. A group of one renders as a single-chip card, which is what a
// hand-added mention from the editor modal has always looked like.

import { useState } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { EntityChip } from "@/components/feed/entity-chip"
import { useLineageStore } from "@/store/lineage-store"
import { usePersonHref } from "@/lib/use-person-href"
import { formatTimestamp, type MomentGroup } from "@/lib/mentions"
import { parseYouTubeId } from "@/lib/utils"
import { entityHref } from "@/lib/entity-links"
import type { Mention } from "@/types"

export type MentionMoment = MomentGroup<Mention>

/**
 * Deep link to the moment when the media can actually seek there. Same rule as
 * MentionRow: only YouTube honors a `t=` offset, so anything else degrades to
 * "Open episode" rather than promising a jump it cannot make.
 */
function watchLink(
  mediaUrl: string | null | undefined,
  seconds: number | null,
): { href: string; seeks: boolean } | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  if (!id) return { href: mediaUrl, seeks: false }
  return seconds != null
    ? { href: `https://www.youtube.com/watch?v=${id}&t=${seconds}s`, seeks: true }
    : { href: `https://www.youtube.com/watch?v=${id}`, seeks: false }
}

export function MentionGroup({
  moment,
  isEditor = false,
  onEdit,
  onRemove,
  onSetStatus,
}: {
  moment: MentionMoment
  isEditor?: boolean
  onEdit?: (mention: Mention) => void
  onRemove?: (mention: Mention) => void
  /** Flip the whole story's rows together. A story publishes or it does not. */
  onSetStatus?: (mentions: Mention[], status: "draft" | "published") => Promise<void> | void
}) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const catalog = useLineageStore((s) => s.catalog)
  const personHref = usePersonHref()

  const stamp = moment.timestamp_seconds != null ? formatTimestamp(moment.timestamp_seconds) : null
  const first = moment.items[0]
  const watch = watchLink(first?.episode?.media_url, moment.timestamp_seconds)
  const hasDetail = Boolean(moment.excerpt) || Boolean(watch)
  const anyDraft = moment.items.some((m) => m.status === "draft")

  function nameOf(mention: Mention): string {
    if (mention.subject_type === "person") {
      return catalog.people.find((p) => p.id === mention.subject_id)?.display_name ?? "Someone"
    }
    return resolveEntityName(catalog, mention)
  }

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
            {stamp && (
              <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-surface-hover border border-border-default text-muted">
                {stamp}
              </span>
            )}
            {anyDraft && isEditor && (
              <span
                title="Only editors can see this"
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover border border-border-default text-muted"
              >
                Draft
              </span>
            )}
          </div>

          {moment.story_title && (
            <p className="text-sm font-semibold text-foreground mt-1.5 leading-snug">{moment.story_title}</p>
          )}
          {!expanded && moment.excerpt && (
            <p
              className={`text-sm text-muted line-clamp-2 leading-relaxed ${moment.story_title ? "mt-0.5" : "mt-1.5"}`}
            >
              {moment.excerpt}
            </p>
          )}
          {hasDetail && !expanded && (
            <p className="text-[11px] text-muted mt-1">{moment.excerpt ? "Read the line" : "Listen"} →</p>
          )}
        </button>

        {isEditor && onSetStatus && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try { await onSetStatus(moment.items, anyDraft ? "published" : "draft") }
              finally { setBusy(false) }
            }}
            className={`flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
              anyDraft
                ? "border-transparent bg-[#1C1917] text-white hover:bg-[#292524]"
                : "border-border-default text-muted hover:text-foreground"
            }`}
          >
            {busy ? "Saving…" : anyDraft ? "Publish" : "Unpublish"}
          </button>
        )}
      </div>

      {/* The cast. Outside the expand button so every chip stays its own link. */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {moment.items.map((mention) => {
          const name = nameOf(mention)
          const person =
            mention.subject_type === "person"
              ? catalog.people.find((p) => p.id === mention.subject_id)
              : null
          return person ? (
            <Link key={mention.id} href={personHref(person)}>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-500/10 border border-violet-700/40 rounded-lg text-foreground hover:border-violet-700 transition-all">
                <span className="text-[10px]">👤</span>
                {name}
              </span>
            </Link>
          ) : (
            <EntityChip
              key={mention.id}
              id={mention.subject_id}
              type={mention.subject_type}
              name={name}
            />
          )
        })}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border-default">
          {moment.excerpt && (
            <blockquote className="text-sm text-foreground leading-relaxed border-l-2 border-fuchsia-500 pl-3 italic">
              {moment.excerpt}
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
            {first?.episode && (
              <CommunityLink
                href={entityHref(first.episode.id, "event", catalog)}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Episode page
              </CommunityLink>
            )}
          </div>

          {/* Editing is still per mention, because each subject is its own row. */}
          {isEditor && (onEdit || onRemove) && (
            <div className="mt-3 pt-3 border-t border-border-default flex flex-col gap-1.5">
              {moment.items.map((mention) => (
                <div key={mention.id} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted truncate">{nameOf(mention)}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
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
                </div>
              ))}
            </div>
          )}
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
