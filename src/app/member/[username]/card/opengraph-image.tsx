import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"
import { readMemberOgTarget } from "@/lib/public-timeline-read"
import { loadGeologica, loadCalendula } from "@/lib/og-fonts"

// Curated Member Profile Phase 3 (T13): share card for /member/[username]/card.
// Dark brand-guide treatment carrying the tier: the member's name as the hero,
// their tier label + accent line, and a "verified member" standing line. A
// shared card link now unfurls with the card's own look instead of the site
// default. Free / unresolved usernames fall back to a neutral member card (the
// page itself 404s for those, so this is only a safety net).

const S = 2
export const size = { width: 1200 * S, height: 630 * S }
export const contentType = "image/png"
export const alt = "A Linestry member card"

const FRAME   = "#100F0E"  // page ground (near-black, warm)
const CARD     = "#1A1715"  // dark panel
const BORDER   = "#2C2926"  // hairline
const WHITE    = "#FAFAF9"  // foreground on dark
const MUTED     = "#A8A29E"  // muted body on dark
const MARK_BLUE = "#3B82F6"  // vivid brand blue for the mark body

// Canonical tier colours / labels (mirror member-badge.tsx + the member card
// page). Kept local so this server route never imports the "use client" badge
// module. The badge symbols (◈ ◆ ✦) are intentionally omitted: Geologica has no
// glyph for them, so the accent colour carries the tier here instead.
const TIER = {
  annual:   { color: "#3b82f6", label: "Member" },
  lifetime: { color: "#8b5cf6", label: "Lifetime Member" },
  founding: { color: "#f59e0b", label: "Founding Member" },
} as const

export default async function OpengraphImage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const member = await readMemberOgTarget(username)

  const tierMeta = member ? TIER[member.membership_tier as keyof typeof TIER] : undefined
  const accent = tierMeta?.color ?? MARK_BLUE
  const name = member?.display_name ?? "Linestry Member"
  const tierLine = tierMeta ? tierMeta.label : "Verified Member"
  const foundingNo =
    member?.membership_tier === "founding" && member.founding_member_number
      ? `No. ${String(member.founding_member_number).padStart(3, "0")} of 500`
      : null
  const standing = "A verified member of snowboarding's community history."
  const urlLine = "linestry.com"

  const [nameFont, boldFont, mutedFont, wordmarkFont] = await Promise.all([
    loadGeologica(800, name),
    loadGeologica(700, tierLine + (foundingNo ?? "") + urlLine),
    loadGeologica(400, standing),
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
          {/* Top: brand lockup + the member as hero */}
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
            <span style={{ marginTop: 18 * S, fontSize: 44 * S, fontWeight: 700, color: accent }}>
              {tierLine}
            </span>
            {foundingNo && (
              <span style={{ marginTop: 8 * S, fontSize: 28 * S, fontWeight: 700, color: MUTED }}>
                {foundingNo}
              </span>
            )}
            <span style={{ marginTop: 20 * S, fontSize: 32 * S, fontWeight: 400, color: MUTED }}>
              {standing}
            </span>
          </div>

          {/* Foot: tier accent line + share URL */}
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
