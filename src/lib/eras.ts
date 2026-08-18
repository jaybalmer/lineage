// The five-era spine, shared by the FTUE and /api/stats/user.
//
// These boundaries decide which era a rider's first season lands in, and they
// are surfaced in two places that must never disagree: the FTUE's year-reveal
// beat and the post-signup stats endpoint. Keeping the bounds here means a
// rider who is told "the Boom Era" during signup is not told something else on
// their profile ten seconds later.
//
// Era COPY differs by surface on purpose. /api/stats/user rotates through
// several context lines; the FTUE needs one deterministic headline and body so
// the reveal reads the same every time it is tested.

export type EraKey = "pioneers" | "boom" | "golden_age" | "evolution" | "modern"

export const ERA_BOUNDS: {
  maxYear: number
  key: EraKey
  /** Mid-sentence form, e.g. "You came up in the Boom Era." */
  label: string
  /** Standalone form for badges and chips. */
  badge: string
}[] = [
  { maxYear: 1989,     key: "pioneers",   label: "the Pioneer Era",   badge: "Pioneer Era" },
  { maxYear: 1997,     key: "boom",       label: "the Boom Era",      badge: "Boom Era" },
  { maxYear: 2006,     key: "golden_age", label: "the Golden Age",    badge: "Golden Age" },
  { maxYear: 2015,     key: "evolution",  label: "the Evolution Era", badge: "Evolution Era" },
  { maxYear: Infinity, key: "modern",     label: "the Modern Era",    badge: "Modern Era" },
]

export function eraForYear(year: number) {
  return ERA_BOUNDS.find((e) => year <= e.maxYear) ?? ERA_BOUNDS[ERA_BOUNDS.length - 1]
}

/** The FTUE's year-reveal copy. One fixed pair per era. */
export const ERA_FTUE: Record<EraKey, { headline: string; body: string }> = {
  pioneers: {
    headline: "You were there before the resorts were.",
    body: "Most mountains still banned snowboards when you started. No industry, no park, no rulebook. You are part of the group that wrote it.",
  },
  boom: {
    headline: "You came up in the Boom Era.",
    body: "Burton ads in every magazine, halfpipes going Olympic, the last of the bans falling. The sport went mainstream and you were already strapped in.",
  },
  golden_age: {
    headline: "You rode the Golden Age.",
    body: "Forum, Robot Food, Kingpin. Park laps, video premieres, crew trips to nowhere. The culture peaked and you were in the middle of it.",
  },
  evolution: {
    headline: "You rode through the Evolution.",
    body: "Park to pow, splitboards, a new definition of style. The sport grew up in the 2010s, and so did the riders who stuck with it.",
  },
  modern: {
    headline: "You're riding the most connected era yet.",
    body: "Global crews, endless footage, more access than any generation before. You're writing the chapter everyone else will look back on.",
  },
}
