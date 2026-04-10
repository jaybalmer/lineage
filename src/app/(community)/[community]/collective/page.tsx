"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import type { Person, Event, Board, Org, Place } from "@/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type CollectiveType = "rider" | "event" | "board" | "brand" | "place"

interface DataPoint {
  year: number
  decade?: string
  rider: number
  event: number
  board: number
  brand: number
  place: number
  label: string
}

// ─── Type definitions (symbols + labels + hrefs) ──────────────────────────────

const TYPE: Record<CollectiveType, { symbol: string; label: string; href: string }> = {
  rider: { symbol: "●",  label: "Riders",  href: "/riders" },
  event: { symbol: "◈",  label: "Events",  href: "/events" },
  board: { symbol: "◆",  label: "Boards",  href: "/boards" },
  brand: { symbol: "◎",  label: "Brands",  href: "/brands" },
  place: { symbol: "◇",  label: "Places",  href: "/places" },
}

// Dark mode: vivid neon palette (original)
const TYPE_COLORS_DARK: Record<CollectiveType, string> = {
  rider: "#a29bfe",  // lavender
  event: "#00d4ff",  // cyan
  board: "#ff9f43",  // orange
  brand: "#55efc4",  // mint
  place: "#4fc3f7",  // sky
}

// Light mode: darker versions matching post-card border accents
const TYPE_COLORS_LIGHT: Record<CollectiveType, string> = {
  rider: "#6d28d9",  // violet-700
  event: "#b45309",  // amber-700
  board: "#047857",  // emerald-700
  brand: "#0f766e",  // teal-700
  place: "#1d4ed8",  // blue-700
}

const TYPE_KEYS: CollectiveType[] = ["rider", "event", "board", "brand", "place"]

// ─── Editorial labels per year / decade ──────────────────────────────────────

const YEAR_LABELS: Record<number, string> = {
  1979: "Before snowboarding",
  1980: "Winterstick & Snurfer",
  1981: "First snowboard shops",
  1982: "Before the scene",
  1983: "Burton Performer",
  1985: "First World Championships",
  1987: "Sims dominate",
  1988: "US Open grows",
  1990: "Resorts open up",
  1991: "Video era starts",
  1992: "US Open iconic",
  1993: "Forum founded",
  1994: "Baker Legendary peaks",
  1995: "Mack Dawg era",
  1996: "Video parts explode",
  1997: "246 drops",
  1998: "Olympics — Nagano",
  1999: "Peak Forum era",
  2000: "Destroyers released",
  2001: "Supernatural born",
  2002: "DCP era",
  2003: "Baldface opens",
  2004: "Scene globalises",
  2005: "Backcountry grows",
  2006: "Park vs BC debate",
  2007: "Film culture shifts",
  2008: "Print media fades",
  2009: "Stories overtake",
  2010: "Shaun White 3rd gold",
  2011: "Backcountry mainstream",
  2012: "BC renaissance",
  2013: "Split touring grows",
  2014: "Sochi Olympics",
  2015: "New generation rises",
  2016: "Instagram era",
  2017: "Digital storytelling",
  2018: "Olympic controversy",
  2019: "Ikon Pass changes access",
  2020: "COVID season",
  2021: "Record pow years",
  2022: "Community rebuilds",
  2023: "New generation",
}

const DECADE_LABELS: Record<number, string> = {
  1970: "Before snowboarding",
  1983: "The outlaw era",
  1990: "The golden era",
  2000: "Peak culture",
  2010: "The backcountry shift",
  2020: "Post-pandemic riding",
}

const CHART_YEARS = [
  1979,                                                          // pre-dataset baseline
  1980, 1981, 1982,
  1983, 1985, 1987, 1988, 1990, 1991, 1992, 1993, 1994, 1995,
  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005,
  2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
]

const CHART_DECADES = [1970, 1983, 1990, 2000, 2010, 2020]

// ─── Build chart data from catalog ───────────────────────────────────────────

type Catalog = {
  people: Person[]
  events: Event[]
  boards: Board[]
  orgs: Org[]
  places: Place[]
}

