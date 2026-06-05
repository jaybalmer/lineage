import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"

// Author the card at 2x so downstream platforms downscale from more pixels
// (crisper thumbnails) and LinkedIn reliably picks the large-image layout.
// Every px value is multiplied by S, so the composition is single-sourced.
const S = 2

export const size        = { width: 1200 * S, height: 630 * S }
export const contentType = "image/png"
export const alt         = "linestry, noun. The cultural lineage of a community, the people, places, stories, and artifacts woven together into a shared fabric."

// Light dictionary-card palette. The locked identity on a near-white surface.
const FRAME      = "#F6F6F5"  // light surface (page ground)
const CARD       = "#FFFFFF"  // card fill
const BORDER     = "#E7E5E4"  // hairline
const INK        = "#1C1917"  // foreground
const MUTED      = "#78716C"  // muted body
const MARK_COLOR = "#3b82f6"  // brand blue, used for fills / large display

const HEADWORD   = "linestry"
const LABEL      = "Dictionary"
const PRON       = "/ˈlin-ə-strē/  n.  (rhymes with ministry)"
const DEFINITION = "the cultural lineage of a community, the people, places, stories, and artifacts woven together into a shared fabric."
const ETYMOLOGY  = "from lineage + tapestry"

/**
 * Fetch a single Geologica weight subset from Google Fonts for Satori. Requests
 * only the glyphs in `text` and matches the truetype/opentype src (Satori cannot
 * parse woff2). Returns null on any failure so the OG card still renders with
 * next/og's bundled fallback font. Mirrors src/app/opengraph-image.tsx.
 */
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

export default async function OpengraphImage() {
  const [displayFont, bodyFont] = await Promise.all([
    loadGeologica(800, HEADWORD),
    loadGeologica(500, LABEL + PRON + DEFINITION + ETYMOLOGY),
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
          width: 1200 * S,
          height: 630 * S,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: FRAME,
          padding: 40 * S,
          fontFamily: "Geologica",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            background: CARD,
            border: `${1 * S}px solid ${BORDER}`,
            borderRadius: 28 * S,
            padding: 56 * S,
            boxShadow: `0 ${2 * S}px ${24 * S}px rgba(0,0,0,0.05)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 22 * S, fontWeight: 500, color: MUTED, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {LABEL}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img width={62 * S} height={62 * S} src={mark} alt="" />
          </div>

          <span style={{ marginTop: 14 * S, fontSize: 96 * S, fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {HEADWORD}
          </span>

          <span style={{ marginTop: 16 * S, fontSize: 28 * S, fontWeight: 500, color: MUTED }}>
            {PRON}
          </span>

          <div style={{ height: 1 * S, background: BORDER, marginTop: 26 * S, marginBottom: 26 * S }} />

          <span style={{ fontSize: 31 * S, fontWeight: 500, color: INK, lineHeight: 1.32 }}>
            {DEFINITION}
          </span>

          <span style={{ marginTop: 20 * S, fontSize: 26 * S, fontWeight: 500, fontStyle: "italic", color: MUTED }}>
            {ETYMOLOGY}
          </span>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) }
  )
}
