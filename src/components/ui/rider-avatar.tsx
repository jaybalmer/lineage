"use client"

import type { Person } from "@/types"
import { isAuthUser } from "@/store/lineage-store"

// ── Initials ─────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Tier color palette (matches riders page KIND_META) ────────────────────────

export type RiderTier = "founding" | "paid" | "free-account" | "unclaimed" | "catalog"

export function getRiderTier(person: Pick<Person, "id" | "membership_tier" | "community_status">): RiderTier {
  if (isAuthUser(person.id)) {
    const tier = person.membership_tier ?? "free"
    if (tier === "founding")                     return "founding"
    if (tier === "annual" || tier === "lifetime") return "paid"
    return "free-account"
  }
  if (person.community_status === "unverified")  return "unclaimed"
  return "catalog"
}

const TIER_STYLE: Record<RiderTier, { bg: string; ring: string; text: string }> = {
  founding:       { bg: "#78350f", ring: "#f59e0b", text: "#fef3c7" },
  paid:           { bg: "#1e3a8a", ring: "#3b82f6", text: "#dbeafe" },
  "free-account": { bg: "#064e3b", ring: "#10b981", text: "#d1fae5" },
  unclaimed:      { bg: "#431407", ring: "#f97316", text: "#ffedd5" },
  catalog:        { bg: "#27272a", ring: "#52525b", text: "#a1a1aa" },
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
  person: Pick<Person, "id" | "display_name" | "membership_tier" | "community_status">
  size?: AvatarSize
  /** Override the automatic tier (e.g. for stack avatars where we just want neutral) */
  tier?: RiderTier
  className?: string
  /** Show a thin colored ring based on tier */
  ring?: boolean
}

export function RiderAvatar({ person, size = "lg", tier: tierOverride, className = "", ring = false }: RiderAvatarProps) {
  const tier   = tierOverride ?? getRiderTier(person)
  const style  = TIER_STYLE[tier]
  const sz     = SIZE[size]
  const initials = getInitials(person.display_name)

  return (
    <div
      className={`${sz.wh} rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}
      style={{
        background:  style.bg,
        color:       style.text,
        fontSize:    undefined,  // use className font size
        outline:     ring ? `2px solid ${style.ring}` : undefined,
        outlineOffset: ring ? "1px" : undefined,
      }}
    >
      <span className={sz.font}>{initials}</span>
    </div>
  )
}
