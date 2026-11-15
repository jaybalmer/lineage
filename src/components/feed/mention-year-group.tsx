"use client"

// A year of podcast mentions folded into one card (Jay, 2026-11-15).
//
// rollupEpisodesByYear() folds any air year with more than three episodes for
// one subject. Collapsed, the card is one line ("Talked about 14 times in 6
// FNRad episodes in 2023") and renders none of its episodes, so a subject named
// in 200 episodes costs a handful of cards, not 200. Opening it lists the
// episodes inside, newest first, each as the usual MentionRow (one mention) or
// MentionEpisodeGroup (several), which keep their own expand controls.
//
// The year is when the episode aired, which is why the copy says "talked
// about", not "in <year>" as if the stories happened then.

import { useState } from "react"
import { MentionRow } from "@/components/feed/mention-row"
import { MentionEpisodeGroup } from "@/components/feed/mention-episode-group"
import type { EpisodeGroup } from "@/lib/mentions"
import type { Mention } from "@/types"

export function MentionYearGroup({
  year,
  groups,
  mentionCount,
}: {
  year: string
  groups: EpisodeGroup<Mention>[]
  mentionCount: number
}) {
  const [open, setOpen] = useState(false)
  const shows = new Set(groups.map((g) => g.items[0]?.episode?.show_name).filter(Boolean))
  const show = shows.size === 1 ? `${[...shows][0]} ` : ""
  const sorted = [...groups].sort((a, b) =>
    (b.items[0]?.episode?.start_date ?? "").localeCompare(a.items[0]?.episode?.start_date ?? ""),
  )

  return (
    <div className="rounded-xl border border-border-default bg-surface px-4 py-3 mb-2">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-xs text-fuchsia-500" aria-hidden>🎙</span>
        <span className="text-sm text-foreground">
          Talked about {mentionCount} {mentionCount === 1 ? "time" : "times"} in{" "}
          <span className="font-semibold">{groups.length} {show}{groups.length === 1 ? "episode" : "episodes"}</span> in {year}
        </span>
      </div>

      {open && (
        <div className="mt-3 space-y-0">
          {sorted.map((g) =>
            g.items.length === 1 ? (
              <MentionRow key={`mention-${g.items[0].id}`} mention={g.items[0]} context="timeline" />
            ) : (
              <MentionEpisodeGroup key={g.key} mentions={g.items} />
            ),
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 text-[11px] font-medium text-accent-strong hover:underline"
      >
        {open ? "Show less" : groups.length === 1 ? "Show the episode" : `Show the ${groups.length} episodes`}
      </button>
    </div>
  )
}
