"use client"

// The FNRad Archive Path view (ported from the podcast Sketches Path, admin
// sketch-engine.ts drawPath). One node, year by year: the top row is the
// node's own stories per year; below it, each row is someone or something told
// in the same stories, starting at the first year they are told together. A
// dot is a year with shared stories; a faint bar is a story dated across more
// than SPAN_YEARS years. Plain SVG, no d3.

import { useEffect, useMemo, useRef, useState } from "react"
import { ENTITY_COLORS } from "@/lib/entity-colors"
import { SPAN_YEARS, TYPE_LABELS } from "@/lib/fnrad-archive-shared"
import type { ArchiveIndex, ArchiveNodeStory } from "@/lib/fnrad-archive-shared"

const KIND = ["rider", "place", "brand", "event", "board"] as const
const color = (t: number) => ENTITY_COLORS[KIND[t]].glow
/** Rows shown per type, in ARCHIVE_TYPES order (the Sketches K). */
const ROWS = [12, 9, 9, 6, 5]
const MIN_YEAR = 1960
const MAX_YEAR = new Date().getFullYear()
const FONT = "var(--font-body), system-ui, sans-serif"

type Co = { j: number; total: number; dated: number; y: Map<number, number>; spans: [number, number][]; first: number; last: number }

/** The years a story is drawn at, or a span for a wide range. */
function storyYears(s: ArchiveNodeStory): { ys: number[]; span: [number, number] | null } {
  const [, , , , a, b] = s
  if (a == null) return { ys: [], span: null }
  const end = b ?? a
  if (a < MIN_YEAR || a > MAX_YEAR) return { ys: [], span: null }
  if (end - a > SPAN_YEARS) return { ys: [], span: [a, Math.min(end, MAX_YEAR)] }
  const ys: number[] = []
  for (let y = a; y <= Math.min(end, MAX_YEAR); y++) ys.push(y)
  return { ys, span: null }
}

