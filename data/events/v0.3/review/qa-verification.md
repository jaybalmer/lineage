# QA Verification — v0.1 editions sample (34 rows)

Checked 2026-09-07 against the URLs cited on each row. Every cited source was reachable
(web.archive.org was not needed for any row). No row is `unreachable`.

Counts: **supported 26 · partly-supported 7 · contradicted 1 · unsupported 0 · unreachable 0**

Headline: **no fabricated editions found.** Every sampled edition happened, in the year the row
says, at the venue the row says. All errors found are field-level (a date range, a discipline label,
a city, a note), not existence-level.

| edition_id | verdict | finding |
| --- | --- | --- |
| mt-baker-legendary-banked-slalom--1987 | supported | Honor roll lists 1987 winners (Pro Women: Amy Howat). Dates correctly left null — the honor roll gives no dates. |
| pacwest-banked-slalom--2022 | supported | Journal piece confirms inaugural 2022 edition at Summit East, Snoqualmie Pass, organised by Marcel Dolak. No dates in source; row correctly leaves them null. |
| dirksen-derby--2013 | supported | Organiser page: "December 13th-14th-15th, 2013", "Little Pine Chair, Mt. Bachelor", 473 racers. Exact match. |
| the-arctic-challenge--2000 | supported | the-house history: 2000 at Lofoten, halfpipe/quarterpipe/surf/skate/freeride. Match. |
| the-arctic-challenge--2007 | partly-supported | **Correction available.** Row leaves `venue` null and notes say "venue not stated in the sources I opened" — but the cited the-house article states the 2007 TAC was in **Oslo**, on **2 March 2007** (the day of Terje Haakonsen's 9.8 m quarterpipe record). Set venue=Oslo, start_date=2007-03-02, end_date=2007-03-02 (or 2007-03 if the event ran multiple days). Source: https://www.the-house.com/portal/the-history-of-the-oakley-arctic-challenge/ |
| air-and-style--2002 | supported | Wikipedia edition table: "December 14. 2002, Seefeld", 10th edition. December event correctly filed under 2002. |
| winter-games-nz--2011 | supported | Wikipedia: 13–28 August 2011, 9 sports, Dunedin/Methven/Naseby/Queenstown/Wanaka. Match. |
| kaunertal-opening--2022 | partly-supported | **Date range is not a continuous event.** Whitelines gives two discrete weekends: "Jib'n'Playground Edition Extended – 15. & 16. Oktober 2022" and "1. Kaunertal Testival Open & Snowpark Days – 19. & 20. November 2022". The row flattens these into 2022-10-15 → 2022-11-20, implying a 37-day event. Either split into two rows (`-a`/`-b`, per the brief's two-runnings rule) or add a flag saying the range is non-continuous. 37th edition is supported. |
| tenjin-banked-slalom--2015 | supported | WSF: "7.03.2015, Tenjindaira – Gunma, Japan". Match, including the "three seasons before" claim in notes. |
| canada-snowboard-national-championships--2017-b | supported | Canada Snowboard: Speed Nationals 3–9 April 2017, Mont Tremblant. Match. |
| canada-snowboard-national-championships--2017-a | supported | Canada Snowboard: Freestyle Nationals 5–12 March 2017, Mt St Louis Moonstone / Horseshoe Resort, Barrie. Match. |
| canada-snowboard-national-championships--2026-a | supported | Page states verbatim: "PLEASE NOTE THE 2026 AIR NATION NAC & NACP SCHEDULED FROM FEBRUARY 20-22, 2026 has been canceled". Venue WinSport (22 ft pipe) confirmed. `status: cancelled` is correct and the "no reason given" note is accurate. |
| us-open-snowboarding--1989 | partly-supported | Event/year/venue fine (both sources confirm Stratton for this era). But the `notes` field is **contradicted by its own citations**: Burton's history page and the Aspen Times both say of 1989 "The halfpipe made its debut at the U.S. Open… Craig Kelly captured the 'Overall' title". The row's note claims Kelly "took a second consecutive halfpipe title" — not supported, and inconsistent with a halfpipe debut. `disciplines: halfpipe\|downhill` — "downhill" and "last year the downhill was run" appear in neither cited source. Recommend rewriting the note to the sourced wording and dropping `downhill` or citing it separately. |
| us-open-snowboarding--2006 | supported | Both sources: "The 24th annual U.S. Open… Shaun White winning both halfpipe and slopestyle", quarterpipe to Danny Davis and Hana Beaman, Stratton. Dates correctly null. (The "Most Valuable Rider" claim in notes is not in the fetched text — low-stakes but unverified.) |
| burton-australian-open--2008 | partly-supported | Whitelines gives "Burton Australian Open Sept 2 – 6, 2008, Perisher Blue, Australia" — but this is a **forward-looking series calendar announcement**, not a report of the event. Dates and venue are supported *as scheduled*; `status: held` is an inference the citation does not carry. Needs a post-event source or `status: unconfirmed`. |
| usasa-national-championships--1990 | partly-supported | Event, month, venue and the snowstorm/Chuck Allen rescue are quoted accurately from the timeline ("February, at Snow Valley, California"). `city: Running Springs` is **not in the source** (the source only mentions roads to Big Bear closing). Value is factually right but unsourced — per the brief it should be null or separately cited. Minor. |
| op-wintersurf--1991 | supported | Timeline quote: February 1991, surf contest at Huntington Beach plus snowboard obstacle course/race at Bear Mountain, won by Gary Elkerton. Row matches exactly, including the single-source disclosure. |
| op-pro-snowboarding--1989 | supported | Timeline quote: "the OP Pro of Snowboarding. The contest is held at June Mountain, California", filed under 1989. Dates correctly null; the row explicitly declines to use the rider-bio podium, which is the right call under the brief. |
| fis-snowboard-world-cup--2001 | supported | FIS calendar (seasoncode 2001): earliest Tignes 17–19 Nov 2000, latest Ruka 14–17 Mar 2001. Row's 2000-11-17 → 2001-03-17 matches. See PATTERN 1 on the season-row model. (Source shows 21 calendar rows; row's note says 20 — trivial.) |
| olympic-snowboarding--2018 | supported | Olympedia: Phoenix Snow Park, Bongpyeong, Mountain Cluster; 10 events; 244 competitors / 29 nations; competition 10–24 Feb 2018. Match, and the row correctly says these are snowboard-competition dates, not Games dates. |
| fis-snowboard-world-cup--1994 | partly-supported | **Duplicate row.** FIS confirms Zell am See/Kaprun 24–26 Nov 1994, "2xPSL 2xGS" — so the facts are right. But this single stop is already the opening event of `fis-snowboard-world-cup--1995` (that row's start_date is 1994-11-24). The same competition is in the catalogue twice at two different granularities. Recommend deleting this row or converting the whole series to per-stop rows. The second cited URL (seasoncode=1994) returns no events, as the row's own note admits. |
| winter-x-games--2001 | supported | Wikipedia: Winter X Games 5, Mount Snow, Vermont. Aspen Daily News confirms Mount Snow "for the second straight year" and gives no 2001 dates — the row correctly leaves dates null. |
| winter-dew-tour--2009-b | partly-supported | **end_date unsupported, and confidence overstated.** SAM gives only a start: "stops at Vermont's Mount Snow (Jan. 8) and California's Northstar-at-Tahoe (Feb. 19)". The other cited source (Vail Resorts release) covers only Breckenridge Dec 18–21 2008 and says nothing about Northstar. start_date 2009-02-19 is supported; end_date 2009-02-22 is not in either source. Downgrade confidence from `verified` to `likely`, or null the end_date. Same caveat as PATTERN 3 — both citations are pre-event. |
| winter-x-games--2025 | supported | Wikipedia: Winter X Games 29, Aspen, Colorado, January 23–25 2025. Buttermilk is the standing Aspen venue and is carried by the second citation (xgames.com past-events). Disciplines correctly left blank. |
| winter-dew-tour--2017 | supported | Vail Resorts release: Dec 14–17 2017, Breckenridge; halfpipe/superpipe, slopestyle, Streetstyle jib session, Team Challenge. Matches the row's disciplines including the `jib`/`team` mappings. December event correctly filed under 2017. |
| fis-snowboard-junior-world-championships--2024 | supported | FIS WJC 2024 calendar: Lachtal 22–24 Mar (PGS/PSL), Livigno/Mottolino 22–30 Mar (SS/BA), Gudauri 3–7 Apr (SBX/BXT). Row's 2024-03-22 → 2024-04-07 and its venue list match. (Non-continuous range — see PATTERN 4.) |
| air-and-style--2009-b | supported | Wikipedia: 17th edition, "December 5. 2009, Innsbruck", Marko Grilc. Bergisel is the Innsbruck A&S stadium and is carried by the Whitelines citation. December event correctly filed under 2009. |
| winter-dew-tour--2010-b | supported | Wikipedia 2009–10 Winter Dew Tour: Mount Snow, West Dover VT, February 5–7 2010, and explicitly the third stop. Match. |
| fis-snowboard-junior-world-championships--2007 | supported | FIS WJC 2007 calendar: Bad Gastein, AUT, 11–13 Apr 2007, "2xSBX 2xPGS 2xPSL 2xBA". Row's dates and four disciplines match exactly. |
| fis-snowboard-world-cup--2022 | supported | FIS calendar (seasoncode 2022): opens Chur 23 Oct 2021 (2xBA), closes Silvaplana 25–27 Mar 2022. Row's 2021-10-23 → 2022-03-27 matches. See PATTERN 1. |
| winter-x-games--1998 | supported | Wikipedia: Winter X Games 2, Crested Butte, Colorado. Aspen Daily News: "over four days in January". Row's `1998-01` partial date is exactly the right level of precision under the brief. |
| winter-games-nz--2009 | supported | Wikipedia: 21–30 August 2009, 7 sports / 51 events, Dunedin, Naseby, Queenstown, Wanaka. Match. |
| blue-mountain-fis-snowboard-world-cup--2013 | **contradicted** | **Correction to apply.** Dates (1–2 Feb 2013) and venue are right, but the FIS calendar entry reads "Blue Mountain WC • QUA 4xSBX" — four snowboard cross races (M/W qualification + finals), **not a team event**. The row's `edition_label` "2013 Blue Mountain World Cup team snowboardcross" and its `team` discipline are not supported by the cited calendar; the row's own note quotes "4xSBX" while the label says team. Corrected values: edition_label = "2013 Blue Mountain World Cup snowboard cross", disciplines = `boardercross`. Source: https://www.fis-ski.com/DB/general/calendar-results.html?sectorcode=SB&seasoncode=2013&categorycode=WC&nationcode=CAN |
| winter-dew-tour--2014 | supported | World Snowboard Guide: "December 11 - 15, 2014", Breckenridge, "seventh straight year". Matches the row including the note. December event correctly filed under 2014. |

---

## PATTERNS

**1. `fis-snowboard-world-cup` uses a season-row model that breaks the brief's year rule (structural, ~33 rows, agent `olympics-fis`).**
Each row represents a whole World Cup *season* keyed to the season-*end* year, so `year: 2001` carries
`start_date: 2000-11-17`. The brief says `year` is the calendar year the event was held, and an
edition is "one running of the series". These rows are internally consistent and every sampled one
matched the FIS calendar exactly — the data is not wrong, the *shape* is. In a product where a member
marks "I was at this event", a row spanning five months and a dozen countries is not an event.
Decide before import: either keep them as season containers and mark them as such in the schema, or
explode them into per-stop editions. This is the single largest structural issue in the dataset.

**2. `fis-snowboard-world-cup--1994` double-counts the Zell am See stop already inside the 1995 season row.** Direct consequence of mixing granularities inside one series. One row must go.

**3. Announcement-as-evidence, marked `verified` (agents `xgames-dewtour`, `burton-opens`, `canada`).**
Several rows carry `status: held` and `confidence: verified` while citing only a *pre-event* schedule
announcement: `burton-australian-open--2008` (Burton Global Open Series calendar), `winter-dew-tour--2009-b`
(Vail Resorts and SAM previews), `winter-dew-tour--2017` (October schedule release), both `canada-…--2017`
rows. For events that plainly ran, this is harmless; but "verified" should mean a source confirms the
event happened, not that it was scheduled. `winter-dew-tour--2009-b` shows the failure mode: an
end_date appears that no cited source ever gave. Suggest a sweep: any row whose only citation predates
its start_date should drop to `likely`.

**4. Multi-block events flattened into one continuous date range.**
`kaunertal-opening--2022` (two weekends five weeks apart), `fis-snowboard-junior-world-championships--2024`
(three venues, three countries, 22 Mar – 7 Apr), the FIS season rows, and the Winter Games NZ rows all
present a single start/end pair. Each pair is literally sourced, but the range implies continuity that
did not exist. A `date_precision` or `multi_block` flag would fix this without re-researching anything.

**5. The dating risks flagged in the QA scope did NOT materialise — 5 out of 5 December events are filed correctly.**
`air-and-style--2002` (14 Dec 2002), `air-and-style--2009-b` (5 Dec 2009), `dirksen-derby--2013`
(13–15 Dec 2013), `winter-dew-tour--2014` (11–15 Dec 2014), `winter-dew-tour--2017` (14–17 Dec 2017)
are all under the calendar year they were held, with the season identified in `edition_label` or
`notes`. No season-vs-calendar-year error was found anywhere in the sample. Likewise **no
finals-day-as-start_date error** was found: where a source gave a multi-day window the row used the
first day (verified explicitly on Dew Tour 2017, where the release separates qualifiers 13–14 Dec from
finals 15–16 Dec and the row correctly starts on the 14th).

**6. The 1980s/90s rows are the *best*-disciplined rows in the sample, not the worst.**
All three `legacy-80s-90s` rows quote their single secondary source almost verbatim, disclose the
single-sourcing in `notes`, leave dates at month precision, and — notably — `op-pro-snowboarding--1989`
explicitly refuses to use a rider biography for a podium, which is exactly what the brief demands.
The caveat is concentration risk, not fabrication: the whole 25-row block hangs off one
Snowboarder/TransWorld timeline. Where the agent went beyond the source it was to add a correct but
uncited detail (`usasa-…--1990` city).

**7. `notes` is the weakest-governed field in the dataset.**
The only claim in the sample that is flatly contradicted by its own citation lives in `notes`
(`us-open-snowboarding--1989`, Craig Kelly's "second consecutive halfpipe title" against a source that
says the halfpipe debuted that year). Dated fields were held to the brief; prose was not. `notes` is
user-visible on an event page, so it needs the same citation discipline — worth a targeted sweep of
notes text across the full 597 rows before launch.
