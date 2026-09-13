// One entity color palette, declared once, consumed everywhere an entity type is
// colored: card frames, the Collective graph nodes and legend, chips, dots, left
// rails and type labels. A reader who learns "orange means Events" on the graph
// should find orange on every Event surface.
//
// No "use client" directive so OG image routes and server components can import
// it (same reason src/lib/tiers.ts has none).
//
// Tailwind v4 scans source for full class-name literals, so every class string
// below is a complete literal. NEVER build an entity class by interpolation
// (`border-${family}-700`) or Tailwind will not emit it and the color silently
// disappears.
//
// Card frames render inside `.postcard`, which forces the light surface even in
// dark mode (see globals.css / design-system.md). That is why the chip and text
// classes use solid mid-weight colors and carry no `dark:` variant: a `dark:`
// lightening would wash the text out against the always-light postcard.

import type { Claim, EntityType, Predicate } from "@/types"

export type EntityKind = "story" | "event" | "board" | "brand" | "place" | "rider"

// `frame` is the solid 600/700-weight used for borders, rails, dots and
// light-mode graph nodes. `glow` is the 300/400-weight used for dark-mode graph
// nodes and other neon-on-dark surfaces (the story/compare players, the FTUE
// mosaic). `family` is the Tailwind color family, for reference only.
export const ENTITY_COLORS: Record<EntityKind, { frame: string; glow: string; family: string }> = {
  story: { frame: "#6d28d9", glow: "#a78bfa", family: "violet" },  // violet-700 / violet-400
  event: { frame: "#b45309", glow: "#fbbf24", family: "amber" },   // amber-700 / amber-400
  board: { frame: "#0284c7", glow: "#38bdf8", family: "sky" },     // sky-600 / sky-400
  brand: { frame: "#4338ca", glow: "#818cf8", family: "indigo" },  // indigo-700 / indigo-400 (moved off green so Place can take green)
  place: { frame: "#15803d", glow: "#4ade80", family: "green" },   // green-700 / green-400 (Cory: Places reads as green, clearly apart from Brand)
  rider: { frame: "#be123c", glow: "#fb7185", family: "rose" },    // rose-700 / rose-400
}

// Full-width 2px frame border (matches the Story frame everywhere).
export const ENTITY_FRAME_CLASS: Record<EntityKind, string> = {
  story: "border-violet-700",
  event: "border-amber-700",
  board: "border-sky-600",
  brand: "border-indigo-700",
  place: "border-green-700",
  rider: "border-rose-700",
}

// Left rail (border-l-*), for row-style claim lists.
export const ENTITY_RAIL_CLASS: Record<EntityKind, string> = {
  story: "border-l-violet-700",
  event: "border-l-amber-700",
  board: "border-l-sky-600",
  brand: "border-l-indigo-700",
  place: "border-l-green-700",
  rider: "border-l-rose-700",
}

// Type-label text color.
export const ENTITY_TEXT_CLASS: Record<EntityKind, string> = {
  story: "text-violet-700",
  event: "text-amber-700",
  board: "text-sky-700",
  brand: "text-indigo-700",
  place: "text-green-700",
  rider: "text-rose-700",
}

// Solid dot / rail node fill.
export const ENTITY_DOT_CLASS: Record<EntityKind, string> = {
  story: "bg-violet-600",
  event: "bg-amber-600",
  board: "bg-sky-600",
  brand: "bg-indigo-600",
  place: "bg-green-600",
  rider: "bg-rose-600",
}

// Rounded pill chip (tint bg + border + readable text + hover). Readable on the
// always-light postcard surface.
export const ENTITY_CHIP_CLASS: Record<EntityKind, string> = {
  story: "bg-violet-500/10 border border-violet-500/20 text-violet-700 hover:bg-violet-500/20 transition-colors",
  event: "bg-amber-500/10 border border-amber-500/20 text-amber-700 hover:bg-amber-500/20 transition-colors",
  board: "bg-sky-500/10 border border-sky-500/20 text-sky-700 hover:bg-sky-500/20 transition-colors",
  brand: "bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 hover:bg-indigo-500/20 transition-colors",
  place: "bg-green-500/10 border border-green-500/20 text-green-700 hover:bg-green-500/20 transition-colors",
  rider: "bg-rose-500/10 border border-rose-500/20 text-rose-700 hover:bg-rose-500/20 transition-colors",
}

// Neutral fallbacks for genuinely untyped items (mixed groups, the else branch
// of a claim accent). Grey stays only for things that have no single type.
export const NEUTRAL_FRAME_CLASS = "border-zinc-600"
export const NEUTRAL_DOT_CLASS = "bg-zinc-600"

const OBJECT_TYPE_TO_KIND: Record<EntityType, EntityKind> = {
  person: "rider",
  org: "brand",
  place: "place",
  event: "event",
  board: "board",
}

export function kindForObjectType(t: EntityType | string | null | undefined): EntityKind | null {
  if (!t) return null
  return OBJECT_TYPE_TO_KIND[t as EntityType] ?? null
}

// Predicate fallback, used only when a claim carries no resolvable object type.
// `worked_at` falls back to Place here (its legacy color); the object-type-first
// path in kindForClaim upgrades a "worked at <brand>" claim to green.
export function kindForPredicate(p: Predicate | string | null | undefined): EntityKind | null {
  switch (p) {
    case "owned_board":
      return "board"
    case "rode_at":
    case "worked_at":
    case "located_at":
      return "place"
    case "sponsored_by":
    case "part_of_team":
    case "fan_of":
      return "brand"
    case "rode_with":
    case "shot_by":
    case "coached_by":
      return "rider"
    case "competed_at":
    case "spectated_at":
    case "organized_at":
    case "organized":
      return "event"
    default:
      return null
  }
}

// Object type first (so a "worked at Burton" claim colors as a Brand), predicate
// only as a fallback when the object type is missing.
export function kindForClaim(claim: Pick<Claim, "object_type" | "predicate">): EntityKind | null {
  return kindForObjectType(claim.object_type) ?? kindForPredicate(claim.predicate)
}

export function frameClassForClaim(claim: Pick<Claim, "object_type" | "predicate">): string {
  const k = kindForClaim(claim)
  return k ? ENTITY_FRAME_CLASS[k] : NEUTRAL_FRAME_CLASS
}

export function dotClassForClaim(claim: Pick<Claim, "object_type" | "predicate">): string {
  const k = kindForClaim(claim)
  return k ? ENTITY_DOT_CLASS[k] : NEUTRAL_DOT_CLASS
}

// The single homogeneous entity kind across a run of claims, or null when the
// run is empty or mixes types (then the caller uses a neutral frame).
export function singleKindForClaims(claims: Pick<Claim, "object_type" | "predicate">[]): EntityKind | null {
  let only: EntityKind | null = null
  for (const c of claims) {
    const k = kindForClaim(c)
    if (!k) return null
    if (only === null) only = k
    else if (only !== k) return null
  }
  return only
}
