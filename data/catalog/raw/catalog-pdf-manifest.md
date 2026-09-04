# Archived brand catalog PDFs (Wayback CDX sweep, 2026-09-03)

The sweep behind Part 2 of the v0.3 brief. Every URL below was found with a CDX query of
the form:

```
https://web.archive.org/cdx/search/cdx?url=<domain>&matchType=domain&filter=mimetype:application/pdf&fl=timestamp,original&collapse=urlkey
```

Fetch any of them through `https://web.archive.org/web/<timestamp>id_/<url>`. That form
returns the original bytes and works from a browser tab; neither the cloud container nor
the laptop shell has network to archive.org, so this is browser-only work.

## Domains swept

20 domains, 369 archived PDFs total, 20 of them catalog-shaped.

| Domain | PDFs | Domain | PDFs |
|---|---|---|---|
| burton.com | 184 | gnu.com | 30 |
| ridesnowboards.com | 71 | nidecker.com | 33 |
| nitrousa.com | 11 | lib-tech.com | 10 |
| k2snowboards.com | 9 | romesnowboards.com | 6 |
| salomonsnowboard.com | 3 | neversummer.com | 3 |
| yesnowboard.com | 3 | arborcollective.com | 2 |
| bataleon.com | 2 | capitasnowboarding.com | 1 |
| morrowsnowboards.com | 1 | forumsnowboards.com | 0 |
| simsnow.com | 0 | optionsnowboards.com | 0 |
| palmerusa.com | 0 | jonessnowboards.com | 0 |

Burton's 184 and Nidecker's 33 are almost entirely non-catalog PDFs (manuals, dealer
forms, press releases). The catalog-name filter found none in either, which is worth a
second manual look before concluding Burton published no archived catalog PDF.

## Catalogs harvested this pass

| Brand | Season | Pages | Text layer | Result |
|---|---|---|---|---|
| Ride | 2005/06 | 45 | good | 6 models confirmed |
| Ride | 2006/07 | 17 | good | 8 models confirmed |
| Ride | 2008/09 | 75 | good | 6 models confirmed |
| Ride | 2009/10 | 98 | good | 6 models confirmed |
| Arbor | 2014 | 25 | good | 15 models confirmed |

41 model rows confirmed against a primary catalog. Details in
`review/catalog-confirmations.csv`.

## Catalogs found but NOT harvested

| Brand | Season | Why |
|---|---|---|
| K2 | 2005/06 | 17 pages, only ~9.4k chars of text. Image-based; needs OCR or page screenshots. |
| K2 | 2008/09 | Fetch failed against the Wayback copy. Retry, or find another snapshot. |
| Lib Tech | 2006/07 | The archived file is 2 pages, not a catalog. |
| Bataleon | 2011/12 | The archived file is 1 page of 30 characters. Effectively empty. |
| Ride | 2006/07 JPN, 2006/07 US alt, 2009/10 DE, 2009/10 FR | Non-English duplicates of seasons already harvested. |
| Cappel, DFC | 2005/06, 2006/07 | Apparel brands, not snowboards. |

## Still open from the brief

- **Arbor Issuu archive** (`arborcollective.com/pages/snow-catalog-archive`): every catalog
  1995/96 to 2025/26 as Issuu embeds. This is the single richest target left, and it covers
  exactly the years the database is thinnest on. Issuu text is not fetchable from the cloud;
  it needs a browser tab reading the reader's text layer per spread.
- **Issuu brand accounts** (2009 onward): capita, rome sds, nitro snowboards, salomon
  snowboards, yes snowboards, jones snowboards, never summer, bataleon, gnu, lib tech,
  ride snowboards, k2 snowboarding.
- **The 1990 to 1994 hole**: Snowboarder Magazine buyer's guides 1989 to 1993 on archive.org
  (`snowboarder-magazine-89-93`) and the Board Vault 1994 scans
  (`boardvault.net/catalogs-preview/1994-transworld-buyers-guide` and
  `1994-snowboarder-buyers-guide`).

## Method note for the next pass

Confirming our own model names against a catalog's text is safe and cheap. Going the other
way, reading model names *out* of catalog text automatically, is not: catalog PDFs
interleave marketing copy, size charts, and rider names, and a regex will happily invent
boards that never existed. The Ride catalogs each list roughly 25 boards while we matched
6 to 8, so the gap is real and worth harvesting, but it should be done by reading the
board-spec pages, not by pattern-matching the whole document.
