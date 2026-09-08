#!/usr/bin/env python3
"""Map the researched events catalog onto Linestry's EXISTING events schema.

Companion to scripts/build-catalog-import.py. Reads data/events/v0.3/*.csv (the research output,
which has its own shape) and writes data/events/v0.3/import/*.csv in the shape of the live tables.

  catalog series   -> public.event_series   (already exists; events.series_id points at it)
  catalog edition  -> public.events         (already exists; event_type = 'contest')
  catalog result   -> public.event_results  (NEW; created by the accompanying migration)

READ ONLY with respect to the database. This script writes CSVs and nothing else.

Guard rail: if data/events/schema-probe.json exists (written by scripts/export-events-tables.mjs),
every column this script emits is checked against the live column list and the script FAILS if it
would write a column the table does not have. Run the export script first. Without the probe the
script still runs, but it prints a loud warning, because the target shape is then unverified.

Usage:
  node scripts/export-events-tables.mjs      # first, to refresh the probe and the existing exports
  python3 scripts/build-events-import.py
  python3 scripts/build-events-import.py --widen   # only if start_date is a real `date` column
"""
import csv, json, os, sys, re

WIDEN = "--widen" in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "data/events/v0.3")
OUT  = os.path.join(SRC, "import")
REV  = os.path.join(ROOT, "data/events/review")
PROBE= os.path.join(ROOT, "data/events/schema-probe.json")
os.makedirs(OUT, exist_ok=True); os.makedirs(REV, exist_ok=True)

def rows(p):
    with open(os.path.join(SRC, p), newline="") as fh: return list(csv.DictReader(fh))
def pipe(v): return [x.strip() for x in (v or "").split("|") if x.strip()]
def arr(v):  return "{" + ",".join('"' + x.replace('"', '\\"') + '"' for x in pipe(v)) + "}"

# frequency is a live enum: annual | tour | irregular. Map the catalog's category onto it.
FREQ = {"tour-series": "tour", "tour-stop": "annual", "major-contest": "annual",
        "legacy-contest": "annual", "grassroots-contest": "annual", "national-championship": "annual"}

series_in   = rows("series.csv")
editions_in = rows("editions.csv")
results_in  = rows("results.csv")

# ---------------------------------------------------------------- event_series
series_out = []
for s in series_in:
    series_out.append({
        "id": s["series_id"],
        "name": s["series_name"],
        "frequency": FREQ.get(s["category"], "irregular"),
        "start_year": s["first_year"] or "",
        "end_year": s["last_year"] or "",
        "description": s["significance"] or "",
        # catalog-only provenance; the migration adds these columns
        "catalog_category": s["category"],
        "catalog_status": s["status"],
        "governing_body": s["governing_body"] or "",
        "region": s["region"] or "",
        "home_venue": s["home_venue"] or "",
        "country": s["country"] or "",
        "former_names": arr(s["former_names"]),
        "disciplines": arr(s["disciplines"]),
        "sources": arr(s["sources"]),
        "confidence": s["confidence"],
    })

