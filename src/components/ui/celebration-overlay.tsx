"use client"

import { useEffect, useRef, useCallback } from "react"
import { useLineageStore } from "@/store/lineage-store"
import type { CelebrationPayload, CelebrationTier } from "@/types"

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const KEYFRAMES = `
@keyframes celebToastIn  { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes celebToastOut { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(10px) scale(0.95); } }
@keyframes celebModalIn  { from { opacity:0; transform:scale(0.88) translateY(24px); } to { opacity:1; transform:scale(1) translateY(0); } }
@keyframes celebFadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes celebRingOut  { from { transform:scale(0.6); opacity:0.8; } to { transform:scale(2.4); opacity:0; } }
@keyframes celebDotPop   { 0% { transform:scale(0) translate(0,0); opacity:1; } 80% { opacity:0.8; } 100% { opacity:0; } }
@keyframes celebPulse    { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
@media (prefers-reduced-motion: reduce) {
  .celeb-toast   { animation: none !important; opacity: 1 !important; transform: none !important; }
  .celeb-modal   { animation: none !important; opacity: 1 !important; transform: none !important; }
  .celeb-body    { animation: none !important; opacity: 1 !important; }
  .celeb-actions { animation: none !important; opacity: 1 !important; }
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

// ─── Burst helper ─────────────────────────────────────────────────────────────

function spawnBurst(container: HTMLDivElement, accentColor: string) {
  container.innerHTML = ""
  const cx = container.offsetWidth / 2
  const cy = container.offsetHeight / 2
  const dotColor = accentColor

  for (let r = 0; r < 3; r++) {
    const size = 50 + r * 22
    const ring = document.createElement("div")
    ring.style.cssText = [
      "position:absolute",
      `left:${cx - size / 2}px`,
      `top:${cy - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `border:1.5px solid ${accentColor}`,
      "pointer-events:none",
      `animation:celebRingOut 0.9s ease ${r * 0.16}s both`,
    ].join(";")
    container.appendChild(ring)
  }

  const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 15, 75, 135, 195]
  angles.forEach((angle, i) => {
    const rad  = (angle * Math.PI) / 180
    const dist = 40 + Math.random() * 30
    const size = 3 + Math.round(Math.random() * 4)
    const dot  = document.createElement("div")
    dot.style.cssText = [
      "position:absolute",
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `background:${dotColor}`,
      `left:${cx + Math.cos(rad) * dist}px`,
      `top:${cy + Math.sin(rad) * dist}px`,
      `animation:celebDotPop 0.65s ease ${0.05 + i * 0.03}s both`,
    ].join(";")
    container.appendChild(dot)
  })
}

// ─── Tier defaults ─────────────────────────────────────────────────────────────

function getAutoDismissMs(tier: CelebrationTier, override?: number): number | null {
  if (override !== undefined) return override
  if (tier === 1) return 3000
  if (tier === 2) return 5000
  return null  // Tier 3+ requires interaction
}

// ─── Toast (Tier 1–2) ─────────────────────────────────────────────────────────

