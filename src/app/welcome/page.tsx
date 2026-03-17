"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { MemberCardTile } from "@/components/ui/member-card-overlay"
import { getInitials } from "@/components/ui/rider-avatar"

// ─── Inner page (needs useSearchParams, wrapped in Suspense below) ─────────────

function WelcomeInner() {
  const router       = useRouter()
  const params       = useSearchParams()
  const tierParam    = params.get("tier") as "annual" | "lifetime" | "founding" | null
  const sessionId    = params.get("session_id")

  const {
    showMemberCard, setShowMemberCard,
    membership, profileOverride, setMembership,
  } = useLineageStore()

  // Guard: no session_id → redirect to account
  useEffect(() => {
    if (!sessionId) {
      router.replace("/account/membership")
    }
  }, [sessionId, router])

  // Trigger overlay on mount
  useEffect(() => {
    if (!sessionId) return
    // If store tier hasn't updated yet from webhook, temporarily use the query param
    if (membership.tier === "free" && tierParam) {
      setMembership({ tier: tierParam })
    }
    setShowMemberCard(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When overlay is dismissed, redirect to account/membership
  useEffect(() => {
    if (sessionId && !showMemberCard && membership.member_card_seen_at) {
      router.replace("/account/membership")
    }
  }, [showMemberCard, membership.member_card_seen_at, sessionId, router])

  const displayName = profileOverride.display_name ?? "Member"

  // Blurred timeline background behind the overlay
  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Blurred timeline stub — dimly visible behind overlay */}
      <div style={{ filter: "blur(4px)", opacity: 0.25, pointerEvents: "none", padding: "80px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "#1a1f4e",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 500, color: "#fff",
          }}>
            {getInitials(displayName)}
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>{displayName}</p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>Your timeline</p>
          </div>
        </div>
        {[80, 55, 70, 40, 60].map((w, i) => (
          <div key={i} style={{
            height: 8, background: "var(--surface)",
            borderRadius: 4, marginBottom: 8, width: `${w}%`,
            marginTop: i === 2 ? 16 : 0,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WelcomeInner />
    </Suspense>
  )
}
