// Map a free-text country (as it appears on imported events) to a continent, for
// the events-list "group by continent" view. Country values in the catalog are
// human-entered strings (USA, "United States", "multiple", etc.), so this
// normalises loosely and falls back to "Other" rather than guessing.

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // North America
  usa: "North America", "united states": "North America", "united states of america": "North America",
  canada: "North America", mexico: "North America",
  // Europe
  austria: "Europe", switzerland: "Europe", norway: "Europe", italy: "Europe",
  germany: "Europe", france: "Europe", spain: "Europe", finland: "Europe",
  sweden: "Europe", "united kingdom": "Europe", uk: "Europe", "great britain": "Europe",
  netherlands: "Europe", "czech republic": "Europe", czechia: "Europe", poland: "Europe",
  slovenia: "Europe", slovakia: "Europe", andorra: "Europe", russia: "Europe",
  bulgaria: "Europe", turkey: "Europe", georgia: "Europe", ireland: "Europe",
  // Asia
  japan: "Asia", china: "Asia", "south korea": "Asia", korea: "Asia", india: "Asia",
  kazakhstan: "Asia", iran: "Asia", lebanon: "Asia",
  // Oceania
  "new zealand": "Oceania", australia: "Oceania",
  // South America
  chile: "South America", argentina: "South America", brazil: "South America",
  // Africa
  "south africa": "Africa", morocco: "Africa",
}

export const CONTINENT_ORDER = [
  "North America",
  "Europe",
  "Asia",
  "Oceania",
  "South America",
  "Africa",
  "Multiple",
  "Other",
] as const

export function countryToContinent(country?: string | null): string {
  if (!country) return "Other"
  const key = country.trim().toLowerCase()
  if (!key) return "Other"
  // Tour rows that span countries are tagged "multiple" in the catalog.
  if (key === "multiple" || key.includes("multiple") || key.includes("various")) return "Multiple"
  return COUNTRY_TO_CONTINENT[key] ?? "Other"
}

/** Best single-line location string for an event: a linked Place name wins, else
 *  the imported venue/city/country fields, joined and de-duplicated. */
export function eventLocationText(
  opts: { placeName?: string | null; venue?: string | null; city?: string | null; country?: string | null }
): string | null {
  if (opts.placeName) return opts.placeName
  const parts = [opts.venue, opts.city, opts.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
  // Drop a country of "multiple" from the visible string; it is grouping metadata.
  const cleaned = parts.filter((p) => p.toLowerCase() !== "multiple")
  const seen = new Set<string>()
  const dedup = cleaned.filter((p) => {
    const k = p.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return dedup.length ? dedup.join(", ") : null
}
