"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { computeConnectionSummary } from "@/lib/connection-summary"
import type { Claim, Person } from "@/types"

// ─── Slide types ──────────────────────────────────────────────────────────────

type CompareIntroSlide = {
  kind: "compare-intro"
  nameA: string
  nameB: string
  sinceA?: number
  sinceB?: number
}

type CompareStrengthSlide = {
  kind: "compare-strength"
  strength: string
  score: number
  headline: string
}

type CompareSharedStatSlide = {
  kind: "compare-shared-stat"
  icon: string
  accent: string
  count: number
  label: string
  items: string[]
}

type CompareFactSlide = {
  kind: "compare-fact"
  icon: string
  accent: string
  label: string
  detail: string
}

type CompareVsSlide = {
  kind: "compare-vs"
  icon: string
  nameA: string
  nameB: string
  countA: number
  countB: number
  label: string
}

type CompareOutroSlide = {
  kind: "compare-outro"
  nameA: string
  nameB: string
  strength: string
}

type CompareSlide =
  | CompareIntroSlide
  | CompareStrengthSlide
  | CompareSharedStatSlide
  | CompareFactSlide
  | CompareVsSlide
  | CompareOutroSlide

// ─── Slide builder ────────────────────────────────────────────────────────────

const FACT_ICONS: Record<string, string> = {
  resort: "🏔", event: "🏆", board: "🏂", sponsor: "🎽", team: "🤝", rode_with: "👊",
}
const FACT_ACCENTS: Record<string, string> = {
  resort: "#2563eb", event: "#d97706", board: "#059669",
  sponsor: "#7c3aed", team: "#7c3aed", rode_with: "#ec4899",
}

function buildCompareSlides(
  personA: Person,
  personB: Person,
  claimsA: Claim[],
  claimsB: Claim[],
): CompareSlide[] {
  const slides: CompareSlide[] = []
  const summary = computeConnectionSummary(personA, personB, claimsA, claimsB)

  // 1. Intro
  slides.push({
    kind: "compare-intro",
    nameA: personA.display_name,
    nameB: personB.display_name,
    sinceA: personA.riding_since,
    sinceB: personB.riding_since,
  })

  // 2. Connection strength
  slides.push({
    kind: "compare-strength",
    strength: summary.strength,
    score: summary.score,
    headline: summary.headline,
  })

  // 3. Shared places
  const sharedPlaces = summary.facts.filter(f => f.type === "resort")
  if (sharedPlaces.length > 0) {
    slides.push({
      kind: "compare-shared-stat",
      icon: "🏔",
      accent: "#2563eb",
      count: sharedPlaces.length,
      label: "mountain" + (sharedPlaces.length !== 1 ? "s" : "") + " in common",
      items: sharedPlaces.map(f => f.label.replace("Both rode ", "")),
    })
  }

  // 4. Shared events
  const sharedEvents = summary.facts.filter(f => f.type === "event")
  if (sharedEvents.length > 0) {
    slides.push({
      kind: "compare-shared-stat",
      icon: "🏆",
      accent: "#d97706",
      count: sharedEvents.length,
      label: "event" + (sharedEvents.length !== 1 ? "s" : "") + " in both timelines",
      items: sharedEvents.map(f => f.label.replace("Both attended ", "")),
    })
  }

  // 5. Shared boards
  const sharedBoards = summary.facts.filter(f => f.type === "board")
  if (sharedBoards.length > 0) {
    slides.push({
      kind: "compare-shared-stat",
      icon: "🏂",
      accent: "#059669",
      count: sharedBoards.length,
      label: "board" + (sharedBoards.length !== 1 ? "s" : "") + " in common",
      items: sharedBoards.map(f => f.label.replace("Both rode ", "")),
    })
  }

  // 6. Shared sponsors / teams
  const sharedOrgs = summary.facts.filter(f => f.type === "sponsor" || f.type === "team")
  if (sharedOrgs.length > 0) {
    slides.push({
      kind: "compare-shared-stat",
      icon: "🎽",
      accent: "#7c3aed",
      count: sharedOrgs.length,
      label: "team" + (sharedOrgs.length !== 1 ? "s" : "") + " in common",
      items: sharedOrgs.map(f => f.label),
    })
  }

  // 7. Highlight each top shared fact (up to 5)
  for (const fact of summary.facts.slice(0, 5)) {
    slides.push({
      kind: "compare-fact",
      icon: FACT_ICONS[fact.type] ?? "⬡",
      accent: FACT_ACCENTS[fact.type] ?? "#3b82f6",
      label: fact.label,
      detail: fact.detail,
    })
  }

  // 8. Vs slides — mountains
  const placesA = [...new Set(claimsA.filter(c => c.predicate === "rode_at").map(c => c.object_id))]
  const placesB = [...new Set(claimsB.filter(c => c.predicate === "rode_at").map(c => c.object_id))]
  if (placesA.length > 0 || placesB.length > 0) {
    slides.push({
      kind: "compare-vs",
      icon: "🏔",
      nameA: personA.display_name.split(" ")[0],
      nameB: personB.display_name.split(" ")[0],
      countA: placesA.length,
      countB: placesB.length,
      label: "mountains ridden",
    })
  }

  // 9. Vs slides — boards
  const boardsA = [...new Set(claimsA.filter(c => c.predicate === "owned_board").map(c => c.object_id))]
  const boardsB = [...new Set(claimsB.filter(c => c.predicate === "owned_board").map(c => c.object_id))]
  if (boardsA.length > 0 || boardsB.length > 0) {
    slides.push({
      kind: "compare-vs",
      icon: "🏂",
      nameA: personA.display_name.split(" ")[0],
      nameB: personB.display_name.split(" ")[0],
      countA: boardsA.length,
      countB: boardsB.length,
      label: "boards ridden",
    })
  }

  // 10. Outro
  slides.push({
    kind: "compare-outro",
    nameA: personA.display_name,
    nameB: personB.display_name,
    strength: summary.strength,
  })

  return slides
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1000): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, active, duration])
  return val
}

