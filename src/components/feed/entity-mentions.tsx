"use client"

// Podcast mentions on a NON-PERSON entity page: a place, a brand, a board, an
// event.
//
// A rider's timeline has folded mentions in since Session B, through FeedView.
// Everything else was left out, so a mention of Grouse Mountain showed as a chip
// on the episode page and appeared nowhere on Grouse Mountain's own page. Half
// of ep 21's index was invisible on the entities it was about.
//
// These pages have no FeedView to fold into, so this is a standalone section
// instead. It renders nothing at all when there are no mentions, which is the
// common case for most of the catalog, so an entity that has never been talked
// about on a podcast looks exactly as it did before.
//
// The read is public and published-only (GET /api/mentions never returns a
// draft on the subject-side path, by design: that path feeds public timelines).
// It is the capped read: over SUBJECT_MENTION_CAP (Burton, Whistler), a busy
// year arrives as a count and its mentions load when that card is opened.

import { useEffect, useMemo, useState } from "react"
import { MentionRow } from "@/components/feed/mention-row"
import { MentionEpisodeGroup } from "@/components/feed/mention-episode-group"
import { MentionYearGroup } from "@/components/feed/mention-year-group"
import { fetchSubjectMentionYear, fetchSubjectMentions, groupMentionsByEpisode, rollupEpisodesByYear } from "@/lib/mentions"
import type { EpisodeGroup, MentionYearStub } from "@/lib/mentions"
import type { Mention, MentionSubjectType } from "@/types"

/** Cards shown before "Show more": a busy brand has a year card per year. */
const INITIAL_ITEMS = 8

type Item =
  | { kind: "episode"; group: EpisodeGroup<Mention>; date: string }
  | { kind: "year"; key: string; year: string; groups: EpisodeGroup<Mention>[]; mentionCount: number; date: string }
  | { kind: "stub"; stub: MentionYearStub; date: string }

const groupDate = (g: EpisodeGroup<Mention>) => g.items[0]?.episode?.start_date ?? ""

export function EntityMentions({
  subjectType,
  subjectId,
  className = "",
}: {
  subjectType: Exclude<MentionSubjectType, "person">
  subjectId: string
  className?: string
}) {
  const [mentions, setMentions] = useState<Mention[]>([])
  const [years, setYears] = useState<MentionYearStub[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!subjectId) return
    let live = true
    fetchSubjectMentions(subjectType, subjectId).then((p) => {
      if (!live) return
      const rows = [...p.mentions]
      // The API orders by timestamp within an episode, which means nothing
      // across episodes. Newest episode first, then in episode order.
      rows.sort((a, b) => {
        const da = a.episode?.start_date ?? ""
        const db = b.episode?.start_date ?? ""
        if (da !== db) return db.localeCompare(da)
        return (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
      })
      setMentions(rows)
      setYears(p.years)
    })
    return () => { live = false }
  }, [subjectType, subjectId])

  const items = useMemo(() => {
    const loaded: Item[] = rollupEpisodesByYear(
      groupMentionsByEpisode(mentions),
      (g) => g.items[0].episode?.start_date?.slice(0, 4) || null,
    ).map((r): Item =>
      r.kind === "episode"
        ? { kind: "episode", group: r.group, date: groupDate(r.group) }
        : { ...r, date: r.groups.map(groupDate).sort().at(-1) ?? "" },
    )
    const stubs: Item[] = years.map((y) => ({ kind: "stub", stub: y, date: y.latestDate }))
    // Newest first. A stub year never shares a year with a loaded item (the
    // server only stubs years it would fold), so this just interleaves them.
    return [...loaded, ...stubs].sort((a, b) => b.date.localeCompare(a.date))
  }, [mentions, years])

  if (items.length === 0) return null
  const shown = showAll ? items : items.slice(0, INITIAL_ITEMS)

  return (
    <section className={className}>
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
        Talked about on the podcast
      </h2>
      {/* Same episode grouping as a rider timeline (BUG-172), then a busy air
          year folds into one year card. Newest first is preserved because
          both groupings keep input order. */}
      {shown.map((r) =>
        r.kind === "stub" ? (
          <MentionYearGroup
            key={`stub:${r.stub.year}`}
            year={r.stub.year}
            mentionCount={r.stub.mentionCount}
            episodeCount={r.stub.episodeCount}
            showName={r.stub.showName}
            load={() => fetchSubjectMentionYear(subjectType, subjectId, r.stub.year)}
          />
        ) : r.kind === "year" ? (
          <MentionYearGroup key={r.key} year={r.year} groups={r.groups} mentionCount={r.mentionCount} />
        ) : r.group.items.length === 1 ? (
          <MentionRow key={`mention-${r.group.items[0].id}`} mention={r.group.items[0]} context="timeline" />
        ) : (
          <MentionEpisodeGroup key={r.group.key} mentions={r.group.items} />
        )
      )}
      {items.length > INITIAL_ITEMS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-xs font-medium text-accent-strong hover:underline"
        >
          {showAll ? "Show less" : `Show ${items.length - INITIAL_ITEMS} more`}
        </button>
      )}
    </section>
  )
}
