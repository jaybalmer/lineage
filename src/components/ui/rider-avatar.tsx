"use client"

import type { Person } from "@/types"
import { isAuthUser } from "@/store/lineage-store"

// ── Initials ─────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Tier color palette ───────────────────────────────────────────────────────
// Colors aligned with PB-008 node status visual language:
//   catalog   = grey       unclaimed = blue (dashed)
//   free      = green      paid/member = orange
//   founding  = amber      verified = inherits tier + checkmark

export type RiderTier = "founding" | "paid" | "free-account" | "unclaimed" | "catalog" | "verified"

export function getRiderTier(
  person: Pick<Person, "id" | "membership_tier" | "community_status" | "node_status">
): RiderTier {
  const status = person.node_status

  // If node_status is set, use it as source of truth
  if (status === "verified") return "verified"
  if (status === "claimed") {
    const tier = person.membership_tier ?? "free"
    if (tier === "founding") return "founding"
    if (tier === "annual" || tier === "lifetime") return "paid"
    return "free-account"
  }
  if (status === "unclaimed") return "unclaimed"
  if (status === "catalog") return "catalog"

  // Fallback: infer from isAuthUser (backward compat before backfill)
  if (isAuthUser(person.id)) {
    const tier = person.membership_tier ?? "free"
    if (tier === "founding") return "founding"
    if (tier === "annual" || tier === "lifetime") return "paid"
    return "free-account"
  }
  if (person.community_status === "unverified") return "unclaimed"
  return "catalog"
}

interface TierStyle {
  bg: string
  ring: string
  text: string
  dashed?: boolean
}

const TIER_STYLE: Record<RiderTier, TierStyle> = {
  founding:       { bg: "#78350f", ring: "#f59e0b", text: "#fef3c7" },
  paid:           { bg: "#431407", ring: "#f97316", text: "#ffedd5" },     // orange (was blue)
  "free-account": { bg: "#064e3b", ring: "#10b981", text: "#d1fae5" },
  unclaimed:      { bg: "#1e3a8a", ring: "#3b82f6", text: "#dbeafe", dashed: true }, // blue dashed (was orange)
  catalog:        { bg: "#27272a", ring: "#52525b", text: "#a1a1aa" },
  verified:       { bg: "#064e3b", ring: "#10b981", text: "#d1fae5" },     // inherits green by default
}

/** Get the resolved style for a verified user (inherits their tier color) */
function getVerifiedStyle(person: Pick<Person, "membership_tier">): TierStyle {
  const tier = person.membership_tier ?? "free"
  if (tier === "founding") return { ...TIER_STYLE.founding }
  if (tier === "annual" || tier === "lifetime") return { ...TIER_STYLE.paid }
  return { ...TIER_STYLE["free-account"] }
}

// ── Size scale ────────────────────────────────────────────────────────────────

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

const SIZE: Record<AvatarSize, { wh: string; font: string }> = {
  xs: { wh: "w-4 h-4",   font: "text-[7px]"  },
  sm: { wh: "w-6 h-6",   font: "text-[9px]"  },
  md: { wh: "w-8 h-8",   font: "text-[11px]" },
  lg: { wh: "w-10 h-10", font: "text-xs"     },
  xl: { wh: "w-16 h-16", font: "text-lg"     },
}

// ── RiderAvatar ───────────────────────────────────────────────────────────────

interface RiderAvatarProps {
  person: Pick<Person, "id" | "display_name" | "membership_tier" | "community_status" | "node_status">
  size?: AvatarSize
  /** Override the automatic tier (e.g. for stack avatars where we just want neutral) */
  tier?: RiderTier
  className?: string
  /** Show a colored ring based on tier */
  ring?: boolean
}

export function RiderAvatar({ person, size = "lg", tier: tierOverride, className = "", ring = false }: RiderAvatarProps) {
  const tier   = tierOverride ?? getRiderTier(person)
  const style  = tier === "verified" ? getVerifiedStyle(person) : TIER_STYLE[tier]
  const sz     = SIZE[size]
  const initials = getInitials(person.display_name)
  const isDashed = style.dashed === true

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={ring ? {
        padding: "3px",
        borderRadius: "9999px",
        border: `2px ${isDashed ? "dashed" : "solid"} ${style.ring}`,
      } : undefined}
    >
      <div
        className={`${sz.wh} rounded-full flex items-center justify-center font-bold shrink-0`}
        style={{ background: style.bg, color: style.text }}
      >
        <span className={sz.font}>{initials}</span>
      </div>
      {/* Verified checkmark overlay */}
      {ring && tier === "verified" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full text-white"
          style={{
            width: "14px",
            height: "14px",
            fontSize: "9px",
            background: style.ring,
            lineHeight: 1,
          }}
        >
          &#10003;
        </span>
      )}
    </div>
  )
}
