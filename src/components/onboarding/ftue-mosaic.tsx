"use client"

import { useEffect, useMemo, useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import type { Board } from "@/types"

// The two mosaic states behind the FTUE's opening beat.
//
//   scatter  the same images strewn, rotated, wearing generic post chrome.
//             "Your stories are scattered across feeds."
//   woven    the same images squared into a grid, captioned with the real
//             catalog entity, threads drawn between them.
//             "Linestry gives every piece a home."
//
// Images are REAL photos, sourced primarily from members' STORIES (fetched from
// /api/stats/community-images), which usually carry a linked place or event for
// the caption, with board catalog photos backfilling. Stories are where the real
// photos live; the catalog entity pages themselves are nearly all image-less.
// The photos are fetched on mount, so the first paint is the generated fallback
// below and real photos swap in when they land.
//
// The post chrome deliberately carries NO handle or like count. Attaching an
// invented @name to a real photo of someone's mountain would be fabricating
// attribution; an avatar dot and a redacted bar read as "a post" without
// claiming who posted it.

const TILE_COUNT = 8

/** Tints used for slots the catalog cannot fill. */
const FALLBACK_TINTS = ["#14b8a6", "#8b5cf6", "#f59e0b", "#10b981", "#06b6d4"]

const TIER = {
  place: "#14b8a6",
  board: "#10b981",
  event: "#f59e0b",
  story: "#8b5cf6",
  brand: "#06b6d4",
} as const

type Tile = {
  key: string
  src?: string
  caption: string
  tint: string
}

/** One real photo from /api/stats/community-images. */
type StoryImage = { url: string; caption: string; kind: "place" | "event" | "story" }

const TINT_BY_KIND: Record<StoryImage["kind"], string> = {
  place: TIER.place,
  event: TIER.event,
  story: TIER.story,
}

// Percent-based layouts. Same eight tiles in both, so the transition between
// beats reads as the SAME pieces finding their place rather than a new scene.
const SCATTER = [
  { x: 2,  y: 8,  w: 36, h: 33, r: -8 },
  { x: 44, y: 0,  w: 31, h: 29, r: 6 },
  { x: 78, y: 14, w: 22, h: 24, r: -4 },
  { x: 14, y: 46, w: 29, h: 31, r: 9 },
  { x: 47, y: 34, w: 33, h: 34, r: -5 },
  { x: 2,  y: 74, w: 24, h: 24, r: 5 },
  { x: 57, y: 72, w: 27, h: 26, r: -9 },
  { x: 82, y: 44, w: 18, h: 22, r: 7 },
]
const WOVEN = [
  { x: 1,  y: 6,  w: 31, h: 29, r: 0 },
  { x: 35, y: 2,  w: 31, h: 29, r: 0 },
  { x: 69, y: 6,  w: 30, h: 29, r: 0 },
  { x: 1,  y: 39, w: 31, h: 29, r: 0 },
  { x: 35, y: 35, w: 31, h: 29, r: 0 },
  { x: 69, y: 39, w: 30, h: 29, r: 0 },
  { x: 18, y: 72, w: 31, h: 26, r: 0 },
  { x: 52, y: 72, w: 31, h: 26, r: 0 },
]
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [3, 4],
  [4, 5], [3, 6], [4, 6], [4, 7], [5, 7], [6, 7],
]

// Generated stand-in used until the catalog lands, and for any slot the catalog
// cannot fill. Abstract on purpose: it carries no name, so it never implies a
// place that is not in the archive.
const FALLBACK_PALETTES = [
  ["#1e3a5f", "#4a7ba7", "#dbe9f4"], ["#3b2f4a", "#7d6a9c", "#e8ddf0"],
  ["#123c38", "#3f8f83", "#d6f0ea"], ["#4a2f22", "#a8714a", "#f2e0cf"],
  ["#1c2b3a", "#5b7f9e", "#e2edf5"], ["#38243a", "#8c5f8a", "#f0dcee"],
  ["#0f3d2e", "#37a06f", "#d9f3e5"], ["#3d3520", "#9c8a4e", "#f2ecd4"],
]

