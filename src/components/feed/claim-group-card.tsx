"use client"

// BUG-076: a run of one member's claims added on the same day, folded into one
// feed card. Collapsed it is header-only (like MentionEpisodeGroup, BUG-175):
// the author, a by-type summary ("added 4 places and 2 boards to their
// timeline") and a "Show the N entries" toggle. Opening it lists each claim as
// its normal PostCard so a grouped claim looks identical to a lone one.

import { useState } from "react"
import Link from "next/link"
import { PostCard } from "@/components/feed/post-card"
import { summarizeClaimTypes } from "@/lib/feed-grouping"
import type { Claim } from "@/types"
import type { CompanionMap } from "@/lib/companion-grouping"

export function ClaimGroupCard({
  claims,
  authorName,
  authorHref,
  ago,
  companionMap,
  activePersonId,
}: {
  claims: Claim[]
  authorName?: string
  authorHref?: string
  ago: string
  companionMap: CompanionMap
  activePersonId: string | null
}) {
  const [showAll, setShowAll] = useState(false)
  const summary = summarizeClaimTypes(claims)

  return (
    <div className="rounded-xl border border-border-default bg-surface px-4 py-3">
      {/* Header: author + by-type summary, once */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 text-sm min-w-0">
          {authorName && authorHref ? (
            <Link
              href={authorHref}
              className="font-medium text-foreground hover:text-blue-400 transition-colors truncate"
            >
              {authorName}
            </Link>
          ) : authorName ? (
            <span className="font-medium text-foreground truncate">{authorName}</span>
          ) : null}
          <span className="text-muted">added {summary} to their timeline</span>
        </div>
        {ago && <span className="text-[10px] text-muted shrink-0 ml-3">{ago}</span>}
      </div>

      {/* One PostCard per claim, only once expanded */}
      {showAll && (
        <div className="mt-3 space-y-3">
          {claims.map((c) => (
            <PostCard
              key={c.id}
              claim={c}
              isOwn={c.subject_id === activePersonId}
              explicitCompanionIds={companionMap.get(c.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        aria-expanded={showAll}
        className="mt-2 text-[11px] font-medium text-accent-strong hover:underline"
      >
        {showAll ? "Show less" : `Show the ${claims.length} entries`}
      </button>
    </div>
  )
}
