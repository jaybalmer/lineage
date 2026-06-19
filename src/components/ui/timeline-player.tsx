"use client"

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { getEntityName, getPersonById } from "@/lib/mock-data"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { BrandMark } from "@/components/ui/brand-mark"
import type { Claim, Person, Community } from "@/types"

// ─── Slide definitions ─────────────────────────────────────────────────────────

type IntroSlide  = { kind: "intro";  name: string; ridingSince?: number; yearsCount: number; eyebrow?: string }
type StatSlide   = { kind: "stat";   icon: string; accent: string; count: number; label: string; sublabel: string; items: string[] }
type ClaimSlide  = { kind: "claim";  icon: string; accent: string; label: string; entityName: string; year?: string; predicate: string }
type OutroSlide  = { kind: "outro";  name: string; headline?: string; subtext?: string; cta?: { label: string; onClick: () => void } }
type Slide = IntroSlide | StatSlide | ClaimSlide | OutroSlide

const PREDICATE_LABELS: Record<string, string> = {
  rode_at: "Rode at", owned_board: "Rode", competed_at: "Competed at",
  spectated_at: "Was at", organized_at: "Organized", rode_with: "Rode with",
  sponsored_by: "Sponsored by", worked_at: "Worked at", part_of_team: "Part of", fan_of: "Fan of",
  coached_by: "Coached by", shot_by: "Shot by",
}

function buildSlides(person: Person, claims: Claim[], catalog: ReturnType<typeof useLineageStore.getState>["catalog"]): Slide[] {
  const slides: Slide[] = []
  const currentYear = new Date().getFullYear()
  const yearsCount = person.riding_since ? currentYear - person.riding_since : 0

  slides.push({ kind: "intro", name: person.display_name, ridingSince: person.riding_since, yearsCount })

  const places = [...new Set(claims.filter(c => c.predicate === "rode_at" || c.predicate === "worked_at").map(c => c.object_id))]
  if (places.length > 0) {
    const names = places.map(id => catalog.places.find(p => p.id === id)?.name ?? getEntityName(id, "place")).filter(Boolean)
    slides.push({ kind: "stat", icon: "🏔", accent: "#0D9488", count: places.length, label: "mountain" + (places.length !== 1 ? "s" : ""), sublabel: "ridden", items: names.slice(0, 8) })
  }

  const boards = [...new Set(claims.filter(c => c.predicate === "owned_board").map(c => c.object_id))]
  if (boards.length > 0) {
    const names = boards.map(id => {
      const b = catalog.boards.find(b => b.id === id)
      return b ? `${b.brand} ${b.model}` : getEntityName(id, "board")
    }).filter(Boolean)
    slides.push({ kind: "stat", icon: "🏂", accent: "#10b981", count: boards.length, label: "board" + (boards.length !== 1 ? "s" : ""), sublabel: "in the quiver", items: names.slice(0, 8) })
  }

  const events = [...new Set(claims.filter(c => ["competed_at","spectated_at","organized_at"].includes(c.predicate)).map(c => c.object_id))]
  if (events.length > 0) {
    const names = events.map(id => catalog.events.find(e => e.id === id)?.name ?? getEntityName(id, "event")).filter(Boolean)
    slides.push({ kind: "stat", icon: "🏆", accent: "#f59e0b", count: events.length, label: "event" + (events.length !== 1 ? "s" : ""), sublabel: "attended", items: names.slice(0, 8) })
  }

  const connections = [...new Set(claims.filter(c => ["rode_with","coached_by","shot_by"].includes(c.predicate)).map(c => c.object_id))]
  if (connections.length > 0) {
    const names = connections.map(id => {
      const p = catalog.people.find(p => p.id === id) ?? getPersonById(id)
      return p?.display_name ?? null
    }).filter(Boolean) as string[]
    slides.push({ kind: "stat", icon: "🤝", accent: "#a78bfa", count: connections.length, label: "rider" + (connections.length !== 1 ? "s" : ""), sublabel: "in your crew", items: names.slice(0, 8) })
  }

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
    const accents: Record<string, string> = { owned_board: "#10b981", rode_at: "#0D9488", competed_at: "#f59e0b", worked_at: "#a78bfa" }

    slides.push({
      kind: "claim",
      icon: icons[claim.predicate] ?? "•",
      accent: accents[claim.predicate] ?? "#3b82f6",
      label: PREDICATE_LABELS[claim.predicate] ?? claim.predicate,
      entityName,
      year: claim.start_date?.slice(0, 4),
      predicate: claim.predicate,
    })
  }

  slides.push({ kind: "outro", name: person.display_name })
  return slides
}

