"use client"

// Podcast pass Session C: one published mention on the PUBLIC episode page.
//
// Deliberately NOT the in-app MentionRow. That row reads the Zustand catalog to
// name its subject and offers editor affordances; the chromeless /t/[slug] page
// is store-free by design (every value is resolved server-side), and the public
// surface carries no Draft badge, no edit, and no remove. So this is the same
// idea rendered for the dark ground with a pre-resolved subject name.

import { useState } from "react"
import Link from "next/link"
import { formatTimestamp } from "@/lib/mentions"
import { parseYouTubeId } from "@/lib/utils"
import type { PublicMention } from "@/lib/public-timeline-read"

/**
 * Deep link to the mentioned moment when the media can actually seek there.
 * Same rule as the in-app row: only YouTube honors a `t=` offset, so an Apple
 * Podcasts link degrades to "Open episode" rather than promising a jump it
 * cannot make.
 */
function watchLink(mediaUrl: string | null, seconds: number | null): { href: string; seeks: boolean } | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  if (!id) return { href: mediaUrl, seeks: false }
  return seconds != null
    ? { href: `https://www.youtube.com/watch?v=${id}&t=${seconds}s`, seeks: true }
    : { href: `https://www.youtube.com/watch?v=${id}`, seeks: false }
}

export function PublicMentionRow({ mention, mediaUrl }: {
  mention: PublicMention
  mediaUrl: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const stamp = mention.timestamp_seconds != null ? formatTimestamp(mention.timestamp_seconds) : null
  const watch = watchLink(mediaUrl, mention.timestamp_seconds)
  const hasDetail = Boolean(mention.excerpt) || Boolean(watch)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fuchsia-400" aria-hidden>🎙</span>
        {mention.href ? (
          <Link
            href={mention.href}
            className="text-sm font-semibold text-white hover:text-white/80 transition-colors"
          >
            {mention.subject_name}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-white">{mention.subject_name}</span>
        )}
        {stamp && (
          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/60">
            {stamp}
          </span>
        )}
      </div>
      {hasDetail && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-white/45 hover:text-white/70 transition-colors mt-1 text-left"
          aria-expanded={expanded}
        >
          {mention.excerpt ? "Read the line" : "Listen"} →
        </button>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10">
          {mention.excerpt && (
            <blockquote className="text-sm text-white/85 leading-relaxed border-l-2 border-fuchsia-500 pl-3 italic">
              {mention.excerpt}
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
