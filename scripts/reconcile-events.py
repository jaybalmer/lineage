#!/usr/bin/env python3
"""
Reconcile the researched events catalog (data/events/v0.3/) against Linestry's
existing event records, and write a human review pass. This script never touches
the database and never modifies the catalog files. It only reads inputs and writes
review files under data/events/review/.

Companion to scripts/reconcile-catalog.py; same reasoning, events edition. Step 2
of features/events-catalog-import-brief.md: an import that duplicates an event that
already carries stories, tags or claims is worse than one that waits, so this runs
and is reviewed before anything is written to prod.

Inputs:
  1. The catalog:  data/events/v0.3/series.csv + editions.csv
  2. The existing list: data/events/existing-events.json
     (a live MCP snapshot of public.events + public.event_series). If the network
     export scripts/export-events-tables.mjs was run instead, this reads its
     existing-events-export.csv fallback.

Outputs:
  data/events/review/reconciliation.csv   (one row per pairing / unmatched item)
  data/events/review/summary.md           (bucket counts + the rows that need a human)

Matching is on series name + year, never on IDs (brief Step 2). Both sides are
normalised the same way before comparison.

Usage:
  python3 scripts/reconcile-events.py
"""

from __future__ import annotations

import csv
import difflib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG_DIR = ROOT / "data" / "events" / "v0.3"
REVIEW_DIR = ROOT / "data" / "events" / "review"
EXISTING_JSON = ROOT / "data" / "events" / "existing-events.json"
EXISTING_CSV = ROOT / "data" / "events" / "existing-events-export.csv"

FUZZY_THRESHOLD = 0.88

