"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

type CollectiveType = "event" | "artifact" | "story" | "place"

interface DataPoint {
  year: number
  decade?: string
  event: number
  artifact: number
  story: number
  place: number
  label: string
}

// ─── Palette (always dark — cinematic data page) ──────────────────────────────

const BG    = "#05080f"
const SPINE = "#142436"
const MUTED = "#2a4a5a"
const TEXT  = "#d8eaf4"
const DIM   = "#0d1824"
const CYAN  = "#00d4ff"

const TYPE: Record<CollectiveType, { symbol: string; label: string; color: string }> = {
  event:    { symbol: "◈", label: "Events",    color: "#00d4ff" },
  artifact: { symbol: "◉", label: "Artifacts", color: "#ff9f43" },
  story:    { symbol: "◎", label: "Stories",   color: "#a29bfe" },
  place:    { symbol: "◇", label: "Places",    color: "#55efc4" },
}

const TYPE_KEYS: CollectiveType[] = ["event", "artifact", "story", "place"]

// ─── Static fallback data ─────────────────────────────────────────────────────

const YEAR_DATA_STATIC: DataPoint[] = [
  { year: 1983, event: 2,  artifact: 1,  story: 1,  place: 0,  label: "Burton Performer"           },
  { year: 1985, event: 4,  artifact: 3,  story: 2,  place: 1,  label: "First World Championships"  },
  { year: 1987, event: 5,  artifact: 6,  story: 3,  place: 2,  label: "Sims dominate"              },
  { year: 1988, event: 6,  artifact: 9,  story: 4,  place: 2,  label: "US Open grows"              },
  { year: 1990, event: 11, artifact: 14, story: 6,  place: 4,  label: "Resorts open up"            },
  { year: 1991, event: 13, artifact: 17, story: 8,  place: 5,  label: "Video era starts"           },
  { year: 1992, event: 16, artifact: 22, story: 11, place: 6,  label: "US Open iconic"             },
  { year: 1993, event: 19, artifact: 28, story: 13, place: 8,  label: "Forum founded"              },
  { year: 1994, event: 24, artifact: 35, story: 16, place: 10, label: "Baker Legendary peaks"      },
  { year: 1995, event: 29, artifact: 44, story: 19, place: 13, label: "Mack Dawg era"              },
  { year: 1996, event: 34, artifact: 54, story: 23, place: 16, label: "Video parts explode"        },
  { year: 1997, event: 41, artifact: 64, story: 29, place: 19, label: "246 drops"                  },
  { year: 1998, event: 72, artifact: 91, story: 48, place: 32, label: "Olympics — Nagano"          },
  { year: 1999, event: 58, artifact: 78, story: 41, place: 26, label: "Peak Forum era"             },
  { year: 2000, event: 64, artifact: 88, story: 46, place: 31, label: "Destroyers released"        },
  { year: 2001, event: 59, artifact: 82, story: 43, place: 29, label: "Supernatural born"          },
  { year: 2002, event: 67, artifact: 95, story: 52, place: 35, label: "DCP era"                    },
  { year: 2003, event: 74, artifact: 104, story: 58, place: 40, label: "Baldface opens"            },
  { year: 2004, event: 68, artifact: 97, story: 54, place: 37, label: "Scene globalises"           },
  { year: 2005, event: 62, artifact: 87, story: 50, place: 36, label: "Backcountry grows"          },
  { year: 2006, event: 55, artifact: 76, story: 48, place: 34, label: "Park vs BC debate"          },
  { year: 2007, event: 51, artifact: 69, story: 52, place: 33, label: "Film culture shifts"        },
  { year: 2008, event: 48, artifact: 62, story: 58, place: 31, label: "Print media fades"          },
  { year: 2009, event: 44, artifact: 55, story: 64, place: 29, label: "Stories overtake"           },
  { year: 2010, event: 88, artifact: 64, story: 98, place: 67, label: "Shaun White 3rd gold"       },
  { year: 2011, event: 76, artifact: 58, story: 89, place: 59, label: "Backcountry mainstream"     },
  { year: 2012, event: 94, artifact: 61, story: 112, place: 74, label: "BC renaissance"            },
  { year: 2013, event: 82, artifact: 54, story: 99, place: 66, label: "Split touring grows"        },
  { year: 2014, event: 78, artifact: 51, story: 95, place: 62, label: "Sochi Olympics"             },
  { year: 2015, event: 69, artifact: 46, story: 87, place: 57, label: "New generation rises"       },
  { year: 2016, event: 63, artifact: 42, story: 81, place: 53, label: "Instagram era"              },
  { year: 2017, event: 58, artifact: 38, story: 76, place: 49, label: "Digital storytelling"       },
  { year: 2018, event: 54, artifact: 34, story: 71, place: 45, label: "Olympic controversy"        },
  { year: 2019, event: 48, artifact: 31, story: 65, place: 41, label: "Ikon Pass changes access"   },
  { year: 2020, event: 22, artifact: 14, story: 38, place: 19, label: "COVID season"               },
  { year: 2021, event: 41, artifact: 26, story: 58, place: 31, label: "Record pow years"           },
  { year: 2022, event: 36, artifact: 22, story: 51, place: 27, label: "Community rebuilds"         },
  { year: 2023, event: 31, artifact: 19, story: 44, place: 24, label: "New generation"             },
]