// ─── Slide renderers ──────────────────────────────────────────────────────────

function CompareIntroView({ slide, active }: { slide: CompareIntroSlide; active: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) }
  }, [active])

  const initials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-white/40 text-xs uppercase tracking-[0.3em] mb-10">Timeline comparison</div>

        <div className="flex items-center justify-center gap-6 mb-8">
          {/* Rider A */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#1C1917]/30 border-2 border-[#1C1917]/50 flex items-center justify-center text-xl font-black text-foreground">
              {initials(slide.nameA)}
            </div>
            <div className="text-white font-bold text-sm">{slide.nameA.split(" ")[0]}</div>
            {slide.sinceA && <div className="text-white/40 text-xs">since {slide.sinceA}</div>}
          </div>

          <div className="text-white/25 text-5xl font-thin">×</div>

          {/* Rider B */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-600/30 border-2 border-emerald-500/50 flex items-center justify-center text-xl font-black text-emerald-300">
              {initials(slide.nameB)}
            </div>
            <div className="text-white font-bold text-sm">{slide.nameB.split(" ")[0]}</div>
            {slide.sinceB && <div className="text-white/40 text-xs">since {slide.sinceB}</div>}
          </div>
        </div>

        <div className="text-white/40 text-sm">Let&apos;s see how their timelines connect</div>
      </div>
    </div>
  )
}

