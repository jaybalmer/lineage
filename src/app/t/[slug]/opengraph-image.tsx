import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { brandMarkSvgString } from "@/components/ui/brand-mark"
import { readPublicTimelineOwner } from "@/lib/public-timeline-read"

// PB-010 Phase 2: dynamic share card for /t/[slug]. Dark brand-guide treatment,
// person-first: a small Linestry lockup masthead, then the owner as the hero,
// their era + share link, and a playful "I'll show you mine" invite at the foot.

const S = 2
export const size = { width: 1200 * S, height: 630 * S }
export const contentType = "image/png"
export const alt = "A snowboarding timeline on Linestry"

const FRAME   = "#100F0E"  // page ground (near-black, warm)
const CARD     = "#1A1715"  // dark panel
const BORDER   = "#2C2926"  // hairline
const WHITE    = "#FAFAF9"  // foreground on dark
const MUTED     = "#A8A29E"  // muted body on dark
const BLUE      = "#60A5FA"  // accent text on dark (AA-legible)
const MARK_BLUE = "#3B82F6"  // vivid brand blue for the mark body

const TAGLINE = "I'll show you mine . . ."

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

async function loadCalendula(): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), "src/app/fonts/Calendula-Bold.ttf"))
  } catch {
    return null
  }
}

export default async function OpengraphImage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const owner = await readPublicTimelineOwner(slug)

  const era = owner?.era_start ? `Snowboarding since ${owner.era_start}` : null
  const loc = [owner?.region, owner?.country].filter(Boolean).join(", ")
  const name = owner?.display_name ?? "Linestry"
  const sub = [era, loc || null].filter(Boolean).join("  ·  ")
  const urlLine = owner ? `linestry.com/t/${owner.slug}` : "linestry.com"

  const [nameFont, linkFont, mutedFont, wordmarkFont] = await Promise.all([
    loadGeologica(800, name),
    loadGeologica(700, urlLine),
    loadGeologica(400, sub + TAGLINE),
    loadCalendula(),
  ])
  const fonts = [
    ...(nameFont  ? [{ name: "Geologica", data: nameFont,  weight: 800 as const, style: "normal" as const }] : []),
    ...(linkFont  ? [{ name: "Geologica", data: linkFont,  weight: 700 as const, style: "normal" as const }] : []),
    ...(mutedFont ? [{ name: "Geologica", data: mutedFont, weight: 400 as const, style: "normal" as const }] : []),
    ...(wordmarkFont ? [{ name: "Calendula", data: wordmarkFont, weight: 700 as const, style: "normal" as const }] : []),
  ]

  // Dark ground: blue mark body with a white contrast dot.
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
          {/* Top: brand lockup masthead + the person as hero */}
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
            {sub && (
              <span style={{ marginTop: 16 * S, fontSize: 32 * S, fontWeight: 400, color: MUTED }}>
                {sub}
              </span>
            )}
            <span style={{ marginTop: 18 * S, fontSize: 40 * S, fontWeight: 700, color: BLUE }}>
              {urlLine}
            </span>
          </div>

          {/* Foot: the share invite */}
          <span style={{ fontSize: 34 * S, fontWeight: 400, color: MUTED }}>
            {TAGLINE}
          </span>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  )
}
