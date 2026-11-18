"use client"

// The FNRad Archive Retold view (from the Sketches Retold tab). Stories told
// more than once: the same moment told by different guests, or one guest
// telling the same story on different episodes. Groupings come from Pass B
// (fnrad_retellings); only the groupings are public, never the model-written
// differences or notes. The list sits where the drawing goes; the selected
// entry's tellings fill the side panel.

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ENTITY_COLORS } from "@/lib/entity-colors"
import { formatTimestamp } from "@/lib/mentions"
import { parseYouTubeId } from "@/lib/utils"
import type { ArchiveIndex, ArchiveRetelling, ArchiveRetold } from "@/lib/fnrad-archive-shared"

const KIND = ["rider", "place", "brand", "event", "board"] as const
const color = (t: number) => ENTITY_COLORS[KIND[t]].glow

const ROLE_LABEL: Record<string, string> = { did_it: "did it", was_there: "was there", heard_about: "heard about it", other: "other" }

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function kindLine(e: ArchiveRetelling): string {
  const n = e[4].length
  return e[3] === "same_teller" ? `Told ${n} times by the same guest` : `The same moment, told ${n} times`
}

// ── data, fetched once per page load, only when the view opens ──────────────

let retoldPromise: Promise<ArchiveRetold | null> | null = null
function loadRetold(): Promise<ArchiveRetold | null> {
  if (!retoldPromise) {
    retoldPromise = fetch("/api/fnrad/archive/retold")
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveRetold>) : null))
      .catch(() => null)
      .then((d) => {
        if (!d) retoldPromise = null
        return d
      })
  }
  return retoldPromise
}

