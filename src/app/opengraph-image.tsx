import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { brandMarkSvgString } from "@/components/ui/brand-mark"

export const size        = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt         = "Linestry, a living, community-authored snowboarding history"

const GROUND     = "#161413"  // brand near-black
const WORDMARK   = "#ffffff"
const TAGLINE    = "#a1a1aa"

const wordmark = "Linestry"
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

/**
 * Read the bundled Calendula Bold .ttf for the wordmark. Satori cannot parse
 * woff2, so the OG route loads the .ttf (the live site serves the .woff2). This
 * runs on the default Node runtime; next.config outputFileTracingIncludes keeps
 * the asset in the Vercel function bundle. Returns null on any failure so the
 * card falls back to Geologica rather than throwing.
 */
async function loadCalendula(): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(join(process.cwd(), "src/app/fonts/Calendula-Bold.ttf"))
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  // Wordmark prefers the licensed Calendula Bold, read from the bundled .ttf. If
  // that read fails (for example the asset was not traced into the function),
  // fall back to the previous Geologica 800 fetch so the wordmark still renders
  // bold rather than in Satori's default face.
  let wordmarkData = await loadCalendula()
  let wordmarkFamily: "Calendula" | "Geologica" = "Calendula"
  let wordmarkWeight: 700 | 800 = 700
  if (!wordmarkData) {
    wordmarkData = await loadGeologica(800, wordmark)
    wordmarkFamily = "Geologica"
    wordmarkWeight = 800
  }

  const bodyFont = await loadGeologica(300, tagline)

  const fonts = [
    ...(wordmarkData ? [{ name: wordmarkFamily, data: wordmarkData, weight: wordmarkWeight, style: "normal" as const }] : []),
    ...(bodyFont     ? [{ name: "Geologica",   data: bodyFont,     weight: 300 as const,   style: "normal" as const }] : []),
  ]

  // Dark OG ground: blue body with a white contrast dot, matching the banner set.
  const mark = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString("#3b82f6", "#ffffff"))

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
          {/* Landscape mark box (aspect 1.518) sized to the 104px wordmark. */}
          <img width={152} height={100} src={mark} alt="" />
          <span style={{ fontFamily: wordmarkFamily, fontSize: 104, fontWeight: wordmarkWeight, color: WORDMARK, letterSpacing: "-0.03em" }}>
            Linestry
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
