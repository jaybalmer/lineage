"use client"

import { useEffect, useRef, useCallback } from "react"
import { useLineageStore } from "@/store/lineage-store"

// ─── Era mapping ──────────────────────────────────────────────────────────────

type Era = { label: string; tagline: string }

function getEra(ridingSince?: number): Era | null {
  if (!ridingSince) return null
  if (ridingSince < 1990) return {
    label: "the Pioneer Era",
    tagline: "You were riding before snowboarding had rules. You helped write them.",
  }
  if (ridingSince < 2000) return {
    label: "the Golden Era",
    tagline: "The 90s shaped everything that came after. You were there.",
  }
  if (ridingSince < 2010) return {
    label: "the Progression Era",
    tagline: "Parks, video parts, and a global scene. You came up in the best decade.",
  }
  return {
    label: "the Modern Era",
    tagline: "The sport is bigger and wilder than ever. You're part of its next chapter.",
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
    profileOverride, membership, triggerPrefs, setTriggerPrefs,
  } = useLineageStore()

  const burstRef      = useRef<HTMLDivElement>(null)
  const reducedMotion = useRef(false)

  useEffect(() => {
    injectStyles()
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

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

  const displayName   = profileOverride.display_name ?? "Rider"
  const ridingSince   = profileOverride.riding_since
  const era           = getEra(ridingSince)
  const ridingText    = getRidingYearsText(ridingSince)
  const foundingNum   = membership.founding_member_number
  const isFounding    = membership.tier === "founding"

  // Member number line
  const memberLine = isFounding && foundingNum
    ? `You're founding member #${String(foundingNum).padStart(3, "0")} of 500.`
    : null

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
        animation:   reducedMotion.current ? undefined : "weBgPulse 3s ease-in-out infinite",
      }} />

      {/* Content */}
      <div
        className="we-hero"
        style={{
          position:  "relative",
          zIndex:    1,
          textAlign: "center",
          maxWidth:  480,
          animation: reducedMotion.current ? undefined : "weHeroIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both",
          opacity:   reducedMotion.current ? 1 : 0,
        }}
      >
        {/* Hex icon */}
        <div style={{
          fontSize:     48,
          marginBottom: 8,
          color:        "#B8862A",
          animation:    reducedMotion.current ? undefined : "weHexSpin 8s linear infinite",
          display:      "inline-block",
        }}>
          ⬡
        </div>

        {/* Welcome */}
        <p style={{ margin: "0 0 4px", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#78716C", fontFamily: "'IBM Plex Mono', monospace" }}>
          Welcome to
        </p>
        <h1 style={{ margin: "0 0 20px", fontSize: 30, fontWeight: 800, color: "#F5F2EE", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
          The Snowboard Community
        </h1>

        {/* Member number */}
        {memberLine && (
          <p className="we-body" style={{
            margin:      "0 0 16px",
            fontSize:    13,
            color:       "#B8862A",
            fontFamily:  "'IBM Plex Mono', monospace",
            animation:   reducedMotion.current ? undefined : "weFadeUp 0.4s ease 0.6s both",
            opacity:     reducedMotion.current ? 1 : 0,
          }}>
            {memberLine}
          </p>
        )}

        {/* Riding years + era */}
        {(ridingText || era) && (
          <div className="we-body" style={{
            margin:      "0 0 20px",
            padding:     "14px 18px",
            background:  "#B8862A12",
            border:      "1px solid #B8862A30",
            borderRadius: 10,
            animation:   reducedMotion.current ? undefined : "weFadeUp 0.4s ease 0.75s both",
            opacity:     reducedMotion.current ? 1 : 0,
          }}>
            {ridingText && (
              <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#F5DFA0" }}>
                {ridingText}
              </p>
            )}
            {era && (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "#B8862A", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {era.label}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#A8A29E", lineHeight: 1.55 }}>
                  {era.tagline}
                </p>
              </>
            )}
          </div>
        )}

        {/* Core message */}
        <p className="we-body" style={{
          margin:    "0 0 8px",
          fontSize:  15,
          color:     "#F5F2EE",
          lineHeight: 1.65,
          fontWeight: 500,
          animation: reducedMotion.current ? undefined : "weFadeUp 0.4s ease 0.9s both",
          opacity:   reducedMotion.current ? 1 : 0,
        }}>
          Your history is part of the permanent record now{displayName !== "Rider" ? `, ${displayName.split(" ")[0]}` : ""}.
        </p>
        <p className="we-body" style={{
          margin:    "0 0 28px",
          fontSize:  13,
          color:     "#78716C",
          lineHeight: 1.6,
          animation: reducedMotion.current ? undefined : "weFadeUp 0.4s ease 1s both",
          opacity:   reducedMotion.current ? 1 : 0,
        }}>
          Start building your timeline — boards, events, crew, stories. Every entry makes the collective history more complete.
        </p>

        {/* CTA */}
        <div className="we-acts" style={{
          display:   "flex",
          gap:       10,
          animation: reducedMotion.current ? undefined : "weFadeUp 0.4s ease 1.1s both",
          opacity:   reducedMotion.current ? 1 : 0,
        }}>
          <button
            onClick={handleDismiss}
            style={{
              flex:         1,
              padding:      "12px 0",
              borderRadius: 10,
              fontSize:     14,
              fontWeight:   700,
              cursor:       "pointer",
              border:       "none",
              background:   "#B8862A",
              color:        "#1C1917",
              transition:   "opacity .15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "0.85" }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "1" }}
          >
            Build my timeline
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex:         "0 0 auto",
              padding:      "12px 16px",
              borderRadius: 10,
              fontSize:     13,
              fontWeight:   500,
              cursor:       "pointer",
              background:   "rgba(255,255,255,0.07)",
              border:       "1px solid rgba(255,255,255,0.12)",
              color:        "rgba(255,255,255,0.6)",
              transition:   "opacity .15s",
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
