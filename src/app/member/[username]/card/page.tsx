"use client"

import { use } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { useLineageStore } from "@/store/lineage-store"
import { MemberCardTile, type MemberCardData } from "@/components/ui/member-card-overlay"
import { nameToSlug } from "@/lib/utils"

// ─── Tier badge labels ────────────────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  annual:   "Member",
  lifetime: "Lifetime Member",
  founding: "Founding Member",
}

const TIER_COLOR: Record<string, string> = {
  annual:   "#3b82f6",
  lifetime: "#8b5cf6",
  founding: "#f59e0b",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemberCardPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const { catalog, catalogLoaded } = useLineageStore()

  // Wait for catalog to hydrate before calling notFound
  if (!catalogLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted text-sm">Loading…</div>
      </div>
    )
  }

  // Look up person by slug
  const person = catalog.people.find(
    (p) => nameToSlug(p.display_name) === username
  )

  if (!person) notFound()

  const tier = (person.membership_tier ?? "free") as string
  const isPaid = tier !== "free"

  if (!isPaid) notFound()  // no card for free riders

  const cardData: MemberCardData = {
    tier:        tier as "annual" | "lifetime" | "founding",
    displayName: person.display_name,
    ridingSince: person.riding_since,
    tokens:      0, // token balance is private — show 0 on public card
    memberSince: undefined,
  }

  const tierLabel = TIER_LABEL[tier] ?? "Member"
  const tierColor = TIER_COLOR[tier] ?? "#3b82f6"
  const symbol    = tier === "founding" ? "✦" : tier === "lifetime" ? "◆" : "◈"

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(30,40,80,0.6) 0%, #0a0a0a 70%)",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Wordmark */}
      <div className="mb-8 flex items-center gap-2">
        <span className="text-blue-400 text-lg">⬡</span>
        <span className="text-muted text-xs tracking-widest font-medium">LINEAGE</span>
      </div>

      {/* Tier badge */}
      <div
        className="mb-6 px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}44` }}
      >
        {symbol} {tierLabel.toUpperCase()}
      </div>

      {/* Card */}
      <MemberCardTile data={cardData} animate={false} />

      {/* Tagline */}
      <p className="text-muted mt-6 text-xs text-center max-w-xs leading-relaxed">
        {person.display_name} is a verified member of the Lineage community —
        part of the collective history of snowboarding.
      </p>

      {/* CTA */}
      <Link
        href="/membership"
        className="mt-8 px-6 py-2.5 rounded-full text-xs font-medium transition-all"
        style={{
          background:   "#1a1f4e",
          color:        "#93c5fd",
          border:       "1px solid #3b82f640",
        }}
      >
        Build your own timeline →
      </Link>
    </div>
  )
}
