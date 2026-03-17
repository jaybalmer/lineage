"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { nameToSlug } from "@/lib/utils"
import { getInitials } from "@/components/ui/rider-avatar"

// ─── Tier config ─────────────────────────────────────────────────────────────

type Tier = "annual" | "lifetime" | "founding"

const TIER_CONFIG: Record<Tier, {
  label:      string
  cardBg:     string
  accentLine: string
  ringColor:  string
  dotColor:   string
  tokens:     (n: number) => string
  stat3Label: string
  stat3Val:   string
  message:    (num?: number) => string
  btnColor:   string
}> = {
  annual: {
    label:      "Annual member",
    cardBg:     "#1a1f4e",
    accentLine: "#3B5BA5",
    ringColor:  "#378ADD",
    dotColor:   "#85B7EB",
    tokens:     (n) => String(n || 10),
    stat3Label: "Revenue share",
    stat3Val:   "Active",
    message:    () =>
      "You're part of something that's never existed before. The collective history of snowboarding — verified, owned, and built by riders.",
    btnColor: "#fff",
  },
  lifetime: {
    label:      "Lifetime member",
    cardBg:     "#0c2340",
    accentLine: "#185FA5",
    ringColor:  "#185FA5",
    dotColor:   "#378ADD",
    tokens:     (n) => String(n || 30),
    stat3Label: "Revenue share",
    stat3Val:   "Lifetime",
    message:    () =>
      "This is permanent. Your name and your history are part of the record — for as long as snowboarding exists.",
    btnColor: "#fff",
  },
  founding: {
    label:      "Founding member",
    cardBg:     "#412402",
    accentLine: "#854F0B",
    ringColor:  "#EF9F27",
    dotColor:   "#FAC775",
    tokens:     (n) => String(n || 100),
    stat3Label: "Share weight",
    stat3Val:   "2× premium",
    message:    (num) =>
      num
        ? `#${String(num).padStart(3, "0")} of 500. You were here at the start. The founding era is yours — permanently.`
        : "You were here at the start. The founding era is yours — permanently.",
    btnColor: "#FAC775",
  },
}

function isTier(t: string): t is Tier {
  return t === "annual" || t === "lifetime" || t === "founding"
}

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const KEYFRAMES = `
@keyframes mcCardIn  { from { opacity:0; transform:scale(0.88) translateY(24px); } to { opacity:1; transform:scale(1) translateY(0); } }
@keyframes mcFadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes mcRingOut { from { transform:scale(0.6); opacity:0.8; } to { transform:scale(2.2); opacity:0; } }
@keyframes mcDotPop  { 0% { transform:scale(0); opacity:1; } 80% { opacity:1; } 100% { transform:scale(1) translateY(-60px); opacity:0; } }
@keyframes mcShimmer { 0%,100% { opacity:0.08; } 50% { opacity:0.18; } }
@media (prefers-reduced-motion: reduce) {
  .mc-card-anim  { animation: none !important; opacity: 1 !important; transform: none !important; }
  .mc-wrap-anim  { animation: none !important; opacity: 1 !important; }
  .mc-msg-anim   { animation: none !important; opacity: 1 !important; }
  .mc-acts-anim  { animation: none !important; opacity: 1 !important; }
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

function spawnBurst(container: HTMLDivElement, ringColor: string, dotColor: string) {
  container.innerHTML = ""
  const cx = container.offsetWidth / 2
  const cy = container.offsetHeight / 2

  for (let r = 0; r < 3; r++) {
    const size = 60 + r * 20
    const ring = document.createElement("div")
    ring.style.cssText = [
      "position:absolute",
      `left:${cx - size / 2}px`,
      `top:${cy - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `border:2px solid ${ringColor}`,
      "pointer-events:none",
      `animation:mcRingOut 0.8s ease ${r * 0.18}s both`,
    ].join(";")
    container.appendChild(ring)
  }

  const angles = [0, 45, 90, 135, 180, 225, 270, 315, 22, 67, 112, 157]
  angles.forEach((angle, i) => {
    const rad  = (angle * Math.PI) / 180
    const dist = 55 + Math.random() * 30
    const dx   = Math.cos(rad) * dist
    const dy   = Math.sin(rad) * dist
    const size = 4 + Math.round(Math.random() * 4)
    const dot  = document.createElement("div")
    dot.style.cssText = [
      "position:absolute",
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `background:${dotColor}`,
      `left:${cx + dx}px`,
      `top:${cy + dy}px`,
      `animation:mcDotPop 0.7s ease ${0.05 + i * 0.04}s both`,
    ].join(";")
    container.appendChild(dot)
  })
}

