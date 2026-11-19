"use client"

// The FNRad Archive explorer (briefs/fnrad-archive-surface-brief-v1.md, A3 to A5,
// A7, plus the Sketches views). Search, type chips, two views (Constellation and
// Path), the node panel with its pair box (the stories two nodes share), and the
// focused node's full story list under the drawing in place of the browse lists.
// State is this component's own plus ?focus= and ?view=path (history.replaceState,
// no navigation); no store, no localStorage.

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { trackEvent } from "@/lib/analytics"
import { formatTimestamp } from "@/lib/mentions"
import { FNRAD_ARCHIVE_HREF, addStoryAboutHref } from "@/lib/fnrad"
import { ARCHIVE_TYPES, REPORT_HREF, SPAN_YEARS, TYPE_LABELS, archivePathHref } from "@/lib/fnrad-archive-shared"
import type { ArchiveIndex, ArchiveNodeStories, ArchiveNodeStory } from "@/lib/fnrad-archive-shared"
import { parseYouTubeId } from "@/lib/utils"
import { ENTITY_COLORS } from "@/lib/entity-colors"
import { ArchivePath } from "./archive-path"
import { RetoldList, RetoldPanel, useRetold } from "./archive-retold"

const ArchiveConstellation = dynamic(() => import("./archive-constellation"), {
  ssr: false,
  loading: () => <div className="h-[380px] md:h-[560px]" aria-hidden="true" />,
})
// Same palette as the constellation, read here directly so the chips and panel
// do not pull the d3 chunk into the first load.
const KIND = ["rider", "place", "brand", "event", "board"] as const
const color = (t: number) => ENTITY_COLORS[KIND[t]].glow

const TYPE_SINGULAR = ["Rider", "Place", "Brand or shop", "Event", "Board"]
/** Stars at the fitted zoom; zooming in reveals up to SKY_MAX. */
const SKY_SIZE = 140
// Phones fit fewer stars in the shorter box; pinch reveals the rest.
const SKY_SIZE_MOBILE = 40
const SKY_MAX = 400
const SKY_MIN_EPISODES = 2
const LIST_PAGE = 25

export type ArchiveView = "sky" | "path" | "retold"


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


// ── one node's stories, fetched once per node per page load ─────────────────

type NodeStoriesState = { status: "loading" | "ready" | "failed"; data: ArchiveNodeStories | null }
const nodeStoriesCache = new Map<string, Promise<ArchiveNodeStories | null>>()

function loadNodeStories(focus: string): Promise<ArchiveNodeStories | null> {
  let p = nodeStoriesCache.get(focus)
  if (!p) {
    p = fetch(`/api/fnrad/archive/node?focus=${encodeURIComponent(focus)}`)
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveNodeStories>) : null))
      .catch(() => null)
      .then((d) => {
        if (!d) nodeStoriesCache.delete(focus)
        return d
      })
    nodeStoriesCache.set(focus, p)
  }
  return p
}

function useNodeStories(index: ArchiveIndex, i: number | null): NodeStoriesState {
  const focus = i == null ? null : `${ARCHIVE_TYPES[index.nodes[i][0]]}:${index.nodes[i][1]}`
  const [state, setState] = useState<{ focus: string | null } & NodeStoriesState>({ focus: null, status: "loading", data: null })
  useEffect(() => {
    if (!focus) return
    let live = true
    loadNodeStories(focus).then((d) => {
      if (live) setState({ focus, status: d ? "ready" : "failed", data: d })
    })
    return () => {
      live = false
    }
  }, [focus])
  if (!focus || state.focus !== focus) return { status: "loading", data: null }
  return state
}

/** Years a story is drawn at (empty for undated or a wide span). */
function yearsOf(s: ArchiveNodeStory): number[] {
  const [, , , , a, b] = s
  if (a == null) return []
  const end = b ?? a
  if (end - a > SPAN_YEARS) return []
  const out: number[] = []
  for (let y = a; y <= end; y++) out.push(y)
  return out
}

function yearLabel(s: ArchiveNodeStory): string | null {
  const [, , , , a, b] = s
  if (a == null) return null
  return b != null && b !== a ? `${a} to ${b}` : String(a)
}

