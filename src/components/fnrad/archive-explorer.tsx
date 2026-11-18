"use client"

// The FNRad Archive explorer (briefs/fnrad-archive-surface-brief-v1.md, A3 to A5,
// A7). Search, type chips, the constellation and the node panel. State is this
// component's own plus the ?focus= param (history.replaceState, no navigation);
// no store, no localStorage.

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { trackEvent } from "@/lib/analytics"
import { fetchSubjectMentions, formatTimestamp } from "@/lib/mentions"
import { addStoryAboutHref } from "@/lib/fnrad"
import { ARCHIVE_TYPES, REPORT_HREF, TYPE_LABELS } from "@/lib/fnrad-archive-shared"
import type { ArchiveIndex } from "@/lib/fnrad-archive-shared"
import type { Mention } from "@/types"
import { parseYouTubeId } from "@/lib/utils"
import { ENTITY_COLORS } from "@/lib/entity-colors"

const ArchiveConstellation = dynamic(() => import("./archive-constellation"), {
  ssr: false,
  loading: () => <div className="h-[380px] md:h-[560px]" aria-hidden="true" />,
})
// Same palette as the constellation, read here directly so the chips and panel
// do not pull the d3 chunk into the first load.
const KIND = ["rider", "place", "brand", "event", "board"] as const
const color = (t: number) => ENTITY_COLORS[KIND[t]].glow

const TYPE_SINGULAR = ["Rider", "Place", "Brand or shop", "Event", "Board"]
const SKY_SIZE = 140
const SKY_MIN_EPISODES = 2

