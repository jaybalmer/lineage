"use client"

// Canonical member/tier badge (BUG-099). The colour map and symbols mirror the
// membership page (src/app/account/membership/page.tsx), so the badge reads the
// same on every surface that shows one: the Riders list, the avatar dropdown,
// and the membership page itself. Route every compact tier badge through here
// rather than re-deriving an ad hoc colour/icon/label per surface.

export interface TierBadgeMeta {
  label: string
  color: string
  symbol: string
}

// Free (and any unknown tier) deliberately has no entry: those surfaces render
// no badge chip, matching the membership-page treatment.
const TIER_BADGE: Record<string, TierBadgeMeta> = {
  annual:   { label: "Annual",   color: "#3b82f6", symbol: "◈" },
  lifetime: { label: "Lifetime", color: "#8b5cf6", symbol: "◆" },
  founding: { label: "Founding", color: "#f59e0b", symbol: "✦" },
}

export function memberBadgeFor(tier: string | null | undefined): TierBadgeMeta | null {
  return tier ? TIER_BADGE[tier] ?? null : null
}

export function MemberBadge({ tier, className = "" }: { tier: string | null | undefined; className?: string }) {
  const badge = memberBadgeFor(tier)
  if (!badge) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${className}`}
      style={{ color: badge.color, background: `${badge.color}18`, border: `1px solid ${badge.color}33`, fontSize: 10 }}
    >
      <span aria-hidden="true">{badge.symbol}</span>
      {badge.label}
    </span>
  )
}
