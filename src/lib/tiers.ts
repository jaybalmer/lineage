// Canonical membership-tier wording (BUG-134, BUG-137).
//
// One source of truth for the word a paid tier prints, plus the colour and
// symbol that travel with it. "Member" is the generic noun for anyone with an
// account; a tier badge or a membership card prints the TIER word instead, so
// `annual` reads "Annual", not "Member".
//
// This module is deliberately NOT a client module and imports no React, so the
// server-rendered `next/og` routes can read it directly. `member-badge.tsx`
// (which is `"use client"`) re-exports the same data for component use.
//
// `free` (and any unknown tier) has no entry on purpose: badge surfaces render
// no chip for it. The one surface that needs a word for `free`
// (`/account/membership`) supplies its own "Rider" locally.

export interface TierMeta {
  label: string
  color: string
  symbol: string
}

export const TIER_META: Record<string, TierMeta> = {
  annual:   { label: "Annual",   color: "#3b82f6", symbol: "◈" },
  lifetime: { label: "Lifetime", color: "#8b5cf6", symbol: "◆" },
  founding: { label: "Founding", color: "#f59e0b", symbol: "✦" },
}

/** Tier metadata, or null for `free` / unknown / missing tiers. */
export function tierMetaFor(tier: string | null | undefined): TierMeta | null {
  return tier ? TIER_META[tier] ?? null : null
}

const pick = <K extends keyof TierMeta>(key: K): Record<string, TierMeta[K]> =>
  Object.fromEntries(Object.entries(TIER_META).map(([tier, meta]) => [tier, meta[key]]))

/** Flat lookups for surfaces that only want one field. */
export const TIER_LABEL:  Record<string, string> = pick("label")
export const TIER_COLOR:  Record<string, string> = pick("color")
export const TIER_SYMBOL: Record<string, string> = pick("symbol")
