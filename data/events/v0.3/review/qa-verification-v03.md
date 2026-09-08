# QA verification — v0.3 Wayback Machine wave

Checked 2026-09-07 against the Internet Archive (web.archive.org), reached through the user's
browser. Every cited snapshot was opened; every cited URL was additionally checked against the
Wayback CDX index to confirm the exact path + timestamp actually exists as a capture.

Verdict vocabulary: `supported`, `partly-supported`, `wrong-value`, `unsupported`, `unreachable`.

Throughout, **`partly-supported` on a result row means the factual claim (rider / place / division /
discipline / time) is confirmed by the archive, but the cited URL is defective** — it points at a
path or timestamp that is not the page the data came from. No sampled result row was found to state
a wrong rider, place, division or discipline.

## Sampled RESULT rows (35)

| # | edition_id | division_label | place / rider | verdict | evidence |
|---|---|---|---|---|---|
| 0 | burton-european-open--2006 | Girl's Halfpipe Finals | 1 Emilie Aubry, SUI | supported | page prints "Girl's Halfpipe Finals / Emilie Aubry, SUI" (only finisher) |
| 1 | burton-european-open--2006 | Junior's Slopestyle Finals | 1 Christian Haller, SUI | supported | listed first in rank order |
| 2 | burton-european-open--2006 | Boy's Halfpipe Finals | 1 Nico Kurz, SUI | supported | "Ben Watts, USA/Nico Kurz, SUI" — tie; results.csv carries both as place 1 |
| 3 | burton-european-open--2006 | Junior's Halfpipe Finals | 1 Daniel Friberg, SUI | supported | as printed (see PATTERNS P6 — source's own nationality is likely wrong) |
| 4 | burton-european-open--2006 | Men's Slopestyle Finals | 3 Janne Korpi, FIN | supported | order: Piiroinen, Autti, Korpi |
| 5 | mt-baker--2014 | Younger Amateurs | 1 Jacob Krugmire 1:57.66 | supported | page heads "SUNDAY FINALS • FEBRUARY 9, 2014"; URL valid |
| 6 | mt-baker--2016 | Junior Girls | 1 Kaitlyn Peterson 2:34.15 | partly-supported | values exact; cited path `/juniors` has **zero captures** — real page is `/next-generation-juniors` at the same timestamp |
| 7 | mt-baker--2012 | Masters | 1 Adam Haynes 1:31.72 | supported | "2012 LEGENDARY BANKED SLALOM / SUNDAY FINALS / MASTERS • ages 30-39"; Bend, Oregon |
| 8 | mt-baker--2016 | Next Generation Boys | 3 Caleb Chomlack 2:20.34 | partly-supported | values exact; cited path `/next-generation` has zero captures |
| 9 | mt-baker--2012 | Grand Masters | 1 Randy Haugen 1:57.53 | supported | Bellingham, Washington; page menu names 2012 |
| 10 | ttr-wst--2012 | (season champion) | 1 Jamie Anderson | supported | 2011/12 section: "became the Slopestyle Tour Champion" (see P5) |
| 11 | ttr-wst--2015 | (season champion) | 1 Kelly Clark | supported | "Crowning the 2015 WST Pro Series Champions – Burton US Open, March 8th, 2015" |
| 12 | ttr-wst--2009 | (season champion) | 1 Peetu Piiroinen | supported | "2008/2009 World Tour Champions: Men's ... Peetu Piiroinen (FIN)" |
| 13 | ttr-wst--2012 | (season champion) | 1 Iouri Podladtchikov | supported | 2011/12: "TTR World Tour Halfpipe Title" |
| 14 | ttr-wst--2012 | (season champion) | 1 Kelly Clark | supported | same sentence |
| 15 | us-open--2001 | Women's Quarterpipe | 3 Pauline Richon, SUI | partly-supported | podium exact (Boulanger, Vidal, Richon); citation timestamp wrong (P2) |
| 16 | us-open--2000 | Men's Halfpipe | 3 Xavier Hoffman, GER | partly-supported | podium exact (Morisset, Powers, Hoffman); timestamp wrong (P2) |
| 17 | us-open--1987 | Junior's Slalom | 3 Todd Davidson, USA | partly-supported | podium exact (Hayes, Brandon, Davidson); timestamp wrong (P2) |
| 18 | us-open--2000 | Women's Dual GS | 3 Nadja Livers, CAN | partly-supported | page prints "Nadja Livers CAN"; timestamp wrong (P2); source nationality suspect (P6) |
| 19 | us-open--2001 | Women's Halfpipe | 2 Shannon Dunn, USA | partly-supported | podium exact (Zurek, Dunn, Bleiler); timestamp wrong (P2) |
| 20 | winter-dew-tour--2012-c | Snowboard Superpipe (Women) | 2 Queralt Castellet 80.00 | partly-supported | exact on `/event-results/10026/346`; cited path has zero captures (P3) |
| 21 | winter-dew-tour--2012-c | Snowboard Slopestyle (Women) | 3 Enni Rukajarvi 82.75 | partly-supported | exact on `/10026/351`; cited path has zero captures (P3) |
| 22 | winter-dew-tour--2011-c | Snowboard Superpipe (Men) | 3 Iouri Podladtchikov, no score | partly-supported | exact on `/1867/331` ("Dew Tour Breckenridge 2011"), score printed as "-" (P3) |
| 23 | winter-dew-tour--2012-c | Snowboard Big Air | 3 Staale Sandbech 69.25 | partly-supported | exact on `/10026/287`; page indeed gives no gender label (P3) |
| 24 | winter-dew-tour--2015 | Snowboard Superpipe (Women) | 3 Kelly Clark 84.40 | partly-supported | exact on `/35946/346` (Liu, Kim, Clark) (P3) |
| 25 | mt-baker--2018 | Women Amateurs (16-29) | 3 Jacqui Shaffer 1:30.01 | partly-supported | values exact; cited path `/women-ams` has zero captures — real page `/women-amateurs` at same timestamp. Page heading is just "Women Amateurs"; the "(16-29)" bracket is not printed anywhere on it |
| 26 | us-open--1990 | Men's Slalom | 3 Jean Nerva, FRA | partly-supported | podium exact (Colturi, Dabbeni, Nerva); timestamp wrong (P2) |
| 27 | us-open--1995 | Women's Halfpipe | 2 Nicole Angelrath, SUI | partly-supported | podium exact (Jarvela, Angelrath, Waara); timestamp wrong (P2) |
| 28 | mt-baker--2016 | Pro Masters Women | 1 Marni Yamada 1:53.96 | partly-supported | values exact on `/Pro-Masters-Men-Women` (same timestamp); cited path `/pro-masters` has zero captures |
| 29 | mt-baker--2013 | Grand Masters | 3 Mike Cotes 1:59.232 | supported | "2013 LEGENDARY BANKED SLALOM FINALS"; Spokane, Washington; URL valid |
| 30 | us-open--2006 | Women's Quarterpipe | 2 Junko Asazuma | supported | "2006 US OPEN FINAL RESULTS": Beaman, Asazuma, Aguirre. URL valid |
| 31 | us-open--1984 | Women's Downhill | 1 Holly McDonald, USA | partly-supported | podium exact; page names 1984; timestamp wrong (P2) |
| 32 | us-open--1985 | Men's Downhill | 1 Andy Coghlan, USA | partly-supported | podium exact; timestamp wrong (P2); page body never prints "1985" (P4) |
| 33 | mt-baker--2016 | Junior Girls | 2 Hayley Houston 2:40.77 | partly-supported | values exact; cited path has zero captures |
| 34 | us-open--1989 | Women's Downhill | 2 Carla Dalpiaz, USA | partly-supported | podium exact (Lofthus, Dalpiaz, Higgins); timestamp wrong (P2) |