# --------------------------------------------------------------------- events
# Dates. 181 catalog editions are known only to the year and 26 only to the month.
#
# The repo already solves this: src/lib/utils.ts formatPartialDate (line 103 region) accepts "YYYY",
# "YYYY-MM" and "YYYY-MM-DD" and renders "1986", "Mar 1992", "15 Mar 1992", and formatEventDateRange
# builds on it. That helper only exists because events.start_date already carries partial strings,
# which means the column is text, not date. So by DEFAULT this script writes the partial string
# through unchanged and every existing surface renders it correctly with no UI change at all.
#
# If the schema probe shows start_date is a real `date` column, that assumption is wrong. Re-run with
# --widen: partial dates then become the first of the month or year and date_precision carries the
# truth, and every surface that renders start_date must branch on it or it will state a day no source
# supports. Prefer the default. review/undated-editions.csv lists the affected rows either way.
events_out, undated = [], []
for e in editions_in:
    row = {
        "id": e["edition_id"],                 # slug; external_ref carries it too, see the brief
        "external_ref": e["edition_id"],
        "name": e["edition_label"] or f'{e["year"]} {e["series_id"]}',
        "series_id": e["series_id"],
        "year": e["year"],
        "start_date": e["start_date"],
        "end_date": e["end_date"] or "",
        "event_type": "contest",
        "description": e["notes"] or "",
        "community_status": "verified" if e["confidence"] == "verified" else "unverified",
        # catalog-only provenance; the migration adds these columns
        "catalog_status": e["status"],
        "catalog_status_note": e["status_note"] or "",
        "date_precision": ("day" if len(e["start_date"] or "") == 10
                           else "month" if len(e["start_date"] or "") == 7
                           else "year" if len(e["start_date"] or "") == 4 else ""),
        "venue_name": e["venue"] or "",
        "city": e["city"] or "",
        "country": e["country"] or "",
        "disciplines": arr(e["disciplines"]),
        "sources": arr(e["sources"]),
        "confidence": e["confidence"],
    }
    if not row["start_date"]:
        row["start_date"] = str(e["year"])          # year-only is a legitimate partial date here
        row["date_precision"] = "year"
    if row["date_precision"] != "day":
        undated.append(row)
    if WIDEN:
        d = row["start_date"]
        if len(d) == 7: row["start_date"] = d + "-01"
        elif len(d) == 4: row["start_date"] = d + "-01-01"
    events_out.append(row)

# --------------------------------------------------------------- event_results
have = {e["id"] for e in events_out}
results_out, orphan = [], []
for r in results_in:
    row = {
        "event_id": r["edition_id"],
        "discipline": r["discipline"],
        "division_label": r["division_label"] or "",
        "division_gender": r["division_gender"],
        "division_class": r["division_class"],
        "division_age_band": r["division_age_band"] or "",
        "event_name": r["event_name"] or "",
        "place": r["place"],
        "rider_name": r["rider_name"],
        "nationality": r["nationality"] or "",
        "score_or_time": r["score_or_time"] or "",
        "notes": r["notes"] or "",
        "sources": arr(r["sources"]),
        "confidence": r["confidence"],
        "citation_status": r["citation_status"] or "",
    }
    (results_out if r["edition_id"] in have else orphan).append(row)

def write(path, rows_):
    if not rows_:
        open(path, "w").close(); return
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows_[0].keys())); w.writeheader(); w.writerows(rows_)

write(os.path.join(OUT, "event_series.csv"), series_out)
write(os.path.join(OUT, "events.csv"), events_out)
write(os.path.join(OUT, "event_results.csv"), results_out)
write(os.path.join(REV, "undated-editions.csv"), undated)
write(os.path.join(REV, "orphaned-results.csv"), orphan)

print(f"event_series.csv   {len(series_out):5d}")
mode = "widened to a real date, date_precision carries the truth" if WIDEN else "partial strings written through as-is"
print(f"events.csv         {len(events_out):5d}   ({len(undated)} are not day-precision; {mode})")
print(f"event_results.csv  {len(results_out):5d}   ({len(orphan)} orphaned, which must be 0)")

# ------------------------------------------------------- shape check vs live schema
if os.path.exists(PROBE):
    probe = json.load(open(PROBE))
    problems = []
    for table, got in (("event_series", series_out), ("events", events_out)):
        info = probe.get("tables", {}).get(table, {})
        if not info.get("exists"): problems.append(f"{table}: not found live ({info.get('error')})"); continue
        live = set(info.get("columns") or [])
        extra = [c for c in got[0].keys() if c not in live]
        if extra: problems.append(f"{table}: columns not present live, the migration must add them: {', '.join(extra)}")
    if problems:
        print("\nSHAPE CHECK:"); [print("  " + p) for p in problems]
        print("  This is expected before the migration runs, and must be empty after it.")
    else:
        print("\nSHAPE CHECK: every emitted column exists live.")
else:
    print("\nWARNING: data/events/schema-probe.json is missing, so the emitted shape is UNVERIFIED.")
    print("         Run `node scripts/export-events-tables.mjs` first. Do not import without it.")