function CompareStrengthView({ slide, active }: { slide: CompareStrengthSlide; active: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) }
  }, [active])

  const strengthColors: Record<string, string> = {
    strong: "#10b981", medium: "#3b82f6", light: "#f59e0b", none: "#6b7280",
  }
  const strengthDots: Record<string, string> = {
    strong: "●●●", medium: "●●○", light: "●○○", none: "○○○",
  }
  const accent = strengthColors[slide.strength] ?? "#6b7280"
  // Strip "Name + Name: " prefix from headline for the big display text
  const displayText = slide.headline.includes(": ")
    ? slide.headline.split(": ").slice(1).join(": ").trim()
    : slide.headline

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
        <div className="text-5xl mb-6">⬡</div>
        <div className="text-xs uppercase tracking-[0.3em] mb-4 font-bold" style={{ color: accent }}>
          {strengthDots[slide.strength] ?? "○○○"}&nbsp;&nbsp;{slide.strength} connection
        </div>
        <div className="text-2xl sm:text-3xl font-black text-white leading-snug max-w-xs mb-5">
          {displayText}
        </div>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {slide.score} connection pts
        </div>
      </div>
    </div>
  )
}

function CompareSharedStatView({ slide, active }: { slide: CompareSharedStatSlide; active: boolean }) {
  const count = useCountUp(slide.count, active)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) }
  }, [active])

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-6xl mb-5">{slide.icon}</div>
        <div className="text-8xl sm:text-9xl font-black leading-none mb-2" style={{ color: slide.accent }}>
          {count}
        </div>
        <div className="text-2xl font-bold text-white mb-1">{slide.label}</div>
        <div className="text-white/40 text-sm mb-8">shared history</div>
        {slide.items.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {slide.items.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs font-medium text-white/80"
                style={{ backgroundColor: `${slide.accent}22`, border: `1px solid ${slide.accent}44` }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CompareFactView({ slide, active }: { slide: CompareFactSlide; active: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) }
  }, [active])

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
        <div className="text-5xl mb-5">{slide.icon}</div>
        <div className="text-white/40 text-xs uppercase tracking-widest mb-4">Together</div>
        <div className="text-2xl sm:text-3xl font-black text-white leading-tight mb-5 max-w-xs">
          {slide.label}
        </div>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
          style={{ backgroundColor: `${slide.accent}33`, color: slide.accent }}
        >
          {slide.detail}
        </div>
      </div>
    </div>
  )
}

function CompareVsView({ slide, active }: { slide: CompareVsSlide; active: boolean }) {
  const countA = useCountUp(slide.countA, active)
  const countB = useCountUp(slide.countB, active)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) }
  }, [active])

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 w-full max-w-xs ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-4xl mb-8">{slide.icon}</div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-6xl sm:text-7xl font-black text-blue-400 leading-none mb-2">{countA}</div>
            <div className="text-white/50 text-xs uppercase tracking-wide">{slide.nameA}</div>
          </div>
          <div>
            <div className="text-6xl sm:text-7xl font-black text-emerald-400 leading-none mb-2">{countB}</div>
            <div className="text-white/50 text-xs uppercase tracking-wide">{slide.nameB}</div>
          </div>
        </div>
        <div className="text-white/30 text-sm mt-6">{slide.label}</div>
      </div>
    </div>
  )
}

