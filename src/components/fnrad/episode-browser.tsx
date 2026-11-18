"use client"

// Every FNRad episode, searchable (briefs/fnrad-archive-front-doors-brief-v1.md, B2).
//
// Server-rendered with the full list (a client component still renders on the
// server), so the page works with no script; the search box filters in place.
// Folds accents the way the archive search does, so "Gigi Ruf" finds "Gigi Rüf".

import Link from "next/link"
import { useMemo, useState } from "react"
import type { ArchiveEpisode } from "@/lib/fnrad-archive-shared"

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

const yearOf = (e: ArchiveEpisode) => e[4].slice(0, 4) || "Undated"

export function EpisodeBrowser({ episodes }: { episodes: ArchiveEpisode[] }) {
  const [query, setQuery] = useState("")

  // One folded haystack per episode: title, the show's label (which carries the
  // year), and the air-date year.
  const haystacks = useMemo(() => episodes.map((e) => fold(`${e[3]} ${e[2]} ${yearOf(e)}`)), [episodes])

  const groups = useMemo(() => {
    const terms = fold(query.trim()).split(/\s+/).filter(Boolean)
    const byYear = new Map<string, ArchiveEpisode[]>()
    episodes.forEach((e, i) => {
      if (terms.length && !terms.every((t) => haystacks[i].includes(t))) return
      const y = yearOf(e)
      byYear.set(y, [...(byYear.get(y) ?? []), e])
    })
    // Newest first; undated last.
    return [...byYear].sort(([a], [b]) => (a === "Undated" ? 1 : b === "Undated" ? -1 : b.localeCompare(a)))
  }, [episodes, haystacks, query])

  return (
    <div>
      <label className="block">
        <span className="sr-only">Find an episode</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a guest, a season or a year"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 outline-none focus:border-white/40"
        />
      </label>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-white/70">
          No episodes match that search.{" "}
          <button type="button" onClick={() => setQuery("")} className="font-semibold text-white underline-offset-2 hover:underline">
            Clear the search
          </button>
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map(([year, eps]) => (
            <section key={year} aria-labelledby={`y-${year}`}>
              <h2 id={`y-${year}`} className="text-xs font-semibold uppercase tracking-widest text-white/40">
                {year}
              </h2>
              <ul className="mt-2 divide-y divide-white/5">
                {eps.map((e) => (
                  <li key={e[0]} className="flex items-baseline justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      {e[1] ? (
                        <Link href={`/t/${e[1]}`} className="text-sm font-medium text-white/90 hover:text-white">
                          {e[3]}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-white/90">{e[3]}</span>
                      )}
                      {e[2] && <p className="mt-0.5 text-xs text-white/45">{e[2]}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-white/45">
                      {/* A live episode whose stories are not mapped yet reads as such, not "0 stories". */}
                      {e[5] === 0 ? "Not mapped yet" : `${e[5].toLocaleString("en-US")} ${e[5] === 1 ? "story" : "stories"}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
