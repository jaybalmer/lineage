import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"

export const size        = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt         = "linestry, noun. The cultural lineage of a community, the people, places, stories, and artifacts woven together into a shared fabric."

// Light dictionary-card palette — the locked identity on a near-white surface.
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
          width: 1200,
          height: 630,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: FRAME,
          padding: 40,
          fontFamily: "Geologica",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 28,
            padding: 56,
            boxShadow: "0 2px 24px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: MUTED, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {LABEL}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img width={62} height={62} src={mark} alt="" />
          </div>

          <span style={{ marginTop: 14, fontSize: 96, fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {HEADWORD}
          </span>

          <span style={{ marginTop: 16, fontSize: 28, fontWeight: 500, color: MUTED }}>
            {PRON}
          </span>

          <div style={{ height: 1, background: BORDER, marginTop: 26, marginBottom: 26 }} />

          <span style={{ fontSize: 31, fontWeight: 500, color: INK, lineHeight: 1.32 }}>
            {DEFINITION}
          </span>

          <span style={{ marginTop: 20, fontSize: 26, fontWeight: 500, fontStyle: "italic", color: MUTED }}>
            {ETYMOLOGY}
          </span>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) }
  )
}