// ─── Community slides (Phase 2) ────────────────────────────────────────────────

const EVENT_PREDICATES = new Set(["competed_at", "spectated_at", "organized_at"])

/**
 * Build the community-level slide deck: an intro, one stat slide per node type
 * (skipping empties), one or two most-attended-event highlights, and an outro
 * with a Start Your Timeline CTA. Reuses the same Slide kinds as personal play,
 * so it renders through the shared TimelinePlayerShell unchanged.
 */
export function buildCommunitySlides(
  community: Community,
  catalog: ReturnType<typeof useLineageStore.getState>["catalog"],
  onStart?: () => void,
): Slide[] {
  const slides: Slide[] = []
  const name = community.name

  // Founding year — the earliest dated signal across riders, events, and places.
  const years: number[] = []
  for (const p of catalog.people) if (p.riding_since && p.riding_since > 1900) years.push(p.riding_since)
  for (const e of catalog.events) if (e.year && e.year > 1900) years.push(e.year)
  for (const pl of catalog.places) if (pl.first_snowboard_year && pl.first_snowboard_year > 1900) years.push(pl.first_snowboard_year)
  const foundingYear = years.length ? Math.min(...years) : undefined
  const yearsCount = foundingYear ? new Date().getFullYear() - foundingYear : 0

  slides.push({ kind: "intro", name, eyebrow: "The Linestry", ridingSince: foundingYear, yearsCount })

  // Stat slides — one per node type, skipping any that are empty. Notable
  // riders surface first in the rider sample.
  const sample = (names: string[]) => names.filter(Boolean).slice(0, 8)
  const notableFirst = [...catalog.people].sort((a, b) => Number(!!b.is_notable) - Number(!!a.is_notable))

  if (catalog.people.length > 0)
    slides.push({ kind: "stat", icon: "🤝", accent: "#a78bfa", count: catalog.people.length, label: "rider" + (catalog.people.length !== 1 ? "s" : ""), sublabel: "in the community", items: sample(notableFirst.map((p) => p.display_name)) })
  if (catalog.places.length > 0)
    slides.push({ kind: "stat", icon: "🏔", accent: "#0D9488", count: catalog.places.length, label: "place" + (catalog.places.length !== 1 ? "s" : ""), sublabel: "on the map", items: sample(catalog.places.map((p) => p.name)) })
  if (catalog.events.length > 0)
    slides.push({ kind: "stat", icon: "🏆", accent: "#f59e0b", count: catalog.events.length, label: "event" + (catalog.events.length !== 1 ? "s" : ""), sublabel: "logged", items: sample(catalog.events.map((e) => e.name)) })
  if (catalog.boards.length > 0)
    slides.push({ kind: "stat", icon: "🏂", accent: "#10b981", count: catalog.boards.length, label: "board" + (catalog.boards.length !== 1 ? "s" : ""), sublabel: "in the quiver", items: sample(catalog.boards.map((b) => `${b.brand} ${b.model}`)) })
  if (catalog.orgs.length > 0)
    slides.push({ kind: "stat", icon: "🏢", accent: "#06b6d4", count: catalog.orgs.length, label: "brand" + (catalog.orgs.length !== 1 ? "s" : ""), sublabel: "represented", items: sample(catalog.orgs.map((o) => o.name)) })

  // Highlight — most-attended events by distinct rider count (Phase 2 fact 10).
  const attend = new Map<string, Set<string>>()
  for (const c of catalog.claims) {
    if (!EVENT_PREDICATES.has(c.predicate)) continue
    let s = attend.get(c.object_id)
    if (!s) { s = new Set(); attend.set(c.object_id, s) }
    s.add(c.subject_id)
  }
  const topEvents = catalog.events
    .map((e) => ({ e, count: attend.get(e.id)?.size ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
  for (const { e } of topEvents) {
    slides.push({
      kind: "claim",
      icon: "🏆",
      accent: "#f59e0b",
      label: "Most attended",
      entityName: e.name,
      year: e.year ? String(e.year) : e.start_date?.slice(0, 4),
      predicate: "competed_at",
    })
  }

  slides.push({
    kind: "outro",
    name,
    headline: `That's the ${name.toLowerCase()} linestry.`,
    subtext: "Every rider, mountain, and moment.",
    cta: onStart ? { label: "Start Your Timeline", onClick: onStart } : undefined,
  })

  return slides
}

// ─── Background gradients ──────────────────────────────────────────────────────

function slideBg(slide: Slide): string {
  if (slide.kind === "intro")
    return "radial-gradient(ellipse at 25% 55%, #1e2a7a 0%, #0d1245 40%, #060818 100%)"
  if (slide.kind === "outro")
    return "radial-gradient(ellipse at 60% 40%, #1a0a2e 0%, #06020f 60%, #020104 100%)"
  if (slide.kind === "stat") {
    const map: Record<string, string> = {
      "#0D9488": "radial-gradient(ellipse at 15% 65%, #07403a 0%, #02130f 55%, #010403 100%)",
      "#10b981": "radial-gradient(ellipse at 80% 25%, #053d1a 0%, #011408 55%, #000301 100%)",
      "#f59e0b": "radial-gradient(ellipse at 50% 75%, #3d1f00 0%, #150900 55%, #040200 100%)",
      "#a78bfa": "radial-gradient(ellipse at 30% 40%, #1e0b4a 0%, #09041e 55%, #020108 100%)",
      "#06b6d4": "radial-gradient(ellipse at 70% 30%, #073a45 0%, #02141a 55%, #00060a 100%)",
    }
    return map[slide.accent] ?? "radial-gradient(ellipse at 50% 50%, #0d1020 0%, #040508 100%)"
  }
  if (slide.kind === "claim") {
    return `radial-gradient(ellipse at 35% 60%, ${slide.accent}28 0%, #050408 60%, #020204 100%)`
  }
  return "#050408"
}

// ─── Web Audio ambient soundtrack ─────────────────────────────────────────────

function useAmbientAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      if (gainRef.current && ctxRef.current) {
        gainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.4)
      }
      return
    }

    stoppedRef.current = false
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    ctxRef.current = ctx

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    gainRef.current = master
    master.gain.setTargetAtTime(0.22, ctx.currentTime, 2)

    // Reverb via convolver
    const reverbLen = ctx.sampleRate * 2.5
    const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = reverbBuf.getChannelData(ch)
      for (let i = 0; i < reverbLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5)
    }
    const reverb = ctx.createConvolver()
    reverb.buffer = reverbBuf
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = 0.35
    reverb.connect(reverbGain)
    reverbGain.connect(master)

    // Pad synth — play a chord as layered sine oscillators
    const playChord = (freqs: number[], startTime: number, dur: number, vol = 0.12) => {
      if (stoppedRef.current) return
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = i === 0 ? "sawtooth" : "sine"
        osc.frequency.value = freq
        // Slight detune for warmth
        osc.detune.value = (Math.random() - 0.5) * 8
        g.gain.setValueAtTime(0, startTime)
        g.gain.linearRampToValueAtTime(vol, startTime + 0.8)
        g.gain.setTargetAtTime(0, startTime + dur - 0.8, 0.5)
        osc.connect(g)
        g.connect(master)
        g.connect(reverb)
        osc.start(startTime)
        osc.stop(startTime + dur + 0.5)
      })
    }

    // Bass note
    const playBass = (freq: number, startTime: number, dur: number) => {
      if (stoppedRef.current) return
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      osc.type = "sine"
      osc.frequency.value = freq
      filter.type = "lowpass"
      filter.frequency.value = 220
      g.gain.setValueAtTime(0, startTime)
      g.gain.linearRampToValueAtTime(0.28, startTime + 0.2)
      g.gain.setTargetAtTime(0, startTime + dur - 0.3, 0.4)
      osc.connect(filter)
      filter.connect(g)
      g.connect(master)
      osc.start(startTime)
      osc.stop(startTime + dur + 0.2)
    }

    // Chord progression in A minor: Am7 → Fmaj7 → Cmaj7 → Em7
    // Each bar = 4 beats at 72 BPM = 3.33s
    const BPM = 72
    const BAR = (60 / BPM) * 4

    const progression: Array<{ pad: number[]; bass: number }> = [
      { pad: [220, 261.63, 329.63, 392],        bass: 55   }, // Am7   (A E2)
      { pad: [174.61, 220, 261.63, 329.63],      bass: 43.65 }, // Fmaj7 (F1)
      { pad: [261.63, 329.63, 392, 523.25],      bass: 65.41 }, // Cmaj7 (C2)
      { pad: [164.81, 196, 246.94, 329.63],      bass: 41.20 }, // Em7   (E1)
    ]

    const intervals: ReturnType<typeof setInterval>[] = []

    const scheduleLoop = (startTime: number) => {
      progression.forEach((chord, i) => {
        const t = startTime + i * BAR
        playChord(chord.pad, t, BAR * 0.97)
        playBass(chord.bass, t, BAR * 0.97)
      })
    }

    // Start first loop immediately, then repeat
    scheduleLoop(ctx.currentTime + 0.1)
    const loopInterval = setInterval(() => {
      if (stoppedRef.current) return
      scheduleLoop(ctx.currentTime + 0.1)
    }, BAR * progression.length * 1000)
    intervals.push(loopInterval)

    return () => {
      stoppedRef.current = true
      intervals.forEach(clearInterval)
      if (gainRef.current && ctx) {
        gainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.5)
      }
      setTimeout(() => { try { ctx.close() } catch { /* ignore */ } }, 1200)
    }
  }, [enabled])
}

