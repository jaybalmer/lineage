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

import { useEffect, useState } from "react"
import { MentionRow } from "@/components/feed/mention-row"
import type { Mention, MentionSubjectType } from "@/types"

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

  useEffect(() => {
    if (!subjectId) return
    let live = true
    fetch(`/api/mentions?subject_type=${subjectType}&subject_id=${encodeURIComponent(subjectId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!live) return
        const rows = (Array.isArray(d) ? d : []) as Mention[]
        // The API orders by timestamp within an episode, which means nothing
        // across episodes. Newest episode first, then in episode order.
        rows.sort((a, b) => {
          const da = a.episode?.start_date ?? ""
          const db = b.episode?.start_date ?? ""
          if (da !== db) return db.localeCompare(da)
          return (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
        })
        setMentions(rows)
      })
      .catch(() => {})
    return () => { live = false }
  }, [subjectType, subjectId])

  if (mentions.length === 0) return null

  return (
    <section className={className}>
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
        Talked about on the podcast
      </h2>
      {mentions.map((m) => (
        <MentionRow key={m.id} mention={m} context="timeline" />
      ))}
    </section>
  )
}
