"use client"

// The FNRad Archive card (briefs/fnrad-archive-front-doors-brief-v1.md, A2).
//
// One card, four placements: home, /snowboarding, /fnrad and the FNRad brand
// page. A real constellation from the live archive index, laid out on the
// server (getArchiveCardData) and drawn here as inline SVG: no d3, a few KB.
//
// Always dark (D3): it is a window into the archive, so it looks like the
// archive, even on a light-theme host page. With no `data` prop it fetches
// GET /api/fnrad/archive/card once per page load; on null or failure it renders
// nothing at all, wrapper included, so the host page reads exactly as before.

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ENTITY_COLORS } from "@/lib/entity-colors"
import { FNRAD_ARCHIVE_HREF } from "@/lib/fnrad"
import { trackEvent } from "@/lib/analytics"
import type { ArchiveCardData } from "@/lib/fnrad-archive-shared"

export type ArchiveCardPlacement = "home" | "community" | "fnrad" | "brand"

type Props = {
  data?: ArchiveCardData | null
  placement: ArchiveCardPlacement
  size?: "feature" | "compact"
  /** Classes for the outer wrapper (spacing). Not rendered when the card is not. */
  className?: string
}

const BG = "#1C1917"
const TYPE_KIND = ["rider", "place", "brand", "event", "board"] as const
const colorOf = (t: number) => ENTITY_COLORS[TYPE_KIND[t] ?? "story"].glow
const displayFont = { fontFamily: "var(--font-display)" }

const ALT = "A map of the riders, places and brands named across the FNRad archive."

// One fetch per page load, shared by every card on the page.
let pending: Promise<ArchiveCardData | null> | null = null
function loadCardData(): Promise<ArchiveCardData | null> {
  if (!pending) {
    pending = fetch("/api/fnrad/archive/card")
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveCardData | null>) : null))
      .catch(() => null)
      .then((d) => {
        if (!d) pending = null // let a later mount retry
        return d && Array.isArray(d.sky?.nodes) && d.sky.nodes.length ? d : null
      })
  }
  return pending
}

