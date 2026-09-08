# QA verification of sampled podium rows (v0.2)

Sample: 40 rows from `review/qa-sample-results.json`, drawn across seven mining agents.
Method: every cited URL opened and read. Where a row's own source was ambiguous or contested,
a second independent source was opened to break the tie. web.archive.org is blocked from this
environment; web search budget was exhausted mid-run, so all checks after that point were done by
direct URL fetch.

Effort was weighted as instructed: 11 `likely` X Games / Dew Tour rows and 4 pre-1990 rows checked
in depth (plus tie-break fetches), FIS and Olympedia rows spot-checked, and an extra out-of-sample
probe run against the largest unsampled risk cluster (see PATTERNS).

## Verdicts

| edition_id | discipline / division | place | rider | verdict | finding |
| --- | --- | --- | --- | --- | --- |
| air-and-style--2019 | big-air womens | 2 | Anna Gasser | supported | |
| air-and-style--2002 | big-air open | 1 | David Benedek | supported | |
| the-arctic-challenge--2010 | slopestyle mens | 2 | Torstein Horgmo | supported | Source carries both an event podium and TTR season standings; the row took the event podium correctly. |
| toyota-big-air--2004 | big-air open | 2 | Eero Ettala | supported | |
| burton-european-open--2015 | halfpipe mens | 1 | Iouri Podladtchikov | supported | |
| us-open-snowboarding--1991 | slalom mens | 1 | Chris Carol | supported | Name is as printed by the source. The rider is normally spelled **Chris Karol**; flag for entity resolution, not a results error. |
| laax-open--2017 | slopestyle womens | 3 | Jamie Anderson | supported | Source URL sits under a `/news/2018-19/` path but the article is the 2017 Laax Open. Year is right; the path is a trap for anyone re-checking. |
| us-open-snowboarding--2016 | halfpipe mens | 2 | Ben Ferguson | supported | |
| snowboard-jamboree--2014 | big-air mens | 3 | Antoine Truchon | supported | |
| snowboard-jamboree--2014 | halfpipe womens | 2 | Yuki Furihata | supported | |
| canada-snowboard-national-championships--2018-a | halfpipe womens | 1 | Calynn Irwin | supported | The article's prose paragraph gives a *junior* women's halfpipe podium (Ballantyne / D'Hondt / Hignell); the senior result list gives Irwin 1st. The row used the right one. |
| canada-snowboard-national-championships--2002 | boardercross womens | 1 | Mayumi Fukuda | supported | FIS lists her as CAN, so the `CAN` nationality is source-faithful. |
| mt-baker-legendary-banked-slalom--1993 | banked-slalom am | 1 | Jeremy Lichtenwaldt | supported | |
| mt-baker-legendary-banked-slalom--2002 | banked-slalom masters | 1 | Mike Cotes | supported | |
| mt-baker-legendary-banked-slalom--2019 | banked-slalom masters | 1 | Craig Newbury | supported | First read of the honor roll returned a false negative; a targeted second read of the 2019 row confirms Masters Men 30-39: Craig Newbury. |
| mt-baker-legendary-banked-slalom--2025 | banked-slalom open (NON-BINARY) | 3 | Gillian Kelly | supported | Confirmed in the 2025 final-results PDF (1:39.97, 3rd). The honor-roll page has no non-binary column, so the PDF is the load-bearing citation — keep it. |
| fis-snowboard-junior-world-championships--2021 | big-air mens | 3 | TARAKANOV Igor | supported | |
| fis-snowboard-world-championships--2019 | slopestyle womens | 3 | ANDERSON Jamie | supported | |
| fis-snowboard-world-championships--2017 | boardercross womens | 3 | MOIOLI Michela | supported | |
| fis-snowboard-world-championships--2015 | slopestyle womens | 1 | ONITSUKA Miyabi | supported | |
| us-open-snowboarding--1982 | downhill open | 1 | Tom Sims | supported | Contested flag can be closed. See note below. |
| world-snowboarding-championships-sims--1984 | halfpipe open | 1 | Terry Kidwell | supported | |
| national-snurfing-championships--1981 | slalom open | 1 | Bob Novak | supported | Timeline reads "bob novak (slalom) ... 1st at national snurfing championships" for 1981. |
| world-snowboarding-championships-sims--1985 | halfpipe open | 1 | Terry Kidwell | supported | |
| olympic-snowboarding--2026 | team open | 2 | Sommariva / Moioli | supported | |
| olympic-snowboarding--2022 | big-air mens | 1 | Su Yiming | supported | |
| olympic-snowboarding--2002 | halfpipe womens | 3 | Fabienne Reuteler | supported | |
| winter-youth-olympic-snowboarding--2020 | big-air mens | 3 | Liam Brearley | supported | |
| x-games-norway--2020 | slopestyle mens | 2 | Mark McMorris | supported | |
| winter-x-games--2010 | slopestyle womens | 3 | Janna Meyen-Wetherby | supported | |
| winter-dew-tour--2024 | jib mens | 2 | Luke Winkelmann | supported | |
| x-games-norway--2016 | superpipe mens | 3 | Chase Josey | supported | |
| winter-x-games--2003 | slopestyle mens | 2 | Jussi Oksanen | supported | |
| winter-x-games--2012 | big-air mens | 2 | Torstein Horgmo | supported | Conflict resolved in the row's favour. See note below. |
| winter-dew-tour--2023 | jib womens | 1 | Alexis Hernandez-Roland | supported | |
| winter-x-games--2000 | big-air mens | 2 | Jason Borgstede | supported | |
| winter-x-games--2025 | slopestyle womens | 2 | Kokomo Murase | supported | |
| winter-x-games--2015 | superpipe mens | 2 | Taku Hiraoka | supported | Ski SuperPipe silver that year was also 92.33; the row is on the snowboard table. |
| winter-x-games--2025 | big-air mens | 3 | Rocco Jamieson | supported | |
| winter-dew-tour--2020 | superpipe womens | 2 | Maddie Mastro | supported | |

**Counts: 40 supported, 0 partly-supported, 0 wrong-rider, 0 unsupported, 0 unreachable.**

### Note: us-open-snowboarding--1982 downhill (contested slot closed)

`review/results-slot-conflicts.csv` has Doug Bouton vs Tom Sims for downhill 1st. The two sources are
not actually in conflict about the same slot:

- snowboardinginsouthernvermont.com (Woodstock 1982): "Breaking his thumb as he crashed into the
  finish line hay bales, Californian **Tom Sims won the downhill**." Same page: **Doug Bouton**
  "won the slalom and claimed overall honors."
- burton.com "13 Firsts": "**Doug Bouton went the fastest** – 60 miles per hour according to some –
  earning him the first U.S. Open victory." It names no discipline and does not mention Sims.

The Vermont local-history account is discipline-specific and internally consistent (Sims = downhill,
Bouton = slalom + overall); the Burton blog is a loose retrospective that compresses "first US Open
victory" into a speed anecdote. Recommendation: keep Tom Sims as downhill 1st, add Doug Bouton as
slalom 1st / overall champion sourced to the same page, and close the conflict row with a note rather
than leaving a live contested winner in the table.

### Note: winter-x-games--2012 big-air (the mining agent was right to distrust Wikipedia)

The row's own note flags a conflict with the Winter X Games XVI Wikipedia medal table
(Kotsenburg / Piiroinen in the Big Air silver and bronze slots). Resolved against Wikipedia:

- worldsnowboardguide.com (published 31 Jan 2012, Aspen): Big Air gold McMorris, silver Horgmo,
  bronze Toutant; "Horgmo scored a perfect 50."
- Wikipedia's own Torstein Horgmo article: "Horgmo followed this up in January 2012 landing a true
  triple cork 1440 in the Winter X Games Big Air Final, scoring a perfect score of 50/50," finishing
  second to McMorris.

The 93.00 / 88.00 / 86.00 McMorris–Kotsenburg–Piiroinen trio is the 2012 **slopestyle** podium, which
the catalog already stores correctly as slopestyle. The Wikipedia XVI page (or the reader of it) had
shifted the table labels by one. The catalog's `winter-x-games--2012` block — big-air, slopestyle and
jib (Snowboard Street: Bailey / Paul / Visconti) — is correct in all three.

## PATTERNS

**1. No fabrication and no discipline-crossing in the sample.** Zero wrong riders across 40 rows and
seven agents. The wave-2 failure mode described in the brief — a ski table read as a snowboard table,
or season standings read as an event podium — did not appear in a single sampled row, and both rows
where that trap was actually present in the source (Arctic Challenge 2010 TTR standings; X Games 2015
ski SuperPipe with an identical 92.33 silver score) were handled correctly.

**2. The sample missed the largest residual risk cluster.** 316 result rows (10%) are sourced to
Wikipedia alone, against the brief's rule that Wikipedia is for series-level facts and only where its
citation can be followed. They sit in two agents: wave2-japan-europe (170) and wave2-xgames (146).
Not one of them landed in the 40-row sample, so the sample says nothing about them. I ran an
out-of-sample probe: all 24 `winter-x-games--2024` rows against the Winter X Games XXVIII page. All 24
matched exactly and no ski medallist had leaked into the snowboard rows, so the cluster is probably
sound — but it is one probe, and my own fetch of the XVI page mislabelled tables in exactly the way
the mining agents were warned about, which is a live demonstration that a single automated read of a
multi-table Wikipedia page is not reliable evidence. Recommend a dedicated pass over these 316 rows
before or shortly after import, prioritising Air & Style (105) and Toyota Big Air (53), where the
German-language table has one row per edition and a one-row offset would be silent.

**3. Verification tooling produces false negatives as well as false positives.** The first read of the
Mt Baker honor roll reported "Craig Newbury not listed for 2019" and "no non-binary division"; both
were wrong, and a targeted second read of the specific row confirmed the catalog. Any future QA pass
should re-query a negative before recording it as a correction — a false correction is as damaging to
this dataset as a false row.

**4. Source-URL paths and article prose lie more often than the tables do.** Two sampled rows sat next
to near-misses: the Laax 2017 article lives under a `/news/2018-19/` path, and the Canada Snowboard
2018 article's prose paragraph reports the *junior* women's halfpipe podium while its result list
reports the senior one. Both rows took the correct value. This is the shape of error to look for in
the rest of the table: not invention, but the wrong one of two adjacent true things.

**5. Structural checks on the full 3,149-row table are clean.** No rows without a source, no place
outside 1-3, no discipline outside the brief's vocabulary. Six duplicate (edition, discipline,
division, place) slots: five are Toyota Big Air ties annotated "[tie recorded by the source]" and are
legitimate; the sixth is the us-open-1982 contested slot above.