function fallbackPhoto(i: number): string {
  const p = FALLBACK_PALETTES[i % FALLBACK_PALETTES.length]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'>` +
    `<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${p[0]}'/><stop offset='.62' stop-color='${p[1]}'/></linearGradient>` +
    `<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${p[2]}'/><stop offset='1' stop-color='${p[1]}'/></linearGradient></defs>` +
    `<rect width='300' height='300' fill='url(#s)'/>` +
    `<circle cx='${215 - ((i * 11) % 110)}' cy='${58 + ((i * 13) % 30)}' r='${16 + (i % 4) * 4}' fill='#fff' opacity='.16'/>` +
    `<path d='M0 300 L0 ${190 - i * 3} L${70 + ((i * 9) % 30)} ${150 - i * 2} L${120 + ((i * 7) % 20)} ${180} ` +
    `L${180 + ((i * 5) % 25)} 120 L300 ${175 - i} L300 300 Z' fill='url(#g)' opacity='.9'/>` +
    `<path d='M0 300 L0 235 L${90 + ((i * 11) % 40)} 196 L${165 + ((i * 6) % 30)} 238 L230 205 L300 242 L300 300 Z' ` +
    `fill='${p[0]}' opacity='.93'/>` +
    `<rect width='300' height='300' fill='#161413' opacity='.14'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Builds the eight tiles from real photos, rotated by `offset` so repeat visits
 *  see a different eight. Story photos are the primary source (real uploads,
 *  usually captioned by their linked place or event); board catalog photos
 *  backfill. Every photo is used AT MOST ONCE: once the real photos run out, the
 *  remaining slots take a generated fallback rather than repeating a photo to pad
 *  the grid. Repeating both looks broken (the same image eight times) and
 *  collides render keys. With a small archive the fallback path is the common
 *  case, not an edge case. */
function pickTiles(storyImages: StoryImage[], boards: Board[], offset: number): Tile[] {
  const fromStories: Tile[] = storyImages
    .filter((im) => im.url)
    .map((im, i) => ({
      key: `st-${im.url.slice(-24)}-${i}`,
      src: im.url,
      caption: im.caption ?? "",
      tint: TINT_BY_KIND[im.kind] ?? TIER.story,
    }))
  const fromBoards: Tile[] = boards
    .filter((x) => x.image_url)
    .map((x) => ({
      key: `bd-${x.id}`,
      src: x.image_url as string,
      caption: [x.brand, x.model, x.model_year ? `· ${x.model_year}` : ""].filter(Boolean).join(" "),
      tint: TIER.board,
    }))

  // Stories first, boards backfill, deduped by src so one upload never appears
  // twice.
  const pool: Tile[] = []
  const seen = new Set<string>()
  for (const t of [...fromStories, ...fromBoards]) {
    if (t.src && !seen.has(t.src)) {
      seen.add(t.src)
      pool.push(t)
    }
  }

  const out: Tile[] = []
  const start = pool.length ? offset % pool.length : 0
  for (let i = 0; i < TILE_COUNT; i++) {
    const found = i < pool.length ? pool[(start + i) % pool.length] : undefined
    out.push(
      found ?? {
        key: `fb-${i}`,
        src: undefined,
        caption: "",
        // Cycle the tier palette across empty slots so a fallback scene still
        // reads as a mix of kinds rather than eight identical violet dots.
        tint: FALLBACK_TINTS[i % FALLBACK_TINTS.length],
      },
    )
  }
  return out
}

export function FtueMosaic({ mode }: { mode: "scatter" | "woven" }) {
  const catalog = useLineageStore((s) => s.catalog)
  const [storyImages, setStoryImages] = useState<StoryImage[]>([])

  // Real story photos are fetched client-side, so the first paint uses the
  // generated fallback below and real photos swap in when the request lands.
  useEffect(() => {
    let alive = true
    fetch("/api/stats/community-images")
      .then((r) => (r.ok ? r.json() : { images: [] }))
      .then((d) => {
        if (alive && Array.isArray(d?.images)) setStoryImages(d.images as StoryImage[])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // The starting point in the tile pool. Derived from catalog size rather than
  // Math.random() on purpose: a random offset would differ between the server
  // render and the client one and tear the hydration. Keying off the count still
  // varies the eight tiles as the archive grows, without any nondeterminism.
  const offset = (catalog.places?.length ?? 0) + (catalog.boards?.length ?? 0)

  const tiles = useMemo(
    () => pickTiles(storyImages, (catalog.boards ?? []) as Board[], offset),
    [storyImages, catalog.boards, offset],
  )

  const layout = mode === "scatter" ? SCATTER : WOVEN
  const centres = WOVEN.map((t) => ({ x: (t.x + t.w / 2) * 3.4, y: (t.y + t.h / 2) * 2.5 }))

  return (
    <div className="relative w-full h-[250px]">
      {mode === "woven" && (
        <svg
          viewBox="0 0 340 250"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
        >
          {EDGES.map(([a, b], i) => (
            <line
              key={`e${i}`}
              x1={centres[a].x}
              y1={centres[a].y}
              x2={centres[b].x}
              y2={centres[b].y}
              stroke={TIER.story}
              strokeWidth={1.4}
              strokeLinecap="round"
              pathLength={1}
              className="ftue-intro-draw"
              style={{ animationDelay: `${0.5 + i * 0.06}s`, opacity: 0.75 }}
            />
          ))}
          {centres.map((c, i) => (
            <circle
              key={`n${i}`}
              cx={c.x}
              cy={c.y}
              r={4.5}
              fill={tiles[i]?.tint ?? TIER.story}
              className="ftue-intro-pop"
              style={{
                animationDelay: `${0.9 + i * 0.05}s`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          ))}
        </svg>
      )}

      {layout.map((t, i) => {
        const tile = tiles[i]
        return (
          // Outer element owns the angle; inner owns the drop-in animation, so
          // the reduced-motion override cannot flatten a tile's rotation.
          <div
            key={`${tile.key}-${mode}-${i}`}
            className="absolute"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.w}%`,
              height: `${t.h}%`,
              transform: `rotate(${t.r}deg)`,
            }}
          >
            <div
              className="ftue-tile-in relative w-full h-full rounded-[9px] overflow-hidden bg-surface border border-foreground/10"
              style={{
                animationDelay: `${0.08 + i * 0.07}s`,
                boxShadow: "0 10px 26px -10px rgba(0,0,0,.9)",
              }}
            >
              <img
                src={tile.src ?? fallbackPhoto(i)}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: "saturate(.75) contrast(1.05)" }}
              />

              {mode === "scatter" ? (
                <>
                  {/* Generic post chrome: no handle, no count, nothing invented. */}
                  <div
                    className="absolute top-0 left-0 right-0 flex items-center gap-1.5 px-1.5 pt-1.5 pb-3 z-[2]"
                    style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.62),transparent)" }}
                  >
                    <span
                      className="rounded-full shrink-0"
                      style={{ width: 11, height: 11, background: tile.tint }}
                    />
                    <span className="h-[4px] flex-1 rounded-full bg-white/35 max-w-[62%]" />
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 pt-3 z-[2] text-white/70"
                    style={{
                      background: "linear-gradient(to top,rgba(0,0,0,.66),transparent)",
                      fontSize: 9,
                    }}
                    aria-hidden="true"
                  >
                    ♥
                  </div>
                </>
              ) : (
                tile.caption && (
                  <div
                    className="absolute left-0 right-0 bottom-0 px-1.5 pb-1 pt-3.5 font-semibold uppercase text-white/90 truncate"
                    style={{
                      background: "linear-gradient(to top,rgba(0,0,0,.82),transparent)",
                      fontSize: 8.5,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {tile.caption}
                  </div>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