// ─── Static card tile (reused by /member/[username]/card too) ────────────────

export interface MemberCardData {
  tier:          Tier
  displayName:   string
  ridingSince?:  number
  location?:     string
  tokens:        number
  foundingNum?:  number
  memberSince?:  string // e.g. "March 2026"
}

export function MemberCardTile({ data, animate = false, replayKey = 0 }: {
  data:       MemberCardData
  animate?:   boolean
  replayKey?: number
}) {
  const c = TIER_CONFIG[data.tier]
  const yearsRiding = data.ridingSince ? new Date().getFullYear() - data.ridingSince : 0
  const filledDots  = Math.min(5, Math.max(1, Math.ceil(yearsRiding / 10)))

  const cardStyle: React.CSSProperties = {
    background:    data.tier === "annual"   ? "linear-gradient(135deg, #1a1f4e 0%, #1e2460 100%)"
                 : data.tier === "lifetime" ? "linear-gradient(135deg, #0c2340 0%, #0f2d52 100%)"
                 : "linear-gradient(135deg, #412402 0%, #502d05 100%)",
    borderRadius:  14,
    padding:       "24px 24px 12px",
    position:      "relative",
    overflow:      "hidden",
    width:         "100%",
    maxWidth:      340,
    boxShadow:     `0 0 40px ${c.ringColor}22`,
    border:        `1px solid ${c.accentLine}44`,
    ...(animate ? {
      animation:       `mcCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both`,
    } : {}),
  }

  return (
    <div key={animate ? replayKey : undefined} style={cardStyle} className={animate ? "mc-card-anim" : ""}>
      {/* Shimmer */}
      <div style={{
        position:   "absolute", inset: 0,
        background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)",
        animation:  "mcShimmer 3s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Accent line bottom */}
      <div style={{
        position:   "absolute", bottom: 0, left: 0, right: 0,
        height:     3,
        background: c.accentLine,
      }} />

      {/* Tier label + founding number */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
          {c.label}
        </span>
        {data.tier === "founding" && data.foundingNum && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
            #{String(data.foundingNum).padStart(3, "0")} of 500
          </span>
        )}
      </div>

      {/* Name */}
      <p style={{ fontSize: 22, fontWeight: 500, color: "#fff", margin: "0 0 4px" }}>
        {data.displayName}
      </p>

      {/* Tagline */}
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: "0 0 20px" }}>
        {data.tier === "founding"
          ? `Founding member since ${data.memberSince ?? "2026"}`
          : `Member since ${data.memberSince ?? "2026"}${data.location ? ` · ${data.location}` : ""}`
        }
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: "0 0 2px" }}>Tokens</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            {c.tokens(data.tokens)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: "0 0 2px" }}>Riding since</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            {data.ridingSince ?? "—"}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: "0 0 2px" }}>{c.stat3Label}</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            {c.stat3Val}
          </p>
        </div>
      </div>

      {/* Dots (timeline motif) */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: i < filledDots ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)",
          }} />
        ))}
      </div>

      {/* Wordmark */}
      <p style={{
        position: "absolute", bottom: 18, right: 20,
        fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)",
        letterSpacing: "0.06em", margin: 0,
      }}>
        lineage.wtf
      </p>
    </div>
  )
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────