export function useRetold(enabled: boolean): { status: "idle" | "loading" | "ready" | "failed"; data: ArchiveRetold | null } {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "failed"; data: ArchiveRetold | null }>({ status: "idle", data: null })
  useEffect(() => {
    if (!enabled || state.status === "ready" || state.status === "loading") return
    let live = true
    setState({ status: "loading", data: null })
    loadRetold().then((d) => {
      if (live) setState({ status: d ? "ready" : "failed", data: d })
    })
    return () => {
      live = false
    }
    // Load once when first enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  return state
}

// ── the list (in the drawing area) ──────────────────────────────────────────

export function RetoldList({
  index,
  data,
  focus,
  selectedId,
  onSelect,
}: {
  index: ArchiveIndex
  data: ArchiveRetold
  focus: number | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const focusKey = focus != null ? `${index.nodes[focus][0]}:${index.nodes[focus][1]}` : null
  const withFocus = useMemo(() => (focusKey ? data.entries.filter((e) => e[5].includes(focusKey)) : []), [data, focusKey])
  const [onlyFocus, setOnlyFocus] = useState(true)
  const useFocus = focusKey != null && onlyFocus && withFocus.length > 0

  const shown = useMemo(() => {
    const base = useFocus ? withFocus : data.entries
    const q = fold(query.trim())
    if (!q) return base
    return base.filter((e) => fold(`${e[1]} ${e[2] ?? ""}`).includes(q))
  }, [data, withFocus, useFocus, query])

  return (
    <div className="flex h-[560px] max-h-[70vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <label htmlFor="retold-search" className="sr-only">
          Find a retold story
        </label>
        <input
          id="retold-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a retold story"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
        />
        {focusKey && withFocus.length > 0 && (
          <button
            type="button"
            aria-pressed={useFocus}
            onClick={() => setOnlyFocus((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              useFocus ? "border-white bg-white text-[#1C1917]" : "border-white/20 text-white/75 hover:text-white"
            }`}
          >
            With {index.nodes[focus!][2]} · {withFocus.length}
          </button>
        )}
      </div>
      <p className="px-4 pt-3 text-xs font-light text-white/45">
        {shown.length.toLocaleString("en-US")} {shown.length === 1 ? "story" : "stories"} told more than once
        {useFocus ? ` that name ${index.nodes[focus!][2]}` : ""}. The same moment from different guests, or one guest telling it
        again.
      </p>
      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {shown.length === 0 ? (
          <li className="px-2 py-6 text-sm text-white/55">No retold stories match that search.</li>
        ) : (
          shown.map((e) => (
            <li key={e[0]}>
              <button
                type="button"
                aria-pressed={selectedId === e[0]}
                onClick={() => onSelect(e[0])}
                className={`grid w-full grid-cols-[76px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 rounded-lg px-2 py-2.5 text-left sm:grid-cols-[76px_minmax(0,1fr)_auto] ${
                  selectedId === e[0] ? "bg-white/10 shadow-[inset_3px_0_0_#ffffff]" : "hover:bg-white/5"
                }`}
              >
                <span className="text-xs tabular-nums text-white/45">{e[2] ?? "Undated"}</span>
                <span className="text-sm font-medium leading-snug text-white">{e[1]}</span>
                <span className="col-start-2 text-xs text-white/45 sm:col-start-auto sm:whitespace-nowrap">
                  {e[4].length} tellings
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

// ── the selected entry (in the side panel) ──────────────────────────────────

function watchHref(mediaUrl: string | undefined, seconds: number): string | null {
  if (!mediaUrl) return null
  const id = parseYouTubeId(mediaUrl)
  return id ? `https://www.youtube.com/watch?v=${id}&t=${seconds}s` : mediaUrl
}

export function RetoldPanel({
  index,
  entry,
  media,
  keyToIndex,
  onOpenNode,
  onClose,
}: {
  index: ArchiveIndex
  entry: ArchiveRetelling
  media: Record<string, string>
  keyToIndex: Map<string, number>
  onOpenNode: (j: number) => void
  onClose: () => void
}) {
  const episodeById = useMemo(() => new Map(index.episodes.map((e) => [e[0], e])), [index])
  const named = useMemo(
    () =>
      entry[5]
        .map((k) => keyToIndex.get(k))
        .filter((j): j is number => j != null && !index.nodes[j][6])
        .sort((a, b) => a - b)
        .slice(0, 12),
    [entry, keyToIndex, index],
  )
  return (
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-5" aria-label={`Retold: ${entry[1]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Retold</p>
        <button type="button" onClick={onClose} className="text-xs text-white/50 hover:text-white">
          Close
        </button>
      </div>
      <h3 className="mt-2 text-lg font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
        {entry[1]}
      </h3>
      <p className="mt-1 text-xs text-white/55">
        {kindLine(entry)}
        {entry[2] ? ` · ${entry[2]}` : ""}
      </p>

      <ol className="mt-4 space-y-3">
        {entry[4].map(([epId, seconds, role, title, excerpt]) => {
          const ep = episodeById.get(epId)
          const watch = watchHref(media[epId], seconds)
          return (
            <li key={`${epId}|${seconds}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {ep?.[1] ? (
                  <Link href={`/t/${ep[1]}`} className="text-sm font-semibold text-white hover:underline">
                    {ep[3]}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-white">{ep?.[3] ?? "Episode"}</span>
                )}
                {role && ROLE_LABEL[role] && (
                  <span className="rounded-full border border-white/15 px-2 text-[10px] text-white/60">{ROLE_LABEL[role]}</span>
                )}
              </div>
              {title && <p className="mt-1 text-xs font-medium text-white/80">{title}</p>}
              {excerpt && <p className="mt-1 line-clamp-4 text-xs font-light leading-relaxed text-white/65">{excerpt}</p>}
              <p className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-white/45">
                {ep?.[2] && <span>{ep[2]}</span>}
                {watch && (
                  <a href={watch} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white">
                    Listen at {formatTimestamp(seconds)}
                  </a>
                )}
              </p>
            </li>
          )
        })}
      </ol>

      {named.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Named in these tellings</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {named.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => onOpenNode(j)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color(index.nodes[j][0]) }} />
                {index.nodes[j][2]}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 text-[11px] font-light leading-relaxed text-white/40">
        Grouped by reading every story in the archive side by side. Something grouped wrong? Use &ldquo;Tell us&rdquo; on any story.
      </p>
    </aside>
  )
}
