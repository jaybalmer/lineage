# Linestry Snowboard Events Research Brief (v0.1)

Purpose: pre-populate a database of snowboard EVENTS for the Linestry platform, so members can
mark events they attended, competed in, worked at, or watched, and so event pages become a spine
that stories, photos and people attach to.

Scope agreed with Jay (Sept 2026):
- Contests only for v0.1: major contests plus legacy and grassroots contests with cultural weight.
- Global, 1980s to present, with extra depth on Canada and the Pacific Northwest (launch community).
- Three levels: series -> edition -> result.
- Out of scope for v0.1: film premieres, demo days, trade shows, big-mountain/freeride tours
  (Freeride World Tour, Verbier Xtreme, Natural Selection) unless a legacy contest sits inside them.

## Golden rule

DO NOT GUESS. Every row must be traceable to a source you actually opened. If you cannot confirm an
event happened, on that date, at that venue, leave the field null. An omission is fine. A fabricated
edition, a wrong winner, or a plausible-but-unchecked date is not. Never fill a year to make a series
look continuous. If a year was skipped or cancelled, say so in `status_note` only if a source says it.

Podium results are the highest-risk field in this dataset. A wrong winner is worse than no winner.
Only record a podium when a source lists it explicitly. Do not reconstruct a podium from a rider
biography or a "X-time champion" claim.

## The three tables

### 1. series (the recurring event)
One row per recurring event identity. "US Open Snowboarding Championships" is one row even though it
moved from Stratton to Vail. A materially renamed event with continuous lineage stays one row with
`former_names` populated. A genuinely different event that reused a name is a separate row.

### 2. editions (one running of the series)
One row per year the event actually ran. If a series ran twice in a calendar year (season shift,
two venues), that is two rows, disambiguated in `edition_label`.

### 3. results (podium placings)
One row per placing per discipline per edition. Only 1st, 2nd, 3rd unless a source gives more and the
event is small enough that it matters (a 6-rider legacy final, for example).

## Field definitions

series:
| field | meaning |
| --- | --- |
| series_id | slug, e.g. `us-open-snowboarding`, `mt-baker-banked-slalom` |
| series_name | current or best-known name |
| former_names | pipe-separated previous or sponsor names |
| category | major-contest, legacy-contest, grassroots-contest, national-championship, tour-stop, tour-series |
| governing_body | FIS, IOC, TTR, ESPN, brand-run, independent, etc. Null if none. |
| first_year | first edition year (calendar year the event was held) |
| last_year | last edition held. Null if ongoing. |
| status | active, defunct, dormant, revived, unconfirmed |
| home_venue | the resort/place most associated with it. Null if it moves. |
| country | primary country. `multiple` for touring series. |
| region | north-america, europe, japan, oceania, south-america, global |
| disciplines | pipe-separated from the discipline list below |
| significance | one or two sentences on why it matters. Facts only, no hype. |
| sources | URLs, pipe-separated |
| confidence | verified / likely |

editions:
| field | meaning |
| --- | --- |
| edition_id | `series_id--YYYY` (add `-a`/`-b` if two in one year) |
| series_id | FK |
| year | calendar year held |
| edition_label | e.g. "2003 US Open", "20th Legendary Banked Slalom" |
| start_date / end_date | ISO YYYY-MM-DD. Null if unsourced. Partial month allowed as YYYY-MM. |
| venue | resort or site name as it was called then |
| city / country | |
| disciplines | pipe-separated, as run that year |
| status | held, cancelled, postponed, unconfirmed |
| status_note | why cancelled, weather, venue change, COVID, etc. Only if sourced. |
| notes | anything a rider would recognise: the year the pipe was rebuilt, the storm, the first double cork landed |
| sources | pipe-separated URLs |
| confidence | verified / likely |

results:
| field | meaning |
| --- | --- |
| edition_id | FK |
| discipline | from the list below |
| division | mens, womens, open, masters, juniors, groms, pro, am |
| place | 1, 2, 3 (integer) |
| rider_name | as printed by the source |
| nationality | 3-letter code if given, else null |
| score_or_time | as printed, with units. Null if not given. |
| sources | pipe-separated URLs |
| confidence | verified / likely |

Discipline vocabulary (use exactly these):
halfpipe, superpipe, quarterpipe, slopestyle, big-air, rail-jam, banked-slalom, boardercross,
parallel-slalom, parallel-giant-slalom, giant-slalom, slalom, dual-slalom, downhill, mogul,
hip, jib, freeride, big-mountain, team, other

## Year and date conventions

- `year` is the CALENDAR year the event was held, not the season. The March 2003 US Open is 2003.
- A late-December event is the year it was held, and `notes` should say which season it belonged to.
- If a source gives only a month, use YYYY-MM in the date field. If only a year, leave dates null.
- Where sources disagree on a date, prefer the event organiser or a contemporaneous report, and put
  the disagreement in `notes`.

## Accepted sources (in order of preference)

1. Event or organiser's own site, including its results archive and Wayback Machine captures of it
2. Governing body results databases: FIS (fis-ski.com), IOC/Olympedia, Canada Snowboard, USASA, TTR/WST archives
3. Contemporaneous magazine and news coverage: TransWorld Snowboarding, Snowboarder, Whitelines,
   Method, Onboard, ESPN/X Games archives, local newspaper archives
4. Resort and municipal archives, museum collections, community history projects
5. Wikipedia ONLY where it cites a primary source you can see, and for series-level facts rather
   than individual podiums. Follow its citation and cite that instead where possible.

NOT accepted as sole source: forum posts, social media captions, fan wikis without citations,
AI-generated listicles, results aggregators with no provenance.

## What to do when you cannot verify

Return the row with `confidence: likely` and a null in the unverified field, or leave the row out
entirely and add it to an `open_questions` list in your response. Open questions are valuable output.
Say exactly what you looked for, where you looked, and what was missing.

## Output format for agents

Return ONE JSON object. Use these exact keys. Write it to the file path you are given AND summarise
counts in your final message.

```json
{
  "series": [ { ...series fields, sources as array... } ],
  "editions": [ { ...edition fields, sources as array... } ],
  "results": [ { ...result fields, sources as array... } ],
  "open_questions": [
    "Mt Baker Banked Slalom: no source found for whether the 1986 event ran; baker.com archive starts 2001"
  ]
}
```

Field values use null, not empty strings, when unknown. Do not include a field you did not research.