# ─── Normalisation ──────────────────────────────────────────────────────────
# Expand the short forms the brief calls out, then drop the noise words, so
# "Mt. Baker Legendary Banked Slalom" and "Baker Banked Slalom" collapse together.
EXPANSIONS = {
    r"\blbs\b": "legendary banked slalom",
    r"\buso\b": "us open",
    r"\bwssf\b": "world ski and snowboard festival",
    r"\bx games\b": "winter x games",
    r"\bworlds\b": "world championships",
}
# Dropped AFTER expansion. "championships" is intentionally dropped so a bare
# "World Championships" and "Snowboard World Championships" collide on the venue/body.
# "legendary" is dropped so the live "Baker Banked Slalom" series collapses onto the
# catalog's "Mt. Baker Legendary Banked Slalom"; without it all 10 live Baker editions
# (2019 is on the landing page) look catalog-new and import as duplicates.
NOISE_WORDS = {"snowboard", "snowboarding", "championships", "the", "mt", "mount", "legendary"}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(name: str) -> str:
    s = strip_accents((name or "").lower())
    s = s.replace("&", " and ").replace("+", " and ")
    for pat, rep in EXPANSIONS.items():
        s = re.sub(pat, rep, s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    tokens = [t for t in s.split() if t and t not in NOISE_WORDS]
    return " ".join(tokens).strip()


YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def strip_year(name: str) -> str:
    return YEAR_RE.sub(" ", name or "")


# ─── Load existing prod events ──────────────────────────────────────────────
def load_existing():
    if EXISTING_JSON.exists():
        data = json.loads(EXISTING_JSON.read_text())
        events = data["events"]
        series = {s["id"]: s for s in data["series"]}
        return events, series
    if EXISTING_CSV.exists():
        rows = list(csv.DictReader(EXISTING_CSV.open()))
        for r in rows:
            r["year"] = int(r["year"]) if r.get("year") else None
        return rows, {}
    raise SystemExit(
        "No existing snapshot. Expected data/events/existing-events.json "
        "(MCP dump) or data/events/existing-events-export.csv (export script)."
    )


def existing_series_name(ev, series_by_id) -> str:
    """The best 'series name' for an existing event: the linked series name if it
    has one, otherwise the event name with the trailing year removed."""
    sid = ev.get("series_id")
    if sid and sid in series_by_id:
        return series_by_id[sid]["name"]
    return strip_year(ev.get("name", "")).strip()


# ─── Load the catalog ───────────────────────────────────────────────────────
def load_catalog():
    series = list(csv.DictReader((CATALOG_DIR / "series.csv").open()))
    editions = list(csv.DictReader((CATALOG_DIR / "editions.csv").open()))
    series_by_id = {s["series_id"]: s for s in series}
    return series, editions, series_by_id


def main():
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    existing, existing_series = load_existing()
    cat_series, cat_editions, cat_series_by_id = load_catalog()

    # Index catalog editions by (normalised series name, year) and keep a flat list
    # for fuzzy fallback.
    cat_by_key: dict[tuple[str, int], list[dict]] = {}
    cat_flat = []
    for e in cat_editions:
        s = cat_series_by_id.get(e["series_id"], {})
        sname = s.get("series_name", e["series_id"])
        try:
            yr = int(e["year"])
        except (TypeError, ValueError):
            yr = None
        rec = {
            "edition": e,
            "series_name": sname,
            "series_slug": e["series_id"],
            "year": yr,
            "norm": norm(sname),
            "venue": e.get("venue") or e.get("city") or "",
            "confidence": e.get("confidence", ""),
        }
        cat_flat.append(rec)
        if yr is not None:
            cat_by_key.setdefault((rec["norm"], yr), []).append(rec)

    rows = []
    matched_slugs: set[str] = set()  # catalog edition_ids that matched an existing row
    counts = {"MATCH": 0, "FUZZY": 0, "EXISTING_ONLY": 0, "CATALOG_ONLY": 0}

    # ── Pass 1: every existing event, looking for a catalog counterpart ──
    matched_existing_ids = set()
    for ev in existing:
        etype = ev.get("event_type", "")
        sname = existing_series_name(ev, existing_series)
        nkey = norm(sname)
        yr = ev.get("year")
        note = ""
        bucket = None
        cat_hit = None

        if etype != "contest":
            # A gathering / episode / trip is not in a contest catalog by design.
            bucket = "EXISTING_ONLY"
            note = f"not_a_contest ({etype})"
        else:
            exact = cat_by_key.get((nkey, yr), []) if yr is not None else []
            if exact:
                cat_hit = exact[0]
                bucket = "MATCH"
            else:
                # Fuzzy: same year, ratio over threshold or containment.
                best, best_ratio = None, 0.0
                for rec in cat_flat:
                    if rec["year"] != yr:
                        continue
                    if not nkey or not rec["norm"]:
                        continue
                    ratio = difflib.SequenceMatcher(None, nkey, rec["norm"]).ratio()
                    contained = nkey in rec["norm"] or rec["norm"] in nkey
                    if contained:
                        ratio = max(ratio, 0.9)
                    if ratio > best_ratio:
                        best, best_ratio = rec, ratio
                if best and best_ratio >= FUZZY_THRESHOLD:
                    cat_hit = best
                    bucket = "FUZZY"
                    note = f"fuzzy ratio {best_ratio:.2f}; verify before merging"
                else:
                    bucket = "EXISTING_ONLY"
                    if ev.get("community_status") != "verified":
                        note = "needs_source (unverified, no catalog match)"
                    else:
                        note = "verified existing row, research did not cover it"

        if cat_hit:
            matched_slugs.add(cat_hit["edition"]["edition_id"])
            matched_existing_ids.add(ev["id"])
        counts[bucket] += 1
        rows.append({
            "bucket": bucket,
            "existing_id": ev["id"],
            "existing_name": ev.get("name", ""),
            "existing_year": yr if yr is not None else "",
            "existing_source": ev.get("community_status", ""),
            "catalog_slug": cat_hit["edition"]["edition_id"] if cat_hit else "",
            "catalog_series": cat_hit["series_name"] if cat_hit else "",
            "catalog_year": cat_hit["year"] if cat_hit else "",
            "catalog_venue": cat_hit["venue"] if cat_hit else "",
            "catalog_confidence": cat_hit["confidence"] if cat_hit else "",
            "note": note,
            "reviewer_decision": "",
        })

    # ── Pass 2: every catalog edition that did not match an existing row ──
    for rec in cat_flat:
        slug = rec["edition"]["edition_id"]
        if slug in matched_slugs:
            continue
        counts["CATALOG_ONLY"] += 1
        rows.append({
            "bucket": "CATALOG_ONLY",
            "existing_id": "",
            "existing_name": "",
            "existing_year": "",
            "existing_source": "",
            "catalog_slug": slug,
            "catalog_series": rec["series_name"],
            "catalog_year": rec["year"] if rec["year"] is not None else "",
            "catalog_venue": rec["venue"],
            "catalog_confidence": rec["confidence"],
            "note": "import",
            "reviewer_decision": "",
        })

    # ── Write reconciliation.csv ──
    order = {"MATCH": 0, "FUZZY": 1, "EXISTING_ONLY": 2, "CATALOG_ONLY": 3}
    rows.sort(key=lambda r: (order[r["bucket"]], str(r["existing_year"] or r["catalog_year"]),
                             r["existing_name"] or r["catalog_series"]))
    fields = ["bucket", "existing_id", "existing_name", "existing_year", "existing_source",
              "catalog_slug", "catalog_series", "catalog_year", "catalog_venue",
              "catalog_confidence", "note", "reviewer_decision"]
    out_csv = REVIEW_DIR / "reconciliation.csv"
    with out_csv.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # The list of catalog slugs that collide with an existing row: the import must
    # decide what to do with these before it runs. Emitted as its own file so the
    # import step can read it directly.
    collide = sorted(matched_slugs)
    (REVIEW_DIR / "catalog-slugs-matching-existing.txt").write_text(
        "\n".join(collide) + ("\n" if collide else ""))

    # ── Write summary.md ──
    match_fuzzy = [r for r in rows if r["bucket"] in ("MATCH", "FUZZY")]
    existing_only = [r for r in rows if r["bucket"] == "EXISTING_ONLY"]

    def table(rs, cols, headers):
        out = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
        for r in rs:
            out.append("| " + " | ".join(str(r[c]) for c in cols) + " |")
        return "\n".join(out)

    lines = [
        "# Events reconciliation: catalog v0.3 vs live prod",
        "",
        "Generated by `scripts/reconcile-events.py`. Read-only. Match is on normalised",
        "series name plus year (brief Step 2). This is a review file, not a migration.",
        "",
        "## Bucket counts",
        "",
        f"- MATCH: {counts['MATCH']}  (existing row and a catalog edition are the same event)",
        f"- FUZZY: {counts['FUZZY']}  (probable same event, verify by hand, never auto-merged)",
        f"- EXISTING_ONLY: {counts['EXISTING_ONLY']}  (in prod, not in the catalog)",
        f"- CATALOG_ONLY: {counts['CATALOG_ONLY']}  (the import)",
        f"- total existing events reviewed: {len(existing)}",
        f"- catalog editions: {len(cat_flat)}",
        "",
        "## MATCH + FUZZY: catalog editions that collide with an existing prod row",
        "",
        "Importing these as-is creates a DUPLICATE, because existing rows carry",
        "`external_ref = NULL` so the upsert-on-external_ref will not find them. The 2019",
        "Baker edition here is on the landing-page timeline. Decide per row before import.",
        "",
        table(match_fuzzy,
              ["bucket", "existing_id", "existing_name", "catalog_slug", "catalog_series",
               "catalog_year", "note"],
              ["bucket", "existing_id", "existing_name", "catalog_slug", "catalog_series",
               "year", "note"]) if match_fuzzy else "_none_",
        "",
        "## EXISTING_ONLY: prod events the catalog does not cover",
        "",
        table(existing_only,
              ["existing_id", "existing_name", "existing_year", "existing_source", "note"],
              ["existing_id", "existing_name", "year", "status", "note"]) if existing_only else "_none_",
        "",
        "## Catalog slugs that collide (machine-readable)",
        "",
        "Written to `catalog-slugs-matching-existing.txt`, one slug per line, for the import step.",
        "",
    ]
    (REVIEW_DIR / "summary.md").write_text("\n".join(lines) + "\n")

    print(f"reconciliation.csv  {len(rows)} rows")
    for b in ("MATCH", "FUZZY", "EXISTING_ONLY", "CATALOG_ONLY"):
        print(f"  {b:14s} {counts[b]}")
    print(f"colliding catalog slugs: {len(collide)} -> review/catalog-slugs-matching-existing.txt")


if __name__ == "__main__":
    main()
