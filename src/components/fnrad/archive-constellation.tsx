"use client"

// The FNRad Archive constellation (briefs/fnrad-archive-surface-brief-v1.md, A3).
//
// A way in, not a destination: every star is a node of the archive index, and
// selecting one opens the panel that links to the plain entity page. Loaded with
// next/dynamic from ArchiveExplorer so d3 stays out of the page's first chunk.
//
// Desktop draws the wide sky: the layout is computed once per node set with
// d3-force (no animated simulation, so prefers-reduced-motion needs no special
// case), then rendered as SVG; d3-zoom pans and zooms. Mobile draws the same
// sky (shorter, pinch to zoom) until a star is chosen, then focused mode: one
// centre node and its strongest connections on a ring. Tapping the centre or
// open space in focused mode closes it, back to the sky.

import { useEffect, useMemo, useRef, useState } from "react"
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force"
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force"
import { select } from "d3-selection"
import { zoom, zoomIdentity } from "d3-zoom"
import type { ZoomBehavior, ZoomTransform } from "d3-zoom"
import { ENTITY_COLORS } from "@/lib/entity-colors"
import type { ArchiveIndex } from "@/lib/fnrad-archive-shared"

export const TYPE_KIND = ["rider", "place", "brand", "event", "board"] as const
export const typeColor = (t: number) => ENTITY_COLORS[TYPE_KIND[t] ?? "story"].glow

export const CONSTELLATION_ALT =
  "A map of the people, places and brands named across the FNRad archive. Everything on it is also in the lists below."

type Props = {
  index: ArchiveIndex
  /** Node indexes to draw (desktop), already filtered by type and threshold. */
  nodeSet: number[]
  /** Neighbours of a node, heaviest first: [node index, shared stories]. */
  neighbours: (i: number) => [number, number][]
  selected: number | null
  onSelect: (i: number) => void
  /** A click on open sky (not a drag), or on the mobile ring's centre or open
   *  space, clears the selection. */
  onBackground?: () => void
  mobile: boolean
  /** Bump to reset the desktop zoom. */
  resetKey: number
  /** Desktop: stars shown at the fitted zoom. nodeSet holds more, ranked; zooming
   *  in reveals them (zoom for detail, instead of a thread-count slider). */
  baseCount: number
}

type SimNode = SimulationNodeDatum & { i: number; r: number }
type SimLink = SimulationLinkDatum<SimNode> & { w: number }

const DESKTOP_H = 560
const MOBILE_H = 380
const RING_MAX = 12

const radius = (eps: number) => 3 + Math.sqrt(eps) * 1.25

export default function ArchiveConstellation(props: Props) {
  if (props.mobile && props.selected != null) return <FocusedRing {...props} />
  return <WideSky {...props} height={props.mobile ? MOBILE_H : DESKTOP_H} />
}

// ── desktop: the wide sky ───────────────────────────────────────────────────

