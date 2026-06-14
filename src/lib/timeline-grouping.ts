// Shared timeline grouping primitives.
//
// Extracted from FeedView so the personal timeline and the community timeline
// place items on the same decade scaffold with identical date handling. These
// are pure functions only — no React, no FeedView-specific item shapes — so
// sharing them carries no behavioural coupling between the two surfaces.

// Normalize a YYYY, YYYY-MM, or YYYY-MM-DD date string to a comparable
// YYYYMMDD number. Year-only values are a valid stored format, but
// parseInt("2022") yields 2022, and itemDecade's `sortDate / 10000` then
// collapses the year to 0, surfacing a bogus "0s" decade header (BUG-010).
// Padding partial dates to Jan 1 keeps both the decade bucket and the sort order
// correct.
export function dateToSortNum(dateStr?: string): number {
  if (!dateStr) return 0
  const [y, m = "01", d = "01"] = dateStr.split("-")
  const year = parseInt(y)
  if (isNaN(year)) return 0
  return year * 10000 + (parseInt(m) || 1) * 100 + (parseInt(d) || 1)
}

export function itemDecade(sortDate: number): string {
  if (!sortDate) return "Unknown"
  const year = Math.floor(sortDate / 10000)
  return `${Math.floor(year / 10) * 10}s`
}

// Group any list of timeline items by decade, keyed on a `sortDate` produced by
// dateToSortNum. Generic over the item shape so both FeedView's FeedItem and the
// community timeline's item union can reuse it. Input order is preserved within
// each decade bucket, so callers control intra-decade ordering by pre-sorting.
export function groupByDecade<T extends { sortDate: number }>(
  items: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const decade = itemDecade(item.sortDate)
    if (!groups[decade]) groups[decade] = []
    groups[decade].push(item)
  }
  return groups
}
