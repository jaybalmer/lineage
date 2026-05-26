"use client"

import type { Claim } from "@/types"
import { FeedView } from "@/components/feed/feed-view"

// The aha moment: the user's freshly-claimed moments rendered on a real timeline,
// anchored by their start year. Read-only by design (no actions except Save and Back,
// which live in the wizard footer).
export function TimelineAhaStep({
  claims,
  displayName,
  startYear,
}: {
  claims: Claim[]
  displayName: string
  startYear?: number
}) {
  const n = claims.length

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">
          {startYear ? `Riding since ${startYear}.` : "Your timeline."}{" "}
          {n} moment{n === 1 ? "" : "s"} captured.
        </h2>
        <p className="text-muted text-sm">Save it to keep building.</p>
      </div>

      <FeedView
        claims={claims}
        days={[]}
        stories={[]}
        personName={displayName}
        isOwn
        readOnly
        hideActionButtons
        hideFilters
        order="asc"
      />
    </div>
  )
}