function WideSky({ index, nodeSet, neighbours, selected, onSelect, onBackground, resetKey, baseCount, height: H }: Props & { height: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [width, setWidth] = useState(960)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [hover, setHover] = useState<number | null>(null)
  const fitKRef = useRef(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Read the box once now, so a phone never draws a frame at the desktop width.
    if (el.clientWidth) setWidth(Math.max(320, Math.round(el.clientWidth)))
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Layout, computed to rest in one go. Seeded positions keep it stable across renders.
  const layout = useMemo(() => {
    const set = new Set(nodeSet)
    const nodes: SimNode[] = nodeSet.map((i, k) => {
      const a = (k / Math.max(1, nodeSet.length)) * Math.PI * 2 * 7
      const d = 40 + k * 2.2
      return { i, r: radius(index.nodes[i][4]), x: Math.cos(a) * d, y: Math.sin(a) * d }
    })
    const byI = new Map(nodes.map((n) => [n.i, n]))
    const links: SimLink[] = []
    for (const [a, b, w] of index.edges) {
      if (set.has(a) && set.has(b)) links.push({ source: byI.get(a)!, target: byI.get(b)!, w })
    }
    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimLink>(links).distance((l) => 130 - Math.min(70, l.w * 2)).strength((l) => Math.min(0.9, 0.08 + l.w / 60)))
      .force("charge", forceManyBody().strength(-260))
      .force("x", forceX(0).strength(0.03))
      .force("y", forceY(0).strength(0.06))
      .force("collide", forceCollide<SimNode>((d) => d.r + 9))
      .force("center", forceCenter(0, 0))
      .stop()
    for (let t = 0; t < 300; t++) sim.tick()
    return { nodes, links, byI }
  }, [index, nodeSet])

  // Fit the drawing into the box on first layout and on reset.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .on("zoom", (e) => setTransform(e.transform))
    zoomRef.current = z
    select(svg).call(z)
    return () => {
      select(svg).on(".zoom", null)
    }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z || !layout.nodes.length) return
    // Fit the top stars only; the rest sit around them and appear as you zoom in.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of layout.nodes.slice(0, baseCount)) {
      minX = Math.min(minX, n.x! - n.r); maxX = Math.max(maxX, n.x! + n.r)
      minY = Math.min(minY, n.y! - n.r); maxY = Math.max(maxY, n.y! + n.r)
    }
    const pad = 40
    const k = Math.min(2, (width - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1))
    fitKRef.current = k
    const t = zoomIdentity.translate(width / 2 - ((minX + maxX) / 2) * k, H / 2 - ((minY + maxY) / 2) * k).scale(k)
    select(svg).call(z.transform, t)
    // Only on a new layout, a resize or a reset; never on selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, width, resetKey, H])

  const focus = hover ?? selected
  const lit = useMemo(() => {
    if (focus == null) return null
    return new Set([focus, ...neighbours(focus).map(([j]) => j)])
  }, [focus, neighbours])

  // Level of detail: how far past the fitted zoom we are decides how many stars
  // show (baseCount at the fit, up to everything in nodeSet), and how many carry
  // a label. The selected star and whatever is lit always show.
  const k = transform.k
  const detail = Math.max(1, k / (fitKRef.current || 1))
  const visibleCount = Math.min(nodeSet.length, Math.round(baseCount * Math.pow(detail, 1.6)))
  const visible = useMemo(() => {
    const v = new Set(nodeSet.slice(0, visibleCount))
    if (selected != null) v.add(selected)
    if (lit) for (const j of lit) v.add(j)
    return v
  }, [nodeSet, visibleCount, selected, lit])
  // Fewer labels at the fit when fewer stars show (phones), so they do not pile up.
  const labelCount = Math.round(Math.min(18, baseCount / 4) * Math.pow(detail, 1.3))
  const alwaysLabel = useMemo(() => new Set(nodeSet.slice(0, labelCount)), [nodeSet, labelCount])

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: H }}>
      <svg
        ref={svgRef}
        width={width}
        height={H}
        role="img"
        aria-label={CONSTELLATION_ALT}
        className="block cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => {
          // d3-zoom swallows the click that ends a drag, so this is a real click.
          if (e.target === svgRef.current) {
            setHover(null)
            onBackground?.()
          }
        }}
      >
        <g transform={transform.toString()}>
          {layout.links.map((l, n) => {
            const a = (l.source as SimNode).i
            const b = (l.target as SimNode).i
            if (!visible.has(a) || !visible.has(b)) return null
            const on = lit ? lit.has(a) && lit.has(b) && (a === focus || b === focus) : false
            return (
              <line
                key={n}
                x1={(l.source as SimNode).x}
                y1={(l.source as SimNode).y}
                x2={(l.target as SimNode).x}
                y2={(l.target as SimNode).y}
                stroke="#ffffff"
                strokeOpacity={lit ? (on ? 0.55 : 0.03) : 0.12}
                strokeWidth={Math.min(4, 0.5 + l.w / 12) / Math.sqrt(k)}
              />
            )
          })}
          {layout.nodes.map((n) => {
            if (!visible.has(n.i)) return null
            const node = index.nodes[n.i]
            const dim = lit ? !lit.has(n.i) : false
            const isSel = n.i === selected
            const showLabel = isSel || (lit ? lit.has(n.i) : alwaysLabel.has(n.i))
            return (
              <g
                key={n.i}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.15 : 1}
                // Hover lights a star's links for a mouse only: a tap fires a
                // mouseenter too, and would leave the star lit after it closes.
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHover(n.i)
                }}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(n.i)
                }}
              >
                <circle r={n.r + 6} fill="transparent" />
                <circle
                  r={n.r}
                  fill={typeColor(node[0])}
                  stroke={isSel ? "#ffffff" : "none"}
                  strokeWidth={2 / k}
                />
                {showLabel && (
                  <text
                    y={-n.r - 4 / k}
                    textAnchor="middle"
                    fontSize={11 / Math.sqrt(k)}
                    fill="#ffffff"
                    fillOpacity={0.85}
                    style={{ paintOrder: "stroke", stroke: "#1C1917", strokeWidth: 3 / k }}
                  >
                    {node[2]}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      {nodeSet.length > baseCount && (
        <p className="pointer-events-none absolute right-4 top-3 text-[11px] text-white/40">
          {visibleCount < nodeSet.length
            ? `Showing ${visibleCount} of ${nodeSet.length}. Zoom in for more.`
            : `Showing all ${nodeSet.length}.`}
        </p>
      )}
    </div>
  )
}

