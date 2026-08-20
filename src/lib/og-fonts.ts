import { readFile } from "node:fs/promises"
import { join } from "node:path"

// Shared font loaders for the next/og image routes (Curated Member Profile
// Phase 3). Geologica is pulled subsetted from Google Fonts per glyph set;
// Calendula (the wordmark face) is read from the self-hosted TTF. Both fail
// soft to null so an image still renders with the default face if a fetch or
// read fails. Mirrors the pattern already inlined in t/[slug]/opengraph-image.

export async function loadGeologica(weight: number, text: string): Promise<ArrayBuffer | null> {
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

export async function loadCalendula(): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), "src/app/fonts/Calendula-Bold.ttf"))
  } catch {
    return null
  }
}