function CompareOutroView({ slide, active, onClose }: { slide: CompareOutroSlide; active: boolean; onClose: () => void }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (active) { setShow(false); setTimeout(() => setShow(true), 100) } else { setShow(false) }
  }, [active])

  const strengthMsg: Record<string, string> = {
    strong: "A strong connection.",
    medium: "A real connection.",
    light: "The start of a connection.",
    none: "No overlaps yet — keep riding.",
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-6xl mb-6">⬡</div>
        <div className="text-white/50 text-sm uppercase tracking-[0.3em] mb-3">Lineage</div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
          {slide.nameA.split(" ")[0]}<span className="text-white/30 font-thin mx-3">×</span>{slide.nameB.split(" ")[0]}
        </h2>
        <p className="text-white/50 text-base mb-2">{strengthMsg[slide.strength] ?? ""}</p>
        <p className="text-white/25 text-sm mb-10">Every mountain, board, and moment.</p>
        <button
          onClick={onClose}
          className="px-8 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Main player ──────────────────────────────────────────────────────────────

const SLIDE_DURATION = 3500

export interface ComparePlayerProps {
  personA: Person
  personB: Person
  claimsA: Claim[]
  claimsB: Claim[]
  onClose: () => void
}

export function ComparePlayer({ personA, personB, claimsA, claimsB, onClose }: ComparePlayerProps) {
  useLineageStore() // keep store subscription alive
  const slides = buildCompareSlides(personA, personB, claimsA, claimsB)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOutro = slides[index]?.kind === "compare-outro"

  const goTo = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(i, slides.length - 1)))
    setProgress(0)
  }, [slides.length])

  const next = useCallback(() => {
    if (index < slides.length - 1) goTo(index + 1)
  }, [index, slides.length, goTo])

  const prev = useCallback(() => {
    if (index > 0) goTo(index - 1)
  }, [index, goTo])

  useEffect(() => {
    if (paused || isOutro) return
    timerRef.current = setInterval(next, SLIDE_DURATION)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [index, paused, isOutro, next])

  useEffect(() => {
    if (paused || isOutro) return
    setProgress(0)
    const start = Date.now()
    progressRef.current = setInterval(() => {
      setProgress(Math.min((Date.now() - start) / SLIDE_DURATION, 1))
    }, 30)
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [index, paused, isOutro])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next() }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev() }
      if (e.key === "Escape") onClose()
      if (e.key === "p" || e.key === "P") setPaused(p => !p)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [next, prev, onClose])

  const slide = slides[index]
  if (!slide) return null

  const bgColor =
    slide.kind === "compare-intro"       ? "#06081a" :
    slide.kind === "compare-strength"    ? "#0a060f" :
    slide.kind === "compare-shared-stat" ? "#060a06" :
    slide.kind === "compare-fact"        ? "#08060f" :
    slide.kind === "compare-vs"          ? "#060c14" :
    "#0a0a0a"

  const initials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: bgColor, transition: "background-color 0.8s ease" }}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-4 pt-4 pb-2 shrink-0">
        {slides.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full overflow-hidden cursor-pointer"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            onClick={() => goTo(i)}
          >
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: "rgba(255,255,255,0.85)",
                width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                transition: i === index ? "none" : "width 0.3s",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[#1C1917]/40 flex items-center justify-center text-[9px] font-bold text-foreground">
            {initials(personA.display_name)}
          </div>
          <span className="text-white/30 text-[10px]">×</span>
          <div className="w-5 h-5 rounded-full bg-emerald-600/40 flex items-center justify-center text-[9px] font-bold text-emerald-300">
            {initials(personB.display_name)}
          </div>
          <span className="text-white/40 text-[10px] font-medium ml-1">
            {personA.display_name.split(" ")[0]} × {personB.display_name.split(" ")[0]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(p => !p)}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/70 text-sm"
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? "▶" : "⏸"}
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/70 text-sm"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 relative overflow-hidden">
        {slide.kind === "compare-intro"       && <CompareIntroView      slide={slide} active={true} />}
        {slide.kind === "compare-strength"    && <CompareStrengthView   slide={slide} active={true} />}
        {slide.kind === "compare-shared-stat" && <CompareSharedStatView slide={slide} active={true} />}
        {slide.kind === "compare-fact"        && <CompareFactView       slide={slide} active={true} />}
        {slide.kind === "compare-vs"          && <CompareVsView         slide={slide} active={true} />}
        {slide.kind === "compare-outro"       && <CompareOutroView      slide={slide} active={true} onClose={onClose} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 pb-8 pt-3 shrink-0">
        <button
          onClick={prev}
          disabled={index === 0}
          className="px-5 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          ← Prev
        </button>
        <span className="text-white/30 text-xs">{index + 1} / {slides.length}</span>
        <button
          onClick={next}
          disabled={isOutro}
          className="px-5 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
