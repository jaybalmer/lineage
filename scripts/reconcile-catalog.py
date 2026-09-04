#!/usr/bin/env python3
"""
Reconcile the researched snowboard catalog (data/catalog/v0.2/) against Linestry's
existing brand + board records, and write a human review pass. This script never
touches the database and never modifies the catalog files. It only reads and writes
files under data/catalog/.

Two inputs:
  1. The catalog:  data/catalog/v0.2/brands.csv + models.csv
  2. The existing list: data/catalog/existing-export.csv
     (brand, model, first_year, source). One row per board; a row with an empty
     model is a "brand only" entry (the brand exists in Linestry but we hold no
     board models for it). A real Supabase export drops in here unchanged; the
     --build-existing flag (below) regenerates it from the demo mock-data baseline.

Two outputs:
  data/catalog/review/reconciliation.csv
  data/catalog/review/summary.md

Usage:
  python3 scripts/reconcile-catalog.py --build-existing   # regen existing-export.csv from mock-data.ts, then reconcile
  python3 scripts/reconcile-catalog.py                    # reconcile against whatever existing-export.csv holds

When v0.3 of the catalog arrives, point CATALOG_DIR at it (or replace v0.2) and rerun.
When a real Supabase export is available, drop it at existing-export.csv and rerun
WITHOUT --build-existing.

Matching is on brand + model name, never on IDs. See the alias tables below.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import re
import sys
import unicodedata
from pathlib import Path

# ─── Paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
CATALOG_DIR = ROOT / "data" / "catalog" / "v0.3"
REVIEW_DIR = ROOT / "data" / "catalog" / "review"
EXISTING_EXPORT = ROOT / "data" / "catalog" / "existing-export.csv"
MOCK_DATA = ROOT / "src" / "lib" / "mock-data.ts"

# ─── Brand alias table ──────────────────────────────────────────────────────
# canonical -> list of variant spellings. Variants are compared AFTER the base
# normalisation below (lowercased, accents stripped, punctuation removed,
# collapsed whitespace). Add any alias discovered in the data here and it shows
# up in the printed table in summary.md.
BRAND_ALIASES: dict[str, list[str]] = {
    "gnu": ["gnu"],
    "lib tech": ["lib tech", "lib technologies", "libtech"],
    "k2": ["k2", "k2 snowboarding"],
    "capita": ["capita"],
    "yes": ["yes", "yes.", "yes snowboards"],
    "never summer": ["never summer", "never summer industries"],
    "santa cruz": ["santa cruz"],
    "volkl": ["volkl", "völkl"],
    "korua": ["korua", "korua shapes"],
    "season": ["season", "season eqpt"],
    "moss": ["moss", "moss snowstick"],
    "dc": ["dc", "dc shoes"],
    "rome": ["rome", "rome sds"],
    "sg": ["sg", "sg snowboards"],
    # Discovered in the Linestry existing data (mock-data.ts) during this pass:
    "burton": ["burton", "burton snowboards"],
    "salomon": ["salomon", "salomon snowboards"],
    "jones": ["jones", "jones snowboards"],
    "sims": ["sims", "sims snowboards"],
    "ride": ["ride", "ride snowboards"],
    "bataleon": ["bataleon", "bataleon snowboards"],
    "nitro": ["nitro", "nitro snowboards"],
    "rossignol": ["rossignol", "rossignol snowboards"],
    "palmer": ["palmer", "palmer snowboards"],
    "kemper": ["kemper", "kemper snowboards"],
    "morrow": ["morrow", "morrow snowboards"],
    "forum": ["forum", "forum snowboards"],
    "signal": ["signal", "signal snowboards"],
    "slash": ["slash", "slash snowboards"],
    "option": ["option", "option snowboards"],
    "prior": ["prior", "prior snowboards"],
    "endeavor": ["endeavor", "endeavor snowboards"],
    "arbor": ["arbor", "arbor snowboards"],
    "bonfire": ["bonfire", "bonfire snowboarding"],
    "flow": ["flow", "flow snowboarding"],
    "vans": ["vans", "vans snowboarding"],
    "mervin": ["mervin", "mervin manufacturing"],
}

# Words removed token-wise from a brand name before alias lookup.
BRAND_STOPWORDS = {"snowboards", "snowboarding", "snowboard", "sds", "inc"}

# ─── Model normalisation config ─────────────────────────────────────────────
# Trailing tokens stripped from a model name ONLY when the remainder still
# matches a name on the other side (the conditional strip from the brief).
MODEL_TRAILING_TOKENS = {"wide", "w", "ltd", "smalls", "mini"}
SIZE_RE = re.compile(r"^\d{3}(\.\d)?w?$")  # 158, 158.5, 158w, 158.5w
FUZZY_THRESHOLD = 0.88


# ─── Normalisation helpers ──────────────────────────────────────────────────
def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def brand_base(name: str) -> str:
    """Lowercase, strip accents, drop punctuation, collapse whitespace."""
    s = strip_accents(name).lower()
    s = s.replace("&", " ").replace("/", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _build_variant_map() -> dict[str, str]:
    m: dict[str, str] = {}
    for canonical, variants in BRAND_ALIASES.items():
        for v in variants:
            m[brand_base(v)] = canonical
    return m


VARIANT_TO_CANON = _build_variant_map()


def canonical_brand(name: str) -> tuple[str, str | None]:
    """Return (canonical_brand_key, alias_variant_that_fired_or_None)."""
    base = brand_base(name)
    if base in VARIANT_TO_CANON:
        canon = VARIANT_TO_CANON[base]
        return canon, (base if base != canon else None)
    # strip stopwords token-wise, then retry alias lookup
    stripped = " ".join(t for t in base.split() if t not in BRAND_STOPWORDS).strip()
    if stripped in VARIANT_TO_CANON:
        canon = VARIANT_TO_CANON[stripped]
        return canon, (base if base != canon else None)
    if stripped != base:
        return stripped, base  # stopword strip acted as the alias
    return base, None


def model_key(name: str) -> str:
    """Alnum-only lowercase key. 'Custom X' -> 'customx', 'Skate Banana' -> 'skatebanana'."""
    return re.sub(r"[^a-z0-9]", "", strip_accents(name).lower())


def model_stripped_key(name: str) -> str:
    """Key after removing a trailing size and trailing qualifier tokens."""
    s = strip_accents(name).lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    tokens = s.split()
    while tokens and (SIZE_RE.match(tokens[-1]) or tokens[-1] in MODEL_TRAILING_TOKENS):
        tokens.pop()
    return "".join(tokens)


# ─── Loaders ────────────────────────────────────────────────────────────────
def load_catalog() -> tuple[list[dict], list[dict]]:
    with open(CATALOG_DIR / "brands.csv", newline="", encoding="utf-8") as f:
        brands = list(csv.DictReader(f))
    with open(CATALOG_DIR / "models.csv", newline="", encoding="utf-8") as f:
        models = list(csv.DictReader(f))
    return brands, models


# Header spellings we accept from a real export, mapped to the fields the
# reconciler uses. A real Supabase `boards` export (brand, model, model_year)
# or a hand-rolled CSV both load without renaming columns.
EXISTING_HEADER_ALIASES = {
    "brand": {"brand", "brand_name", "make", "manufacturer"},
    "model": {"model", "model_name", "name", "board"},
    "first_year": {"first_year", "model_year", "year", "year_first", "first_seen"},
    "source": {"source", "sources", "source_url", "url", "note", "notes"},
}


def _map_existing_row(row: dict) -> dict:
    """Map an arbitrary export row onto brand/model/first_year/source."""
    lower = {(k or "").strip().lower(): (v if v is not None else "") for k, v in row.items()}
    out = {"brand": "", "model": "", "first_year": "", "source": ""}
    for field, aliases in EXISTING_HEADER_ALIASES.items():
        for a in aliases:
            if a in lower and str(lower[a]).strip() != "":
                out[field] = str(lower[a]).strip()
                break
    return out


def load_existing(path: Path) -> list[dict]:
    if not path.exists():
        sys.exit(
            f"Missing {path}.\n"
            "Run with --build-existing to generate the demo baseline at "
            f"{EXISTING_EXPORT}, or point --existing at a real Supabase export."
        )
    with open(path, newline="", encoding="utf-8-sig") as f:
        raw = list(csv.DictReader(f))
    if not raw:
        return raw
    mapped = [_map_existing_row(r) for r in raw]
    if not any(r["brand"] for r in mapped):
        sys.exit(
            f"{path}: could not find a brand column. Headers seen: {list(raw[0].keys())}.\n"
            f"Accepted brand headers: {sorted(EXISTING_HEADER_ALIASES['brand'])}."
        )
    return _dedup_existing(mapped)


def load_existing_brands(path: Path) -> list[str]:
    """Read a brands export (e.g. Supabase `orgs`) and return board-brand names.

    Only rows whose brand_category names a board brand count as existing board
    brands; outerwear/bindings/boots/media orgs are out of scope for a board
    catalog.
    """
    if not path.exists():
        sys.exit(f"Missing --existing-brands file {path}.")
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    names: list[str] = []
    for r in rows:
        lower = {(k or "").strip().lower(): (v or "") for k, v in r.items()}
        name = (lower.get("name") or lower.get("brand_name") or lower.get("brand") or "").strip()
        if not name:
            continue
        category = (lower.get("brand_category") or "").strip().lower()
        org_type = (lower.get("org_type") or "").strip().lower()
        # Keep board brands. If neither column is present, keep everything.
        is_board = (
            ("board" in category)
            or (category == "" and org_type in ("", "brand"))
        )
        if is_board:
            names.append(name)
    return names


def _dedup_existing(mapped: list[dict]) -> list[dict]:
    # Dedup board rows to one per (brand, model), keeping the earliest year and
    # the first source seen. A real export with one row per board-year (e.g. the
    # same model across several model_years) collapses to a distinct model.
    board_rows: dict[tuple[str, str], dict] = {}
    brand_only: list[dict] = []
    for r in mapped:
        if not r["model"]:
            brand_only.append(r)
            continue
        key = (r["brand"], r["model"])
        yr = None
        try:
            yr = int(r["first_year"]) if r["first_year"] else None
        except ValueError:
            yr = None
        cur = board_rows.get(key)
        if cur is None:
            board_rows[key] = dict(r)
        else:
            try:
                cur_yr = int(cur["first_year"]) if cur["first_year"] else None
            except ValueError:
                cur_yr = None
            if yr is not None and (cur_yr is None or yr < cur_yr):
                cur["first_year"] = r["first_year"]
            if not cur["source"] and r["source"]:
                cur["source"] = r["source"]
    return list(board_rows.values()) + brand_only


# ─── --build-existing: extract the demo baseline from mock-data.ts ──────────
def build_existing_from_mock() -> None:
    text = MOCK_DATA.read_text(encoding="utf-8")

    # BOARDS rows: { id: "..", brand: "..", model: "..", model_year: NNNN, shape: ".." }
    board_re = re.compile(
        r'brand:\s*"([^"]+)"\s*,\s*model:\s*"([^"]+)"\s*,\s*model_year:\s*(\d+)'
    )
    boards: dict[tuple[str, str], dict] = {}
    for brand, model, year in board_re.findall(text):
        year = int(year)
        key = (brand, model)
        if key not in boards or year < boards[key]["first_year"]:
            boards[key] = {"brand": brand, "model": model, "first_year": year}

    # board_brand ORGS (brand universe, incl. brands with no board rows)
    org_re = re.compile(
        r'name:\s*"([^"]+)"[^\n]*?org_type:\s*"brand"[^\n]*?brand_category:\s*"board_brand"'
    )
    board_brand_orgs = [m for m in org_re.findall(text)]

    rows: list[dict] = []
    seen_brands_with_models = {b for (b, _m) in boards.keys()}
    for (brand, model), rec in sorted(boards.items()):
        rows.append(
            {
                "brand": brand,
                "model": model,
                "first_year": rec["first_year"],
                "source": "",  # mock-data carries no source URL
            }
        )
    # brand-only rows for board brands that have no board models in mock-data
    for org_name in board_brand_orgs:
        canon, _ = canonical_brand(org_name)
        if not any(canonical_brand(b)[0] == canon for b in seen_brands_with_models):
            rows.append({"brand": org_name, "model": "", "first_year": "", "source": ""})
            seen_brands_with_models.add(org_name)

    EXISTING_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(EXISTING_EXPORT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["brand", "model", "first_year", "source"])
        w.writeheader()
        w.writerows(rows)
    board_rows = sum(1 for r in rows if r["model"])
    brand_only = sum(1 for r in rows if not r["model"])
    print(
        f"Wrote {EXISTING_EXPORT} from mock-data.ts: "
        f"{board_rows} board rows, {brand_only} brand-only rows."
    )


# ─── Reconciliation ─────────────────────────────────────────────────────────
def sources_join(row: dict) -> str:
    return (row.get("sources") or "").strip()


def year_note(existing_year, cat_year, year_basis) -> str:
    """Compare years for a MATCH row. Empty string when there is nothing to flag."""
    try:
        ey = int(existing_year)
    except (TypeError, ValueError):
        ey = None
    try:
        cy = int(cat_year)
    except (TypeError, ValueError):
        cy = None
    if ey is None or cy is None or ey == cy:
        return ""
    if year_basis == "earliest_sourced":
        if cy > ey:
            return f"no conflict: catalog earliest_sourced {cy} later than existing {ey} (board predates catalog evidence)"
        return f"note: catalog earliest_sourced {cy} EARLIER than existing {ey} (catalog found older evidence)"
    if year_basis == "introduced":
        return f"YEAR CONFLICT: existing {ey} vs catalog introduced {cy}"
    return f"note: existing {ey} vs catalog {cy} (year_basis={year_basis or 'unknown'})"


def reconcile(catalog_brands, catalog_models, existing_rows):
    # Index catalog models by canonical brand
    cat_by_brand: dict[str, list[dict]] = {}
    catalog_brand_names: dict[str, str] = {}  # canon -> display name
    alias_fired: dict[str, str] = {}  # variant base -> canonical
    for row in catalog_models:
        canon, variant = canonical_brand(row.get("brand_name") or row.get("brand_id") or "")
        cat_by_brand.setdefault(canon, []).append(row)
        catalog_brand_names.setdefault(canon, row.get("brand_name") or canon)
        if variant:
            alias_fired[variant] = canon
    # Also fold in brands.csv so brand-level comparison sees brands with no models
    for row in catalog_brands:
        canon, variant = canonical_brand(row.get("brand_name") or row.get("brand_id") or "")
        catalog_brand_names.setdefault(canon, row.get("brand_name") or canon)
        if variant:
            alias_fired[variant] = canon

    # Index existing rows by canonical brand
    exist_by_brand: dict[str, list[dict]] = {}
    existing_brand_names: dict[str, str] = {}
    for row in existing_rows:
        canon, variant = canonical_brand(row.get("brand") or "")
        existing_brand_names.setdefault(canon, row.get("brand") or canon)
        if variant:
            alias_fired[variant] = canon
        if (row.get("model") or "").strip():
            exist_by_brand.setdefault(canon, []).append(row)

    results: list[dict] = []
    year_conflicts: list[str] = []

    all_brands = set(cat_by_brand) | set(exist_by_brand) | set(catalog_brand_names) | set(existing_brand_names)

    for canon in sorted(all_brands):
        cat_rows = cat_by_brand.get(canon, [])
        ex_rows = exist_by_brand.get(canon, [])

        # Build lookup of catalog models by key + stripped key
        cat_by_key: dict[str, dict] = {}
        cat_by_stripped: dict[str, dict] = {}
        for r in cat_rows:
            cat_by_key.setdefault(model_key(r["model_name"]), r)
            cat_by_stripped.setdefault(model_stripped_key(r["model_name"]), r)

        matched_cat_ids: set[str] = set()
        unmatched_existing: list[dict] = []

        # 1) exact + conditional-strip matches, existing -> catalog
        for er in ex_rows:
            ek = model_key(er["model"])
            esk = model_stripped_key(er["model"])
            hit = None
            if ek in cat_by_key:
                hit = cat_by_key[ek]
            elif esk in cat_by_key:  # strip existing, remainder matches catalog
                hit = cat_by_key[esk]
            elif ek in cat_by_stripped:  # strip catalog, remainder matches existing
                hit = cat_by_stripped[ek]
            if hit is not None:
                yn = year_note(er.get("first_year"), hit.get("first_year"), hit.get("year_basis"))
                if yn.startswith("YEAR CONFLICT"):
                    year_conflicts.append(
                        f"{catalog_brand_names.get(canon, canon)} {hit['model_name']}: {yn}"
                    )
                results.append(
                    {
                        "bucket": "MATCH",
                        "brand_existing": er["brand"],
                        "model_existing": er["model"],
                        "first_year_existing": er.get("first_year", ""),
                        "source_existing": er.get("source", ""),
                        "brand_catalog": hit.get("brand_name", ""),
                        "model_catalog": hit.get("model_name", ""),
                        "model_id_catalog": hit.get("model_id", ""),
                        "first_year_catalog": hit.get("first_year", ""),
                        "year_basis": hit.get("year_basis", ""),
                        "confidence": hit.get("confidence", ""),
                        "sources_catalog": sources_join(hit),
                        "note": yn,
                        "reviewer_decision": "",
                    }
                )
                matched_cat_ids.add(hit["model_id"])
            else:
                unmatched_existing.append(er)

        # 2) fuzzy pass on the leftovers within this brand
        remaining_cat = [r for r in cat_rows if r["model_id"] not in matched_cat_ids]
        used_cat: set[str] = set()
        still_unmatched_existing: list[dict] = []
        for er in unmatched_existing:
            ek = model_key(er["model"])
            best = None
            best_ratio = 0.0
            for cr in remaining_cat:
                if cr["model_id"] in used_cat:
                    continue
                ck = model_key(cr["model_name"])
                ratio = difflib.SequenceMatcher(None, ek, ck).ratio()
                contains = len(ek) >= 3 and len(ck) >= 3 and (ek in ck or ck in ek)
                if ratio > FUZZY_THRESHOLD or contains:
                    score = max(ratio, 0.89 if contains else 0.0)
                    if score > best_ratio:
                        best_ratio, best = score, cr
            if best is not None:
                used_cat.add(best["model_id"])
                results.append(
                    {
                        "bucket": "FUZZY",
                        "brand_existing": er["brand"],
                        "model_existing": er["model"],
                        "first_year_existing": er.get("first_year", ""),
                        "source_existing": er.get("source", ""),
                        "brand_catalog": best.get("brand_name", ""),
                        "model_catalog": best.get("model_name", ""),
                        "model_id_catalog": best.get("model_id", ""),
                        "first_year_catalog": best.get("first_year", ""),
                        "year_basis": best.get("year_basis", ""),
                        "confidence": best.get("confidence", ""),
                        "sources_catalog": sources_join(best),
                        "note": f"fuzzy match ratio={best_ratio:.3f} - reviewer confirms same board or not",
                        "reviewer_decision": "",
                    }
                )
            else:
                still_unmatched_existing.append(er)

        # 3) EXISTING_ONLY
        for er in still_unmatched_existing:
            has_source = bool((er.get("source") or "").strip())
            results.append(
                {
                    "bucket": "EXISTING_ONLY",
                    "brand_existing": er["brand"],
                    "model_existing": er["model"],
                    "first_year_existing": er.get("first_year", ""),
                    "source_existing": er.get("source", ""),
                    "brand_catalog": "",
                    "model_catalog": "",
                    "model_id_catalog": "",
                    "first_year_catalog": "",
                    "year_basis": "",
                    "confidence": "",
                    "sources_catalog": "",
                    "note": "needs_source" if not has_source else "",
                    "reviewer_decision": "",
                }
            )

        # 4) CATALOG_ONLY (catalog models not matched or fuzzed)
        for cr in cat_rows:
            if cr["model_id"] in matched_cat_ids or cr["model_id"] in used_cat:
                continue
            results.append(
                {
                    "bucket": "CATALOG_ONLY",
                    "brand_existing": "",
                    "model_existing": "",
                    "first_year_existing": "",
                    "source_existing": "",
                    "brand_catalog": cr.get("brand_name", ""),
                    "model_catalog": cr.get("model_name", ""),
                    "model_id_catalog": cr.get("model_id", ""),
                    "first_year_catalog": cr.get("first_year", ""),
                    "year_basis": cr.get("year_basis", ""),
                    "confidence": cr.get("confidence", ""),
                    "sources_catalog": sources_join(cr),
                    "note": "",
                    "reviewer_decision": "",
                }
            )

    return results, year_conflicts, {
        "cat_by_brand": cat_by_brand,
        "catalog_brand_names": catalog_brand_names,
        "existing_brand_names": existing_brand_names,
        "exist_by_brand": exist_by_brand,
        "alias_fired": alias_fired,
    }


# ─── Output writers ─────────────────────────────────────────────────────────
BUCKET_ORDER = {"EXISTING_ONLY": 0, "FUZZY": 1, "MATCH": 2, "CATALOG_ONLY": 3}
FIELDNAMES = [
    "bucket", "brand_existing", "model_existing", "first_year_existing", "source_existing",
    "brand_catalog", "model_catalog", "model_id_catalog", "first_year_catalog",
    "year_basis", "confidence", "sources_catalog", "note", "reviewer_decision",
]


def write_reconciliation(results: list[dict]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    results.sort(
        key=lambda r: (
            BUCKET_ORDER.get(r["bucket"], 9),
            (r["brand_catalog"] or r["brand_existing"] or "").lower(),
            (r["model_catalog"] or r["model_existing"] or "").lower(),
        )
    )
    with open(REVIEW_DIR / "reconciliation.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(results)
    print(f"Wrote {REVIEW_DIR / 'reconciliation.csv'} ({len(results)} rows)")


def data_quality_notes(catalog_brands, catalog_models, existing_rows) -> list[str]:
    notes: list[str] = []
    # catalog duplicate model_ids
    seen_ids: dict[str, int] = {}
    for r in catalog_models:
        seen_ids[r["model_id"]] = seen_ids.get(r["model_id"], 0) + 1
    dup_ids = [k for k, v in seen_ids.items() if v > 1]
    if dup_ids:
        notes.append(f"Catalog: {len(dup_ids)} duplicate model_id(s): {', '.join(sorted(dup_ids)[:10])}")
    # catalog blank model names
    blanks = [r["model_id"] for r in catalog_models if not (r.get("model_name") or "").strip()]
    if blanks:
        notes.append(f"Catalog: {len(blanks)} blank model_name row(s).")
    # existing duplicate brand+model (pre-dedup) - report from mock via first_year collision is lost; note here from export
    seen_pairs: dict[tuple[str, str], int] = {}
    for r in existing_rows:
        if (r.get("model") or "").strip():
            key = (r["brand"], r["model"])
            seen_pairs[key] = seen_pairs.get(key, 0) + 1
    dup_pairs = [f"{b} {m}" for (b, m), v in seen_pairs.items() if v > 1]
    if dup_pairs:
        notes.append(f"Existing export: duplicate brand+model rows: {', '.join(dup_pairs)}")
    # catalog future-dated rows (research date was Sept 2026)
    future = []
    for r in catalog_models:
        try:
            if int(r.get("first_year") or 0) > 2026:
                future.append(r)
        except ValueError:
            pass
    if future:
        n_intro = sum(1 for r in future if r.get("year_basis") == "introduced")
        notes.append(
            f"Catalog: {len(future)} model(s) carry a first_year of 2027 (a year ahead of the "
            f"Sept 2026 research date). {len(future) - n_intro} are `earliest_sourced` (current "
            f"retailer listings = the 2026/27 model year, defensible) and {n_intro} are "
            f"`introduced` (worth a spot-check). This is the pattern the catalog README flags."
        )
    # catalog rows that look like non-boards (bindings/boots/etc.)
    nonboard_re = re.compile(r"\b(binding|bindings|boot|boots|glove|goggle|jacket|pant|helmet)\b", re.I)
    nonboard = [r for r in catalog_models if nonboard_re.search(r.get("model_name") or "")]
    if nonboard:
        notes.append(
            f"Catalog: {len(nonboard)} model_name(s) contain a non-board term "
            f"(binding/boot/etc.): {', '.join(sorted(r['model_id'] for r in nonboard)[:8])}"
        )
    else:
        notes.append("Catalog: no model names contain obvious non-board terms (binding/boot/glove/etc.).")
    return notes


def write_summary(results, year_conflicts, ctx, catalog_brands, catalog_models, existing_rows,
                  is_demo=True, extra_notes=None) -> None:
    from collections import Counter

    bucket_counts = Counter(r["bucket"] for r in results)
    cat_only_by_brand = Counter(r["brand_catalog"] for r in results if r["bucket"] == "CATALOG_ONLY")
    exist_only_by_brand = Counter(r["brand_existing"] for r in results if r["bucket"] == "EXISTING_ONLY")

    catalog_brands_set = set(ctx["catalog_brand_names"])
    existing_brands_set = set(ctx["existing_brand_names"])
    brands_catalog_only = sorted(catalog_brands_set - existing_brands_set)
    brands_existing_only = sorted(existing_brands_set - catalog_brands_set)
    brands_both = sorted(catalog_brands_set & existing_brands_set)

    lines: list[str] = []
    lines.append("# Snowboard catalog reconciliation, summary")
    lines.append("")
    lines.append("Catalog: `data/catalog/v0.2/` (brands.csv, models.csv).")
    lines.append("Existing: the demo baseline" if is_demo else "Existing: a real board export.")
    lines.append("")
    if is_demo:
        lines.append("> DEMO BASELINE. The existing side here is Linestry's demo/seed data")
        lines.append("> (`src/lib/mock-data.ts`), NOT the production Supabase catalog. It holds only")
        lines.append("> a small hand-picked board set, so almost every catalog model reads as")
        lines.append("> CATALOG_ONLY. Re-run against a real Supabase export before treating any")
        lines.append("> CATALOG_ONLY row as a genuine addition. Nothing here was written to the database.")
    else:
        lines.append("> Reconciled against a real board export. CATALOG_ONLY rows are genuine")
        lines.append("> candidate additions; EXISTING_ONLY rows are boards you hold that the catalog")
        lines.append("> lacks. This is a review pass only. Nothing was written to the database.")
    lines.append("")

    lines.append("## Counts per bucket")
    lines.append("")
    lines.append("| Bucket | Rows |")
    lines.append("| --- | --- |")
    for b in ["MATCH", "FUZZY", "EXISTING_ONLY", "CATALOG_ONLY"]:
        lines.append(f"| {b} | {bucket_counts.get(b, 0)} |")
    lines.append(f"| **Total** | {sum(bucket_counts.values())} |")
    lines.append("")

    lines.append("## Brand-level overlap")
    lines.append("")
    lines.append(f"- Brands on BOTH sides: {len(brands_both)}")
    lines.append(f"- Brands in CATALOG only: {len(brands_catalog_only)}")
    lines.append(f"- Brands in EXISTING only: {len(brands_existing_only)}")
    lines.append("")
    if brands_existing_only:
        lines.append("**Existing brands not found in the catalog** (each explains a cluster of misses; scrutinise):")
        lines.append("")
        for b in brands_existing_only:
            lines.append(f"- {ctx['existing_brand_names'][b]}")
        lines.append("")
    lines.append("<details><summary>Brands in catalog only (expected: catalog is far larger) - "
                 f"{len(brands_catalog_only)}</summary>")
    lines.append("")
    lines.append(", ".join(ctx["catalog_brand_names"][b] for b in brands_catalog_only))
    lines.append("")
    lines.append("</details>")
    lines.append("")

    lines.append("## CATALOG_ONLY count per brand (candidate additions)")
    lines.append("")
    lines.append("| Brand | Rows |")
    lines.append("| --- | --- |")
    for brand, n in cat_only_by_brand.most_common():
        lines.append(f"| {brand} | {n} |")
    lines.append("")

    lines.append("## EXISTING_ONLY count per brand (needs the most scrutiny)")
    lines.append("")
    if exist_only_by_brand:
        lines.append("| Brand | Rows |")
        lines.append("| --- | --- |")
        for brand, n in exist_only_by_brand.most_common():
            lines.append(f"| {brand} | {n} |")
    else:
        lines.append("None. Every existing board matched or fuzzed to a catalog row.")
    lines.append("")

    lines.append("## Brand alias table used")
    lines.append("")
    lines.append("Canonical brand key <- variant spellings folded onto it (from the brief plus "
                 "aliases discovered in the existing data):")
    lines.append("")
    lines.append("| Canonical | Variants |")
    lines.append("| --- | --- |")
    for canon, variants in sorted(BRAND_ALIASES.items()):
        lines.append(f"| {canon} | {', '.join(variants)} |")
    lines.append("")
    lines.append(f"Brand stopwords removed before alias lookup: {', '.join(sorted(BRAND_STOPWORDS))}.")
    lines.append("")

    lines.append("## Year conflicts among MATCH rows")
    lines.append("")
    lines.append("Only `introduced` catalog years that disagree with the existing first year are")
    lines.append("conflicts. An `earliest_sourced` catalog year later than the existing year is expected,")
    lines.append("not a conflict, and is not listed here.")
    lines.append("")
    if year_conflicts:
        for yc in year_conflicts:
            lines.append(f"- {yc}")
    else:
        lines.append("None.")
    lines.append("")

    lines.append("## Data quality notes")
    lines.append("")
    dq = data_quality_notes(catalog_brands, catalog_models, existing_rows)
    dq.extend(extra_notes or [])
    if dq:
        for n in dq:
            lines.append(f"- {n}")
    else:
        lines.append("- No duplicate model_ids, blank names, or duplicate existing rows detected.")
    if is_demo:
        lines.append("- The demo set includes yearly Barfoot entries (one row per production year);")
        lines.append("  these are deduplicated to distinct brand+model before matching.")
    lines.append("- Linestry's `orgs` also carries non-board brands (outerwear, bindings, boots,")
    lines.append("  media). Those are out of scope for a board catalog and are not counted as")
    lines.append("  existing board brands here.")
    lines.append("")

    lines.append("## Decisions that need a human")
    lines.append("")
    n = 1
    if is_demo:
        lines.append(f"{n}. Replace the demo baseline with a real Supabase `boards`/`orgs` export and re-run,")
        lines.append("   so CATALOG_ONLY reflects genuine gaps rather than the demo set's small size.")
        n += 1
    else:
        lines.append(f"{n}. Which CATALOG_ONLY rows to import as new boards (these are the genuine additions).")
        n += 1
    lines.append(f"{n}. Which EXISTING_ONLY rows to keep vs. retire (rows with no source are flagged `needs_source`).")
    n += 1
    lines.append(f"{n}. Which FUZZY pairs are the same board and should merge (none are auto-merged).")
    n += 1
    lines.append(f"{n}. Whether to adopt the catalog's `model_id` slug (`brand-slug--model-slug`) as the")
    lines.append("   canonical board key going forward.")
    lines.append("")

    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REVIEW_DIR / 'summary.md'}")


# ─── Main ───────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--build-existing",
        action="store_true",
        help="Regenerate the demo mock-data.ts baseline at existing-export.csv before reconciling.",
    )
    ap.add_argument(
        "--existing",
        default=str(EXISTING_EXPORT),
        help="Path to the existing board list (a real Supabase export, or the demo baseline). "
             "Headers are mapped tolerantly (brand/brand_name, model/model_name, "
             "first_year/model_year, source/note). Default: data/catalog/existing-export.csv",
    )
    ap.add_argument(
        "--existing-brands",
        default=None,
        help="Optional path to a brands export (e.g. Supabase `orgs`). Board brands from it "
             "with no board models are added as brand-only rows so brand-level gaps are complete.",
    )
    args = ap.parse_args()

    if args.build_existing:
        build_existing_from_mock()

    existing_path = Path(args.existing)
    # "Demo" = we are reading the mock-data-derived baseline, not a real export.
    is_demo = existing_path.resolve() == EXISTING_EXPORT.resolve()

    catalog_brands, catalog_models = load_catalog()
    existing_rows = load_existing(existing_path)

    if args.existing_brands:
        brand_names = load_existing_brands(Path(args.existing_brands))
        have = {canonical_brand(r["brand"])[0] for r in existing_rows if r["model"]}
        added = 0
        for name in brand_names:
            canon = canonical_brand(name)[0]
            if canon not in have:
                existing_rows.append({"brand": name, "model": "", "first_year": "", "source": ""})
                have.add(canon)
                added += 1
        print(f"Existing brands: {len(brand_names)} board brands from {Path(args.existing_brands).name}, "
              f"{added} added as brand-only (no board models).")
    print(f"Catalog: {len(catalog_brands)} brands, {len(catalog_models)} models.")
    print(f"Existing ({'DEMO baseline' if is_demo else existing_path.name}): "
          f"{sum(1 for r in existing_rows if (r.get('model') or '').strip())} board rows, "
          f"{len(existing_rows)} total rows.")

    extra_notes = existing_data_quality(existing_path, existing_rows, is_demo)

    results, year_conflicts, ctx = reconcile(catalog_brands, catalog_models, existing_rows)
    write_reconciliation(results)
    write_summary(results, year_conflicts, ctx, catalog_brands, catalog_models, existing_rows,
                  is_demo, extra_notes)


def existing_data_quality(existing_path: Path, existing_rows: list[dict], is_demo: bool) -> list[str]:
    """Data-quality notes about the EXISTING side, computed from the raw export so
    duplicates collapsed during dedup are still reported."""
    from collections import Counter

    notes: list[str] = []
    # Duplicates in the raw export (dedup would otherwise hide these).
    try:
        with open(existing_path, newline="", encoding="utf-8-sig") as f:
            raw = [_map_existing_row(r) for r in csv.DictReader(f)]
    except OSError:
        raw = []
    pair_counts = Counter((r["brand"], r["model"]) for r in raw if r["model"])
    dups = [f"{b} {m}" for (b, m), n in pair_counts.items() if n > 1]
    if dups:
        notes.append(
            f"Existing data: {len(dups)} duplicate brand+model row(s) that should be merged: "
            f"{', '.join(sorted(dups))}."
        )
    # Blank model names in the raw export.
    blanks = sum(1 for r in raw if not r["model"] and not r["brand"])
    if blanks:
        notes.append(f"Existing data: {blanks} row(s) with no brand or model.")
    # Placeholder-year pattern: one year dominating dated board rows is suspicious.
    years = [r["first_year"] for r in existing_rows if r["model"] and str(r["first_year"]).strip()]
    if years:
        yc = Counter(years)
        top_year, top_n = yc.most_common(1)[0]
        if top_n >= 8 and top_n >= 0.15 * len(years):
            notes.append(
                f"Existing data: {top_n} of {len(years)} dated boards carry the same year "
                f"({top_year}) - likely a placeholder/default `model_year`, not a real first year. "
                f"Many of the year conflicts above stem from this. Worth a data cleanup pass."
            )
    return notes


if __name__ == "__main__":
    main()
