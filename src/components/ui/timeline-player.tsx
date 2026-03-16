"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { getEntityName, getPersonById } from "@/lib/mock-data"
import type { Claim, Person } from "@/types"

// ─── Slide definitions ────────────────────────────────────────────────────────

type IntroSlide  = { kind: "intro";  name: string; ridingSince?: number; yearsCount: number }
type StatSlide   = { kind: "stat";   icon: string; accent: string; count: number; label: string; sublabel: string; items: string[] }
type ClaimSlide  = { kind: "claim";  icon: string; accent: string; label: string; entityName: string; year?: string; predicate: string }
type OutroSlide  = { kind: "outro";  name: string }
type Slide = IntroSlide | StatSlide | ClaimSlide | OutroSlide

const PREDICATE_LABELS: Record<string, string> = {
  rode_at: "Rode at", owned_board: "Rode", competed_at: "Competed at",
  spectated_at: "Spectated", organized_at: "Organized", rode_with: "Rode with",
  sponsored_by: "Sponsored by", worked_at: "Worked at", part_of_team: "Part of", fan_of: "Fan of",
  coached_by: "Coached by", shot_by: "Shot by",
}

function buildSlides(person: Person, claims: Claim[], catalog: ReturnType<typeof useLineageStore.getState>["catalog"]): Slide[] {
  const slides: Slide[] = []
  const currentYear = new Date().getFullYear()
  const yearsCount = person.riding_since ? currentYear - person.riding_since : 0

  // 1. Intro
  slides.push({ kind: "intro", name: person.display_name, ridingSince: person.riding_since, yearsCount })

  // 2. Places
  const places = [...new Set(claims.filter(c => c.predicate === "rode_at" || c.predicate === "worked_at").map(c => c.object_id))]
  if (places.length > 0) {
    const names = places.map(id => catalog.places.find(p => p.id === id)?.name ?? getEntityName(id, "place")).filter(Boolean)
    slides.push({ kind: "stat", icon: "🏔", accent: "#2563eb", count: places.length, label: "mountain" + (places.length !== 1 ? "s" : ""), sublabel: "ridden", items: names.slice(0, 8) })
  }

  // 3. Boards
  const boards = [...new Set(claims.filter(c => c.predicate === "owned_board").map(c => c.object_id))]
  if (boards.length > 0) {
    const names = boards.map(id => {
      const b = catalog.boards.find(b => b.id === id)
      return b ? `${b.brand} ${b.model}` : getEntityName(id, "board")
    }).filter(Boolean)
    slides.push({ kind: "stat", icon: "🏂", accent: "#059669", count: boards.length, label: "board" + (boards.length !== 1 ? "s" : ""), sublabel: "ridden", items: names.slice(0, 8) })
  }

  // 4. Events
  const events = [...new Set(claims.filter(c => ["competed_at","spectated_at","organized_at"].includes(c.predicate)).map(c => c.object_id))]
  if (events.length > 0) {
    const names = events.map(id => catalog.events.find(e => e.id === id)?.name ?? getEntityName(id, "event")).filter(Boolean)
    slides.push({ kind: "stat", icon: "🏆", accent: "#d97706", count: events.length, label: "event" + (events.length !== 1 ? "s" : ""), sublabel: "attended", items: names.slice(0, 8) })
  }

  // 5. Connections
  const connections = [...new Set(claims.filter(c => ["rode_with","coached_by","shot_by"].includes(c.predicate)).map(c => c.object_id))]
  if (connections.length > 0) {
    const names = connections.map(id => {
      const p = catalog.people.find(p => p.id === id) ?? getPersonById(id)
      return p?.display_name ?? null
    }).filter(Boolean) as string[]
    slides.push({ kind: "stat", icon: "🤝", accent: "#7c3aed", count: connections.length, label: "rider" + (connections.length !== 1 ? "s" : ""), sublabel: "in your crew", items: names.slice(0, 8) })
  }

  // 6. Claim highlights — pick interesting ones (boards, places, events)
  const highlights = claims
    .filter(c => ["owned_board","rode_at","competed_at","worked_at"].includes(c.predicate))
    .slice(0, 5)

  for (const claim of highlights) {
    const entityName =
      claim.object_type === "board"
        ? (() => { const b = catalog.boards.find(b => b.id === claim.object_id); return b ? `${b.brand} ${b.model} '${String(b.model_year).slice(2)}` : getEntityName(claim.object_id, claim.object_type) })()
        : claim.object_type === "place"
          ? (catalog.places.find(p => p.id === claim.object_id)?.name ?? getEntityName(claim.object_id, claim.object_type))
          : (catalog.events.find(e => e.id === claim.object_id)?.name ?? getEntityName(claim.object_id, claim.object_type))

    const icons: Record<string, string> = { owned_board: "🏂", rode_at: "🏔", competed_at: "🏆", worked_at: "🔧" }
    const accents: Record<string, string> = { owned_board: "#059669", rode_at: "#2563eb", competed_at: "#d97706", worked_at: "#7c3aed" }

    slides.push({
      kind: "claim",
      icon: icons[claim.predicate] ?? "⬡",
      accent: accents[claim.predicate] ?? "#3b82f6",
      label: PREDICATE_LABELS[claim.predicate] ?? claim.predicate,
      entityName,
      year: claim.start_date?.slice(0, 4),
      predicate: claim.predicate,
    })
  }

  // 7. Outro
  slides.push({ kind: "outro", name: person.display_name })

  return slides
}