export function MemberCardOverlay() {
  const {
    showMemberCard, setShowMemberCard,
    membership, profileOverride, setMembership,
  } = useLineageStore()

  const [replayKey, setReplayKey]   = useState(0)
  const [copied,    setCopied]      = useState(false)
  const burstRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useRef(false)

  useEffect(() => {
    injectStyles()
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // Escape key to close
  useEffect(() => {
    if (!showMemberCard) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowMemberCard(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showMemberCard, setShowMemberCard])

  // Trigger burst + record first-seen when overlay opens
  useEffect(() => {
    if (!showMemberCard) return
    setReplayKey(k => k + 1)
    setCopied(false)

    // Record first view timestamp
    if (!membership.member_card_seen_at) {
      setMembership({ member_card_seen_at: new Date().toISOString() })
    }

    // Spawn burst after a tiny delay so container is painted
    if (!reducedMotion.current) {
      const t = setTimeout(() => {
        if (burstRef.current) {
          const tier = isTier(membership.tier) ? membership.tier : "annual"
          const c = TIER_CONFIG[tier]
          spawnBurst(burstRef.current, c.ringColor, c.dotColor)
        }
      }, 50)
      return () => clearTimeout(t)
    }
  }, [showMemberCard]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!showMemberCard) return null

  const rawTier     = membership.tier
  const tier        = isTier(rawTier) ? rawTier : "annual"
  const c           = TIER_CONFIG[tier]
  const displayName = profileOverride.display_name ?? "Member"
  const ridingSince = profileOverride.riding_since
  const tokens      = membership.token_balance.founder + membership.token_balance.member
  const foundingNum = membership.founding_member_number

  // Member-since: derive from membership_expires_at or approximate
  const memberSince = (() => {
    if (membership.member_card_seen_at) {
      const d = new Date(membership.member_card_seen_at)
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }
    return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
  })()

  const cardData: MemberCardData = {
    tier, displayName, ridingSince, tokens, foundingNum, memberSince,
  }

  function handleShare() {
    const slug = nameToSlug(displayName)
    navigator.clipboard.writeText(`https://lineage.wtf/member/${slug}/card`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const message = c.message(foundingNum)

  return (
    <div
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          1000,
        background:      "rgba(0,0,0,0.72)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowMemberCard(false) }}
    >
      {/* Tier-coloured glow */}
      <div style={{
        position:       "absolute", inset: 0, pointerEvents: "none",
        background:     `radial-gradient(ellipse 60% 50% at 50% 40%, ${c.ringColor}18 0%, transparent 70%)`,
      }} />

      {/* Burst container */}
      <div
        ref={burstRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
      />

      {/* Card + message + actions */}
      <div
        key={replayKey}
        className="mc-wrap-anim"
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            0,
          width:          "100%",
          maxWidth:       360,
          animation:      reducedMotion.current ? undefined : "mcFadeUp 0.4s ease both",
          position:       "relative",
          zIndex:         1,
        }}
      >
        <MemberCardTile data={cardData} animate={!reducedMotion.current} replayKey={replayKey} />

        {/* Message */}
        <p
          className="mc-msg-anim"
          style={{
            fontSize:   13,
            color:      "#fff",
            textAlign:  "center",
            margin:     "16px 0 20px",
            lineHeight: 1.6,
            opacity:    0.9,
            animation:  reducedMotion.current ? undefined : "mcFadeUp 0.4s ease 0.5s both",
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div
          className="mc-acts-anim"
          style={{
            display:    "flex",
            gap:        8,
            width:      "100%",
            animation:  reducedMotion.current ? undefined : "mcFadeUp 0.4s ease 0.65s both",
          }}
        >
          <button
            onClick={handleShare}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: "pointer", border: "none", transition: "opacity .15s",
              background: "#fff",
              color: tier === "founding" ? "#412402" : "#1a1f4e",
            }}
          >
            {copied ? "Copied link ✓" : "Share your card"}
          </button>
          <button
            onClick={() => setShowMemberCard(false)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: "pointer", border: "0.5px solid rgba(255,255,255,0.15)", transition: "opacity .15s",
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            View my timeline
          </button>
        </div>
      </div>
    </div>
  )
}
