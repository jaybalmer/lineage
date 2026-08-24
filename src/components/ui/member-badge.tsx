"use client"

// Canonical member/tier badge (BUG-099). The colour map and symbols now come
// from src/lib/tiers.ts, which the membership page, the member card and both OG
// routes read too, so the tier reads the same on every surface that shows one:
// the Riders list, the avatar dropdown, and the membership page itself. Route
// every compact tier badge through here rather than re-deriving an ad hoc
// colour/icon/label per surface.

import { tierMetaFor, type TierMeta } from "@/lib/tiers"

// The labels/colours/symbols themselves live in src/lib/tiers.ts, which carries
// no "use client" directive so the server-rendered OG routes can share the same
// map (BUG-137). Free (and any unknown tier) deliberately has no entry there:
// those surfaces render no badge chip, matching the membership-page treatment.
export type TierBadgeMeta = TierMeta

export function memberBadgeFor(tier: string | null | undefined): TierBadgeMeta | null {
  return tierMetaFor(tier)
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