// ── mobile: focused mode ────────────────────────────────────────────────────

function FocusedRing({ index, neighbours, selected, onSelect, onBackground }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    if (el.clientWidth) setWidth(Math.max(280, Math.round(el.clientWidth)))
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (selected == null) return <div ref={wrapRef} style={{ height: MOBILE_H }} />
  const centre = index.nodes[selected]
  const ring = neighbours(selected).slice(0, RING_MAX)
  const maxW = Math.max(1, ...ring.map(([, w]) => w))
  const cx = width / 2
  const cy = MOBILE_H / 2
  const R = Math.min(width / 2 - 52, MOBILE_H / 2 - 44)

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: MOBILE_H }}>
      <svg
        width={width}
        height={MOBILE_H}
        role="img"
        aria-label={CONSTELLATION_ALT}
        className="block select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onBackground?.()
        }}
      >
        {ring.map(([j, w], k) => {
          const a = -Math.PI / 2 + (k / ring.length) * Math.PI * 2
          return (
            <line
              key={`l${j}`}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(a) * R}
              y2={cy + Math.sin(a) * R}
              stroke="#ffffff"
              strokeOpacity={0.12 + (w / maxW) * 0.35}
              strokeWidth={1 + (w / maxW) * 2.5}
            />
          )
        })}
        <g
          role="button"
          tabIndex={0}
          aria-label={`Close ${centre[2]}`}
          className="cursor-pointer outline-none"
          onClick={() => onBackground?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onBackground?.()
            }
          }}
        >
          <circle cx={cx} cy={cy} r={22} fill={typeColor(centre[0])} stroke="#ffffff" strokeWidth={2} />
        </g>
        <text
          x={cx}
          y={cy + 40}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill="#ffffff"
          style={{ paintOrder: "stroke", stroke: "#1C1917", strokeWidth: 4 }}
        >
          {centre[2]}
        </text>
        {ring.map(([j, w], k) => {
          const a = -Math.PI / 2 + (k / ring.length) * Math.PI * 2
          const x = cx + Math.cos(a) * R
          const y = cy + Math.sin(a) * R
          const r = 7 + (w / maxW) * 9
          const node = index.nodes[j]
          const below = Math.sin(a) > 0.2
          return (
            <g
              key={j}
              role="button"
              tabIndex={0}
              aria-label={`Recentre on ${node[2]}`}
              className="cursor-pointer outline-none"
              onClick={() => onSelect(j)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(j)
                }
              }}
            >
              {/* 44px touch target */}
              <circle cx={x} cy={y} r={22} fill="transparent" />
              <circle cx={x} cy={y} r={r} fill={typeColor(node[0])} />
              <text
                x={x}
                y={below ? y + r + 13 : y - r - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#ffffff"
                fillOpacity={0.85}
                style={{ paintOrder: "stroke", stroke: "#1C1917", strokeWidth: 3 }}
              >
                {node[2].length > 18 ? `${node[2].slice(0, 17)}…` : node[2]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
