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

  // Fallback for rows without node_status (pre-backfill data and optimistic
  // client rows that haven't round-tripped yet). community_status must win
  // over the UUID check: ghost riders get crypto.randomUUID() ids since the
  // May 15 PB-008 backfill, so a UUID no longer implies an auth account.
  // The old order filed every new ghost under Riders as a member (BUG-022).
  if (person.community_status === "unverified") return "unclaimed"
  if (isAuthUser(person.id)) {
    const tier = person.membership_tier ?? "free"
    if (tier === "founding") return "founding"
    if (tier === "annual" || tier === "lifetime") return "paid"
    return "free-account"
  }
  return "catalog"
}

interface TierStyle {
  bg: string
  ring: string
  text: string
  dashed?: boolean
}

const TIER_STYLE: Record<RiderTier, TierStyle> = {
  founding:       { bg: "#78350f", ring: "#f59e0b", text: "#fef3c7" },     // amber
  paid:           { bg: "#431407", ring: "#f97316", text: "#ffedd5" },     // orange
  "free-account": { bg: "#064e3b", ring: "#10b981", text: "#d1fae5" },     // green
  // Unclaimed reads as muted grey, dashed (Cory: the rose was too strong; an
  // unclaimed node is "nobody yet", so it should recede, not shout).
  unclaimed:      { bg: "#27272a", ring: "#71717a", text: "#d4d4d8", dashed: true },
  catalog:        { bg: "#27272a", ring: "#52525b", text: "#a1a1aa" },
  verified:       { bg: "#064e3b", ring: "#10b981", text: "#d1fae5" },     // inherits green by default
}

// Per-tier color shared by every specific-rider surface so a rider's card, chip
// and dot match their avatar ring (Cory: membership colors should agree). Hex
// (ring) is for inline borders/dots; the chip classes are readable on the
// always-light postcard surface. Founding amber, member orange, rider green,
// unclaimed muted grey (dashed), catalog grey.
export const RIDER_TIER_RING: Record<RiderTier, string> = {
  founding: "#f59e0b",
  paid: "#f97316",
  "free-account": "#10b981",
  unclaimed: "#71717a",
  catalog: "#52525b",
  verified: "#10b981",
}

export const RIDER_TIER_CHIP_CLASS: Record<RiderTier, string> = {
  founding: "bg-amber-500/10 border border-amber-500/20 text-amber-700 hover:bg-amber-500/20 transition-colors",
  paid: "bg-orange-500/10 border border-orange-500/20 text-orange-700 hover:bg-orange-500/20 transition-colors",
  "free-account": "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/20 transition-colors",
  unclaimed: "bg-zinc-500/5 border border-dashed border-zinc-400/40 text-zinc-500 hover:bg-zinc-500/10 transition-colors",
  catalog: "bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 hover:bg-zinc-500/20 transition-colors",
  verified: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/20 transition-colors",
}

/** The tier color for a specific person, matching their avatar ring. */
export function riderTierRing(person: Pick<Person, "id" | "membership_tier" | "community_status" | "node_status">): string {
  return RIDER_TIER_RING[getRiderTier(person)]
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
  person: Pick<Person, "id" | "display_name" | "membership_tier" | "community_status" | "node_status" | "avatar_url">
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
        className={`${sz.wh} rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden`}
        style={{ background: style.bg, color: style.text }}
      >
        {person.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatar_url} alt={person.display_name} className="w-full h-full object-cover" />
        ) : (
          <span className={sz.font}>{initials}</span>
        )}
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