// ─── Floating particles ────────────────────────────────────────────────────────

type Particle = { id: number; x: number; y: number; size: number; dur: number; delay: number; opacity: number }

function Particles({ color = "white", count = 22 }: { color?: string; count?: number }) {
  const particles: Particle[] = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (i * 97 + 13) % 100,
      y: (i * 67 + 31) % 100,
      size: 1.5 + (i % 4) * 0.8,
      dur: 7 + (i % 5) * 2,
      delay: -(i * 1.3),
      opacity: 0.15 + (i % 5) * 0.06,
    }))
  , [count])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full tp-float"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: color,
            opacity: p.opacity,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Slide animation hooks ───────────────────────────────────────────────────────

// Replays a slide's entrance transition: `show` starts false and flips true after
// `delay`ms so the CSS transition runs. The reset on (de)activation happens during
// render, not via a synchronous setState in the effect (react-hooks/set-state-in-effect);
// the effect only schedules the delayed reveal.
function useSlideEntrance(active: boolean, delay: number): boolean {
  const [show, setShow] = useState(false)
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    setShow(false)
  }
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [active, delay])
  return show
}

function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [val, setVal] = useState(0)
  const [wasActive, setWasActive] = useState(active)
  // Reset to zero on (de)activation during render rather than with a synchronous
  // setState in the effect (react-hooks/set-state-in-effect). The rAF tick below
  // sets state from an async callback, which is allowed.
  if (active !== wasActive) {
    setWasActive(active)
    setVal(0)
  }
  useEffect(() => {
    if (!active) return
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

// ─── Slide renderers ───────────────────────────────────────────────────────────

function IntroSlideView({ slide, active }: { slide: IntroSlide; active: boolean }) {
  const show = useSlideEntrance(active, 60)

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <Particles color="rgba(100,140,255,0.7)" count={28} />
      {/* Large glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full tp-breathe"
        style={{ background: "radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
      <div
        className="relative z-10"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0) scale(1)" : "translateY(30px) scale(0.96)", transition: "opacity 0.8s ease, transform 0.8s ease" }}
      >
        <div className="text-8xl mb-5" style={{ filter: "drop-shadow(0 0 24px rgba(100,140,255,0.5))" }}>🏔</div>
        <div className="text-white/40 text-xs uppercase tracking-[0.35em] mb-4">{slide.eyebrow ?? "Your Linestry"}</div>
        <h1
          className="font-black text-white leading-none mb-5"
          style={{ fontSize: "clamp(3rem, 12vw, 6.5rem)", letterSpacing: "-0.02em", textShadow: "0 0 60px rgba(100,150,255,0.3)" }}
        >
          {slide.name}
        </h1>
        {slide.ridingSince && (
          <div className="text-white/50 text-xl">
            Riding since{" "}
            <span className="text-white font-bold" style={{ textShadow: "0 0 20px rgba(120,160,255,0.6)" }}>
              {slide.ridingSince}
            </span>
            {slide.yearsCount > 0 && (
              <span className="ml-3 text-white/30 text-base">· {slide.yearsCount} years</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatSlideView({ slide, active }: { slide: StatSlide; active: boolean }) {
  const count = useCountUp(slide.count, active)
  const done = count === slide.count
  const show = useSlideEntrance(active, 60)

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <Particles color={slide.accent} count={18} />
      {/* Accent glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full tp-breathe"
        style={{ background: `radial-gradient(ellipse, ${slide.accent}18 0%, transparent 65%)` }} />
      <div
        className="relative z-10"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(40px)", transition: "opacity 0.7s ease, transform 0.7s ease" }}
      >
        <div className="text-7xl mb-4" style={{ filter: `drop-shadow(0 0 20px ${slide.accent}88)` }}>{slide.icon}</div>
        {/* Big number */}
        <div
          className="font-black leading-none mb-3"
          style={{
            fontSize: "clamp(6rem, 22vw, 11rem)",
            color: slide.accent,
            letterSpacing: "-0.04em",
            textShadow: `0 0 80px ${slide.accent}55, 0 0 30px ${slide.accent}33`,
            transform: done ? "scale(1.04)" : "scale(1)",
            transition: "transform 0.25s ease-out",
          }}
        >
          {count}
        </div>
        <div
          className="text-white font-bold mb-2"
          style={{ fontSize: "clamp(1.5rem, 5vw, 2.4rem)", letterSpacing: "-0.01em", transition: "opacity 0.5s 0.3s ease", opacity: show ? 1 : 0 }}
        >
          {slide.label}
        </div>
        <div className="text-white/40 text-base mb-8 uppercase tracking-widest" style={{ transition: "opacity 0.5s 0.5s ease", opacity: show ? 1 : 0 }}>
          {slide.sublabel}
        </div>
        {slide.items.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {slide.items.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-sm font-medium text-white/85"
                style={{
                  backgroundColor: `${slide.accent}1a`,
                  border: `1px solid ${slide.accent}40`,
                  opacity: 0,
                  // Delay folded into the shorthand (was a separate animationDelay
                  // longhand) to clear a pre-existing React shorthand/longhand
                  // conflict warning. Visually identical stagger.
                  animation: show ? `tp-chip-in 0.4s ease ${0.4 + i * 90}ms forwards` : "none",
                }}
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
  const show = useSlideEntrance(active, 60)

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-10 overflow-hidden">
      <Particles color={slide.accent} count={14} />
      <div className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 40% 55%, ${slide.accent}1e 0%, transparent 65%)` }} />
      <div
        className="relative z-10"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateX(0)" : "translateX(-24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="text-6xl mb-4" style={{ filter: `drop-shadow(0 0 16px ${slide.accent}88)` }}>{slide.icon}</div>
        <div
          className="text-white/35 uppercase tracking-[0.3em] mb-4"
          style={{ fontSize: "0.7rem", transition: "opacity 0.4s 0.2s ease", opacity: show ? 1 : 0 }}
        >
          {slide.label}
        </div>
        <div
          className="font-black text-white leading-tight mb-6 max-w-xs mx-auto"
          style={{
            fontSize: "clamp(2rem, 9vw, 4.5rem)",
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${slide.accent}40`,
            transition: "opacity 0.5s 0.15s ease, transform 0.5s 0.15s ease",
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.92)",
          }}
        >
          {slide.entityName}
        </div>
        {slide.year && (
          <div
            className="inline-block px-5 py-2 rounded-full text-base font-bold"
            style={{
              backgroundColor: `${slide.accent}22`,
              border: `1px solid ${slide.accent}55`,
              color: slide.accent,
              textShadow: `0 0 12px ${slide.accent}60`,
              transition: "opacity 0.4s 0.35s ease",
              opacity: show ? 1 : 0,
            }}
          >
            {slide.year}
          </div>
        )}
      </div>
    </div>
  )
}

