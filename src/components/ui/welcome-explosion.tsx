"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useLineageStore } from "@/store/lineage-store"

// ─── Era mapping ──────────────────────────────────────────────────────────────

type Era = { label: string; tagline: string }

const ERA_DEFS: { maxYear: number; label: string; taglines: string[] }[] = [
  { maxYear: 1989, label: "the Pioneer Era", taglines: [
    "You were riding before most resorts even allowed it.",
    "You were riding before snowboarding had rules. You helped write them.",
    "The mountains weren't ready for you yet. You went anyway.",
  ]},
  { maxYear: 1997, label: "the Boom Era", taglines: [
    "You were part of the wave that made snowboarding legit.",
    "Burton ads in every magazine. Halfpipes going Olympic. You were in the middle of it.",
    "The sport exploded in the 90s and you were already strapped in.",
  ]},
  { maxYear: 2006, label: "the Golden Age", taglines: [
    "You grew up in the golden age. Forum, Robot Food, Kingpin.",
    "Park laps, video premieres, crew trips. The culture peaked and you were in it.",
    "The golden age of snowboarding shaped a generation. Yours.",
  ]},
  { maxYear: 2015, label: "the Evolution Era", taglines: [
    "You watched the culture shift from park to pow.",
    "Backcountry, splitboards, and a new definition of style. You rode through the evolution.",
    "The sport grew up in the 2010s. So did the riders who stuck with it.",
  ]},
  { maxYear: Infinity, label: "the Modern Era", taglines: [
    "You're riding in the most connected era ever.",
    "Social media, global crews, and endless terrain. The modern era is yours.",
    "More access, more progression, more ways to ride. You're writing the next chapter.",
  ]},
]

function getEra(ridingSince?: number): Era | null {
  if (!ridingSince) return null
  const def = ERA_DEFS.find(d => ridingSince <= d.maxYear) ?? ERA_DEFS[ERA_DEFS.length - 1]
  return {
    label: def.label,
    tagline: def.taglines[Math.floor(Math.random() * def.taglines.length)],
  }
}

function getRidingYearsText(ridingSince?: number): string | null {
  if (!ridingSince) return null
  const years = new Date().getFullYear() - ridingSince
  if (years < 2) return null
  if (years < 5) return `${years} years in`
  if (years < 10) return `${years} years of riding`
  if (years < 20) return `${years} years — you've seen real change`
  return `${years} years on a board`
}

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const KEYFRAMES = `
@keyframes weBgPulse  { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
@keyframes weHeroIn   { from { opacity:0; transform:scale(0.9) translateY(30px); } to { opacity:1; transform:scale(1) translateY(0); } }
@keyframes weFadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes weRingOut  { from { transform:scale(0.4); opacity:0.9; } to { transform:scale(3.5); opacity:0; } }
@keyframes weDotPop   { 0% { transform:translate(0,0) scale(0); opacity:1; } 75% { opacity:0.7; } 100% { opacity:0; } }
@keyframes weHexSpin  { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .we-hero  { animation: none !important; opacity: 1 !important; transform: none !important; }
  .we-body  { animation: none !important; opacity: 1 !important; }
  .we-acts  { animation: none !important; opacity: 1 !important; }
  .we-ring  { animation: none !important; opacity: 0 !important; }
}
`

let styleInjected = false
function injectStyles() {
  if (styleInjected || typeof document === "undefined") return
  styleInjected = true
  const el = document.createElement("style")
  el.textContent = KEYFRAMES
  document.head.appendChild(el)
}

// ─── Full burst for welcome ───────────────────────────────────────────────────