function CelebrationToast({ payload, onDismiss }: {
  payload: CelebrationPayload
  onDismiss: () => void
}) {
  const accentColor = payload.accentColor ?? "#B8862A"
  const autoDismissMs = getAutoDismissMs(payload.tier, payload.autoDismissMs)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    injectStyles()
    if (autoDismissMs) {
      timerRef.current = setTimeout(onDismiss, autoDismissMs)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [autoDismissMs, onDismiss])

  const isTier2 = payload.tier >= 2

  return (
    <div
      className="celeb-toast"
      style={{
        position:     "fixed",
        bottom:       24,
        right:        20,
        zIndex:       1100,
        maxWidth:     340,
        width:        "calc(100vw - 40px)",
        background:   "#1C1917",
        border:       `1px solid ${accentColor}44`,
        borderRadius: 12,
        padding:      isTier2 ? "14px 16px" : "10px 14px",
        boxShadow:    `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}22`,
        animation:    "celebToastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        cursor:       "pointer",
      }}
      onClick={onDismiss}
    >
      {/* Accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, borderRadius: "12px 0 0 12px", background: accentColor }} />

      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isTier2 ? 6 : 0 }}>
          {payload.icon && (
            <span style={{ fontSize: isTier2 ? 20 : 16, lineHeight: 1 }}>{payload.icon}</span>
          )}
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#F5F2EE", lineHeight: 1.3 }}>
            {payload.title}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#78716C", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
          >
            ×
          </button>
        </div>

        {isTier2 && payload.body && (
          <p className="celeb-body" style={{
            margin: "0 0 4px", fontSize: 12, color: "#A8A29E", lineHeight: 1.5,
            animation: "celebFadeUp 0.3s ease 0.15s both",
          }}>
            {payload.body}
          </p>
        )}
        {isTier2 && payload.nextThread && (
          <p className="celeb-body" style={{
            margin: 0, fontSize: 11, color: accentColor, lineHeight: 1.4,
            animation: "celebFadeUp 0.3s ease 0.25s both",
          }}>
            {payload.nextThread}
          </p>
        )}
        {payload.stat && (
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#78716C", fontFamily: "'IBM Plex Mono', monospace" }}>
            {payload.stat}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Modal (Tier 3+) ─────────────────────────────────────────────────────────

function CelebrationModal({ payload, onDismiss }: {
  payload: CelebrationPayload
  onDismiss: () => void
}) {
  const accentColor = payload.accentColor ?? "#B8862A"
  const burstRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useRef(false)

  useEffect(() => {
    injectStyles()
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reducedMotion.current) {
      const t = setTimeout(() => {
        if (burstRef.current) spawnBurst(burstRef.current, accentColor)
      }, 50)
      return () => clearTimeout(t)
    }
  }, [accentColor])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onDismiss])

  const isTier4Plus = payload.tier >= 4

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         1100,
        background:     "rgba(0,0,0,0.75)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      {/* Glow */}
      <div style={{
        position:   "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 50% 45% at 50% 40%, ${accentColor}18 0%, transparent 70%)`,
      }} />

      {/* Burst container */}
      <div ref={burstRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />

      {/* Card */}
      <div
        className="celeb-modal"
        style={{
          position:      "relative",
          zIndex:        1,
          width:         "100%",
          maxWidth:      isTier4Plus ? 400 : 360,
          background:    "#1C1917",
          border:        `1px solid ${accentColor}44`,
          borderRadius:  16,
          padding:       isTier4Plus ? "32px 28px 24px" : "24px 24px 20px",
          boxShadow:     `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}22`,
          animation:     reducedMotion.current ? undefined : "celebModalIn 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
          textAlign:     "center",
        }}
      >
        {/* Accent line top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "16px 16px 0 0", background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

        {/* Close */}
        <button
          onClick={onDismiss}
          style={{
            position: "absolute", top: 12, right: 14,
            background: "none", border: "none", cursor: "pointer",
            color: "#78716C", fontSize: 18, lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Icon */}
        {payload.icon && (
          <div style={{
            fontSize: isTier4Plus ? 52 : 40,
            marginBottom: 12,
            animation: reducedMotion.current ? undefined : "celebPulse 2s ease-in-out infinite",
          }}>
            {payload.icon}
          </div>
        )}

        {/* Title */}
        <p style={{
          margin:      "0 0 8px",
          fontSize:    isTier4Plus ? 22 : 18,
          fontWeight:  700,
          color:       "#F5F2EE",
          lineHeight:  1.25,
          animation:   reducedMotion.current ? undefined : "celebFadeUp 0.4s ease 0.3s both",
          opacity:     reducedMotion.current ? 1 : 0,
        }}
        className="celeb-body"
        >
          {payload.title}
        </p>

        {/* Body */}
        {payload.body && (
          <p className="celeb-body" style={{
            margin:    "0 0 8px",
            fontSize:  14,
            color:     "#A8A29E",
            lineHeight: 1.6,
            animation: reducedMotion.current ? undefined : "celebFadeUp 0.4s ease 0.45s both",
            opacity:   reducedMotion.current ? 1 : 0,
          }}>
            {payload.body}
          </p>
        )}

        {/* Stat */}
        {payload.stat && (
          <p className="celeb-body" style={{
            margin:      "8px 0 0",
            fontSize:    11,
            color:       accentColor,
            fontFamily:  "'IBM Plex Mono', monospace",
            letterSpacing: "0.05em",
            animation:   reducedMotion.current ? undefined : "celebFadeUp 0.4s ease 0.55s both",
            opacity:     reducedMotion.current ? 1 : 0,
          }}>
            {payload.stat}
          </p>
        )}

        {/* Next Thread */}
        {payload.nextThread && (
          <p className="celeb-body" style={{
            margin:    "12px 0 0",
            fontSize:  12,
            color:     "#78716C",
            lineHeight: 1.5,
            animation: reducedMotion.current ? undefined : "celebFadeUp 0.4s ease 0.65s both",
            opacity:   reducedMotion.current ? 1 : 0,
          }}>
            {payload.nextThread}
          </p>
        )}

        {/* CTA */}
        <div
          className="celeb-actions"
          style={{
            marginTop:  20,
            animation:  reducedMotion.current ? undefined : "celebFadeUp 0.4s ease 0.75s both",
            opacity:    reducedMotion.current ? 1 : 0,
          }}
        >
          <button
            onClick={onDismiss}
            style={{
              width:        "100%",
              padding:      "10px 0",
              borderRadius: 8,
              fontSize:     13,
              fontWeight:   600,
              cursor:       "pointer",
              border:       "none",
              background:   accentColor,
              color:        "#1C1917",
              transition:   "opacity .15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "0.85" }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "1" }}
          >
            {payload.tier >= 4 ? "Let's go" : "Nice!"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main export — reads from celebrationQueue ────────────────────────────────

export function CelebrationOverlay() {
  const { celebrationQueue, dismissCelebration } = useLineageStore()

  const current = celebrationQueue[0]

  const handleDismiss = useCallback(() => {
    dismissCelebration()
  }, [dismissCelebration])

  if (!current) return null

  if (current.tier <= 2) {
    return <CelebrationToast key={`${current.title}-${celebrationQueue.length}`} payload={current} onDismiss={handleDismiss} />
  }

  return <CelebrationModal key={`${current.title}-${celebrationQueue.length}`} payload={current} onDismiss={handleDismiss} />
}