const DECADE_DATA_STATIC: DataPoint[] = [
  { year: 1983, decade: "1980s", event: 30,  artifact: 41,  story: 19,  place: 11,  label: "The outlaw era"        },
  { year: 1990, decade: "1990s", event: 234, artifact: 402, story: 162, place: 99,  label: "The golden era"        },
  { year: 2000, decade: "2000s", event: 571, artifact: 769, story: 465, place: 311, label: "Peak culture"          },
  { year: 2010, decade: "2010s", event: 662, artifact: 444, story: 808, place: 535, label: "The backcountry shift" },
  { year: 2020, decade: "2020s", event: 130, artifact: 81,  story: 191, place: 101, label: "Post-pandemic riding"  },
]

// ─── Predicate → collective type mapping ──────────────────────────────────────

function toCollectiveType(predicate: string, objectType: string): CollectiveType | null {
  if (objectType === "event") return "event"
  if (objectType === "place") return "place"
  if (objectType === "board") return "artifact"
  if (objectType === "org")   return "artifact" // brands/sponsors count as cultural artifacts
  if (["rode_with", "shot_by", "coached_by", "fan_of"].includes(predicate)) return "story"
  return null
}

// ─── Chart math helpers ───────────────────────────────────────────────────────

interface Point { x: number; y: number }