function OutroSlideView({ slide, active, onClose }: { slide: OutroSlide; active: boolean; onClose: () => void }) {
  const show = useSlideEntrance(active, 100)

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <Particles color="rgba(180,120,255,0.6)" count={30} />
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(120,60,200,0.15) 0%, transparent 65%)" }} />
      <div
        className="relative z-10"
        style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(30px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}
      >
        <div className="mb-6 flex justify-center" style={{ filter: "drop-shadow(0 0 20px rgba(59,130,246,0.5))" }}><BrandMark size={72} color="#3b82f6" /></div>
        <div className="text-white/35 text-xs uppercase tracking-[0.4em] mb-4">Linestry.com</div>
        {slide.headline ? (
          <h2
            className="font-black text-white leading-tight mb-4"
            style={{ fontSize: "clamp(2rem, 8vw, 4rem)", letterSpacing: "-0.02em" }}
          >
            {slide.headline}
          </h2>
        ) : (
          <h2
            className="font-black text-white leading-tight mb-4"
            style={{ fontSize: "clamp(2rem, 8vw, 4rem)", letterSpacing: "-0.02em" }}
          >
            That&apos;s {slide.name}&apos;s<br />linestry.
          </h2>
        )}
        <p className="text-white/35 text-sm mb-12">{slide.subtext ?? "Every board, mountain, and moment."}</p>
        {slide.cta ? (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={slide.cta.onClick}
              className="px-10 py-3.5 rounded-xl text-black text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, #e0e7ff, #ffffff)", boxShadow: "0 0 40px rgba(160,130,255,0.3)" }}
            >
              {slide.cta.label}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3.5 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Close
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="px-10 py-3.5 rounded-xl text-black text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #e0e7ff, #ffffff)", boxShadow: "0 0 40px rgba(160,130,255,0.3)" }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main player ──────────────────────────────────────────────────────────────