**6. One real data-loss defect, unrelated to correctness.** 81 rows carry `discipline: other`, all with
an empty `event_name`; 50 of those 81 also have no note, so what the rider actually won is
unrecoverable from the row (Knuckle Huck and Snowboard Best Trick are the identifiable cases). Fix by
populating `event_name` from the source before import, or these become 50 anonymous podium slots.

**7. Sample-size honesty.** 40 of 3,149 rows is 1.3%. Zero errors in 40 puts the 95% upper bound on the
podium error rate at roughly 7%, not at zero. The verdict below is a statement about the absence of
systematic error, not about every row.

## Air & Style and Toyota Big Air table verification

Out-of-sample pass over the two clusters the sampled QA could not reach: every result row whose
`edition_id` begins `air-and-style--` (135 rows) or `toyota-big-air--` (53 rows). **188 rows checked,
one discrepancy found.**

### Method

`curl` to Wikipedia is refused by this environment's egress proxy (`CONNECT tunnel failed, 403`), and
the `action=raw` wikitext endpoint returns "this domain is cache-only", so raw table markup was not
obtainable. Every read therefore went through the summarising fetch tool — the exact step PATTERNS
item 2 flags as unreliable on multi-table pages. To compensate, **no finding below rests on a single
read**:

- `de.wikipedia.org/wiki/Air_%26_Style/Wertungen` was read **three times** with different prompts —
  (1) dump every row of every table top to bottom, (2) a table-structure interrogation of the
  1994-2001 block asking for verbatim German headings and explicit tie detection, (3) a date-keyed
  spot check of sixteen named editions spanning 1994-2013 with a separate tie question.
