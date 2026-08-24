import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"
import { readMemberOgTarget } from "@/lib/public-timeline-read"
import { loadGeologica, loadCalendula } from "@/lib/og-fonts"
import { tierMetaFor } from "@/lib/tiers"

// Curated Member Profile Phase 3 (T14): share card for /people/[id]. A paid
// member's profile unfurls carrying their tier (name + tier line + accent
// edge); everyone else (free riders, unclaimed nodes) gets the neutral brand
// treatment. Mirrors the t/[slug] card so the two look like one family.

const S = 2
export const size = { width: 1200 * S, height: 630 * S }
export const contentType = "image/png"
export const alt = "A snowboarding timeline on Linestry"

const FRAME   = "#100F0E"
const CARD     = "#1A1715"
const BORDER   = "#2C2926"
const WHITE    = "#FAFAF9"
const MUTED     = "#A8A29E"
const BLUE      = "#60A5FA"  // neutral accent text on dark (AA-legible)
const MARK_BLUE = "#3B82F6"

// Tier colours / labels come from src/lib/tiers.ts, which carries no
// "use client" directive, so this server route shares the canonical map without
// pulling in the badge component. Badge symbols are unused here (Geologica has
// no glyph for them); the accent colour carries the tier.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GENERATED_ID_RE = /^[a-z]{1,8}[_-]\d{9,}([_-][a-z0-9]+)*$/i

/** Reverse a name-based slug into a readable display name; null for a raw id. */
function humanizeSlug(slug: string): string | null {
  if (!slug || UUID_RE.test(slug) || GENERATED_ID_RE.test(slug)) return null
  const words = decodeURIComponent(slug).replace(/[_-]+/g, " ").trim()
  if (!words) return null
  return words.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function OpengraphImage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const member = await readMemberOgTarget(id)

  const tierMeta = member ? tierMetaFor(member.membership_tier) : null
  const accent = tierMeta?.color ?? BLUE
  const name = member?.display_name ?? humanizeSlug(id) ?? "Linestry"
  const tierLine = tierMeta ? `${tierMeta.label} member` : null
  const sub = "A snowboarding timeline on Linestry"
  const urlLine = `linestry.com/people/${id}`

  const [nameFont, boldFont, mutedFont, wordmarkFont] = await Promise.all([
    loadGeologica(800, name),
    loadGeologica(700, (tierLine ?? "") + urlLine),
    loadGeologica(400, sub),
    loadCalendula(),
  ])
  const fonts = [
    ...(nameFont     ? [{ name: "Geologica", data: nameFont,     weight: 800 as const, style: "normal" as const }] : []),
    ...(boldFont     ? [{ name: "Geologica", data: boldFont,     weight: 700 as const, style: "normal" as const }] : []),
    ...(mutedFont    ? [{ name: "Geologica", data: mutedFont,    weight: 400 as const, style: "normal" as const }] : []),
    ...(wordmarkFont ? [{ name: "Calendula", data: wordmarkFont, weight: 700 as const, style: "normal" as const }] : []),
  ]

  const mark = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString(MARK_BLUE, "#FFFFFF"))

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200 * S, height: 630 * S, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: FRAME, padding: 40 * S, fontFamily: "Geologica",
        }}
      >
        <div
          style={{
            display: "flex", flexDirection: "column", width: "100%", height: "100%",
            justifyContent: "space-between", background: CARD,
            border: `${1 * S}px solid ${BORDER}`, borderRadius: 28 * S, padding: 72 * S,
          }}
        >
          {/* Top: brand lockup + the rider as hero */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 * S }}>
              <img width={88 * S} height={58 * S} src={mark} alt="" />
              <span style={{ fontFamily: "Calendula", fontSize: 52 * S, color: WHITE, lineHeight: 1 }}>
                Linestry
              </span>
            </div>

            <span style={{ marginTop: 44 * S, fontSize: 96 * S, fontWeight: 800, color: WHITE, letterSpacing: "-0.03em", lineHeight: 1.0 }}>
              {name}
            </span>
            {tierLine && (
              <span style={{ marginTop: 18 * S, fontSize: 40 * S, fontWeight: 700, color: accent }}>
                {tierLine}
              </span>
            )}
            <span style={{ marginTop: 16 * S, fontSize: 32 * S, fontWeight: 400, color: MUTED }}>
              {sub}
            </span>
          </div>

          {/* Foot: accent line (tier for members, brand blue otherwise) + URL */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ width: 180 * S, height: 6 * S, background: accent, borderRadius: 3 * S }} />
            <span style={{ marginTop: 16 * S, fontSize: 34 * S, fontWeight: 700, color: WHITE }}>
              {urlLine}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  )
}
