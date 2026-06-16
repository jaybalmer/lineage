import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"
import { readPublicTimelineOwner } from "@/lib/public-timeline-read"

// PB-010 Phase 2: dynamic share card for /t/[slug]. Mirrors the /word OG route
// (Satori-compatible Geologica fetch, light dictionary-card palette). Renders
// the owner's name + era + location so a shared timeline link previews richly.

const S = 2
export const size = { width: 1200 * S, height: 630 * S }
export const contentType = "image/png"
export const alt = "A snowboarding timeline on Linestry"

const FRAME      = "#F6F6F5"
const CARD       = "#FFFFFF"
const BORDER     = "#E7E5E4"
const INK        = "#1C1917"
const MUTED      = "#78716C"
const ACCENT     = "#2563EB"
const MARK_COLOR = "#3b82f6"

async function loadGeologica(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Geologica:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    if (!src) return null
    const res = await fetch(src)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OpengraphImage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const owner = await readPublicTimelineOwner(slug)

  const name = owner?.display_name ?? "Linestry"
  const era = owner?.era_start ? `Snowboarding since ${owner.era_start}` : null
  const loc = [owner?.region, owner?.country].filter(Boolean).join(", ")
  const sub = [era, loc || null].filter(Boolean).join("  ·  ")
  const label = owner ? "Linestry timeline" : "Linestry"
  const urlLine = owner ? `linestry.com/t/${owner.slug}` : "linestry.com"

  const [displayFont, bodyFont] = await Promise.all([
    loadGeologica(800, name),
    loadGeologica(500, label + sub + urlLine),
  ])
  const fonts = [
    ...(displayFont ? [{ name: "Geologica", data: displayFont, weight: 800 as const, style: "normal" as const }] : []),
    ...(bodyFont    ? [{ name: "Geologica", data: bodyFont,    weight: 500 as const, style: "normal" as const }] : []),
  ]

  const mark = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString(MARK_COLOR))

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
            border: `${1 * S}px solid ${BORDER}`, borderRadius: 28 * S,
            padding: 64 * S, boxShadow: `0 ${2 * S}px ${24 * S}px rgba(0,0,0,0.05)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 * S, fontWeight: 500, color: MUTED, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {label}
            </span>
            <img width={64 * S} height={64 * S} src={mark} alt="" />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 88 * S, fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              {name}
            </span>
            {sub && (
              <span style={{ marginTop: 22 * S, fontSize: 32 * S, fontWeight: 500, color: MUTED }}>
                {sub}
              </span>
            )}
            {/* Entity-color tiles evoke the curated stack of cards (stories, places,
                events, boards, brands) without a remote-image fetch (Satori-safe). */}
            {owner && (
              <div style={{ display: "flex", gap: 12 * S, marginTop: 30 * S }}>
                {["#7C3AED", "#0D9488", "#D97706", "#059669", "#0891B2"].map((c) => (
                  <div key={c} style={{ display: "flex", width: 60 * S, height: 60 * S, borderRadius: 14 * S, background: c }} />
                ))}
              </div>
            )}
          </div>

          <span style={{ fontSize: 26 * S, fontWeight: 500, color: ACCENT }}>
            {urlLine}
          </span>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  )
}