export function ArchiveCard({ data, placement, size = "feature", className }: Props) {
  const [fetched, setFetched] = useState<ArchiveCardData | null | undefined>(data === undefined ? undefined : null)

  useEffect(() => {
    if (data !== undefined) return
    let live = true
    loadCardData().then((d) => {
      if (live) setFetched(d)
    })
    return () => {
      live = false
    }
  }, [data])

  const card = data !== undefined ? data : fetched
  const compact = size === "compact"
  // Container queries, not viewport breakpoints: the same card sits in a 576 px
  // column on /fnrad and a 720 px one on home. Side-by-side from 40rem of card width.
  const heights = compact ? "min-h-[260px] @[40rem]:min-h-[220px]" : "min-h-[460px] @[40rem]:min-h-[340px]"

  if (card === null) return null
  if (card === undefined) {
    // Loading: hold the final height so nothing below jumps when it lands.
    return (
      <div className={className}>
        <div className={`dark @container rounded-2xl border border-white/10 ${heights}`} style={{ background: BG }} aria-hidden="true" />
      </div>
    )
  }

  const track = (target: string) => trackEvent("content", "archive_card_click", { placement, target })

  return (
    <div className={className}>
      <section
        aria-label="The FNRad Archive"
        className={`dark @container relative isolate flex flex-col overflow-hidden rounded-2xl border border-white/10 ${heights}`}
        style={{ background: BG }}
      >
        <Sky data={card} compact={compact} />

        <div className={`relative flex flex-1 flex-col justify-end px-5 pb-5 @[40rem]:max-w-[56%] @[40rem]:justify-center @[40rem]:px-8 @[40rem]:py-8 ${compact ? "pt-[130px] @[40rem]:pt-6" : "pt-[220px] @[40rem]:pt-8"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">The FNRad Archive</p>
          <h2
            className={`mt-2 font-extrabold tracking-tight text-white leading-tight ${compact ? "text-xl @[40rem]:text-2xl" : "text-2xl @[40rem]:text-[1.7rem]"}`}
            style={displayFont}
          >
            Twelve seasons of snowboarding stories, connected.
          </h2>
          {!compact && (
            <p className="mt-3 text-sm font-light leading-relaxed text-white/80">
              We mapped every story told on FNRad to the riders, hills, brands and boards in it, so you can follow any
              name through fifty years of snowboarding.
            </p>
          )}
          <p className="mt-3 text-xs font-medium text-white/55">{card.scaleLine}</p>
          <div className="mt-4">
            <Link
              href={FNRAD_ARCHIVE_HREF}
              onClick={() => track("archive")}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              Explore the archive <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          {!compact && card.featured.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {card.featured.map((f) => (
                <Link
                  key={f.focus}
                  href={f.href}
                  onClick={() => track(f.focus)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm transition-colors hover:border-white/35 hover:text-white"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(f.type) }} />
                  <span className="truncate">
                    {f.name} · {f.stories.toLocaleString("en-US")} stories
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/** Deterministic background dust, so the sky never reads as a diagram. */
function dust(count: number): [number, number, number][] {
  let s = 7
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  return Array.from({ length: count }, () => [Math.round(rnd() * 1000), Math.round(rnd() * 600), rnd()])
}

function Sky({ data, compact }: { data: ArchiveCardData; compact: boolean }) {
  const stars = useMemo(() => dust(90), [])
  const { nodes, edges } = data.sky
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 @[40rem]:inset-0 @[40rem]:h-full ${compact ? "h-[170px]" : "h-[280px]"}`}
    >
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMaxYMid slice"
        role="img"
        aria-label={ALT}
        className="block h-full w-full"
      >
        <defs>
          <radialGradient id="archive-card-glow" cx="68%" cy="50%" r="45%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.06" />
            <stop offset="100%" stopColor={BG} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1000" height="600" fill="url(#archive-card-glow)" />
        {stars.map(([x, y, o], i) => (
          <circle key={`s${i}`} cx={x} cy={y} r={o > 0.85 ? 1.6 : 1} fill="#ffffff" fillOpacity={0.08 + o * 0.22} />
        ))}
        <g className="archive-sky-frame">
        <g className="archive-sky-drift">
          {edges.map(([a, b], i) => (
            <line
              key={`e${i}`}
              x1={nodes[a][0]}
              y1={nodes[a][1]}
              x2={nodes[b][0]}
              y2={nodes[b][1]}
              stroke="#ffffff"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          ))}
          {nodes.map(([x, y, r, t], i) => (
            <circle key={`h${i}`} cx={x} cy={y} r={r * 2.6} fill={colorOf(t)} fillOpacity={0.12} />
          ))}
          {nodes.map(([x, y, r, t], i) => (
            <circle key={`n${i}`} cx={x} cy={y} r={r} fill={colorOf(t)} fillOpacity={0.95} />
          ))}
          {nodes.map(([x, y, r, , label], i) =>
            label ? (
              <text
                key={`t${i}`}
                x={x}
                y={y - r - 8}
                textAnchor="middle"
                fontSize={19}
                fontWeight={500}
                fill="#ffffff"
                fillOpacity={0.82}
                style={{ paintOrder: "stroke", stroke: BG, strokeWidth: 4, fontFamily: "var(--font-body)" }}
              >
                {label}
              </text>
            ) : null,
          )}
        </g>
        </g>
      </svg>
      {/* Readability: fades the sky into the text side (left on desktop, bottom on a phone). */}
      <div
        className="absolute inset-0 @[40rem]:hidden"
        style={{ background: `linear-gradient(to bottom, transparent 35%, ${BG} 92%)` }}
      />
      <div
        className="absolute inset-0 hidden @[40rem]:block"
        style={{ background: `linear-gradient(to right, ${BG} 0%, ${BG}e6 30%, ${BG}66 52%, transparent 72%)` }}
      />
    </div>
  )
}