- `en.wikipedia.org/wiki/Toyota_Big_Air` was read **twice** — once for the whole table verbatim, once
  demanding cell-by-cell quotes for seven named years and an explicit ruling on shared thirds.
- `ja.wikipedia.org/wiki/TOYOTA_BIG_AIR` was read **twice** for the 2012-2014 winners.
- `en.wikipedia.org/wiki/Air_%26_Style` was read once as an independent cross-check on 1994 and on the
  2008/2009 format question.

Only a value that came back identical on every read was treated as source truth. This paid off: read
(3) of the German page answered "which dates are labelled Quarterpipe or Corner Challenge" with
*1995, 1996, 1997, 1998, 1999, 2000, 2001* — sweeping in three editions that reads (1) and (2) both
show carrying a single unlabelled table. That answer was discarded as a summariser artefact. It is the
same failure mode as the mislabelling warning, caught in the act, and it is why the discipline
findings below rest on reads (1) and (2), which agree on the table inventory date by date.

### 1. Offset test — negative

Deliberately anchored at both ends and sampled through the middle rather than scattered.

| Anchor | CSV | German/English table | Match |
| --- | --- | --- | --- |
| First A&S edition | `1994-a` Reto Lamm 1st | 17. Jänner 1994, Innsbruck: 1. Reto Lamm | yes |
| Second (same-year) edition | `1994-b` Ingemar Backman 1st | 19. Dezember 1994, Innsbruck: 1. Ingemar Backman | yes |
| Mid | `2002` Benedek / White / Tarte | 14. Dez 2002 Seefeld: identical | yes |
| Mid | `2005` Mosesson / Crepel / Oksanen | 3. Dez 2005 München: identical | yes |
| Mid | `2008-a` Pearce / Lago / Piiroinen | 2. Feb 2008 Innsbruck: identical | yes |
| Mid (3-edition year) | `2011-a` McMorris, `2011-b` Piiroinen, `2011-c` Badertscher | 5. Feb Innsbruck, 12. Feb München, 3. Dez Peking | yes, all three |
| Mid | `2013-a` Willett, `2013-c` Thorgren | 2. Feb 2013 Innsbruck, 8. Dez 2013 Peking | yes |
| Last A&S edition | `2019` Parrot (M) / Onitsuka (W) | 14. Dez 2019 Peking, Männer + Frauen | yes |
| First Toyota | `1997` Rohrer / Ploetzenneder / Albin | 1997 row | yes |
| Mid Toyota | `2004`, `2008`, `2011` | identical incl. tied thirds | yes |
| Last Toyota | `2014` Maxence Parrot | 第18回 2014: マクセンス・パロット | yes |

