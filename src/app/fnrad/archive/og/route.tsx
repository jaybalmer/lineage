import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { brandMarkSvgString } from "@/components/ui/brand-mark"
import { ENTITY_COLORS } from "@/lib/entity-colors"
import { archiveScaleLine, findFocus, readArchiveIndex } from "@/lib/fnrad-archive"

// The FNRad Archive share card (briefs/fnrad-archive-surface-brief-v1.md, D6).
//
// GET /fnrad/archive/og              the archive's default card
// GET /fnrad/archive/og?focus=t:id   one node: its name, counts, strongest
//                                    connections and a small ring of them
//
// A route handler rather than an opengraph-image file because the card depends
// on ?focus=, which file-based OG images cannot read. Same dark treatment and
// fonts as /t/[slug]/opengraph-image.tsx. Reads the shared cached index; an
// unknown focus renders the default card, never an error.

const S = 2
const W = 1200 * S
const H = 630 * S

const FRAME = "#100F0E"
const CARD = "#1A1715"
const BORDER = "#2C2926"
const WHITE = "#FAFAF9"
const MUTED = "#A8A29E"
const BLUE = "#60A5FA"
const MARK_BLUE = "#3B82F6"

const KIND = ["rider", "place", "brand", "event", "board"] as const
const TYPE_SINGULAR = ["Rider", "Place", "Brand or shop", "Event", "Board"]
const color = (t: number) => ENTITY_COLORS[KIND[t]].glow
const fmt = (n: number) => n.toLocaleString("en-US")

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

/** A small ring: the node in the middle, its strongest connections around it. */
function ringSvg(centre: number, ring: [number, number][]): string {
  const size = 440
  const c = size / 2
  const R = 170
  const maxW = Math.max(1, ...ring.map(([, w]) => w))
  const pts = ring.map(([t, w], k) => {
    const a = -Math.PI / 2 + (k / ring.length) * Math.PI * 2
    return { x: c + Math.cos(a) * R, y: c + Math.sin(a) * R, t, w }
  })
  const lines = pts
    .map((p) => `<line x1="${c}" y1="${c}" x2="${p.x}" y2="${p.y}" stroke="#ffffff" stroke-opacity="${(0.15 + (p.w / maxW) * 0.4).toFixed(2)}" stroke-width="${(1.5 + (p.w / maxW) * 3).toFixed(1)}"/>`)
    .join("")
  const dots = pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${(10 + (p.w / maxW) * 12).toFixed(1)}" fill="${color(p.t)}"/>`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${lines}${dots}<circle cx="${c}" cy="${c}" r="38" fill="${color(centre)}" stroke="#ffffff" stroke-width="5"/></svg>`
}

export async function GET(req: Request) {
  const focus = new URL(req.url).searchParams.get("focus") ?? undefined
  const index = await readArchiveIndex()
  const i = findFocus(index, focus)
  const node = i != null ? index.nodes[i] : null

  // Strongest connections, heaviest first.
  let ring: [number, number][] = []
  let names: string[] = []
  if (i != null) {
    const nb: [number, number][] = []
    for (const [a, b, w] of index.edges) {
      if (a === i) nb.push([b, w])
      else if (b === i) nb.push([a, w])
    }
    nb.sort((x, y) => y[1] - x[1])
    ring = nb.slice(0, 10).map(([j, w]) => [index.nodes[j][0], w])
    names = nb.slice(0, 3).map(([j]) => index.nodes[j][2])
  }

  const kicker = "The FNRad Archive"
  const title = node ? node[2] : "Twelve seasons of FNRad, mapped."
  const sub = node
    ? `${TYPE_SINGULAR[node[0]]}  ·  ${fmt(node[5])} ${node[5] === 1 ? "story" : "stories"} across ${fmt(node[4])} ${node[4] === 1 ? "episode" : "episodes"}`
    : index.totals.episodes
      ? archiveScaleLine(index.totals)
      : "Every rider, hill, board and brand the guests talked about."
  // A long name takes two lines; then the connections line would crowd the link.
  const connected = names.length && title.length <= 16 ? `Connected to ${names.join(", ")}` : ""
  const urlLine = "linestry.com/fnrad/archive"

  const [titleFont, boldFont, bodyFont, wordmarkFont] = await Promise.all([
    loadGeologica(800, title),
    loadGeologica(700, kicker + urlLine),
    loadGeologica(400, sub + connected),
    loadCalendula(),
  ])
  const fonts = [
    ...(titleFont ? [{ name: "Geologica", data: titleFont, weight: 800 as const, style: "normal" as const }] : []),
    ...(boldFont ? [{ name: "Geologica", data: boldFont, weight: 700 as const, style: "normal" as const }] : []),
    ...(bodyFont ? [{ name: "Geologica", data: bodyFont, weight: 400 as const, style: "normal" as const }] : []),
    ...(wordmarkFont ? [{ name: "Calendula", data: wordmarkFont, weight: 700 as const, style: "normal" as const }] : []),
  ]

  const mark = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString(MARK_BLUE, "#FFFFFF"))
  const graphic = node && ring.length ? "data:image/svg+xml," + encodeURIComponent(ringSvg(node[0], ring)) : null
  // Beside the ring the text column is narrow: long names drop a size so two
  // lines still leave room for the counts and the link.
  const titleSize = node ? (title.length > 14 ? 68 : 84) : title.length > 22 ? 76 : 92

  const image = new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center",
          background: FRAME, padding: 40 * S, fontFamily: "Geologica",
        }}
      >
        <div
          style={{
            display: "flex", width: "100%", height: "100%", background: CARD,
            border: `${1 * S}px solid ${BORDER}`, borderRadius: 28 * S, padding: 56 * S,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 * S }}>
                <img width={72 * S} height={48 * S} src={mark} alt="" />
                <span style={{ fontFamily: "Calendula", fontSize: 44 * S, color: WHITE, lineHeight: 1 }}>Linestry</span>
              </div>
              <span style={{ marginTop: 32 * S, fontSize: 30 * S, fontWeight: 700, color: BLUE, letterSpacing: "0.02em" }}>
                {kicker}
              </span>
              <span
                style={{
                  marginTop: 12 * S, fontSize: titleSize * S, fontWeight: 800, color: WHITE,
                  letterSpacing: "-0.03em", lineHeight: 1.02,
                }}
              >
                {title}
              </span>
              <span style={{ marginTop: 20 * S, fontSize: 28 * S, fontWeight: 400, color: MUTED, lineHeight: 1.3 }}>{sub}</span>
              {connected && (
                <span style={{ marginTop: 14 * S, fontSize: 28 * S, fontWeight: 400, color: MUTED, lineHeight: 1.3 }}>
                  {connected}
                </span>
              )}
            </div>
            <span style={{ fontSize: 34 * S, fontWeight: 700, color: BLUE }}>{urlLine}</span>
          </div>
          {graphic && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 32 * S }}>
              <img width={360 * S} height={360 * S} src={graphic} alt="" />
            </div>
          )}
        </div>
      </div>
    ),
    { width: W, height: H, ...(fonts.length ? { fonts } : {}) },
  )
  // One render per node per hour at the edge; the index itself refreshes hourly.
  image.headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400")
  return image
}
