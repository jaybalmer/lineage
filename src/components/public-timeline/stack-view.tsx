"use client"

// PB-010A Phase 3: the curated Stack — one flat, high-density list of cards in
// owner-chosen `position` order (no decade grouping, no category headers; the
// supplement is explicit that the stack is one list). Store-free: every entry is
// resolved server-side by readPublicStack. Decoupled from the timeline renderer.

import type { ResolvedStackEntry } from "@/lib/public-timeline-read"
import { StackEntryCard } from "@/components/public-timeline/stack-entry-card"

export function StackView({ entries }: { entries: ResolvedStackEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-white/55 py-16">
        <div className="text-3xl mb-3">🏂</div>
        <div className="text-sm">This stack is just getting started.</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <StackEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
