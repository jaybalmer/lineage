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
// On a subject with more than SUBJECT_MENTION_CAP mentions the card can arrive
// as a count-only stub (no `groups`, a `load` instead). It then fetches its
// mentions the first time it is opened and keeps them, so the page never
// downloads a year the reader does not open.
//
// The year is when the episode aired, which is why the copy says "talked
// about", not "in <year>" as if the stories happened then.

import { useState } from "react"
import { groupMentionsByEpisode } from "@/lib/mentions"
import { MentionRow } from "@/components/feed/mention-row"
import { MentionEpisodeGroup } from "@/components/feed/mention-episode-group"
import type { EpisodeGroup } from "@/lib/mentions"
import type { Mention } from "@/types"

export function MentionYearGroup({
  year,
  groups: initialGroups,
  mentionCount,
  episodeCount,
  showName = null,
  load,
}: {
  year: string
  /** The year's episode groups, when they were downloaded with the page. */
  groups?: EpisodeGroup<Mention>[]
  mentionCount: number
  /** Required with `load`; defaults to groups.length. */
  episodeCount?: number
  /** Stub mode: the show name the server resolved, when there is one. */
  showName?: string | null
  /** Stub mode: fetch this year's mentions on first open. */
  load?: () => Promise<Mention[]>
}) {
  const [open, setOpen] = useState(false)
  const [fetched, setFetched] = useState<EpisodeGroup<Mention>[] | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const groups = initialGroups ?? fetched
  const count = episodeCount ?? initialGroups?.length ?? 0

  const fetchYear = () => {
    if (!load || status === "loading") return
    setStatus("loading")
    load()
      .then((rows) => {
        setFetched(groupMentionsByEpisode(rows))
        setStatus("idle")
      })
      .catch(() => setStatus("error"))
  }

  const toggle = () => {
    if (!open && !groups) fetchYear()
    setOpen((v) => !v)
  }

  let show = showName ? `${showName} ` : ""
  if (groups) {
    const shows = new Set(groups.map((g) => g.items[0]?.episode?.show_name).filter(Boolean))
    show = shows.size === 1 ? `${[...shows][0]} ` : ""
  }
  const sorted = [...(groups ?? [])].sort((a, b) =>
    (b.items[0]?.episode?.start_date ?? "").localeCompare(a.items[0]?.episode?.start_date ?? ""),
  )

  return (
    <div className="rounded-xl border border-border-default bg-surface px-4 py-3 mb-2">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-xs text-fuchsia-500" aria-hidden>🎙</span>
        <span className="text-sm text-foreground">
          Talked about {mentionCount} {mentionCount === 1 ? "time" : "times"} in{" "}
          <span className="font-semibold">{count} {show}{count === 1 ? "episode" : "episodes"}</span> in {year}
        </span>
      </div>

      {open && !groups && (
        <p className="mt-3 text-xs text-muted" role="status">
          {status === "error" ? (
            <>
              Could not load these episodes.{" "}
              <button type="button" onClick={fetchYear} className="font-medium text-accent-strong hover:underline">
                Try again
              </button>
            </>
          ) : (
            "Loading episodes..."
          )}
        </p>
      )}

      {open && groups && (
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
        onClick={toggle}
        aria-expanded={open}
        className="mt-2 text-[11px] font-medium text-accent-strong hover:underline"
      >
        {open ? "Show less" : count === 1 ? "Show the episode" : `Show the ${count} episodes`}
      </button>
    </div>
  )
}
