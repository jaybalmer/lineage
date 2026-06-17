"use client"

// PB-010A Phase 3: the curated Stack — one flat, high-density list of cards in
// owner-chosen `position` order (no decade grouping, no category headers; the
// supplement is explicit that the stack is one list). Store-free: every entry is
// resolved server-side by readPublicStack. Decoupled from the timeline renderer.

import type { ResolvedStackEntry, PublicTimelineOwner, PublicTimelineEntities } from "@/lib/public-timeline-read"
import type { Story } from "@/types"
import { StackEntryCard } from "@/components/public-timeline/stack-entry-card"

export function StackView({ entries, owner, stories, entities }: {
  entries: ResolvedStackEntry[]
  owner: PublicTimelineOwner
  /** Full stories + resolved entities, so story cards expand to the rich story. */
  stories?: Story[]
  entities?: PublicTimelineEntities
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-white/55 py-16">
        <div className="text-3xl mb-3">🏂</div>
        <div className="text-sm">This stack is just getting started.</div>
      </div>
    )
  }
  const storyById = new Map((stories ?? []).map((s) => [s.id, s]))
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <StackEntryCard
          key={entry.id}
          entry={entry}
          owner={owner}
          story={entry.entry_type === "story" && entry.refId ? storyById.get(entry.refId) : undefined}
          entities={entities}
        />
      ))}
    </div>
  )
}