**No offset exists in either series.** The A&S series is the harder case because 1994 holds two
editions and 2011, 2013, 2015, 2016 and 2017 hold three apiece — precisely the shape that would let a
shift hide. The `-a`/`-b`/`-c` suffixes are correctly ordered by date within every multi-edition year,
including the December-1994 second edition that starts the off-by-one risk.

### 2. Wrong division — none found

The German page splits by division on exactly five occasions: 1999 (Quarterpipe Männer / Damen), 2000
and 2001 (Corner Challenge Männer / Damen), and 2017 Peking / 2018 Peking / 2019 Peking (Männer /
Frauen). Every corresponding CSV row sits on the correct side:

- `1999 quarterpipe mens` Andrew / Köffler / Nyvelt = Quarterpipe **Männer**; `1999 quarterpipe womens`
  Richon / Pederzolli / Molin Kongsgaard = Quarterpipe **Damen**. Not swapped.
- `2000 other womens` and `2001 other womens` (Richon 1st in both) = Corner Challenge **Damen**. Not swapped.
- `2017-b` mens McMorris / Collins / Bergrem and womens Gasser / Onitsuka / Rukajärvi = the 25. Nov 2017
  Peking Männer and Frauen tables respectively. Not swapped.
- `2019` mens Parrot / Thorgren / Corning and womens Onitsuka / Gasser / Blouin = 14. Dez 2019 Männer
  and Frauen. Not swapped. (Gasser appears in both years' women's tables and Thorgren in both men's —
  a swap here would have been easy to make and was not made.)