// ─── Count-up animation hook ──────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1000): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setVal(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, active, duration])
  return val
}

// ─── Individual slide renderers ───────────────────────────────────────────────

function IntroSlideView({ slide, active }: { slide: IntroSlide; active: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => { if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) } }, [active])
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-7xl mb-6">🏔</div>
        <div className="text-white/50 text-sm uppercase tracking-[0.3em] mb-3">Timeline</div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
          {slide.name}
        </h1>
        {slide.ridingSince && (
          <div className="text-white/60 text-lg">
            Riding since <span className="text-white font-bold">{slide.ridingSince}</span>
            {slide.yearsCount > 0 && <span className="ml-2 text-white/40">· {slide.yearsCount} years</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function StatSlideView({ slide, active }: { slide: StatSlide; active: boolean }) {
  const count = useCountUp(slide.count, active)
  const [show, setShow] = useState(false)
  useEffect(() => { if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) } }, [active])

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-6xl mb-5">{slide.icon}</div>
        <div className="text-8xl sm:text-9xl font-black text-white leading-none mb-2" style={{ color: slide.accent }}>
          {count}
        </div>
        <div className="text-2xl font-bold text-white mb-1">{slide.label}</div>
        <div className="text-white/50 text-sm mb-8">{slide.sublabel}</div>
        {slide.items.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {slide.items.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs font-medium text-white/80 border border-white/10"
                style={{ backgroundColor: `${slide.accent}22`, borderColor: `${slide.accent}44` }}
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

function ClaimSlideView({ slide, active }: { slide: ClaimSlide; active: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => { if (active) { setShow(false); setTimeout(() => setShow(true), 80) } else { setShow(false) } }, [active])

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
        <div className="text-5xl mb-5">{slide.icon}</div>
        <div className="text-white/40 text-xs uppercase tracking-widest mb-3">{slide.label}</div>
        <div className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4 max-w-xs">
          {slide.entityName}
        </div>
        {slide.year && (
          <div
            className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
            style={{ backgroundColor: `${slide.accent}33`, color: slide.accent }}
          >
            {slide.year}
          </div>
        )}
      </div>
    </div>
  )
}

function OutroSlideView({ slide, active, onClose }: { slide: OutroSlide; active: boolean; onClose: () => void }) {
  const [show, setShow] = useState(false)
  useEffect(() => { if (active) { setShow(false); setTimeout(() => setShow(true), 100) } else { setShow(false) } }, [active])

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-6xl mb-6">⬡</div>
        <div className="text-white/50 text-sm uppercase tracking-[0.3em] mb-3">Lineage</div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
          That&apos;s {slide.name}&apos;s<br />lineage.
        </h2>
        <p className="text-white/40 text-sm mb-10">Every board, mountain, and moment.</p>
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

const SLIDE_DURATION = 3500 // ms per slide

interface TimelinePlayerProps {
  person: Person
  claims: Claim[]
  onClose: () => void
}

export function TimelinePlayer({ person, claims, onClose }: TimelinePlayerProps) {
  const { catalog } = useLineageStore()
  const slides = buildSlides(person, claims, catalog)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOutro = slides[index]?.kind === "outro"

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

  // Auto-advance
  useEffect(() => {
    if (paused || isOutro) return
    timerRef.current = setInterval(next, SLIDE_DURATION)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [index, paused, isOutro, next])

  // Progress bar
  useEffect(() => {
    if (paused || isOutro) return
    setProgress(0)
    const start = Date.now()
    progressRef.current = setInterval(() => {
      setProgress(Math.min((Date.now() - start) / SLIDE_DURATION, 1))
    }, 30)
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [index, paused, isOutro])

  // Keyboard nav
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

  // Background color shifts per slide type
  const bgColor =
    slide.kind === "intro"  ? "#0a0f1e" :
    slide.kind === "outro"  ? "#0a0a0a" :
    slide.kind === "stat"   ? "#060a06" :
    slide.kind === "claim"  ? "#08060f" : "#0a0a0a"

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
              className="h-full rounded-full transition-none"
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
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
            {person.display_name[0]}
          </div>
          <span className="text-white/60 text-xs font-medium">{person.display_name}</span>
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
        {slide.kind === "intro"  && <IntroSlideView  slide={slide} active={true} />}
        {slide.kind === "stat"   && <StatSlideView   slide={slide} active={true} />}
        {slide.kind === "claim"  && <ClaimSlideView  slide={slide} active={true} />}
        {slide.kind === "outro"  && <OutroSlideView  slide={slide} active={true} onClose={onClose} />}
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