type Source = "constellation" | "search" | "list" | "chip" | "focus"

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`
}

function prompt(type: number, name: string): string {
  const first = name.split(/\s+/)[0] || name
  switch (type) {
    case 0:
      return `Is this you, or someone you rode with? Add your story about ${first}.`
    case 1:
      return `Were you there? Add your story from ${name}.`
    case 2:
      return "Rode for them, worked there, bought your first board there? Add your story."
    case 4:
      return "Rode one? Add it to your timeline."
    default:
      return `Were you there? Add your story from ${name}.`
  }
}

export function ArchiveExplorer({
  index,
  initialFocus,
  challengeGuestId,
}: {
  index: ArchiveIndex
  initialFocus: number | null
  challengeGuestId: string | null
}) {
  const [selected, setSelected] = useState<number | null>(initialFocus)
  const [mobile, setMobile] = useState<boolean | null>(null)
  const [types, setTypes] = useState<boolean[]>(() => ARCHIVE_TYPES.map(() => true))
  const [query, setQuery] = useState("")
  const [resetKey, setResetKey] = useState(0)
  const [backStack, setBackStack] = useState<number[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<number | null>(initialFocus)

  // Adjacency, heaviest first.
  const adjacency = useMemo(() => {
    const m = new Map<number, [number, number][]>()
    for (const [a, b, w] of index.edges) {
      if (!m.has(a)) m.set(a, [])
      if (!m.has(b)) m.set(b, [])
      m.get(a)!.push([b, w])
      m.get(b)!.push([a, w])
    }
    for (const list of m.values()) list.sort((x, y) => y[1] - x[1] || index.nodes[x[0]][2].localeCompare(index.nodes[y[0]][2]))
    return m
  }, [index])
  const neighbours = useCallback((i: number) => adjacency.get(i) ?? [], [adjacency])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const set = () => setMobile(mq.matches)
    set()
    mq.addEventListener("change", set)
    return () => mq.removeEventListener("change", set)
  }, [])

  useEffect(() => {
    trackEvent("content", "fnrad_archive_viewed", { focus: initialFocus != null })
  }, [initialFocus])

  // Mobile opens on a centre even with no ?focus=: the challenge guest when he is
  // in the index, otherwise the highest-ranked non-host person.
  const defaultCentre = useMemo(() => {
    if (challengeGuestId) {
      const g = index.nodes.findIndex((n) => n[0] === 0 && n[1] === challengeGuestId)
      if (g >= 0) return g
    }
    const p = index.nodes.findIndex((n) => n[0] === 0 && !n[6])
    return p >= 0 ? p : null
  }, [index, challengeGuestId])
  const centre = selected ?? (mobile ? defaultCentre : null)
  // The opening centre on mobile counts as "where you were" for Back.
  const centreRef = useRef<number | null>(centre)
  useEffect(() => {
    centreRef.current = centre
  }, [centre])

  const select = useCallback(
    (i: number, source: Source) => {
      const prev = selectedRef.current ?? centreRef.current
      if (prev === i) return
      if (prev != null) setBackStack((s) => [...s.slice(-30), prev])
      selectedRef.current = i
      setSelected(i)
      const n = index.nodes[i]
      const url = new URL(window.location.href)
      url.searchParams.set("focus", `${ARCHIVE_TYPES[n[0]]}:${n[1]}`)
      window.history.replaceState(window.history.state, "", url)
      document.title = `${n[2]} in the FNRad Archive`
      trackEvent("content", "fnrad_archive_node_selected", { type: ARCHIVE_TYPES[n[0]], source })
    },
    [index],
  )

  const back = () => {
    const prev = backStack[backStack.length - 1]
    if (prev == null) return
    setBackStack(backStack.slice(0, -1))
    selectedRef.current = prev
    setSelected(prev)
    const n = index.nodes[prev]
    const url = new URL(window.location.href)
    url.searchParams.set("focus", `${ARCHIVE_TYPES[n[0]]}:${n[1]}`)
    window.history.replaceState(window.history.state, "", url)
    document.title = `${n[2]} in the FNRad Archive`
  }

  // The sky: top non-host nodes with 2+ live episodes in the enabled types, plus
  // the selected node when it is not among them.
  const nodeSet = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < index.nodes.length && out.length < SKY_SIZE; i++) {
      const n = index.nodes[i]
      if (!n[6] && n[4] >= SKY_MIN_EPISODES && types[n[0]]) out.push(i)
    }
    if (selected != null && !out.includes(selected)) out.push(selected)
    return out
  }, [index, types, selected])

  const results = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    const prefix: number[] = []
    const inner: number[] = []
    index.nodes.forEach((n, i) => {
      const name = fold(n[2])
      if (name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q))) prefix.push(i)
      else if (name.includes(q)) inner.push(i)
    })
    return [...prefix, ...inner].slice(0, 8)
  }, [index, query])

  const choose = (i: number) => {
    select(i, "search")
    setQuery("")
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "nearest" }))
    }
  }

  if (index.nodes.length === 0) {
    return <p className="text-sm text-white/60">The archive map is being built. The lists below have everything.</p>
  }

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <label htmlFor="archive-search" className="sr-only">
          Search the archive
        </label>
        <input
          id="archive-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length) {
              e.preventDefault()
              choose(results[0])
            } else if (e.key === "Escape") setQuery("")
          }}
          placeholder="Find a rider, a hill, a board, a brand"
          autoComplete="off"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 outline-none focus:border-white/40"
          aria-controls="archive-search-results"
        />
        {results.length > 0 && (
          <ul
            id="archive-search-results"
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-[#26221F] shadow-xl"
          >
            {results.map((i) => {
              const n = index.nodes[i]
              return (
                <li key={i} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(n[0]) }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white">{n[2]}</span>
                    <span className="shrink-0 text-xs text-white/45">
                      {TYPE_SINGULAR[n[0]]} · {plural(n[4], "episode", "episodes")}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Type chips (desktop sky filter) */}
      <div className="mt-4 hidden flex-wrap gap-2 md:flex">
        {TYPE_LABELS.map((label, t) => (
          <button
            key={label}
            type="button"
            aria-pressed={types[t]}
            onClick={() => setTypes((prev) => prev.map((v, k) => (k === t ? !v : v)))}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              types[t] ? "border-white/25 bg-white/10 text-white" : "border-white/10 text-white/40"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: color(t), opacity: types[t] ? 1 : 0.35 }} />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setResetKey((k) => k + 1)}
          className="ml-auto rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white"
        >
          Reset view
        </button>
      </div>

      {/* Drawing + panel */}
      <div className="mt-4 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {mobile !== null && (
            <ArchiveConstellation
              index={index}
              nodeSet={nodeSet}
              neighbours={neighbours}
              selected={mobile ? centre : selected}
              onSelect={(i) => select(i, "constellation")}
              mobile={mobile}
              resetKey={resetKey}
            />
          )}
          {mobile === null && <div className="h-[380px] md:h-[560px]" aria-hidden="true" />}
          {mobile && backStack.length > 0 && (
            <button
              type="button"
              onClick={back}
              className="absolute left-3 top-3 min-h-11 rounded-full border border-white/15 bg-black/40 px-4 text-sm text-white/80"
            >
              <span aria-hidden="true">&larr;</span> Back
            </button>
          )}
          {!mobile && selected == null && (
            <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-white/40">
              Hover to see connections. Click a star to open it. Drag and scroll to move around.
            </p>
          )}
        </div>
        <div ref={panelRef} className="mt-4 md:mt-0">
          {centre != null ? (
            <NodePanel
              key={centre}
              index={index}
              i={centre}
              neighbours={neighbours(centre)}
              onSelect={(j) => select(j, "chip")}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-light leading-relaxed text-white/60">
              Pick a star, or search above, to see who and what it connects to and the stories that name it.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── the node panel (A5) ─────────────────────────────────────────────────────

type StoryCard = { key: string; title: string; excerpt: string; episodeId: string; seconds: number | null; date: string; mediaUrl: string | null }

function recentStories(mentions: Mention[]): StoryCard[] {
  const seen = new Map<string, StoryCard>()
  for (const m of mentions) {
    const key = `${m.episode_event_id}|${m.timestamp_seconds ?? "x"}`
    if (seen.has(key)) continue
    seen.set(key, {
      key,
      title: m.story_title ?? "",
      excerpt: m.excerpt ?? "",
      episodeId: m.episode_event_id,
      seconds: m.timestamp_seconds ?? null,
      date: m.episode?.start_date ?? "",
      mediaUrl: m.episode?.media_url ?? null,
    })
  }
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date) || (a.seconds ?? 0) - (b.seconds ?? 0)).slice(0, 3)
}

function watchHref(mediaUrl: string | null, seconds: number | null): string | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  if (!id) return mediaUrl
  return seconds != null ? `https://www.youtube.com/watch?v=${id}&t=${seconds}s` : `https://www.youtube.com/watch?v=${id}`
}