export function ArchiveExplorer({
  index,
  initialFocus,
  initialView = "sky",
  browse,
}: {
  index: ArchiveIndex
  initialFocus: number | null
  initialView?: ArchiveView
  challengeGuestId: string | null
  /** The browse lists, shown under the drawing when nothing is focused. */
  browse?: ReactNode
}) {
  const [selected, setSelected] = useState<number | null>(initialFocus)
  const [view, setViewState] = useState<ArchiveView>(initialFocus != null || initialView === "retold" ? initialView : "sky")
  const [retoldId, setRetoldId] = useState<string | null>(null)
  const [pair, setPair] = useState<number | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [mobile, setMobile] = useState<boolean | null>(null)
  // Phones: the selected star shows in the sky (links lit, as on desktop) unless
  // Focus is on, which swaps in the ring of its strongest connections.
  const [ring, setRing] = useState(false)
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
  const keyToIndex = useMemo(() => new Map(index.nodes.map((n, i) => [`${n[0]}:${n[1]}`, i])), [index])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const set = () => setMobile(mq.matches)
    set()
    mq.addEventListener("change", set)
    return () => mq.removeEventListener("change", set)
  }, [])

  useEffect(() => {
    trackEvent("content", "fnrad_archive_viewed", { focus: initialFocus != null, view: initialView })
  }, [initialFocus, initialView])

  // Nothing is selected until someone picks a star, on phones too.
  const centre = selected
  const centreRef = useRef<number | null>(centre)
  useEffect(() => {
    centreRef.current = centre
  }, [centre])

  const stories = useNodeStories(index, centre)
  const retold = useRetold(view === "retold")
  const retoldEntry = useMemo(
    () => (retoldId && retold.data ? retold.data.entries.find((e) => e[0] === retoldId) ?? null : null),
    [retoldId, retold.data],
  )

  const writeUrl = useCallback(
    (i: number | null, v: ArchiveView) => {
      const url = new URL(window.location.href)
      if (i != null) {
        const n = index.nodes[i]
        url.searchParams.set("focus", `${ARCHIVE_TYPES[n[0]]}:${n[1]}`)
        document.title = `${n[2]} in the FNRad Archive`
      }
      if (v === "path" && i != null) url.searchParams.set("view", "path")
      else if (v === "retold") url.searchParams.set("view", "retold")
      else url.searchParams.delete("view")
      window.history.replaceState(window.history.state, "", url)
    },
    [index],
  )

  const select = useCallback(
    (i: number, source: Source) => {
      const prev = selectedRef.current ?? centreRef.current
      if (prev === i) return
      if (prev != null) setBackStack((s) => [...s.slice(-30), prev])
      selectedRef.current = i
      setSelected(i)
      setPair(null)
      setYear(null)
      writeUrl(i, view)
      const n = index.nodes[i]
      trackEvent("content", "fnrad_archive_node_selected", { type: ARCHIVE_TYPES[n[0]], source, view })
    },
    [index, view, writeUrl],
  )

  const setView = (v: ArchiveView) => {
    setViewState(v)
    const i = selectedRef.current ?? centreRef.current
    if (v === "path" && selectedRef.current == null && i != null) {
      selectedRef.current = i
      setSelected(i)
    }
    writeUrl(i, v)
    trackEvent("content", "fnrad_archive_view_changed", { view: v })
  }

  const choosePair = (j: number | null, y: number | null = null) => {
    setPair(j)
    setYear(y)
    if (j != null) trackEvent("content", "fnrad_archive_pair_opened", { type: ARCHIVE_TYPES[index.nodes[j][0]] })
  }

  // Close the selected node: clears it, the pair, the year and the retold
  // story, and drops ?focus and ?view. The zoom stays where it is.
  const clearSelection = () => {
    selectedRef.current = null
    setSelected(null)
    setPair(null)
    setYear(null)
    setRetoldId(null)
    setBackStack([])
    if (view === "path") setViewState("sky")
    const url = new URL(window.location.href)
    url.searchParams.delete("focus")
    url.searchParams.delete("view")
    window.history.replaceState(window.history.state, "", url)
    document.title = "The FNRad Archive on Linestry"
  }

  // Reset view: the whole archive again, with the zoom refit.
  const resetView = () => {
    clearSelection()
    setResetKey((k) => k + 1)
    trackEvent("content", "fnrad_archive_reset", {})
  }

  const back = () => {
    const prev = backStack[backStack.length - 1]
    if (prev == null) return
    setBackStack(backStack.slice(0, -1))
    selectedRef.current = prev
    setSelected(prev)
    setPair(null)
    setYear(null)
    writeUrl(prev, view)
  }

  // The sky: top non-host nodes with 2+ live episodes in the enabled types,
  // ranked, plus the selected node when it is not among them.
  const nodeSet = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < index.nodes.length && out.length < SKY_MAX; i++) {
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

  // The focused node's stories, narrowed by the pair and the year.
  const filtered = useMemo(() => {
    let list = stories.data?.stories ?? []
    if (pair != null) {
      const k = `${index.nodes[pair][0]}:${index.nodes[pair][1]}`
      list = list.filter((s) => s[6].includes(k))
    }
    if (year != null) list = list.filter((s) => yearsOf(s).includes(year))
    return list
  }, [stories.data, pair, year, index])

  if (index.nodes.length === 0) {
    return <p className="text-sm text-white/60">The archive map is being built. The lists below have everything.</p>
  }

  const viewTab = (v: ArchiveView, label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        view === v ? "border-white bg-white text-[#1C1917]" : "border-white/20 text-white/75 hover:text-white"
      }`}
    >
      {label}
    </button>
  )

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

      {/* Views + type chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label="View the archive as">
          {viewTab("sky", "Constellation")}
          {viewTab("path", "Path")}
          {viewTab("retold", "Retold")}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-white/15 md:block" aria-hidden="true" />
        <div className="hidden flex-wrap gap-2 md:flex">
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
        </div>
        {view === "sky" && (
          <button
            type="button"
            onClick={resetView}
            className="ml-auto hidden rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white md:block"
          >
            Reset view
          </button>
        )}
      </div>

      {/* Drawing + panel */}
      <div className="mt-4 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-4">
        <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {view === "retold" ? (
            retold.status === "ready" ? (
              <RetoldList
                index={index}
                data={retold.data!}
                focus={selected}
                selectedId={retoldId}
                onSelect={(id) => {
                  setRetoldId(id)
                  trackEvent("content", "fnrad_archive_retold_opened", {})
                  if (window.matchMedia("(max-width: 767px)").matches) {
                    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
                  }
                }}
              />
            ) : retold.status === "failed" ? (
              <p className="px-5 py-10 text-sm font-light text-white/60">Retold stories did not load. Try again in a moment.</p>
            ) : (
              <p className="px-5 py-10 text-sm font-light text-white/50">Finding the stories told more than once…</p>
            )
          ) : view === "path" ? (
            centre == null ? (
              <p className="px-5 py-10 text-sm font-light text-white/60">
                Pick a rider, place or brand, from the search or the map, to see their path year by year.
              </p>
            ) : stories.status === "loading" ? (
              <p className="px-5 py-10 text-sm font-light text-white/50">Drawing {index.nodes[centre][2]}&apos;s path…</p>
            ) : stories.status === "failed" ? (
              <p className="px-5 py-10 text-sm font-light text-white/60">The path did not load. Try again in a moment.</p>
            ) : (
              <ArchivePath
                index={index}
                sel={centre}
                stories={stories.data!.stories}
                keyToIndex={keyToIndex}
                types={types}
                pair={pair}
                year={year}
                onPair={(j, y) => choosePair(j, y)}
                onYear={(y) => {
                  setPair(null)
                  setYear((cur) => (cur === y ? null : y))
                }}
              />
            )
          ) : (
            <>
              {mobile !== null && (
                <ArchiveConstellation
                  index={index}
                  nodeSet={nodeSet}
                  neighbours={neighbours}
                  selected={selected}
                  onSelect={(i) => {
                    // A second click on the selected star closes it, as in the Sketches.
                    if (i === selectedRef.current) clearSelection()
                    else select(i, "constellation")
                  }}
                  onBackground={() => {
                    if (selectedRef.current != null) clearSelection()
                  }}
                  mobile={mobile}
                  ring={ring}
                  resetKey={resetKey}
                  baseCount={mobile ? SKY_SIZE_MOBILE : SKY_SIZE}
                />
              )}
              {mobile === null && <div className="h-[380px] md:h-[560px]" aria-hidden="true" />}
              {mobile && selected != null && (
                <button
                  type="button"
                  aria-pressed={ring}
                  onClick={() => {
                    setRing((v) => !v)
                    trackEvent("content", "fnrad_archive_focus_toggled", { on: !ring })
                  }}
                  className={`absolute bottom-3 right-3 min-h-11 rounded-full border px-4 text-sm font-medium ${
                    ring ? "border-white bg-white text-[#1C1917]" : "border-white/20 bg-black/40 text-white/80"
                  }`}
                >
                  Focus
                </button>
              )}
              {selected == null && mobile !== null && (
                <p className="pointer-events-none absolute bottom-3 left-4 right-4 text-xs text-white/40">
                  {mobile
                    ? "Tap a star to open it. Pinch to zoom in for more."
                    : "Hover to see connections. Click a star to open it. Drag to move, scroll to zoom in for more."}
                </p>
              )}
            </>
          )}
          {mobile && backStack.length > 0 && (
            <button
              type="button"
              onClick={back}
              className="absolute left-3 top-3 min-h-11 rounded-full border border-white/15 bg-black/40 px-4 text-sm text-white/80"
            >
              <span aria-hidden="true">&larr;</span> Back
            </button>
          )}
        </div>
        <div ref={panelRef} className="mt-4 md:mt-0">
          {view === "retold" && retoldEntry ? (
            <RetoldPanel
              index={index}
              entry={retoldEntry}
              media={retold.data!.media}
              keyToIndex={keyToIndex}
              onOpenNode={(j) => select(j, "chip")}
              onClose={() => setRetoldId(null)}
            />
          ) : view === "retold" && selected == null ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-light leading-relaxed text-white/60">
              Pick a story from the list to read every telling of it, side by side.
            </div>
          ) : centre != null ? (
            <NodePanel
              key={centre}
              index={index}
              i={centre}
              neighbours={neighbours(centre)}
              stories={stories}
              filtered={filtered}
              pair={pair}
              year={year}
              view={view}
              onPair={choosePair}
              onYear={setYear}
              onOpen={(j) => select(j, "chip")}
              onShowPath={() => setView("path")}
              onClose={selected != null ? clearSelection : undefined}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-light leading-relaxed text-white/60">
              Pick a star, or search above, to see who and what it connects to and the stories that name it.
            </div>
          )}
        </div>
      </div>

      {/* Under the drawing: the focused node's stories, or the browse lists. */}
      {selected != null ? (
        <StoryList
          index={index}
          i={selected}
          stories={selected === centre ? stories : { status: "loading", data: null }}
          filtered={filtered}
          pair={pair}
          year={year}
          onClear={() => choosePair(null)}
        />
      ) : (
        browse
      )}
    </div>
  )
}

// ── the node panel (A5) with the pair box ───────────────────────────────────

function watchHref(mediaUrl: string | null | undefined, seconds: number | null): string | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  if (!id) return mediaUrl
  return seconds != null ? `https://www.youtube.com/watch?v=${id}&t=${seconds}s` : `https://www.youtube.com/watch?v=${id}`
}