function buildYearData(catalog: Catalog, extraRidersByYear: Map<number, number>): DataPoint[] {
  return CHART_YEARS.map(year => {
    const catalogRiders = catalog.people.filter(p => p.riding_since && p.riding_since <= year).length
    const extraRiders   = [...extraRidersByYear.entries()]
      .filter(([ry]) => ry <= year)
      .reduce((s, [, n]) => s + n, 0)

    return {
      year,
      label: YEAR_LABELS[year] ?? `${year}`,
      rider: catalogRiders + extraRiders,
      event: catalog.events.filter(e => {
        const y = e.year ?? (e.start_date ? parseInt(e.start_date.slice(0, 4)) : NaN)
        return y === year
      }).length,
      board: catalog.boards.filter(b => b.model_year === year).length,
      brand: catalog.orgs.filter(o => o.founded_year && o.founded_year <= year).length,
      place: catalog.places.filter(p => p.first_snowboard_year && p.first_snowboard_year <= year).length,
    }
  })
}

function buildDecadeData(catalog: Catalog, extraRidersByYear: Map<number, number>): DataPoint[] {
  const decades: [number, number, string][] = [
    [1970, 1979, "1970s"],
    [1983, 1989, "1980s"],
    [1990, 1999, "1990s"],
    [2000, 2009, "2000s"],
    [2010, 2019, "2010s"],
    [2020, 2029, "2020s"],
  ]

  return decades.map(([start, end, label]) => {
    const pivotYear = start // use start year for cumulative counts
    const catalogRiders = catalog.people.filter(p => p.riding_since && p.riding_since <= pivotYear).length
    const extraRiders   = [...extraRidersByYear.entries()]
      .filter(([ry]) => ry <= pivotYear)
      .reduce((s, [, n]) => s + n, 0)

    return {
      year: start,
      decade: label,
      label: DECADE_LABELS[start] ?? label,
      rider: catalogRiders + extraRiders,
      event: catalog.events.filter(e => {
        const y = e.year ?? (e.start_date ? parseInt(e.start_date.slice(0, 4)) : NaN)
        return y >= start && y <= end
      }).length,
      board: catalog.boards.filter(b => b.model_year >= start && b.model_year <= end).length,
      brand: catalog.orgs.filter(o => o.founded_year && o.founded_year <= pivotYear).length,
      place: catalog.places.filter(p => p.first_snowboard_year && p.first_snowboard_year <= pivotYear).length,
    }
  })
}

