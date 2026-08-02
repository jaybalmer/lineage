"use client"

// One MOMENT of an episode on the PUBLIC page, with its whole cast.
//
// The public twin of MentionGroup, and separate for the same reason
// PublicMentionRow is separate from MentionRow: the chromeless /t/[slug] page is
// store-free by design (every name is resolved server-side) and carries no
// editor affordances. Subject names arrive pre-resolved, so there is no catalog
// lookup and no linking out to in-app entity pages.

import { useState } from "react"
import { formatTimestamp, type MomentGroup } from "@/lib/mentions"
import { parseYouTubeId } from "@/lib/utils"
import type { PublicMention } from "@/lib/public-timeline-read"

function watchLink(mediaUrl: string | null, seconds: number | null): { href: string; seeks: boolean } | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  if (!id) return { href: mediaUrl, seeks: false }
  return seconds != null
    ? { href: `https://www.youtube.com/watch?v=${id}&t=${seconds}s`, seeks: true }
    : { href: `https://www.youtube.com/watch?v=${id}`, seeks: false }
}

export function PublicMentionGroup({ moment, mediaUrl }: {
  moment: MomentGroup<PublicMention>
  mediaUrl: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const stamp = moment.timestamp_seconds != null ? formatTimestamp(moment.timestamp_seconds) : null
  const watch = watchLink(mediaUrl, moment.timestamp_seconds)
  const hasDetail = Boolean(moment.excerpt) || Boolean(watch)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={`w-full text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fuchsia-400" aria-hidden>🎙</span>
          {stamp && (
            <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/60">
              {stamp}
            </span>
          )}
        </div>
        {moment.story_title && (
          <p className="text-sm font-semibold text-white mt-1.5 leading-snug">{moment.story_title}</p>
        )}
        {!expanded && moment.excerpt && (
          <p
            className={`text-sm text-white/70 line-clamp-2 leading-relaxed ${moment.story_title ? "mt-0.5" : "mt-1.5"}`}
          >
            {moment.excerpt}
          </p>
        )}
        {hasDetail && !expanded && (
          <p className="text-[11px] text-white/45 mt-1">{moment.excerpt ? "Read the line" : "Listen"} →</p>
        )}
      </button>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {moment.items.map((mention) => (
          <span
            key={mention.id}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-white/10 border border-white/10 rounded-lg text-white/80"
          >
            {mention.subject_name}
          </span>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10">
          {moment.excerpt && (
            <blockquote className="text-sm text-white/85 leading-relaxed border-l-2 border-fuchsia-500 pl-3 italic">
              {moment.excerpt}
            </blockquote>
          )}
          {watch && (
            <a
              href={watch.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs font-medium text-white/80 hover:text-white underline"
            >
              {watch.seeks && stamp ? `Watch at ${stamp}` : "Open episode"} ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