function StoryCardView({
  index,
  s,
  media,
  compact,
}: {
  index: ArchiveIndex
  s: ArchiveNodeStory
  media: Record<string, string>
  compact?: boolean
}) {
  const episodeById = useMemo(() => new Map(index.episodes.map((e) => [e[0], e])), [index])
  const [epId, seconds, title, excerpt] = s
  const ep = episodeById.get(epId)
  const watch = watchHref(media[epId], seconds)
  const when = yearLabel(s)
  return (
    <li className="rounded-lg border border-white/10 bg-black/20 p-3">
      {title && <p className="text-sm font-semibold text-white">{title}</p>}
      {excerpt && (
        <p className={`mt-1 text-xs font-light leading-relaxed text-white/70 ${compact ? "line-clamp-4" : ""}`}>{excerpt}</p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
        {ep?.[1] ? (
          <Link href={`/t/${ep[1]}`} className="text-white/70 hover:text-white">
            {ep[3]}
          </Link>
        ) : (
          ep && <span>{ep[3]}</span>
        )}
        {when && <span>· {when}</span>}
        {watch && (
          <a href={watch} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white">
            · Listen at {formatTimestamp(seconds)}
          </a>
        )}
      </p>
    </li>
  )
}

function NodePanel({
  index,
  i,
  neighbours,
  stories,
  filtered,
  pair,
  year,
  view,
  onPair,
  onYear,
  onOpen,
  onShowPath,
  onClose,
}: {
  index: ArchiveIndex
  i: number
  neighbours: [number, number][]
  stories: NodeStoriesState
  filtered: ArchiveNodeStory[]
  pair: number | null
  year: number | null
  view: ArchiveView
  onPair: (j: number | null, y?: number | null) => void
  onYear: (y: number | null) => void
  onOpen: (j: number) => void
  onShowPath: () => void
  /** Close the node (clears the selection). Absent when nothing is selected. */
  onClose?: () => void
}) {
  const n = index.nodes[i]
  const [type, id, name, href, eps, storyCount] = n
  const cta = (which: string) => trackEvent("content", "fnrad_archive_panel_cta_clicked", { type: ARCHIVE_TYPES[type], cta: which })
  const addHref = type === 0 ? addStoryAboutHref(id) : href
  const media = stories.data?.media ?? {}

  // The pair box: the years the shared stories land in.
  const pairNode = pair != null ? index.nodes[pair] : null
  const pairYears = useMemo(() => {
    if (pair == null || !stories.data) return []
    const k = `${index.nodes[pair][0]}:${index.nodes[pair][1]}`
    const m = new Map<number, number>()
    for (const s of stories.data.stories) if (s[6].includes(k)) for (const y of yearsOf(s)) m.set(y, (m.get(y) ?? 0) + 1)
    return [...m].sort((a, b) => a[0] - b[0])
  }, [pair, stories.data, index])
  const shared = pair != null ? (stories.data ? stories.data.stories.filter((s) => s[6].includes(`${index.nodes[pair][0]}:${index.nodes[pair][1]}`)).length : null) : null

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-5" aria-label={`${name} in the archive`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        <span className="h-2 w-2 rounded-full" style={{ background: color(type) }} />
        {TYPE_SINGULAR[type]}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${name}`}
            title="Close"
            className="-mr-2 -mt-1 ml-auto flex h-8 w-8 items-center justify-center rounded-full text-base font-normal normal-case tracking-normal text-white/55 hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        )}
      </div>
      <h3 className="mt-2 text-xl font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
        {name}
      </h3>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          [eps, "episodes"],
          [storyCount, "stories"],
          [neighbours.length, "connections"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-lg bg-white/5 px-2 py-2">
            <dt className="sr-only">{l}</dt>
            <dd className="text-base font-bold text-white">{Number(v).toLocaleString("en-US")}</dd>
            <dd className="text-[11px] text-white/45">{l}</dd>
          </div>
        ))}
      </dl>

      {view !== "path" && (
        <button
          type="button"
          onClick={() => {
            cta("path")
            onShowPath()
          }}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
        >
          See {name}&apos;s path
        </button>
      )}

      {neighbours.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">In the same stories</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {neighbours.slice(0, 10).map(([j, w]) => (
              <button
                key={j}
                type="button"
                aria-pressed={pair === j}
                onClick={() => onPair(pair === j ? null : j)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  pair === j ? "border-white bg-white text-[#1C1917]" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
                title={plural(w, "shared story", "shared stories")}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color(index.nodes[j][0]) }} />
                {index.nodes[j][2]}
                <span className={pair === j ? "text-[#1C1917]/60" : "text-white/40"}>{w}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pairNode && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3" style={{ borderLeft: `4px solid ${color(pairNode[0])}` }}>
          <p className="text-[11px] text-white/45">
            {TYPE_SINGULAR[pairNode[0]]} · with {name}
          </p>
          <p className="mt-0.5 text-base font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
            {pairNode[2]}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {shared == null ? "Counting shared stories…" : plural(shared, "story", "stories")} told together
            {pairYears.length > 0 && `, ${pairYears[0][0]}${pairYears.length > 1 ? ` to ${pairYears[pairYears.length - 1][0]}` : ""}`}
          </p>
          {pairYears.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {pairYears.map(([y, c]) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={year === y}
                  onClick={() => onYear(year === y ? null : y)}
                  className={`rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums ${
                    year === y ? "border-white bg-white text-[#1C1917]" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  {y} <span className="opacity-60">{c}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpen(pair!)}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Open {pairNode[2]}
            </button>
            <button type="button" onClick={() => onPair(null)} className="px-2 text-xs text-white/55 hover:text-white">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
          {pair != null || year != null
            ? `${plural(filtered.length, "story", "stories")}${pairNode ? ` with ${pairNode[2]}` : ""}${year != null ? ` from ${year}` : ""}`
            : "Recent stories"}
        </div>
        {stories.status === "loading" ? (
          <p className="mt-2 text-xs text-white/40">Loading stories…</p>
        ) : stories.status === "failed" ? (
          <p className="mt-2 text-xs text-white/45">Stories did not load. Try again in a moment.</p>
        ) : filtered.length === 0 ? (
          <p className="mt-2 text-xs text-white/45">No stories with a moment yet.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-3">
              {filtered.slice(0, 3).map((s) => (
                <StoryCardView key={`${s[0]}|${s[1]}`} index={index} s={s} media={media} compact />
              ))}
            </ul>
            {filtered.length > 3 && (
              <a href="#archive-stories" className="mt-2 inline-block text-xs font-semibold text-white/70 hover:text-white">
                All {filtered.length.toLocaleString("en-US")} below <span aria-hidden="true">&darr;</span>
              </a>
            )}
          </>
        )}
      </div>

      {href && (
        <p className="mt-5 text-xs text-white/50">
          <Link href={href} onClick={() => cta("page")} className="font-semibold text-white/75 hover:text-white">
            {name}&apos;s page on Linestry <span aria-hidden="true">&rarr;</span>
          </Link>
        </p>
      )}
      {addHref && (
        <p className="mt-3 text-sm font-light leading-relaxed text-white/75">
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

// ── every story about the focused node, under the drawing ───────────────────

function StoryList({
  index,
  i,
  stories,
  filtered,
  pair,
  year,
  onClear,
}: {
  index: ArchiveIndex
  i: number
  stories: NodeStoriesState
  filtered: ArchiveNodeStory[]
  pair: number | null
  year: number | null
  onClear: () => void
}) {
  const [limit, setLimit] = useState(LIST_PAGE)
  useEffect(() => setLimit(LIST_PAGE), [i, pair, year])
  const name = index.nodes[i][2]
  const narrowed = pair != null || year != null
  return (
    <section id="archive-stories" className="mt-14 scroll-mt-6" aria-labelledby="archive-stories-h">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="archive-stories-h" className="text-xl font-extrabold text-white" style={{ fontFamily: "var(--font-display)" }}>
          {narrowed
            ? `${plural(filtered.length, "story", "stories")}${pair != null ? ` with ${index.nodes[pair][2]}` : ""}${year != null ? ` from ${year}` : ""}`
            : `Every story about ${name}`}
        </h2>
        {narrowed && (
          <button type="button" onClick={onClear} className="text-sm font-semibold text-white/65 hover:text-white">
            Show all of {name}&apos;s stories
          </button>
        )}
      </div>
      {stories.status === "loading" ? (
        <p className="mt-4 text-sm text-white/45">Loading stories…</p>
      ) : stories.status === "failed" ? (
        <p className="mt-4 text-sm text-white/55">Stories did not load. Try again in a moment.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">No stories with a moment yet.</p>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.slice(0, limit).map((s) => (
              <StoryCardView key={`${s[0]}|${s[1]}`} index={index} s={s} media={stories.data!.media} />
            ))}
          </ul>
          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 50)}
              className="mt-4 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Show more ({(filtered.length - limit).toLocaleString("en-US")} left)
            </button>
          )}
        </>
      )}
      <p className="mt-6 text-sm text-white/55">
        <a href={FNRAD_ARCHIVE_HREF} className="font-semibold text-white/75 hover:text-white">
          Browse the whole archive <span aria-hidden="true">&rarr;</span>
        </a>
      </p>
    </section>
  )
}

// ── "Show all" for a browse list (A2.5) ─────────────────────────────────────
// The server renders each type's top rows as plain links; the rest expand here
// from the index the page already ships, so the HTML stays small.

export function ArchiveListMore({ index, type, skip }: { index: ArchiveIndex; type: number; skip: number }) {
  const [open, setOpen] = useState(false)
  const rest = useMemo(() => index.nodes.filter((n) => n[0] === type).slice(skip), [index, type, skip])
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
      {rest.map((n, k) => (
        <li key={`${n[1]}-${k}`}>
          <Link href={archivePathHref(n[0], n[1])} className="group flex items-baseline justify-between gap-3 py-1.5 text-sm">
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