function NodePanel({
  index,
  i,
  neighbours,
  onSelect,
}: {
  index: ArchiveIndex
  i: number
  neighbours: [number, number][]
  onSelect: (j: number) => void
}) {
  const n = index.nodes[i]
  const [type, id, name, href, eps, stories] = n
  const [state, setState] = useState<{ loading: boolean; cards: StoryCard[]; failed: boolean }>({ loading: true, cards: [], failed: false })
  const episodeById = useMemo(() => new Map(index.episodes.map((e) => [e[0], e])), [index])

  useEffect(() => {
    let live = true
    fetchSubjectMentions(ARCHIVE_TYPES[type], id).then((d) => {
      if (!live) return
      setState({ loading: false, cards: recentStories(d.mentions), failed: d.total > 0 && d.mentions.length === 0 && d.years.length === 0 })
    })
    return () => {
      live = false
    }
  }, [type, id])

  const cta = (which: string) => trackEvent("content", "fnrad_archive_panel_cta_clicked", { type: ARCHIVE_TYPES[type], cta: which })
  const addHref = type === 0 ? addStoryAboutHref(id) : href

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-5" aria-label={`${name} in the archive`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        <span className="h-2 w-2 rounded-full" style={{ background: color(type) }} />
        {TYPE_SINGULAR[type]}
      </div>
      <h3 className="mt-2 text-xl font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
        {name}
      </h3>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          [eps, "episodes"],
          [stories, "stories"],
          [neighbours.length, "connections"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-lg bg-white/5 px-2 py-2">
            <dt className="sr-only">{l}</dt>
            <dd className="text-base font-bold text-white">{Number(v).toLocaleString("en-US")}</dd>
            <dd className="text-[11px] text-white/45">{l}</dd>
          </div>
        ))}
      </dl>

      {neighbours.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Strongest connections</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {neighbours.slice(0, 8).map(([j, w]) => (
              <button
                key={j}
                type="button"
                onClick={() => onSelect(j)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                title={plural(w, "shared story", "shared stories")}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color(index.nodes[j][0]) }} />
                {index.nodes[j][2]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Recent stories</div>
        {state.loading ? (
          <p className="mt-2 text-xs text-white/40">Loading stories…</p>
        ) : state.cards.length === 0 ? (
          <p className="mt-2 text-xs text-white/45">
            {state.failed ? "Stories did not load. They are all on the page below." : "No stories with a moment yet."}
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {state.cards.map((c) => {
              const ep = episodeById.get(c.episodeId)
              const watch = watchHref(c.mediaUrl, c.seconds)
              return (
                <li key={c.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  {c.title && <p className="text-sm font-semibold text-white">{c.title}</p>}
                  {c.excerpt && <p className="mt-1 line-clamp-4 text-xs font-light leading-relaxed text-white/70">{c.excerpt}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
                    {ep?.[1] ? (
                      <Link href={`/t/${ep[1]}`} className="text-white/70 hover:text-white">
                        {ep[3]}
                      </Link>
                    ) : (
                      ep && <span>{ep[3]}</span>
                    )}
                    {watch && (
                      <a href={watch} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white">
                        {c.seconds != null ? `Listen at ${formatTimestamp(c.seconds)}` : "Listen"}
                      </a>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {href && (
        <Link
          href={href}
          onClick={() => cta("page")}
          className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
        >
          Open {name}&apos;s page
        </Link>
      )}
      {addHref && (
        <p className="mt-4 text-sm font-light leading-relaxed text-white/75">
          {prompt(type, name)}{" "}
          <Link href={addHref} onClick={() => cta("add_story")} className="font-semibold text-white hover:underline">
            Add yours <span aria-hidden="true">&rarr;</span>
          </Link>
        </p>
      )}
      <p className="mt-3 text-xs text-white/40">
        Something wrong with a story?{" "}
        <a href={REPORT_HREF(name)} onClick={() => cta("report")} className="text-white/60 hover:text-white">
          Tell us.
        </a>
      </p>
    </aside>
  )
}

// ── "Show all" for a browse list (A2.5) ─────────────────────────────────────
// The server renders each type's top rows as plain links; the rest expand here
// from the index the page already ships, so the HTML stays small.

export function ArchiveListMore({ index, type, skip }: { index: ArchiveIndex; type: number; skip: number }) {
  const [open, setOpen] = useState(false)
  const rest = useMemo(() => index.nodes.filter((n) => n[0] === type && n[3]).slice(skip), [index, type, skip])
  if (!rest.length) return null
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 py-2 text-xs font-semibold text-white/60 hover:text-white"
      >
        Show all {(rest.length + skip).toLocaleString("en-US")}
      </button>
    )
  }
  return (
    <ul className="divide-y divide-white/5">
      {rest.map((n) => (
        <li key={n[1]}>
          <Link href={n[3]!} className="group flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 truncate text-white/85 group-hover:text-white">{n[2]}</span>
            <span className="shrink-0 text-xs text-white/40">
              {n[4].toLocaleString("en-US")} ep · {n[5].toLocaleString("en-US")} {n[5] === 1 ? "story" : "stories"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
