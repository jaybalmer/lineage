// Builds the FNRad Archive logo files (public/brand/fnrad-archive/).
//
// The mark is a derivative of the FNRad Snowboard Podcast masthead: the show's
// justified, ruled, heavy-serif stack, boxed like an archive label. Letters are
// set in Tinos Bold (src/app/fonts/Tinos-Bold.ttf, Apache 2.0, a Times
// metric-compatible face) and converted to outlines here, so the files never
// depend on a font being installed. Letterforms are never distorted: each line
// is sized so its ink runs exactly across the rule width, the way the FNRad
// masthead is set, and the stack's height follows from that.
//
//   node scripts/build-fnrad-archive-logo.mjs
//
// Outputs, each in black (light backgrounds), white (dark backgrounds) and
// sticker (black on a white die-cut, for photos and colour):
//   fnrad-archive-logo-{black,white,sticker}.svg/.png   primary lockup
//   fnrad-archive-mark-{black,white,sticker}.svg/.png   small mark (FNRad / ARCHIVE)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import opentype from "opentype.js"
import sharp from "sharp"

const ROOT = process.cwd()
const OUT = join(ROOT, "public/brand/fnrad-archive")
const font = opentype.parse(readFileSync(join(ROOT, "src/app/fonts/Tinos-Bold.ttf")).buffer)

const W = 676 // rule width, the justified measure
const r2 = (v) => Math.round(v * 100) / 100

/** Outline `text` with tracking (em) at `size`, pen starting at x=0, baseline 0. */
function rawPath(text, size, tracking) {
  const glyphs = font.stringToGlyphs(text)
  const scale = size / font.unitsPerEm
  const path = new opentype.Path()
  let x = 0
  glyphs.forEach((g, i) => {
    path.extend(g.getPath(x, 0, size))
    x += g.advanceWidth * scale
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size
  })
  return path
}

/** One justified line: true letterforms, sized (with fixed tracking) so the ink
 *  runs exactly edge to edge across W. Placed with its ink top at `top`. */
function line(text, tracking, top) {
  const probe = rawPath(text, 100, tracking).getBoundingBox()
  const size = (100 * W) / (probe.x2 - probe.x1)
  const path = rawPath(text, size, tracking)
  const bb = path.getBoundingBox()
  const dx = -bb.x1
  const dy = top - bb.y1
  const P = (x, y) => `${r2(x + dx)} ${r2(y + dy)}`
  let d = ""
  for (const c of path.commands) {
    if (c.type === "M") d += `M${P(c.x, c.y)}`
    else if (c.type === "L") d += `L${P(c.x, c.y)}`
    else if (c.type === "Q") d += `Q${P(c.x1, c.y1)} ${P(c.x, c.y)}`
    else if (c.type === "C") d += `C${P(c.x1, c.y1)} ${P(c.x2, c.y2)} ${P(c.x, c.y)}`
    else if (c.type === "Z") d += "Z"
  }
  return { d, bottom: top + (bb.y2 - bb.y1) }
}

const rule = (y, h) => `M0 ${y}H${W}V${y + h}H0Z`

/** Stack lines and rules top-down from y=0 with the masthead's spacing: a
 *  small gap above each rule, a slightly larger one below it. */
function stack(items) {
  const GAP_ABOVE = 20
  const GAP_BELOW = 24
  let y = 0
  const ink = []
  for (const it of items) {
    if (it.rule) {
      y += GAP_ABOVE
      ink.push(rule(y, it.rule))
      y += it.rule + GAP_BELOW
    } else {
      const l = line(it.text, it.tracking, y)
      ink.push(l.d)
      y = l.bottom
    }
  }
  return { ink, height: y }
}

// Tracking per line (em): FNRad sits tight like the show's masthead, the
// small line is opened up so it stays legible.
const LOCKUPS = {
  logo: {
    label: "The FNRad Archive",
    ...stack([
      { text: "FNRad", tracking: -0.01 },
      { rule: 10 },
      { text: "ARCHIVE", tracking: 0.03 },
      { rule: 10 },
      { text: "SNOWBOARD PODCAST · LINESTRY.COM/FNRAD", tracking: 0.02 },
    ]),
  },
  mark: {
    label: "The FNRad Archive",
    ...stack([
      { text: "FNRad", tracking: -0.01 },
      { rule: 14 },
      { text: "ARCHIVE", tracking: 0.03 },
    ]),
  },
}

const INSET = 34 // frame centreline distance from the ink
const FRAME = { x: -INSET, y: -INSET, w: W + INSET * 2, stroke: 10 }
const PAD = 15 // clear space beyond the frame's outer edge in the plain files
const STICKER = 24 // white die-cut margin beyond the frame

function svg(kind, variant) {
  const L = LOCKUPS[kind]
  const ink = variant === "white" ? "#FFFFFF" : "#0B0B0B"
  const frameH = L.height + INSET * 2
  const outer = { x: FRAME.x - FRAME.stroke / 2, y: FRAME.y - FRAME.stroke / 2, w: FRAME.w + FRAME.stroke, h: frameH + FRAME.stroke }
  const m = variant === "sticker" ? STICKER : PAD
  const vb = [outer.x - m, outer.y - m, outer.w + m * 2, outer.h + m * 2].map(r2)
  const parts = []
  if (variant === "sticker") parts.push(`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" rx="28" fill="#FFFFFF"/>`)
  parts.push(`<path fill="${ink}" d="${L.ink.join("")}"/>`)
  parts.push(
    `<rect x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${r2(frameH)}" fill="none" stroke="${ink}" stroke-width="${FRAME.stroke}"/>`,
  )
  return {
    vb,
    text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" role="img" aria-label="${L.label}"><title>${L.label}</title>${parts.join("")}</svg>\n`,
  }
}

mkdirSync(OUT, { recursive: true })
const PNG_WIDTH = { logo: 1600, mark: 1024 }
for (const kind of Object.keys(LOCKUPS)) {
  for (const variant of ["black", "white", "sticker"]) {
    const { text } = svg(kind, variant)
    const base = join(OUT, `fnrad-archive-${kind}-${variant}`)
    writeFileSync(`${base}.svg`, text)
    await sharp(Buffer.from(text), { density: 300 }).resize({ width: PNG_WIDTH[kind] }).png().toFile(`${base}.png`)
    console.log(`wrote ${base}.{svg,png}`)
  }
}