const SLIDE_DURATION = 4000

interface TimelinePlayerProps {
  person: Person
  claims: Claim[]
  onClose: () => void
}

/**
 * Personal timeline player — a thin wrapper over TimelinePlayerShell.
 * Behaviour is identical to the pre-Phase-2 single component: it builds the
 * person's slides and hands the shell a header with the rider's avatar + name.
 */
export function TimelinePlayer({ person, claims, onClose }: TimelinePlayerProps) {
  const { catalog } = useLineageStore()
  const slides = buildSlides(person, claims, catalog)
  return (
    <TimelinePlayerShell
      slides={slides}
      header={{
        label: person.display_name,
        avatar: (
          <RiderAvatar
            person={person}
            size="sm"
            ring={!!(person.membership_tier && person.membership_tier !== "free")}
          />
        ),
      }}
      onClose={onClose}
    />
  )
}

interface TimelinePlayerShellProps {
  slides: Slide[]
  header: { label: string; avatar?: ReactNode }
  onClose: () => void
}

/**
 * The reusable player chrome: progress bars, header, keyboard nav, pause, mute,
 * ambient audio, and the slide loop. Personal play (TimelinePlayer) and the
 * community player (CommunityTimelinePlayer) both render through this shell; the
 * only difference is the slides passed in and the header label/avatar.
 */
