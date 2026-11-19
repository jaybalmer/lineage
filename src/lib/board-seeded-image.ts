// Seeded board images: board_sources rows with kind='image', status='active',
// written by scripts/seed-board-images.mjs. They sit in the resolution chain
// after a community suggestion and boards.image_url, and ahead of the live
// Serper lookup. See ~/linestry-ops/briefs/board-image-seeding-brief-v1.md.

export interface SeededImageRow {
  board_id: string
  hosted_url: string | null
  image_url: string | null
  source_url: string
  publisher: string
  doc_title: string | null
  page: number | null
  model_year: number | null
  source_tier: number | null
  created_at: string
}

/** Columns to select for SeededImageRow. */
export const SEEDED_IMAGE_COLUMNS =
  "board_id, hosted_url, image_url, source_url, publisher, doc_title, page, model_year, source_tier, created_at"

/** Display URL: our re-hosted copy, else the original remote image. */
export function seededUrl(row: SeededImageRow): string | null {
  return row.hosted_url ?? row.image_url ?? null
}

/**
 * Best seeded image for one board: lowest tier, then the source year closest to
 * the board's model year, then earliest added.
 */
export function pickSeeded(rows: SeededImageRow[], boardYear: number | null | undefined): SeededImageRow | null {
  const usable = rows.filter((r) => seededUrl(r))
  if (!usable.length) return null
  const dist = (r: SeededImageRow) =>
    boardYear != null && r.model_year != null ? Math.abs(r.model_year - boardYear) : 99
  return [...usable].sort(
    (a, b) =>
      (a.source_tier ?? 9) - (b.source_tier ?? 9) ||
      dist(a) - dist(b) ||
      a.created_at.localeCompare(b.created_at),
  )[0]
}

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return null }
}

/**
 * The small attribution line under a seeded image (D5):
 *   tier 1  photo: retrosnow.com
 *   tier 2  Blue Tomato 2006/07 catalogue, p.8
 *   tier 3  via evo.com
 */
export function seededCaption(img: {
  source_tier: number | null
  source_url: string
  publisher: string
  doc_title: string | null
  page: number | null
}): string {
  const host = hostOf(img.source_url) ?? img.publisher
  if (img.source_tier === 1) return `photo: ${host}`
  if (img.source_tier === 2) {
    const title = img.doc_title || img.publisher
    return `${title} catalogue${img.page != null ? `, p.${img.page}` : ""}`
  }
  return `via ${host}`
}