function catmullRomPath(pts: Point[], tension = 0.4): string {
  if (pts.length < 2) return ""
  const p = [pts[0], ...pts, pts[pts.length - 1]]
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2]
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function areaPath(pts: Point[], bottomY: number, tension = 0.4): string {
  if (pts.length < 2) return ""
  const line = catmullRomPath(pts, tension)
  return `${line} L ${pts[pts.length - 1].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CollectivePage() {
  const router = useRouter()
  const { sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId } = useLineageStore()

  const [mode, setMode]           = useState<"year" | "decade">("year")
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [scrubX, setScrubX]       = useState<number | null>(null)
  const [enabled, setEnabled]     = useState<Set<CollectiveType>>(new Set(TYPE_KEYS))
  const [yearData, setYearData]   = useState<DataPoint[]>(YEAR_DATA_STATIC)
  const [decadeData, setDecadeData] = useState<DataPoint[]>(DECADE_DATA_STATIC)
  const [myYears, setMyYears]     = useState<Set<number>>(new Set())
  const [drawn, setDrawn]         = useState(false)
  const [addedYear, setAddedYear] = useState<number | null>(null)

  const svgRef    = useRef<SVGSVGElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Load collective data from Supabase ────────────────────────────────────
  useEffect(() => {
    supabase
      .from("claims")
      .select("start_date, predicate, object_type, subject_id, visibility")
      .eq("visibility", "public")
      .not("start_date", "is", null)
      .then(({ data }) => {
        if (!data || data.length < 10) return // too sparse — keep static fallback

        const byYear = new Map<number, Record<CollectiveType, number>>()
        for (const c of data) {
          const yr = parseInt(c.start_date.slice(0, 4))
          if (isNaN(yr) || yr < 1975 || yr > 2025) continue
          const t = toCollectiveType(c.predicate, c.object_type)
          if (!t) continue
          if (!byYear.has(yr)) byYear.set(yr, { event: 0, artifact: 0, story: 0, place: 0 })
          byYear.get(yr)![t]++
        }

        if (byYear.size < 3) return // still too sparse

        // Blend live counts into static data (add to baseline so shape is recognisable)
        setYearData(prev => prev.map(d => {
          const live = byYear.get(d.year)
          if (!live) return d
          return { ...d, event: d.event + live.event, artifact: d.artifact + live.artifact, story: d.story + live.story, place: d.place + live.place }
        }))
      })
  }, [])

  // ── Determine user's personal years ──────────────────────────────────────
  useEffect(() => {
    const allClaims = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
    const userClaims = allClaims.filter(c => c.subject_id === activePersonId)
    const years = new Set<number>()
    for (const c of userClaims) {
      if (c.start_date) {
        const yr = parseInt(c.start_date.slice(0, 4))
        if (!isNaN(yr)) years.add(yr)
      }
    }
    setMyYears(years)
  }, [sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId])

  // ── Animate lines in on load / mode change ────────────────────────────────
  useEffect(() => {
    setDrawn(false)
    const t = setTimeout(() => setDrawn(true), 60)
    return () => clearTimeout(t)
  }, [mode])

  // Reset scrubber on mode change
  useEffect(() => {
    setActiveIdx(null)
    setScrubX(null)
  }, [mode])

  const data = mode === "decade" ? decadeData : yearData

  // ── Chart dimensions ──────────────────────────────────────────────────────
  const CHART_H = 160
  const PAD_T   = 14
  const PLOT_H  = CHART_H - PAD_T
  const NODE_Y  = CHART_H + 26
  const TOTAL_H = NODE_Y + 42
  const STEP    = mode === "decade" ? 72 : 24
  const PAD_L   = 24
  const CHART_W = PAD_L * 2 + (data.length - 1) * STEP

  const xOf = (i: number) => PAD_L + i * STEP
  const maxVal = useMemo(
    () => Math.max(1, ...data.flatMap(d => [d.event, d.artifact, d.story, d.place])),
    [data]
  )
  const yOf = (v: number) => PAD_T + PLOT_H - (v / maxVal) * PLOT_H

  const linePoints = useMemo(() => {
    const out: Record<CollectiveType, Point[]> = { event: [], artifact: [], story: [], place: [] }
    TYPE_KEYS.forEach(k => {
      out[k] = data.map((d, i) => ({ x: xOf(i), y: yOf(d[k]) }))
    })
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, maxVal, mode])

  const activeData = activeIdx !== null ? data[activeIdx] ?? null : null

  // ── Scrub interaction ─────────────────────────────────────────────────────
  const handleSvgInteraction = useCallback((clientX: number) => {
    if (!svgRef.current || !scrollRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scrollLeft = scrollRef.current.scrollLeft
    const relX = clientX - rect.left + scrollLeft
    let closest = 0, minDist = Infinity
    data.forEach((_, i) => {
      const dist = Math.abs(xOf(i) - relX)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    if (minDist < STEP * 0.75) {
      setActiveIdx(closest)
      setScrubX(xOf(closest))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, STEP, mode])

  const onMouseMove  = (e: React.MouseEvent)      => { if (e.buttons === 1) handleSvgInteraction(e.clientX) }
  const onClick      = (e: React.MouseEvent)      => handleSvgInteraction(e.clientX)
  const onTouchStart = (e: React.TouchEvent)      => { e.preventDefault(); handleSvgInteraction(e.touches[0].clientX) }
  const onTouchMove  = (e: React.TouchEvent)      => { e.preventDefault(); handleSvgInteraction(e.touches[0].clientX) }

  // ── Type filter toggle ────────────────────────────────────────────────────
  const toggleType = (k: CollectiveType) => {
    setEnabled(prev => {
      const next = new Set(prev)
      if (next.has(k)) { if (next.size > 1) next.delete(k) } // keep at least one
      else next.add(k)
      return next
    })
  }

  // ── "Add to timeline" ─────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!activeData) return
    setAddedYear(activeData.year)
    setTimeout(() => setAddedYear(null), 2000)
    router.push(`/profile`)
  }

  // ── Spine label logic ─────────────────────────────────────────────────────
  const showLabel = (i: number) =>
    mode === "decade" || i % 4 === 0 || i === activeIdx

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Google Fonts for this page */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=IBM+Plex+Mono:wght@400;700&display=swap" />

      <style>{`
        .collective-page { font-family: 'IBM Plex Mono', monospace; }
        .collective-page * { box-sizing: border-box; }
        .collective-page ::-webkit-scrollbar { display: none; }
        @keyframes ct-fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ct-scrubIn { from { opacity:0; } to { opacity:1; } }
        @keyframes ct-drawLine {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        .ct-line-draw {
          stroke-dasharray: 1;
          pathLength: 1;
          animation: ct-drawLine 0.8s ease forwards;
        }
        .ct-info-panel { animation: ct-fadeUp 0.2s ease; }
        .ct-scrubber    { animation: ct-scrubIn 0.1s ease; }
        .ct-pill { transition: background 0.2s, border-color 0.2s, color 0.2s; cursor: pointer; }
        .ct-pill:hover { opacity: 0.85; }
      `}</style>

      <div className="collective-page min-h-screen" style={{ background: BG, color: TEXT }}>
        <Nav />

        <div className="max-w-3xl mx-auto px-4 pt-6 pb-16">

          {/* ── Page header ────────────────────────────────────────────────── */}
          <div className="mb-6">
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 3, lineHeight: 1, marginBottom: 4 }}>
              COLLECTIVE<span style={{ color: CYAN }}>.</span>
            </div>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: 2 }}>
              // snowboarding · 1983–present
            </div>
          </div>

          {/* ── Controls row ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">

            {/* Type filter pills */}
            <div className="flex gap-2 flex-wrap">
              {TYPE_KEYS.map(k => {
                const t = TYPE[k]
                const on = enabled.has(k)
                return (
                  <button
                    key={k}
                    className="ct-pill flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: 0.5,
                      background: on ? `${t.color}18` : "transparent",
                      borderColor: on ? `${t.color}80` : MUTED,
                      color: on ? t.color : MUTED,
                    }}
                    onClick={() => toggleType(k)}
                  >
                    <span>{t.symbol}</span>
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* 1Y / 10Y toggle */}
            <div
              className="flex rounded-full overflow-hidden border"
              style={{ background: DIM, borderColor: "#ffffff08" }}
            >
              {([["year", "1Y"], ["decade", "10Y"]] as const).map(([m, lbl]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    background: mode === m ? SPINE : "none",
                    border: "none",
                    color: mode === m ? TEXT : MUTED,
                    fontSize: 10,
                    padding: "5px 14px",
                    cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: 1,
                    fontWeight: mode === m ? 700 : 400,
                    transition: "all 0.2s",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* ── Chart ──────────────────────────────────────────────────────── */}
          <div
            style={{
              background: "#0a1220",
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid #ffffff06",
            }}
          >
            {/* Scrollable chart area */}
            <div
              ref={scrollRef}
              style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none" }}
            >
              <svg
                ref={svgRef}
                width={CHART_W}
                height={TOTAL_H}
                style={{ display: "block", cursor: "crosshair", userSelect: "none" }}
                onClick={onClick}
                onMouseMove={onMouseMove}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
              >
                <defs>
                  {/* Area gradient fills */}
                  {TYPE_KEYS.map(k => (
                    <linearGradient key={k} id={`ct-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={TYPE[k].color} stopOpacity="0.16" />
                      <stop offset="100%" stopColor={TYPE[k].color} stopOpacity="0.00" />
                    </linearGradient>
                  ))}
                  {/* Scrubber gradient */}
                  <linearGradient id="ct-scrubGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.45" />
                    <stop offset="70%"  stopColor="#ffffff" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0"    />
                  </linearGradient>
                  {/* Glow filter */}
                  <filter id="ct-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  {/* Cyan glow for spine diamonds */}
                  <filter id="ct-cyan-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Subtle horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map(f => (
                  <line
                    key={f}
                    x1={0} y1={PAD_T + PLOT_H * (1 - f)}
                    x2={CHART_W} y2={PAD_T + PLOT_H * (1 - f)}
                    stroke="#ffffff"
                    strokeOpacity={f === 1.0 ? 0.015 : 0.025}
                    strokeWidth="1"
                    strokeDasharray={f === 1.0 ? undefined : "2 5"}
                  />
                ))}

                {/* Area fills */}
                {TYPE_KEYS.map(k => (
                  <path
                    key={`area-${k}`}
                    d={areaPath(linePoints[k], CHART_H)}
                    fill={`url(#ct-grad-${k})`}
                    style={{ opacity: enabled.has(k) ? 1 : 0, transition: "opacity 0.3s" }}
                  />
                ))}

                {/* Idle lines (dim when scrubbing) */}
                {TYPE_KEYS.map((k, ki) => (
                  <path
                    key={`line-idle-${k}`}
                    d={catmullRomPath(linePoints[k])}
                    fill="none"
                    stroke={TYPE[k].color}
                    strokeWidth={activeData ? 1.0 : 1.5}
                    strokeOpacity={activeData ? 0.25 : 0.75}
                    strokeLinecap="round"
                    pathLength={1}
                    className={drawn ? "ct-line-draw" : ""}
                    style={{
                      opacity: enabled.has(k) ? 1 : 0,
                      transition: "opacity 0.3s, stroke-opacity 0.3s",
                      animationDelay: drawn ? `${ki * 100}ms` : "0ms",
                    }}
                  />
                ))}

                {/* Active lines (full bright + glow, only when scrubbing) */}
                {activeData && TYPE_KEYS.map(k => (
                  <path
                    key={`line-active-${k}`}
                    d={catmullRomPath(linePoints[k])}
                    fill="none"
                    stroke={TYPE[k].color}
                    strokeWidth="2"
                    strokeOpacity="1"
                    strokeLinecap="round"
                    filter="url(#ct-glow)"
                    style={{
                      opacity: enabled.has(k) ? 1 : 0,
                      transition: "opacity 0.3s",
                    }}
                  />
                ))}

                {/* Small always-visible data nodes */}
                {TYPE_KEYS.map(k =>
                  linePoints[k].map((pt, i) => (
                    <circle
                      key={`node-${k}-${i}`}
                      cx={pt.x} cy={pt.y} r={1.8}
                      fill={BG}
                      stroke={TYPE[k].color}
                      strokeWidth="1"
                      strokeOpacity="0.45"
                      style={{ opacity: enabled.has(k) ? 1 : 0, transition: "opacity 0.3s" }}
                    />
                  ))
                )}

                {/* Scrubber crosshair */}
                {scrubX !== null && (
                  <g className="ct-scrubber">
                    <line
                      x1={scrubX} y1={4}
                      x2={scrubX} y2={NODE_Y - 8}
                      stroke="url(#ct-scrubGrad)"
                      strokeWidth="1"
                    />
                    {/* Active nodes on each line */}
                    {activeIdx !== null && TYPE_KEYS.map(k => {
                      if (!enabled.has(k)) return null
                      const pt = linePoints[k][activeIdx]
                      if (!pt) return null
                      return (
                        <g key={`scrub-node-${k}`} filter="url(#ct-glow)">
                          <circle cx={pt.x} cy={pt.y} r={6}   fill={BG}             stroke={TYPE[k].color} strokeWidth="1.5" />
                          <circle cx={pt.x} cy={pt.y} r={2.5} fill={TYPE[k].color} />
                        </g>
                      )
                    })}
                    {/* Active year label at top */}
                    {activeData && (
                      <text
                        x={scrubX} y={10}
                        textAnchor="middle"
                        fontSize="8"
                        fill={TEXT}
                        fontFamily="'IBM Plex Mono', monospace"
                        fillOpacity="0.6"
                      >
                        {activeData.decade ?? activeData.year}
                      </text>
                    )}
                  </g>
                )}

                {/* ── Spine ─────────────────────────────────────────────── */}
                <line
                  x1={PAD_L - 12} y1={NODE_Y}
                  x2={CHART_W - PAD_L + 12} y2={NODE_Y}
                  stroke={SPINE}
                  strokeWidth="1"
                />

                {/* Spine nodes + labels */}
                {data.map((d, i) => {
                  const x     = xOf(i)
                  const isMe  = myYears.has(d.year)
                  const isAct = activeIdx === i
                  const label = mode === "decade" ? d.decade! : `'${String(d.year).slice(2)}`

                  return (
                    <g
                      key={`spine-${i}`}
                      style={{ cursor: "pointer" }}
                      onClick={e => {
                        e.stopPropagation()
                        if (isAct) { setActiveIdx(null); setScrubX(null) }
                        else { setActiveIdx(i); setScrubX(x) }
                      }}
                    >
                      {/* Tick mark */}
                      <line
                        x1={x} y1={NODE_Y - 5}
                        x2={x} y2={NODE_Y + 5}
                        stroke={isAct ? TEXT : SPINE}
                        strokeWidth="1"
                      />

                      {/* Diamond (personal year) */}
                      {isMe && (
                        <rect
                          x={x - 5} y={NODE_Y - 5}
                          width={10} height={10}
                          transform={`rotate(45,${x},${NODE_Y})`}
                          fill={isAct ? CYAN : BG}
                          stroke={CYAN}
                          strokeWidth={isAct ? 1.5 : 1}
                          filter={isAct ? "url(#ct-cyan-glow)" : undefined}
                          style={{ transition: "all 0.2s" }}
                        />
                      )}

                      {/* Circle (non-personal year) */}
                      {!isMe && (
                        <circle
                          cx={x} cy={NODE_Y}
                          r={isAct ? 4 : 2.5}
                          fill={isAct ? TEXT : BG}
                          stroke={isAct ? TEXT : MUTED}
                          strokeWidth="1"
                          style={{ transition: "all 0.2s" }}
                        />
                      )}

                      {/* Year label */}
                      {showLabel(i) && (
                        <text
                          x={x} y={NODE_Y + 18}
                          textAnchor="middle"
                          fontSize={mode === "decade" ? 9 : 7.5}
                          fill={isAct ? TEXT : MUTED}
                          fontFamily="'IBM Plex Mono', monospace"
                          style={{ transition: "fill 0.2s" }}
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Spine legend */}
            <div
              className="flex items-center gap-4 px-4 py-2 border-t"
              style={{ borderColor: "#ffffff06" }}
            >
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <rect x="1" y="1" width="10" height="10" transform="rotate(45,6,6)" fill="none" stroke={CYAN} strokeWidth="1" />
                </svg>
                <span style={{ fontSize: 8, color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>your years</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="3.5" fill="none" stroke={MUTED} strokeWidth="1" />
                </svg>
                <span style={{ fontSize: 8, color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>community</span>
              </div>
              <span style={{ fontSize: 8, color: MUTED, fontFamily: "'IBM Plex Mono', monospace", marginLeft: "auto" }}>← drag or tap to scrub</span>
            </div>

            {/* ── Info panel ─────────────────────────────────────────────── */}
            <div style={{ borderTop: `1px solid #ffffff06`, minHeight: 160 }}>
              {activeData ? (
                <div key={`${activeData.year}-${mode}`} className="ct-info-panel px-5 py-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: CYAN, letterSpacing: 2, marginBottom: 5 }}>
                        {activeData.decade ?? activeData.year}
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
                        {activeData.label}
                      </div>
                    </div>
                    {myYears.has(activeData.year) && (
                      <div
                        className="shrink-0 mt-1 px-2 py-1 rounded-full flex items-center gap-1"
                        style={{ background: "#001a26", border: `1px solid ${CYAN}33`, fontSize: 9, color: CYAN, fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        ◆ yours
                      </div>
                    )}
                  </div>

                  {/* Type breakdown */}
                  <div className="space-y-2.5 mb-4">
                    {(() => {
                      const total = TYPE_KEYS.reduce((s, k) => s + activeData[k], 0)
                      return TYPE_KEYS.map(k => {
                        const t   = TYPE[k]
                        const val = activeData[k]
                        const pct = total > 0 ? (val / total) * 100 : 0
                        return (
                          <div key={k}>
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: 10, color: t.color, fontFamily: "'IBM Plex Mono', monospace", width: 14 }}>{t.symbol}</span>
                              <span style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono', monospace", flex: 1, letterSpacing: 0.5 }}>{t.label}</span>
                              <span style={{ fontSize: 9, color: t.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{val.toLocaleString()}</span>
                              <span style={{ fontSize: 8, color: MUTED, fontFamily: "'IBM Plex Mono', monospace", width: 26, textAlign: "right" }}>{Math.round(pct)}%</span>
                            </div>
                            <div style={{ height: 2, background: "#ffffff08", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                borderRadius: 2,
                                width: `${pct}%`,
                                background: t.color,
                                boxShadow: `0 0 6px ${t.color}88`,
                                transition: "width 0.4s ease",
                              }} />
                            </div>
                          </div>
                        )
                      })
                    })()}

                    {/* Total */}
                    <div className="flex justify-between pt-2" style={{ borderTop: "1px solid #ffffff06" }}>
                      <span style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>TOTAL ENTRIES</span>
                      <span style={{ fontSize: 9, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                        {TYPE_KEYS.reduce((s, k) => s + activeData[k], 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleAdd}
                    className="w-full rounded-full py-2 text-center"
                    style={{
                      background: addedYear === activeData.year ? `${CYAN}18` : "none",
                      border: `1px solid ${addedYear === activeData.year ? CYAN : `${CYAN}44`}`,
                      color: CYAN,
                      fontSize: 9,
                      letterSpacing: 1.5,
                      fontFamily: "'IBM Plex Mono', monospace",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {addedYear === activeData.year ? "✓ ADDED TO YOUR TIMELINE" : "+ ADD TO YOUR TIMELINE"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center" style={{ height: 160 }}>
                  <div style={{ textAlign: "center", color: MUTED, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 2.2, letterSpacing: 0.5 }}>
                    scrub or tap<br />any node to explore
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer legend ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 px-1">
            {TYPE_KEYS.map(k => (
              <div key={k} className="flex items-center gap-2">
                <div style={{ width: 18, height: 2, background: TYPE[k].color, borderRadius: 1, opacity: 0.7 }} />
                <span style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>{TYPE[k].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