export function TimelinePlayerShell({ slides, header, onClose }: TimelinePlayerShellProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [audioOn, setAudioOn] = useState(true)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOutro = slides[index]?.kind === "outro"

  // Reset the active slide's progress bar to 0 when the slide or play state
  // changes, during render rather than with a synchronous setState in the effect
  // below (react-hooks/set-state-in-effect). The interval then fills it.
  const progressKey = `${index}|${paused}|${isOutro}`
  const [prevProgressKey, setPrevProgressKey] = useState(progressKey)
  if (progressKey !== prevProgressKey) {
    setPrevProgressKey(progressKey)
    if (!paused && !isOutro) setProgress(0)
  }

  useAmbientAudio(audioOn)

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
      if (e.key === "m" || e.key === "M") setAudioOn(a => !a)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [next, prev, onClose])

  const slide = slides[index]
  if (!slide) return null

  const bg = slideBg(slide)

  return (
    <>
      {/* Global keyframes injected once */}
      <style>{`
        @keyframes tp-float {
          0%   { transform: translateY(0px) translateX(0px); opacity: var(--tp-op, 0.2); }
          33%  { transform: translateY(-18px) translateX(6px); }
          66%  { transform: translateY(-8px) translateX(-4px); }
          100% { transform: translateY(0px) translateX(0px); opacity: var(--tp-op, 0.2); }
        }
        .tp-float { animation: tp-float linear infinite; }
        @keyframes tp-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          50%       { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
        }
        .tp-breathe { animation: tp-breathe 6s ease-in-out infinite; }
        @keyframes tp-chip-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: bg, transition: "background 1s ease" }}
      >
        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />

        {/* Progress bars */}
        <div className="relative z-10 flex gap-1 px-4 pt-5 pb-2 shrink-0">
          {slides.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[3px] rounded-full overflow-hidden cursor-pointer"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              onClick={() => goTo(i)}
            >
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: "rgba(255,255,255,0.9)",
                  width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                  transition: i === index ? "none" : "width 0.2s",
                  boxShadow: i <= index ? "0 0 6px rgba(255,255,255,0.6)" : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-5 py-2 shrink-0">
          <div className="flex items-center gap-2.5">
            {header.avatar}
            <span className="text-white/50 text-xs tracking-wide">{header.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Mute */}
            <button
              onClick={() => setAudioOn(a => !a)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all hover:bg-white/10 text-sm"
              title={audioOn ? "Mute (M)" : "Unmute (M)"}
            >
              {audioOn ? "🔊" : "🔇"}
            </button>
            {/* Pause */}
            <button
              onClick={() => setPaused(p => !p)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all hover:bg-white/10 text-sm"
              title={paused ? "Resume (P)" : "Pause (P)"}
            >
              {paused ? "▶" : "⏸"}
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all hover:bg-white/10 text-lg leading-none"
              title="Close (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Slide */}
        <div className="relative z-10 flex-1 overflow-hidden">
          {slide.kind === "intro"  && <IntroSlideView  slide={slide} active={true} />}
          {slide.kind === "stat"   && <StatSlideView   slide={slide} active={true} />}
          {slide.kind === "claim"  && <ClaimSlideView  slide={slide} active={true} />}
          {slide.kind === "outro"  && <OutroSlideView  slide={slide} active={true} onClose={onClose} />}
        </div>

        {/* Navigation */}
        <div className="relative z-10 flex items-center justify-between px-5 pb-10 pt-3 shrink-0">
          <button
            onClick={prev}
            disabled={index === 0}
            className="px-5 py-2.5 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-20 disabled:cursor-default"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            ← Prev
          </button>
          <span className="text-white/20 text-xs">{index + 1} / {slides.length}</span>
          <button
            onClick={next}
            disabled={isOutro}
            className="px-5 py-2.5 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-20 disabled:cursor-default"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Next →
          </button>
        </div>
      </div>
    </>
  )
}