// ─── Catmull-rom spline ───────────────────────────────────────────────────────

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
  const { catalog, sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId } = useLineageStore()

  const [mode, setMode]           = useState<"year" | "decade">("year")
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [scrubX, setScrubX]       = useState<number | null>(null)
  const [enabled, setEnabled]     = useState<Set<CollectiveType>>(new Set(TYPE_KEYS))
  const [myYears, setMyYears]     = useState<Set<number>>(new Set())
  const [drawn, setDrawn]         = useState(false)
  // Extra rider counts from Supabase profiles (by riding_since year)
  const [extraRidersByYear, setExtraRidersByYear] = useState<Map<number, number>>(new Map())
  // Theme detection for data-viz color switching
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  const svgRef    = useRef<SVGSVGElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Supplement rider count from real Supabase profiles ───────────────────
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, riding_since")
      .eq("privacy_level", "public")
      .then(({ data }) => {
        if (!data) return
        const byYear = new Map<number, number>()
        for (const p of data) {
          if (!p.riding_since) continue
          // Only count if NOT already in catalog mock data (avoid double-counting)
          const alreadyInCatalog = catalog.people.some(cp => cp.id === p.id)
          if (alreadyInCatalog) continue
          byYear.set(p.riding_since, (byYear.get(p.riding_since) ?? 0) + 1)
        }
        setExtraRidersByYear(byYear)
      })
  }, [catalog.people])

  // ── User's personal years (from their claims) ─────────────────────────────
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

  // ── Draw-in animation reset on mode change ────────────────────────────────
  useEffect(() => {
    setDrawn(false)
    const t = setTimeout(() => setDrawn(true), 60)
    return () => clearTimeout(t)
  }, [mode])

  useEffect(() => { setActiveIdx(null); setScrubX(null) }, [mode])

  // ── Compute chart data from catalog ──────────────────────────────────────
  const yearData   = useMemo(() => buildYearData(catalog, extraRidersByYear),   [catalog, extraRidersByYear])
  const decadeData = useMemo(() => buildDecadeData(catalog, extraRidersByYear), [catalog, extraRidersByYear])
  const data = mode === "decade" ? decadeData : yearData

  // ── Auto-select best year/decade when panel is empty ─────────────────────
  // Runs whenever activeIdx resets to null (page load + mode switch).
  // Priority: year/decade with most user claims → fall back to most riders overall.
  useEffect(() => {
    if (activeIdx !== null) return   // user already selected something
    if (data.length === 0) return

    let bestIdx = -1

    if (myYears.size > 0) {
      if (mode === "year") {
        // Count how many of the user's claim-years land on each chart year
        const counts = data.map(dp => (myYears.has(dp.year) ? 1 : 0))
        // For ties (most chart years have at most 1 match), prefer the most recent
        // year that has a match so the info panel shows something recent/relevant
        for (let i = data.length - 1; i >= 0; i--) {
          if (counts[i] > 0) { bestIdx = i; break }
        }
      } else {
        // Decade mode — find the decade range that contains the most user years
        const DECADE_RANGES: [number, number][] = [
          [1970, 1982], [1983, 1989], [1990, 1999],
          [2000, 2009], [2010, 2019], [2020, 2029],
        ]
        const counts = DECADE_RANGES.map(([start, end]) =>
          [...myYears].filter(y => y >= start && y <= end).length
        )
        const maxCount = Math.max(...counts)
        if (maxCount > 0) bestIdx = counts.indexOf(maxCount)
      }
    }

    // Fall back: most riders overall (most historically active point)
    if (bestIdx === -1) {
      const maxRiders = Math.max(...data.map(d => d.rider))
      bestIdx = data.findIndex(d => d.rider === maxRiders)
    }

    if (bestIdx >= 0) setActiveIdx(bestIdx)
  }, [data, mode, activeIdx, myYears])

  // ── Theme-aware colors ────────────────────────────────────────────────────
  const typeColors  = isDark ? TYPE_COLORS_DARK  : TYPE_COLORS_LIGHT
  const accentColor = "#B8862A"

  // ── Chart dimensions ──────────────────────────────────────────────────────
  const CHART_H = 160
  const PAD_T   = 14
  const PLOT_H  = CHART_H - PAD_T
  const NODE_Y  = CHART_H + 26
  const TOTAL_H = NODE_Y + 42
  const STEP    = mode === "decade" ? 80 : 24
  const PAD_L   = 24
  const CHART_W = PAD_L * 2 + (data.length - 1) * STEP

  const xOf    = (i: number) => PAD_L + i * STEP
  const maxVal = useMemo(
    () => Math.max(1, ...data.flatMap(d => TYPE_KEYS.map(k => d[k]))),
    [data]
  )
  const yOf    = (v: number) => PAD_T + PLOT_H - (v / maxVal) * PLOT_H

  const linePoints = useMemo(() => {
    const out = {} as Record<CollectiveType, Point[]>
    TYPE_KEYS.forEach(k => { out[k] = data.map((d, i) => ({ x: xOf(i), y: yOf(d[k]) })) })
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, maxVal, mode])

  const activeData = activeIdx !== null ? (data[activeIdx] ?? null) : null

  // ── Scrub interaction ─────────────────────────────────────────────────────
  const handleSvgInteraction = useCallback((clientX: number) => {
    if (!svgRef.current || !scrollRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = clientX - rect.left + scrollRef.current.scrollLeft
    let closest = 0, minDist = Infinity
    data.forEach((_, i) => {
      const dist = Math.abs(xOf(i) - relX)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    if (minDist < STEP * 0.75) { setActiveIdx(closest); setScrubX(xOf(closest)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, STEP, mode])

  const onMouseMove  = (e: React.MouseEvent)  => { if (e.buttons === 1) handleSvgInteraction(e.clientX) }
  const onClick      = (e: React.MouseEvent)  => handleSvgInteraction(e.clientX)
  const onTouchStart = (e: React.TouchEvent)  => { e.preventDefault(); handleSvgInteraction(e.touches[0].clientX) }
  const onTouchMove  = (e: React.TouchEvent)  => { e.preventDefault(); handleSvgInteraction(e.touches[0].clientX) }

  // ── Type filter toggle ────────────────────────────────────────────────────
  const toggleType = (k: CollectiveType) => {
    setEnabled(prev => {
      const next = new Set(prev)
      if (next.has(k)) { if (next.size > 1) next.delete(k) } else next.add(k)
      return next
    })
  }

  const showLabel = (i: number) => mode === "decade" || i % 4 === 0 || i === activeIdx

  // ── Link for info panel type row ──────────────────────────────────────────
  // Decade mode: extract the decade prefix from the label (e.g. "1990s" → "199")
  // Year mode: pass the exact year (e.g. 1994)
  const yearParam = activeData
    ? `?year=${activeData.decade
        ? activeData.decade.replace("s", "").slice(0, 3) // "1990s" → "199"
        : activeData.year}`
    : ""

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=IBM+Plex+Mono:wght@400;700&display=swap" />

      <style>{`
        .ct-page { font-family: 'IBM Plex Mono', monospace; }
        .ct-page * { box-sizing: border-box; }
        .ct-page ::-webkit-scrollbar { display: none; }
        @keyframes ct-fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ct-scrubIn { from { opacity:0; } to { opacity:1; } }
        @keyframes ct-drawLine { from { stroke-dashoffset:1; } to { stroke-dashoffset:0; } }
        .ct-line-draw { stroke-dasharray:1; animation: ct-drawLine 0.8s ease forwards; }
        .ct-info-panel { animation: ct-fadeUp 0.2s ease; }
        .ct-scrubber { animation: ct-scrubIn 0.1s ease; }
      `}</style>

      <div className="ct-page min-h-screen bg-background text-foreground">
        <Nav />

        <div className="max-w-3xl mx-auto px-4 pt-6 pb-16">

          {/* ── Page header ──────────────────────────────────────────────── */}
          <div className="mb-6 bg-[#1C1917] rounded-lg px-6 py-5">
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 3, lineHeight: 1, marginBottom: 4 }}
              className="text-[#F5F2EE]">
              COLLECTIVE<span className="inline-block rounded-full align-middle" style={{ width: "0.3em", height: "0.3em", marginBottom: "0.15em", background: accentColor }} />
            </div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#78716C" }}>
              // snowboarding · 1983–present
            </div>
          </div>

          {/* ── Controls row ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            {/* Type filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {TYPE_KEYS.map(k => {
                const t  = TYPE[k]
                const on = enabled.has(k)
                return (
                  <button
                    key={k}
                    onClick={() => toggleType(k)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      background:   on ? `${typeColors[k]}18` : "transparent",
                      borderColor:  on ? `${typeColors[k]}80` : "var(--muted)",
                      color:        on ? typeColors[k]         : "var(--muted)",
                      opacity:      on ? 1 : 0.6,
                    }}
                  >
                    <span>{t.symbol}</span>
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* 1Y / 10Y toggle */}
            <div className="flex rounded-full overflow-hidden border border-border-default bg-surface-2">
              {(["year", "decade"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="transition-all"
                  style={{
                    background: mode === m ? "var(--surface-active)" : "transparent",
                    border: "none",
                    color: mode === m ? "var(--foreground)" : "var(--muted)",
                    fontSize: 10,
                    padding: "5px 14px",
                    cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: 1,
                    fontWeight: mode === m ? 700 : 400,
                  }}
                >
                  {m === "year" ? "1Y" : "10Y"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Chart card ───────────────────────────────────────────────── */}
          <div className="bg-surface border border-border-default rounded-2xl overflow-hidden">

            {/* Scrollable SVG */}
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
                  {TYPE_KEYS.map(k => (
                    <linearGradient key={k} id={`ct-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={typeColors[k]} stopOpacity="0.14" />
                      <stop offset="100%" stopColor={typeColors[k]} stopOpacity="0.00" />
                    </linearGradient>
                  ))}
                  <linearGradient id="ct-scrubGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="currentColor" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0"   />
                  </linearGradient>
                  <filter id="ct-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="ct-cyan-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map(f => (
                  <line key={f}
                    x1={0} y1={PAD_T + PLOT_H * (1 - f)}
                    x2={CHART_W} y2={PAD_T + PLOT_H * (1 - f)}
                    stroke="currentColor" strokeOpacity={f === 1.0 ? 0.03 : 0.04}
                    strokeWidth="1" strokeDasharray={f === 1.0 ? undefined : "2 5"}
                  />
                ))}

                {/* Area fills */}
                {TYPE_KEYS.map(k => (
                  <path key={`area-${k}`}
                    d={areaPath(linePoints[k], CHART_H)}
                    fill={`url(#ct-grad-${k})`}
                    style={{ opacity: enabled.has(k) ? 1 : 0, transition: "opacity 0.3s" }}
                  />
                ))}

                {/* Idle lines */}
                {TYPE_KEYS.map((k, ki) => (
                  <path key={`line-idle-${k}`}
                    d={catmullRomPath(linePoints[k])}
                    fill="none" stroke={typeColors[k]}
                    strokeWidth={activeData ? 1.0 : 1.5}
                    strokeOpacity={activeData ? 0.22 : 0.7}
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

                {/* Bright active lines (when scrubbing) */}
                {activeData && TYPE_KEYS.map(k => (
                  <path key={`line-active-${k}`}
                    d={catmullRomPath(linePoints[k])}
                    fill="none" stroke={typeColors[k]}
                    strokeWidth="2" strokeOpacity="1"
                    strokeLinecap="round" filter="url(#ct-glow)"
                    style={{ opacity: enabled.has(k) ? 1 : 0, transition: "opacity 0.3s" }}
                  />
                ))}

                {/* Small data nodes */}
                {TYPE_KEYS.map(k =>
                  linePoints[k].map((pt, i) => (
                    <circle key={`node-${k}-${i}`}
                      cx={pt.x} cy={pt.y} r={1.8}
                      fill="var(--surface)" stroke={typeColors[k]}
                      strokeWidth="1" strokeOpacity="0.4"
                      style={{ opacity: enabled.has(k) ? 1 : 0, transition: "opacity 0.3s" }}
                    />
                  ))
                )}

                {/* Scrubber crosshair */}
                {scrubX !== null && (
                  <g className="ct-scrubber">
                    <line x1={scrubX} y1={4} x2={scrubX} y2={NODE_Y - 8}
                      stroke="url(#ct-scrubGrad)" strokeWidth="1" />
                    {activeIdx !== null && TYPE_KEYS.map(k => {
                      if (!enabled.has(k)) return null
                      const pt = linePoints[k][activeIdx]
                      if (!pt) return null
                      return (
                        <g key={`scrub-node-${k}`} filter="url(#ct-glow)">
                          <circle cx={pt.x} cy={pt.y} r={6}   fill="var(--surface)" stroke={typeColors[k]} strokeWidth="1.5" />
                          <circle cx={pt.x} cy={pt.y} r={2.5} fill={typeColors[k]} />
                        </g>
                      )
                    })}
                    {activeData && (
                      <text x={scrubX} y={10} textAnchor="middle" fontSize="8"
                        fill="var(--foreground)" fillOpacity="0.5"
                        fontFamily="'IBM Plex Mono', monospace">
                        {activeData.decade ?? activeData.year}
                      </text>
                    )}
                  </g>
                )}

                {/* ── Spine ──────────────────────────────────────────────── */}
                <line x1={PAD_L - 12} y1={NODE_Y} x2={CHART_W - PAD_L + 12} y2={NODE_Y}
                  stroke="var(--border)" strokeWidth="1" />

                {data.map((d, i) => {
                  const x     = xOf(i)
                  const isMe  = myYears.has(d.year)
                  const isAct = activeIdx === i
                  const lbl   = mode === "decade" ? d.decade! : `'${String(d.year).slice(2)}`

                  return (
                    <g key={`spine-${i}`} style={{ cursor: "pointer" }}
                      onClick={e => {
                        e.stopPropagation()
                        if (isAct) { setActiveIdx(null); setScrubX(null) }
                        else { setActiveIdx(i); setScrubX(x) }
                      }}
                    >
                      <line x1={x} y1={NODE_Y - 5} x2={x} y2={NODE_Y + 5}
                        stroke={isAct ? "var(--foreground)" : "var(--border)"} strokeWidth="1" />

                      {isMe ? (
                        <rect x={x - 5} y={NODE_Y - 5} width={10} height={10}
                          transform={`rotate(45,${x},${NODE_Y})`}
                          fill={isAct ? accentColor : "var(--surface)"}
                          stroke={accentColor} strokeWidth={isAct ? 1.5 : 1}
                          filter={isAct ? "url(#ct-cyan-glow)" : undefined}
                          style={{ transition: "all 0.2s" }}
                        />
                      ) : (
                        <circle cx={x} cy={NODE_Y} r={isAct ? 4 : 2.5}
                          fill={isAct ? "var(--foreground)" : "var(--surface)"}
                          stroke={isAct ? "var(--foreground)" : "var(--muted)"}
                          strokeWidth="1"
                          style={{ transition: "all 0.2s" }}
                        />
                      )}

                      {showLabel(i) && (
                        <text x={x} y={NODE_Y + 18} textAnchor="middle"
                          fontSize={mode === "decade" ? 9 : 7.5}
                          fill={isAct ? "var(--foreground)" : "var(--muted)"}
                          fontFamily="'IBM Plex Mono', monospace"
                          style={{ transition: "fill 0.2s" }}
                        >
                          {lbl}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Spine legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border-default">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <rect x="1" y="1" width="10" height="10" transform="rotate(45,6,6)"
                    fill="none" stroke={accentColor} strokeWidth="1" />
                </svg>
                <span className="text-muted" style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace" }}>your years</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--muted)" strokeWidth="1" />
                </svg>
                <span className="text-muted" style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace" }}>community</span>
              </div>
              <span className="text-muted ml-auto" style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
                ← drag or tap to scrub
              </span>
            </div>

            {/* ── Info panel ────────────────────────────────────────────── */}
            <div className="border-t border-border-default" style={{ minHeight: 180 }}>
              {activeData ? (
                <div key={`${activeData.year}-${mode}`} className="ct-info-panel px-5 py-4">

                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: accentColor, letterSpacing: 2, marginBottom: 5 }}>
                        {activeData.decade ?? activeData.year}
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}
                        className="text-foreground">
                        {activeData.label}
                      </div>
                    </div>
                    {myYears.has(activeData.year) && (
                      <div className="shrink-0 mt-1 px-2 py-1 rounded-full flex items-center gap-1"
                        style={{ background: "var(--surface-2)", border: `1px solid ${accentColor}44`, fontSize: 9, color: accentColor, fontFamily: "'IBM Plex Mono', monospace" }}>
                        ◆ yours
                      </div>
                    )}
                  </div>

                  {/* Type breakdown — each row is a link */}
                  {(() => {
                    const total = TYPE_KEYS.reduce((s, k) => s + activeData[k], 0)
                    return (
                      <div className="space-y-2.5 mb-4">
                        {TYPE_KEYS.map(k => {
                          const t   = TYPE[k]
                          const val = activeData[k]
                          const pct = total > 0 ? (val / total) * 100 : 0
                          return (
                            <Link
                              key={k}
                              href={`${t.href}${yearParam}`}
                              className="block group rounded-lg transition-colors"
                              style={{ padding: "4px 6px", margin: "-4px -6px" }}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span style={{ fontSize: 10, color: typeColors[k], fontFamily: "'IBM Plex Mono', monospace", width: 14 }}>{t.symbol}</span>
                                <span className="text-foreground flex-1" style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 0.5 }}>
                                  {t.label}
                                </span>
                                <span style={{ fontSize: 9, color: typeColors[k], fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                                  {val.toLocaleString()}
                                </span>
                                <span className="text-muted" style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", width: 28, textAlign: "right" }}>
                                  {Math.round(pct)}%
                                </span>
                                <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 9 }}>→</span>
                              </div>
                              <div className="bg-surface-2 rounded overflow-hidden" style={{ height: 2 }}>
                                <div style={{
                                  height: "100%", borderRadius: 2,
                                  width: `${pct}%`, background: typeColors[k],
                                  boxShadow: `0 0 5px ${typeColors[k]}66`,
                                  transition: "width 0.4s ease",
                                }} />
                              </div>
                            </Link>
                          )
                        })}

                        {/* Total */}
                        <div className="flex justify-between pt-2 border-t border-border-default">
                          <span className="text-muted" style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>TOTAL</span>
                          <span className="text-foreground" style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                            {total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                </div>
              ) : (
                <div className="flex items-center justify-center" style={{ height: 180 }}>
                  <div className="text-center text-muted" style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 2.2, letterSpacing: 0.5 }}>
                    scrub or tap<br />any node to explore
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer legend ────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 px-1">
            {TYPE_KEYS.map(k => (
              <div key={k} className="flex items-center gap-2">
                <div style={{ width: 18, height: 2, background: typeColors[k], borderRadius: 1, opacity: 0.8 }} />
                <span className="text-muted" style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {TYPE[k].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