function spawnWelcomeBurst(container: HTMLDivElement) {
  container.innerHTML = ""
  const w = container.offsetWidth
  const h = container.offsetHeight

  // Outer rings from center
  const cx = w / 2
  const cy = h * 0.38  // slightly above center where the hero text lives

  const goldColors = ["#B8862A", "#EF9F27", "#FAC775", "#F5DFA0", "#D4A853"]

  for (let r = 0; r < 5; r++) {
    const size = 80 + r * 60
    const ring = document.createElement("div")
    ring.className = "we-ring"
    ring.style.cssText = [
      "position:absolute",
      `left:${cx - size / 2}px`,
      `top:${cy - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `border:1.5px solid ${goldColors[r % goldColors.length]}`,
      "pointer-events:none",
      `animation:weRingOut 1.2s ease ${r * 0.2}s both`,
    ].join(";")
    container.appendChild(ring)
  }

  // Scattered dots
  const angles = Array.from({ length: 28 }, (_, i) => (360 / 28) * i)
  angles.forEach((angle, i) => {
    const rad  = (angle * Math.PI) / 180
    const dist = 80 + Math.random() * 120
    const size = 3 + Math.round(Math.random() * 5)
    const color = goldColors[Math.floor(Math.random() * goldColors.length)]
    const dot  = document.createElement("div")
    dot.style.cssText = [
      "position:absolute",
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `background:${color}`,
      `left:${cx + Math.cos(rad) * dist}px`,
      `top:${cy + Math.sin(rad) * dist}px`,
      `animation:weDotPop 1s ease ${0.1 + i * 0.025}s both`,
    ].join(";")
    container.appendChild(dot)
  })
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function WelcomeExplosion() {
  const {
    showWelcomeCelebration, setShowWelcomeCelebration,
    profileOverride, activePersonId, membership, setTriggerPrefs,
  } = useLineageStore()

  const burstRef      = useRef<HTMLDivElement>(null)
  const reducedMotion = useRef(false)
  const eraRef        = useRef<Era | null>(null)

  // Fetch member_number from stats API (loads during beat 1-2 gap)
  const [memberNumber, setMemberNumber] = useState<number | null>(null)

  useEffect(() => {
    injectStyles()
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // Stabilize era on first render so random tagline doesn't change
  if (eraRef.current === null && profileOverride.riding_since) {
    eraRef.current = getEra(profileOverride.riding_since)
  }

  useEffect(() => {
    if (!showWelcomeCelebration || !activePersonId) return
    let cancelled = false
    fetch(`/api/stats/user?userId=${activePersonId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.member_number) setMemberNumber(data.member_number)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showWelcomeCelebration, activePersonId])

  useEffect(() => {
    if (!showWelcomeCelebration) return

    if (!reducedMotion.current) {
      const t = setTimeout(() => {
        if (burstRef.current) spawnWelcomeBurst(burstRef.current)
      }, 80)
      return () => clearTimeout(t)
    }
  }, [showWelcomeCelebration])

  useEffect(() => {
    if (!showWelcomeCelebration) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleDismiss() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showWelcomeCelebration]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    setShowWelcomeCelebration(false)
    setTriggerPrefs({ welcome_celebration_shown: true, welcome_pending: false })
  }, [setShowWelcomeCelebration, setTriggerPrefs])

  if (!showWelcomeCelebration) return null

  const ridingSince   = profileOverride.riding_since
  const era           = eraRef.current
  const yearsRiding   = ridingSince ? new Date().getFullYear() - ridingSince : null
  const foundingNum   = membership.founding_member_number
  const isFounding    = membership.tier === "founding"

  // Build stats line for Beat 3
  const memberLine = isFounding && foundingNum
    ? `Founding member #${String(foundingNum).padStart(3, "0")}`
    : memberNumber
      ? `Member #${memberNumber}`
      : null

  const yearsLine = yearsRiding && yearsRiding >= 2 && ridingSince
    ? `Riding since ${ridingSince} -- that's ${yearsRiding} years.`
    : null

  // Animation helper: returns style props for a beat at a given delay
  const rm = reducedMotion.current
  const beat = (delaySec: number) => ({
    animation: rm ? undefined : `weFadeUp 0.5s ease ${delaySec}s both`,
    opacity:   rm ? 1 : 0,
  })

  // Beat timing: ~1.5s between beats
  const B1 = 0.3   // "You're in."
  const B2 = 1.8   // "Welcome to..."
  const B3 = 3.3   // Stats block
  const B4 = 4.8   // "Your history matters."
  const BC = 6.0   // CTA buttons

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         1200,
        background:     "rgba(10,8,6,0.96)",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "24px 20px 32px",
        overflow:       "hidden",
      }}
    >
      {/* Burst container */}
      <div ref={burstRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      {/* Ambient glow */}
      <div style={{
        position:    "absolute", inset: 0, pointerEvents: "none",
        background:  "radial-gradient(ellipse 60% 50% at 50% 35%, #B8862A14 0%, transparent 70%)",
        animation:   rm ? undefined : "weBgPulse 3s ease-in-out infinite",
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 480 }}>

        {/* ── Beat 1: "You're in." ── */}
        <div className="we-hero" style={beat(B1)}>
          <div style={{
            fontSize: 48, marginBottom: 16, color: "#B8862A",
            animation: rm ? undefined : "weHexSpin 8s linear infinite",
            display: "inline-block",
          }}>
            ⬡
          </div>
          <h1 style={{
            margin: 0, fontSize: 36, fontWeight: 800,
            color: "#F5F2EE", letterSpacing: "-0.02em", lineHeight: 1.1,
          }}>
            You're in.
          </h1>
        </div>

        {/* ── Beat 2: "Welcome to..." ── */}
        <p className="we-body" style={{
          margin: "28px 0 0", fontSize: 16, color: "#A8A29E",
          lineHeight: 1.6, fontWeight: 400,
          ...beat(B2),
        }}>
          Welcome to the modern history vault of snowboarding.
        </p>

        {/* ── Beat 3: Stats block ── */}
        {(memberLine || yearsLine || era) && (
          <div className="we-body" style={{
            margin: "28px auto 0", maxWidth: 380,
            padding: "16px 20px",
            background: "#B8862A0F",
            border: "1px solid #B8862A30",
            borderRadius: 12,
            ...beat(B3),
          }}>
            {memberLine && (
              <p style={{
                margin: "0 0 8px", fontSize: 13, fontWeight: 600,
                color: "#B8862A", fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: "0.04em",
              }}>
                {memberLine}
              </p>
            )}
            {yearsLine && (
              <p style={{
                margin: "0 0 6px", fontSize: 15, fontWeight: 600,
                color: "#F5DFA0", lineHeight: 1.4,
              }}>
                {yearsLine}
              </p>
            )}
            {era && (
              <p style={{
                margin: 0, fontSize: 13, color: "#A8A29E", lineHeight: 1.55,
              }}>
                {era.tagline}
              </p>
            )}
          </div>
        )}

        {/* ── Beat 4: "Your history matters." ── */}
        <p className="we-body" style={{
          margin: "28px 0 0", fontSize: 17, fontWeight: 600,
          color: "#F5F2EE", lineHeight: 1.5,
          ...beat(B4),
        }}>
          Your history matters. Let's build it.
        </p>

        {/* ── CTA ── */}
        <div className="we-acts" style={{
          marginTop: 28, display: "flex", gap: 10,
          ...beat(BC),
        }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1, padding: "13px 0", borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              border: "none", background: "#B8862A", color: "#1C1917",
              transition: "opacity .15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "0.85" }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "1" }}
          >
            See Your Timeline
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex: "0 0 auto", padding: "13px 16px", borderRadius: 10,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.6)",
              transition: "opacity .15s",
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