Result-row counts: **supported 15, partly-supported 20, wrong-value 0, unsupported 0, unreachable 0.**

## Sampled EDITION rows (12, plus the out-of-sample 2024 cancellation)

| # | edition_id | claim | verdict | evidence |
|---|---|---|---|---|
| 0 | mt-baker--2019 | 2019-02-08 / 02-10, held | supported | 29 Jan 2019 homepage: "33rd • February 8, 9, & 10 • 2019" |
| 1 | mt-baker--2017 | 2017-02-10 / 02-12, held | partly-supported | cited capture is from **April 2016**, ten months ahead, and reads "31st LEGENDARY BANKED SLALOM • February 10-12, 2017* *dates subject to change". A Jan 2017 capture (20170108041925) still carries the same caveat. The archive confirms the event ran (Apr 2017 capture shows 2017 results) but never confirms the dates were kept |
| 2 | mt-baker--2008 | 2008-02-08 / 02-10, held | partly-supported | cited page (`sun_promen.php`) states only "FINALS • SUNDAY Feb. 10, 2008" — the end date. Start date is confirmed by a **different** archived page: `web/20080118174651id_/http://www.lbs.mtbaker.us/lbs.php` — "2008 Legendary Banked Slalom Feb. 8, 9 & 10" |
| 3 | us-open--2010 | 2010-03-16 / 03-21, held | unsupported | the cited capture (20090901021631 opensnowboarding.com) is the Flash-driven BGOS homepage; its entire text is 1,477 chars and contains no event dates at all. Neighbouring 2010 captures are equally Flash-only. Dates rest solely on the three live-web sources |
| 4 | mt-baker--2014 | 2014-02-07 / 02-09, held | supported | 5 Feb 2014 homepage: "2014 Legendary Banked Slalom • Feb. 7, 8, 9" |
| 5 | mt-baker--2013 | 2013-02-08 / 02-10, held | **unsupported** | the cited capture (20121013223123) is the **October 2012** homepage and still reads "February 10-11-12, **2012**". It supports the 2012 dates, not the 2013 ones. No archived Baker page found anywhere that states the 2013 dates; the 2013 results pages give no date, and the Honor Roll (the row's other source) lists winners only, never dates |
| 6 | mt-baker--2026 | 2026-02-06 / 02-08, cancelled, postponed to 19-21 Feb 2027 | supported | 17 Dec 2025 homepage banner "37th LBS • Feb. 6-7-8 • 2026"; 22 Jan 2026 homepage banner "37th LBS • Feb. 19-20-21, 2027 • postponement announcement". Directly stated by the organiser, **not inferred** |
| 7 | burton-european-open--2006 | 2006-01-14 / 01-21, held | supported | opensnowboarding.com 13 Feb 2006: "Burton European Open Jan. 14-21, 2006 Laax, Switzerland" |
| 8 | mt-baker--2009 | 2009-02-06 / 02-08, held | supported | 13 Feb 2009 homepage: "Mt. Baker Legendary Banked Slalom 2009 February 6th, 7th & 8th" |
| 9 | burton-european-open--2004 | 2004-01-10 / 01-17, held | supported | opensnowboarding.com 5 Feb 2004: "Burton European Open January 10-17, 2004 Livigno, Italy" |
| 10 | us-open--2003 | 2003-03-11 / 03-16, held | supported | opensnowboarding.com 5 Feb 2003: "Mar 11 - 16, 2003 Stratton, VT usopen-snowboarding.com" |
| 11 | mt-baker--2010 | 2010-02-05 / 02-07, held | supported | 17 Dec 2009 homepage: "Mt. Baker Legendary Banked Slalom February 5-6-7, 2010" |
| — | mt-baker--2024 (not in sample; checked because the task named it) | 2024-02-09 / 02-11, cancelled, rescheduled to Feb 2025 | supported | 30 Jan 2024 homepage: "36th Legendary Banked Slalom February 9-10-11, 2024"; 21 Mar 2024 homepage: "36th Legendary Banked Slalom **Re-scheduled to February 2025**". Directly stated, not inferred |

Edition-row counts (12 sampled): **supported 8, partly-supported 2, unsupported 2, wrong-value 0, unreachable 0.**

---

# PATTERNS

The single most important finding of this wave is not any individual row. It is that **the citation
strings are systematically unreliable while the extracted values are systematically reliable.**
Every one of the 35 sampled result rows had its rider, place, division and discipline confirmed
against the archived page. Not one was a qualifier misfiled as a final, not one had a shifted
column, not one had a wrong winner. But 20 of 35 carry a URL that does not lead to the page the data
came from — and on dead sites, an unverifiable citation is close to no citation at all.

To quantify the pattern beyond the sample, all **150 distinct web.archive.org URLs** in
`v0.3/results.csv` and `v0.3/editions.csv` (906 references) were checked against the Wayback CDX
index. **34 of the 150 are broken** — the exact path or the exact timestamp has no capture.

### P1 — Truncated / re-spelled last path segment (Mt Baker), 14 broken URLs
The last path segment of Mt Baker per-division URLs has been normalised to the catalog's own
division shorthand instead of the site's real (and often oddly truncated) slug. The timestamp is
almost always correct — it is the real capture time of the real page — so these are recoverable
one-for-one. Confirmed mappings:

- 2014 (`/index.php/results1/results-2014/finals/…`): `next-generation` → `next-gener`,
  `mid-masters` → `mid-maste`, `pro-women-masters` → `pro-women-maste`, `pro-men` → `pro-me`
- 2016 (`/index.php/results/Finals-results-Sunday/…`): `juniors` **and** `next-generation` both →
  `next-generation-juniors`; `pro-masters` → `Pro-Masters-Men-Women`; `older-amateurs` →
  `younger-older-ams`; `women-amateurs` → `women-ams-masters`
- 2018 (`/index.php/results/2018-results/finals-results-Sunday/…`): `women-ams` → `women-amateurs`,
  `older-ams` → `older-amateurs`, `younger-ams` → `younger-amateurs`; `pro-legends` and
  `women-midgrand` do not exist under any spelling and need to be re-derived (candidates in the
  archive are `pro-masters-2` and `women-masters-2`)

Note that this is a *citation* defect, not a data defect: in 2016 one archived page carries four
tables (Next Gen Boys/Girls, Junior Boys/Girls), and the catalog split it into four correctly-named
division rows with correct times — it then invented a per-division URL for each.

### P2 — One US Open timestamp reused for 19 different years, 18 broken
Every `usopen-snowboarding.com/history.asp?yearNum=YYYY` citation in the catalog uses the identical
timestamp `20021202101735`. That timestamp is the capture of **`yearNum=1986` only**. Wayback stores
each query string as its own URL, so 18 of the 19 citations name a capture that does not exist.
They still *resolve*, because Wayback silently redirects to the nearest capture of that exact query
string (e.g. `…101735/…yearNum=1984` lands on the real `20021202102446` capture), which is why the
content checks out. But a reader following the link is trusting a redirect, and the citation as
written is false. Correct timestamps exist for all of 1982–2001 and should be substituted; the
year-matched captures verified here are 1984→20021202102446, 1985→20021202101659,
1987→20021202103432, 1989→20021202113930, 1990→20021202114404, 1995→20021202225609,
2000→20021202102958, 2001→20021202103853.

Checks specifically asked for on the US Open block came out clean: the year in the URL matched the
year in the page content on every page opened, and every podium was the event's own result, not a
season standing.

### P3 — Dew Tour: the sub-event path was dropped entirely, 7 broken URLs
All seven Dew Tour citations are `http://www.dewtour.com/actionsports/event-results/`, which has
**no captures at all**. The real pages are `…/event-results/<eventId>/<disciplineId>`. Worse, each
cited timestamp does belong to a real capture — but to the `/326` (snowboard slopestyle men) page of
that event, regardless of which discipline the row claims. So the timestamps look plausible and are
uniformly pointing at the wrong discipline. Verified replacements:

- 2012 Snowboard Superpipe (Women) → `web/20151025175052/…/event-results/10026/346`
- 2012 Snowboard Slopestyle (Women) → `web/20151025175108/…/event-results/10026/351`
- 2012 Snowboard Big Air → `web/20151025174300/…/event-results/10026/287`
- 2011 Snowboard Superpipe (Men) → `web/20151214145158/…/event-results/1867/331`
- 2015 Snowboard Superpipe (Women) → `web/20151219020002/…/event-results/35946/346`

### P4 — Year attribution: one real failure, and a class of weak cases
The hazard is real and it caught one edition row. **mt-baker--2013's cited capture is from October
2012 and still displays "February 10-11-12, 2012"** — the previous year's dates. Whoever recorded
2013-02-08/10 did not read the year off that page. Nothing else in the archive states the 2013
dates. This row should have its dates nulled or re-sourced before merge.

A weaker version of the same problem is widespread and should be tracked rather than fixed:
several pages carry no printed year at all and inherit it from the URL path or the site nav —
the 2018 `women-amateurs` page (year only in `/2018-results/`), the 2012 Grand Masters page (year
only in the "2012 Results Menu" nav), and the US Open `yearNum=1985` and `yearNum=2001` pages, whose
body text never prints the year because those years have no video links. In each of these the year
is still adequately determined, but a reviewer should know the year is structural, not printed.

Note the flip side: where the year IS printed, it is unambiguous and was verified — "SUNDAY FINALS •
FEBRUARY 9, 2014", "Finals Results : Sunday February 21, 2016", "2013 LEGENDARY BANKED SLALOM",
"2006 US OPEN FINAL RESULTS", "Dew Tour Breckenridge 2011/2012/2015".

### P5 — TTR/WST season titles are stored as podium results
Rows 10–14 are World Snowboard Tour **season-long championship titles**, not placings at an event.
Every value is correct against `worldsnowboardtour.com/history/`, the notes on each row say plainly
what they are, and only `place: 1` rows exist (no 2nd/3rd), so nothing is being faked. But the
research brief defines `results` as podium placings within one edition, and defines an edition as
one running of the series. A whole tour season sitting in the editions table with a single "podium"
row per discipline is a modelling decision, not a sourcing error — it needs a product call before
merge, because a rider page will otherwise render "1st place, TTR World Snowboard Tour 2012" as if
it were a contest win. Also note the season/calendar-year mapping is season-end
(2008/09 → `--2009`, 2011/12 → `--2012`, 2014/15 → `--2015`) and is at least applied consistently.

### P6 — Source-level nationality errors are being faithfully copied
Two sampled rows carry nationalities that are almost certainly wrong in the *source itself*:
`Daniel Friberg, SUI` on the Burton European Open history page (Friberg is Swedish), and
`Nadja Livers, CAN` on the US Open 2000 page — where the winner of the same event, Ursula Bruhin,
is also printed as CAN, and both are Swiss. The brief says to record nationality "as printed by the
source", so these rows are correct by the rules and I have marked them supported. Flagging so the
decision is deliberate: the catalog is inheriting a known-bad column rather than nulling it.

### P7 — Cleared hazards
Three of the four things this QA pass was specifically told to hunt for did **not** occur:

- **Qualifier pages recorded as podiums:** clean. Every Mt Baker citation in the whole of
  `results.csv` (not just the sample) resolves to a Sunday-finals path — `sunday-finals`,
  `finals-results-Sunday`, `finals/`, `results-2014/finals/`, or the 2008 `sun_*.php` pages. No row
  cites `friday-qualifier`, `saturday-qualifier`, `classic-qualifier-results-thursday` or the
  Locals Qualifier, all of which exist in the archive alongside the finals. Page headings agree with
  the URL paths in every case opened.
- **Column misalignment on the archived per-division pages:** clean. Every table on the archived
  Mt Baker pages was checked cell-count-against-header: 2016 Pro Masters (20 rows + 6 rows), 2016
  Next Gen & Juniors (4 tables), 2018 Women Amateurs (8 rows) — **zero** mismatched rows. The
  archived pages do not reproduce the live Honor Roll's shifted-last-column defect. Where the
  archive does show junk in a hometown cell (e.g. "1988 Toy…" against Scotty Wittlake in 2016 Pro
  Masters Men, not a sampled row) the cell count is still correct, so it is source noise rather than
  a shift. The two-column hometown/state layout used in 2012–2013 was recombined correctly in the
  catalog notes ("Bend, Oregon"; "Spokane, Washington").
- **US Open year-in-URL vs year-in-page, and season standings:** clean, as noted in P2.

### P8 — The Honor Roll cannot support any date
`https://lbs.mtbaker.us/results/honor-roll/` is cited on all seven sampled Mt Baker edition rows as
a date source. It lists winners by year and category and contains **no dates whatsoever** (verified
on the 9 Apr 2025 capture). Every Mt Baker edition date therefore rests entirely on the single
archived homepage capture cited beside it — which is exactly why the 2013 row (P4) has nothing
holding it up. Its presence in `sources` on date-bearing rows is misleading and should be understood
as a winners source only. (Incidentally that capture also skips 2015 in its year list, consistent
with the Honor Roll defect noted elsewhere in the v0.3 review.)