- Toyota Big Air carries no women's results at all on either source; all 53 rows are `open`. Correct.

The three `2017-a big-air womens` rows (Rukajärvi / Ormerod / Candrian, Innsbruck) are **not
corroborated or contradicted** by the German page, which lists only one unlabelled table for 2.-5.
Februar 2017 Innsbruck. That unlabelled table matches the CSV's `2017-a mens` row exactly, so the
men's side is confirmed and the women's side simply rests on its other cited source. Not an error;
flagged only as the three rows in this cluster this pass could not reach.

Minor inconsistency, not a correction: `1999` and `2004` big-air rows are labelled `mens` while the
neighbouring 2002/2003/2005 big-air rows are labelled `open`, from identically unlabelled source
tables. 1999 is defensible (a women's quarterpipe ran that day); 2004 is not — nothing gendered ran in
2004. Harmless for lookup, but it is a labelling inconsistency inside one series.

### 3. Wrong discipline — none found

Table inventory from reads (1) and (2), which agree:

| Date | Tables on the German page | CSV discipline | Verdict |
| --- | --- | --- | --- |
| 1994-1996, 1998 | one unlabelled table each | `big-air` | correct |
| 6. Dez 1997 | **two**: Straight Jump, Quarterpipe | `big-air` + `quarterpipe` | correct, both captured |
| 4. Dez 1999 | **three**: Straight Jump, Quarterpipe Männer, Quarterpipe Damen | `big-air` + `quarterpipe` ×2 | correct |
| 9. Dez 2000, 15. Dez 2001 | **three each**: Straight Jump, Corner Challenge Männer, Corner Challenge Damen | `big-air` + `other` ×2 | correct — Corner Challenge is neither big air nor quarterpipe, so `other` is right |
| 2. Feb 2008, 31. Jan 2009 | one table each | `quarterpipe` | correct; the standalone Bergisel quarterpipe editions, corroborated by the English article ("quarterpipe", Kevin Pearce) |
| 5. Dez 2009 onwards | one table per event (plus Männer/Frauen splits) | `big-air` | correct |

**Skateboard contamination: none.** The German page carries a separate skateboard section (Tony Hawk
1999, Lincoln Ueda 2000, Sandro Dias 2001) and the English article lists skateboard winners too. Not
one of those riders appears anywhere in the 135 A&S rows. The 15. Dezember 2001 date is the trap —
it holds both a snowboard Straight Jump and a skateboard contest — and the CSV took Gimpl /
Heristchian / Backman from the snowboard table, not Dias / Gagnon / Ringström from the skateboard one.
Likewise the freestyle motocross (2003-2006) and freestyle snowmobile (2007) tables and the 2006/2007
Rookie Challenge sub-contests are all correctly absent.

### 4. The one discrepancy

`air-and-style--1994-a` is scored **1. Reto Lamm, 2. Bryan Iguchi, 2. Shaun Palmer, 4. Terje Håkonsen,
5. Tommy Brunner** — Iguchi and Palmer are tied for second, and the source's own next place number is
4, so **the inaugural edition has no third place**. The CSV records Palmer at place 3.

All three reads of the German page agree: read (1) printed "2. Bryan Iguchi / 2. Shaun Palmer / 4.
Terje Håkonsen"; read (2), asked directly whether two riders share place 2, answered yes and returned
the source's parenthetical **"(punktegleich)"**; read (3), asked for a tie ruling on sixteen dates,
returned a tie for this one and for no other A&S edition. The English article gives winners only and
does not contradict it.

This is the same tie-recording situation the catalog already handles correctly five times in Toyota
Big Air, so the fix should follow that established convention.

| edition_id | discipline | division | rider | field | current | corrected |
| --- | --- | --- | --- | --- | --- | --- |
| `air-and-style--1994-a` | big-air | open | Shaun Palmer | `place` | `3` | `2` |
| `air-and-style--1994-a` | big-air | open | Shaun Palmer | `notes` | *(empty)* | `[tie recorded by the source]` |

Recommend adding the same annotation to the Bryan Iguchi row so the duplicate `place = 2` slot is
self-explaining and does not read as a validation defect, exactly as the Toyota ties do.

### 5. Toyota Big Air — clean, ties included

All 53 rows match. The English table covers 1997-2011 and the CSV reproduces it exactly, including
every shared third place: 2005 (Hjelmstadstuen + Müller), 2007 (Autti + Müller), 2008 (Pearce +
Yamamoto), 2010 (Autti + Smits), 2011 (McMorris + Smits). Both reads of the English page confirmed
each of those five independently when asked to rule on shared thirds cell by cell. 2012 Scotty Lago,
2013 Antoine Truchon and 2014 Maxence Parrot match both reads of the Japanese article, which gives
winners only for those three years — consistent with the CSV holding a single place-1 row for each.

One nationality note, not a correction: the Japanese article calls Truchon アメリカ (USA); the CSV has
`CAN`, sourced to the German biography article, and `CAN` is correct.

### 6. Gaps found while verifying (not errors in existing rows)

The German table carries podiums the CSV does not hold. These are missing rows, not wrong ones, and
none of them causes an offset — but the cluster is not fully mined:

| Edition | Status | Podium in the source |
| --- | --- | --- |
| `air-and-style--2015-c` (Beijing, 5 Dec 2015) | edition exists in `editions.csv`, **zero result rows** | 1 Maxence Parrot, 2 Mark McMorris, 3 Sven Thorgren |
| Beijing, 17.-19. Nov 2016 | **no edition and no rows** — the year holds only `2016-a` and `2016-b` | 1 Marcus Kleveland, 2 Sébastien Toutant, 3 Darcy Sharpe |
| `air-and-style--2018` (Beijing, 24 Nov 2018) | edition exists, **zero result rows** | Männer: 1 Sven Thorgren, 2 Takeru Otsuka, 3 Clemens Millauer. Frauen: 1 Anna Gasser, 2 Miyabi Onitsuka, 3 Laurie Blouin |
| LA slopestyle, 2015 / 2016 / 2017 | not captured | 2015: Sandbech / Kadono / Toutant. 2016: Thorgren / Parrot / Sandbech. 2017: Kleveland / Parrot / Ciccarelli |
| `toyota-big-air--2013` 2nd place | not captured | 山根俊樹 (Toshiki Yamane) — named as 準優勝 in both reads of the Japanese article, and noted there as the best Japanese result in the event's history |

Adding the Beijing 2016 edition would also resolve the numbering oddity already flagged in
`editions.csv`, where Method Mag calls Innsbruck 2017 the 34th edition against Wikipedia's 25th.

### Verdict

**The tables match.** 188 rows checked against their cited sources under a
no-single-read rule; 185 confirmed correct, 3 (the 2017-a women's podium) not covered by these
sources, and 1 wrong value found — a tied second place at the January 1994 edition recorded as a
third. There is no offset in either series, no division swapped, no discipline mislabelled, and no
skateboard, motocross or snowmobile result contaminating the snowboard database. The single largest
silent-corruption risk identified in the sampled QA pass is closed.