export function ArchivePath({
  index,
  sel,
  stories,
  keyToIndex,
  types,
  pair,
  year,
  onPair,
  onYear,
}: {
  index: ArchiveIndex
  sel: number
  stories: ArchiveNodeStory[]
  keyToIndex: Map<string, number>
  types: boolean[]
  pair: number | null
  year: number | null
  onPair: (j: number, year: number | null) => void
  onYear: (y: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = index.nodes[sel]
  const model = useMemo(() => {
    const own = new Map<number, number>()
    const ownSpans: [number, number][] = []
    const co = new Map<number, Co>()
    let dated = 0
    for (const s of stories) {
      const { ys, span } = storyYears(s)
      if (ys.length || span) dated++
      ys.forEach((y) => own.set(y, (own.get(y) ?? 0) + 1))
      if (span) ownSpans.push(span)
      for (const key of s[6]) {
        const j = keyToIndex.get(key)
        if (j == null) continue
        let c = co.get(j)
        if (!c) {
          c = { j, total: 0, dated: 0, y: new Map(), spans: [], first: 9999, last: 0 }
          co.set(j, c)
        }
        c.total++
        if (ys.length || span) c.dated++
        ys.forEach((y) => c!.y.set(y, (c!.y.get(y) ?? 0) + 1))
        if (span) c.spans.push(span)
      }
    }
    const all = [...own.keys(), ...ownSpans.flat()]
    return { own, ownSpans, co, dated, range: all.length ? [Math.min(...all) - 1, Math.max(...all) + 1] : null }
  }, [stories, keyToIndex])

  // Narrow screens: a slimmer name column, and open scrolled to the busiest year.
  const L = width < 600 ? 118 : 200
  const maxName = width < 600 ? 16 : 28
  const peakYear = useMemo(() => {
    let best: number | null = null
    for (const [y, v] of model.own) if (best == null || v > (model.own.get(best) ?? 0)) best = y
    return best
  }, [model])
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !model.range || peakYear == null || el.scrollWidth <= el.clientWidth) return
    const [a0, b0] = model.range
    const cw0 = Math.max(13, Math.min(22, Math.floor((width - L - 90) / (b0 - a0 + 1))))
    // Centre the peak in the part of the chart the pinned names leave visible.
    el.scrollLeft = Math.max(0, L + (peakYear - a0 + 0.5) * cw0 - (L + el.clientWidth) / 2)
  }, [peakYear, model.range, width, L])

  if (!stories.length) return <Note>No stories with a moment yet for {n[2]}.</Note>
  if (!model.range) return <Note>None of the stories about {n[2]} have a year yet, so there is no path to draw. They are all listed below.</Note>

  const [a, b] = model.range
  const clampY = (y: number) => Math.max(a, Math.min(b, y))
  const cw = Math.max(13, Math.min(22, Math.floor((width - L - 90) / (b - a + 1))))
  const X = (y: number) => L + (y - a + 0.5) * cw
  const W = L + (b - a + 1) * cw + 80
  const rh = 20
  const top = n[0]
  const mx = Math.max(1, ...model.own.values())

  // Rows: per type, the most shared, then ordered by first shared year.
  const sections: { t: number; rows: Co[] }[] = []
  TYPE_LABELS.forEach((_, t) => {
    if (!types[t]) return
    const rows = [...model.co.values()]
      .filter((c) => index.nodes[c.j][0] === t && !index.nodes[c.j][6])
      .sort((p, q) => q.total - p.total)
      .slice(0, ROWS[t])
    if (!rows.length) return
    rows.forEach((c) => {
      const d = [...c.y.keys()].filter((y) => y >= a && y <= b)
      const ends = c.spans.flat().map(clampY)
      c.first = d.length || ends.length ? Math.min(...d, ...ends) : 9999
      c.last = d.length ? Math.max(...d) : 0
    })
    rows.sort((p, q) => p.first - q.first || q.total - p.total)
    sections.push({ t, rows })
  })

  let y0 = 74
  const body: React.ReactNode[] = []
  // Names sit in their own pinned layer so they stay put while the years scroll.
  const labels: React.ReactNode[] = []
  const active = new Map<number, number>()
  for (const { t, rows } of sections) {
    labels.push(
      <text key={`h${t}`} x={0} y={y0 + 13} fill="#ffffff" fillOpacity={0.45} fontWeight={700}>
        {TYPE_LABELS[t]}
      </text>,
    )
    y0 += 20
    for (const c of rows) {
      const m = index.nodes[c.j]
      const cy = y0 + rh / 2
      const mxc = Math.max(1, ...c.y.values())
      const ds = [...c.y.keys()].filter((y) => y >= a && y <= b)
      const und = c.total - c.dated
      const on = pair === c.j
      labels.push(
        <text
            key={`l${c.j}`}
            x={L - 10}
            y={cy + 1}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#ffffff"
            fillOpacity={on ? 1 : 0.8}
            fontWeight={on ? 700 : 300}
            className="cursor-pointer"
            onClick={() => onPair(c.j, null)}
          >
            {m[2].length > maxName ? `${m[2].slice(0, maxName - 1)}…` : m[2]}
            <title>{`${m[2]}: ${c.total} shared ${c.total === 1 ? "story" : "stories"}`}</title>
          </text>,
      )
      body.push(
        <g key={`r${c.j}`}>
          {c.spans.map(([p, q], k) => (
            <rect
              key={`s${k}`}
              x={X(clampY(p)) - cw / 2}
              y={cy - 4}
              width={(clampY(q) - clampY(p) + 1) * cw}
              height={8}
              rx={4}
              fill={color(t)}
              opacity={0.16}
              className="cursor-pointer"
              onClick={() => onPair(c.j, null)}
            >
              <title>{`${n[2]} and ${m[2]}: a story dated ${p} to ${q}`}</title>
            </rect>
          ))}
          {ds.length > 0 && (
            <line x1={X(c.first)} x2={X(c.last)} y1={cy} y2={cy} stroke={color(t)} strokeWidth={2} opacity={0.45} />
          )}
          {ds.map((y) => {
            active.set(y, Math.max(active.get(y) ?? 0, cy))
            const v = c.y.get(y)!
            const hit = on && year === y
            return (
              <circle
                key={y}
                cx={X(y)}
                cy={cy}
                r={3.5 + (3.5 * v) / mxc}
                fill={color(t)}
                stroke={hit ? "#ffffff" : "#1C1917"}
                strokeWidth={2}
                className="cursor-pointer"
                onClick={() => onPair(c.j, y)}
              >
                <title>{`${n[2]} and ${m[2]}, ${y}: ${v} ${v > 1 ? "stories" : "story"}`}</title>
              </circle>
            )
          })}
          {und > 0 && (
            <text x={W - 70} y={cy + 1} dominantBaseline="middle" fill="#ffffff" fillOpacity={0.4} className="cursor-pointer" onClick={() => onPair(c.j, null)}>
              {und} more
            </text>
          )}
        </g>,
      )
      y0 += rh
    }
    y0 += 8
  }

  const years: number[] = []
  for (let y = a; y <= b; y++) years.push(y)

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto px-4 pb-2 pt-4">
        <svg
          width={W}
          height={y0 + 10}
          viewBox={`0 0 ${W} ${y0 + 10}`}
          role="img"
          aria-label={`${n[2]}'s path through the archive, year by year, with the riders, places and brands told in the same stories`}
          style={{ fontFamily: FONT, fontSize: 11 }}
          className="block select-none"
        >
          {model.ownSpans.map(([p, q], k) => (
            <rect key={`os${k}`} x={X(clampY(p)) - cw / 2} y={44} width={(clampY(q) - clampY(p) + 1) * cw} height={6} rx={3} fill={color(top)} opacity={0.16}>
              <title>{`A story about ${n[2]} dated ${p} to ${q}`}</title>
            </rect>
          ))}
          {years
            .filter((y) => y % 5 === 0)
            .map((y) => (
              <text key={`yl${y}`} x={X(y)} y={12} textAnchor="middle" fill="#ffffff" fillOpacity={0.45}>
                {y}
              </text>
            ))}
          <line x1={X(a)} x2={X(b)} y1={50} y2={50} stroke={color(top)} strokeWidth={2} />
          {years.map((y) => {
            const v = model.own.get(y) ?? 0
            if (!v) return null
            const bh = 4 + (v / mx) * 26
            return (
              <rect
                key={`b${y}`}
                x={X(y) - cw / 2 + 1.5}
                y={50 - bh}
                width={cw - 3}
                height={bh}
                rx={3}
                fill={color(top)}
                stroke={year === y && pair == null ? "#ffffff" : "none"}
                className="cursor-pointer"
                onClick={() => onYear(y)}
              >
                <title>{`${y}: ${v} ${v > 1 ? "stories" : "story"} about ${n[2]}`}</title>
              </rect>
            )
          })}
          <text x={W - 70} y={46} fill="#ffffff" fillOpacity={0.4}>
            no year
          </text>
          {[...active].map(([y, cy]) => (
            <line key={`w${y}`} x1={X(y)} x2={X(y)} y1={52} y2={cy} stroke="#ffffff" strokeOpacity={0.08} />
          ))}
          {body}
        </svg>
      </div>
      {/* Pinned names: same coordinates as the chart, over its left margin. */}
      <svg
        width={L + 16}
        height={y0 + 10}
        viewBox={`-16 0 ${L + 16} ${y0 + 10}`}
        aria-hidden="true"
        style={{ fontFamily: FONT, fontSize: 11 }}
        className="pointer-events-none absolute left-0 top-4 select-none"
      >
        <rect x={-16} y={0} width={L + 10} height={y0 + 10} fill="#171412" opacity={0.94} />
        <text x={L - 10} y={46} textAnchor="end" fill="#ffffff" fontWeight={700} fontSize={13}>
          {n[2].length > maxName ? `${n[2].slice(0, maxName - 1)}…` : n[2]}
        </text>
        <g className="pointer-events-auto">{labels}</g>
      </svg>
      </div>
      <p className="px-4 pb-4 text-xs font-light leading-relaxed text-white/45">
        The top row is {n[2]}: stories per year. Each line below is someone or something told in the same stories, starting the
        first year they are told together. Click a dot, a name or a year to read those stories. {model.dated.toLocaleString("en-US")} of{" "}
        {stories.length.toLocaleString("en-US")} stories have a year; &ldquo;more&rdquo; counts shared stories without one.
      </p>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-sm font-light leading-relaxed text-white/60">{children}</p>
}
