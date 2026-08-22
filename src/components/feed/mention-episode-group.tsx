"use client"

// BUG-172: a run of mentions from the same episode, folded into one card.
//
// On a person's timeline (and the entity mention lists) a rider named six times
// on FNRad #142 used to render as six near-identical stacked rows on one date.
// This card carries the episode identity once in its header. Collapsed it is
// header-only (BUG-175); opening it lists each mention beneath, keeping every
// row's own "Read the line" expand and adding a group-level "Expand all" /
// "Collapse all".
//
// It does not re-implement a row: each line is a MentionRow with `nested`, so
// the excerpt, timestamp, and watch/episode links stay exactly as they are on a
// lone mention.

import { useState } from "react"
import { CommunityLink } from "@/components/ui/community-link"
import { MentionRow, episodeLabel } from "@/components/feed/mention-row"
import { useLineageStore } from "@/store/lineage-store"
import { entityHref } from "@/lib/entity-links"
import { formatSmartDate } from "@/lib/utils"
import type { Mention } from "@/types"

export function MentionEpisodeGroup({ mentions }: { mentions: Mention[] }) {
  const catalog = useLineageStore((s) => s.catalog)
  // BUG-175: collapsed means header-only. No mention lines are previewed, so the
  // card reads as one quiet summary until the reader opens it.
  const [showAll, setShowAll] = useState(false)
  // Group-level Expand all / Collapse all. `n` bumps on every click so a row can
  // re-sync even when `open` did not change (e.g. after the reader closed a line
  // by hand and then hits Expand all again).
  const [allOpen, setAllOpen] = useState<{ open: boolean; n: number }>({ open: false, n: 0 })

  const first = mentions[0]
  const label = episodeLabel(first)
  const date = first.episode?.start_date
  const episodeId = first.episode?.id

  // Closing the list also resets the group toggle, so "Expand all" never comes
  // back reading "Collapse all" against freshly remounted (closed) rows.
  const toggleList = () => {
    if (showAll) setAllOpen((s) => ({ open: false, n: s.n + 1 }))
    setShowAll((v) => !v)
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface px-4 py-3 mb-2">
      {/* Header: episode identity, once */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-xs text-fuchsia-500" aria-hidden>🎙</span>
          <span className="text-sm text-foreground">
            Mentioned {mentions.length} times on <span className="font-semibold">{label}</span>
          </span>
          {date && <span className="text-xs text-muted">{formatSmartDate(date)}</span>}
        </div>
        {/* Expand all only means something once the lines are on screen. */}
        {showAll && (
          <button
            type="button"
            onClick={() => setAllOpen((s) => ({ open: !s.open, n: s.n + 1 }))}
            className="text-[11px] text-muted hover:text-foreground transition-colors flex-shrink-0"
          >
            {allOpen.open ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {/* One line per mention, only once expanded */}
      {showAll && (
        <div className="mt-2 divide-y divide-border-default">
          {mentions.map((mention) => (
            <MentionRow
              key={`mention-${mention.id}`}
              mention={mention}
              context="timeline"
              nested
              openSignal={allOpen}
            />
          ))}
        </div>
      )}

      {/* The only way into the list, so it renders for every group size */}
      <button
        type="button"
        onClick={toggleList}
        aria-expanded={showAll}
        className="mt-2 text-[11px] font-medium text-accent-strong hover:underline"
      >
        {showAll ? "Show less" : `Show the ${mentions.length} mentions`}
      </button>

      {/* Episode link */}
      {episodeId && (
        <div className="mt-2">
          <CommunityLink
            href={entityHref(episodeId, "event", catalog)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Episode page
          </CommunityLink>
        </div>
      )}
    </div>
  )
}
