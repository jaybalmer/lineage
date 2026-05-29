import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"

export const size        = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt         = "Linestry, a living, community-authored snowboarding history"

const GROUND     = "#161413"  // brand near-black
const MARK_COLOR = "#F6F6F5"  // cream
const WORDMARK   = "#ffffff"
const PERIOD     = "#3b82f6"  // the single blue accent
const TAGLINE    = "#a1a1aa"

const wordmark = "Linestry."
const tagline  = "A living, community-authored snowboarding history graph"

/**
 * Fetch a single Geologica weight subset from Google Fonts for Satori. Requests
 * only the glyphs in `text` and matches the truetype/opentype src (Satori cannot
 * parse woff2). Returns null on any failure so the OG card still renders with
 * next/og's bundled fallback font.
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
    loadGeologica(800, wordmark),
    loadGeologica(300, tagline),
  ])
  const fonts = [
    ...(displayFont ? [{ name: "Geologica", data: displayFont, weight: 800 as const, style: "normal" as const }] : []),
    ...(bodyFont    ? [{ name: "Geologica", data: bodyFont,    weight: 300 as const, style: "normal" as const }] : []),
  ]

  const mark = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString(MARK_COLOR))

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: GROUND,
          fontFamily: "Geologica",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img width={132} height={132} src={mark} alt="" />
          <span style={{ fontSize: 104, fontWeight: 800, color: WORDMARK, letterSpacing: "-0.03em" }}>
            Linestry<span style={{ color: PERIOD }}>.</span>
          </span>
        </div>
        <span style={{ marginTop: 32, fontSize: 32, fontWeight: 300, color: TAGLINE, letterSpacing: "0.01em" }}>
          {tagline}
        </span>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) }
  )
}
