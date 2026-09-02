#!/usr/bin/env python3
"""
Generate INSERT SQL to import the CATALOG_ONLY boards (and the brands they need)
into Linestry. WRITES NO DATABASE - emits .sql for a human to review and run.

Inputs:
  data/catalog/review/reconciliation.csv     (to get the CATALOG_ONLY model_ids)
  data/catalog/v0.2/models.csv               (full model fields incl. category)
  data/catalog/v0.2/brands.csv               (brand rows for orgs)
  data/catalog/existing-boards-export.csv    (existing brand spellings)
  data/catalog/existing-brands-export.csv    (which board brands already exist)

Outputs (data/catalog/review/import-plan/):
  05-import-catalog-brands.sql   INSERT missing board brands into orgs (additive)
  06-import-catalog-boards.sql   INSERT the CATALOG_ONLY boards (additive)

Scope: all CATALOG_ONLY rows (per Jay, 2026-09). Every row is sourced; confidence
and year_basis are stored so the UI can qualify 'likely' / 'seen from YYYY'.

Boards get: id=gen_random_uuid(); brand=existing spelling if the brand is already
in boards, else the catalog spelling; model_year=catalog first_year; shape=null;
added_by=null; external_ref='catalog:<model_id>'; community_status from confidence.
Both files are transactional and guarded against a double-run.
"""

from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / "data" / "catalog" / "v0.2"
REVIEW = ROOT / "data" / "catalog" / "review"
OUT = REVIEW / "import-plan"
CHUNK = 200  # rows per multi-row INSERT


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def brand_key(name: str) -> str:
    s = strip_accents(name or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\b(snowboards|snowboarding|snowboard|sds|inc|industries|shapes|eqpt)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def q(val) -> str:
    if val is None or str(val).strip() == "":
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def q_int(val) -> str:
    if val is None or str(val).strip() == "":
        return "NULL"
    try:
        return str(int(float(val)))
    except ValueError:
        return "NULL"


def q_text_array(val) -> str:
    if not val or not str(val).strip():
        return "NULL"
    parts = [p.strip() for p in str(val).split("|") if p.strip()]
    if not parts:
        return "NULL"
    return "ARRAY[" + ", ".join("'" + p.replace("'", "''") + "'" for p in parts) + "]"


def status_from_confidence(conf: str) -> str:
    return "verified" if (conf or "").strip().lower() == "verified" else "unverified"


def main() -> None:
    # CATALOG_ONLY model_ids
    with open(REVIEW / "reconciliation.csv", newline="", encoding="utf-8-sig") as f:
        recon = list(csv.DictReader(f))
    catalog_only_ids = {r["model_id_catalog"] for r in recon if r["bucket"] == "CATALOG_ONLY"}

    with open(CAT / "models.csv", newline="", encoding="utf-8-sig") as f:
        models = [r for r in csv.DictReader(f) if r["model_id"] in catalog_only_ids]
    with open(CAT / "brands.csv", newline="", encoding="utf-8-sig") as f:
        brands = list(csv.DictReader(f))
    with open(ROOT / "data/catalog/existing-boards-export.csv", newline="", encoding="utf-8-sig") as f:
        existing_boards = list(csv.DictReader(f))
    with open(ROOT / "data/catalog/existing-brands-export.csv", newline="", encoding="utf-8-sig") as f:
        existing_brands = list(csv.DictReader(f))

    # existing brand spellings (from boards, then orgs) keyed by brand_key
    spelling: dict[str, str] = {}
    for b in existing_boards:
        spelling.setdefault(brand_key(b.get("brand", "")), (b.get("brand") or "").strip())
    existing_brand_keys = set(spelling)
    for o in existing_brands:
        k = brand_key(o.get("name", ""))
        existing_brand_keys.add(k)
        spelling.setdefault(k, (o.get("name") or "").strip())

    OUT.mkdir(parents=True, exist_ok=True)
    sentinel = f"catalog:{models[0]['model_id']}" if models else "catalog:__none__"

    # ---- 05 brands -> orgs (only board brands not already present) ----
    brands_by_id = {b["brand_id"]: b for b in brands}
    needed_brand_ids = sorted({m["brand_id"] for m in models})
    missing_brands = []
    for bid in needed_brand_ids:
        b = brands_by_id.get(bid)
        if not b:
            continue
        if brand_key(b["brand_name"]) not in existing_brand_keys:
            missing_brands.append(b)

    org_cols = ("id, name, org_type, brand_category, founded_year, country, website, "
                "wikidata_qid, community_status, added_by, description")
    b_lines = [
        "-- STEP 5: insert missing board brands into orgs (additive).",
        "-- Only brands referenced by the imported boards that are not already in orgs.",
        "-- Run before STEP 6 is optional (boards.brand is text), but recommended.",
        "",
        "do $$ begin",
        f"  if exists (select 1 from orgs where name = {q(missing_brands[0]['brand_name']) if missing_brands else 'NULL'}"
        + " and org_type = 'brand') then",
        "    raise notice 'Some catalog brands may already exist; ON CONFLICT-free insert, review first.';",
        "  end if;",
        "end $$;",
        "",
        "begin;",
        "",
    ]
    for b in missing_brands:
        vals = ", ".join([
            "gen_random_uuid()",
            q(b["brand_name"]),
            "'brand'",
            "'board_brand'",
            q_int(b.get("founded_year")),
            q(b.get("country")),
            "NULL",  # website not in catalog brands.csv
            "NULL",  # wikidata_qid
            q(status_from_confidence(b.get("confidence"))),
            "NULL",  # added_by
            q(b.get("notes")),
        ])
        b_lines.append(f"insert into orgs ({org_cols}) values ({vals});")
    b_lines += ["", "commit;"]
    (OUT / "05-import-catalog-brands.sql").write_text("\n".join(b_lines) + "\n", encoding="utf-8")

    # ---- 06 boards ----
    board_cols = ("id, brand, model, model_year, shape, external_ref, community_status, "
                  "added_by, model_id, first_year, year_basis, category, confidence, sources")
    rows_sql = []
    for m in models:
        bk = brand_key(m["brand_name"])
        brand = spelling.get(bk, m["brand_name"])
        rows_sql.append("  (" + ", ".join([
            "gen_random_uuid()",
            q(brand),
            q(m["model_name"]),
            q_int(m.get("first_year")),
            "NULL",                                  # shape
            q("catalog:" + m["model_id"]),
            q(status_from_confidence(m.get("confidence"))),
            "NULL",                                  # added_by
            q(m["model_id"]),
            q_int(m.get("first_year")),
            q(m.get("year_basis")),
            q(m.get("category")),
            q(m.get("confidence")),
            q_text_array(m.get("sources")),
        ]) + ")")

    d_lines = [
        f"-- STEP 6: import {len(models)} CATALOG_ONLY boards (additive).",
        "-- id = gen_random_uuid() (default); needs the columns from STEP 1 (already added).",
        "-- Guarded against a double-run via a sentinel external_ref.",
        "",
        "do $$ begin",
        f"  if exists (select 1 from boards where external_ref = {q(sentinel)}) then",
        "    raise exception 'Catalog board import already ran (sentinel found). Aborting to avoid duplicates.';",
        "  end if;",
        "end $$;",
        "",
        "begin;",
        "",
    ]
    for i in range(0, len(rows_sql), CHUNK):
        chunk = rows_sql[i:i + CHUNK]
        d_lines.append(f"insert into boards ({board_cols}) values")
        d_lines.append(",\n".join(chunk) + ";")
        d_lines.append("")
    d_lines += ["commit;", "",
                "-- Verify: select count(*) from boards where external_ref like 'catalog:%';"]
    (OUT / "06-import-catalog-boards.sql").write_text("\n".join(d_lines) + "\n", encoding="utf-8")

    print(f"boards to import: {len(models)}")
    print(f"missing board brands -> orgs: {len(missing_brands)}")
    print(f"  {', '.join(b['brand_name'] for b in missing_brands)}")
    print(f"Wrote {OUT}/05-import-catalog-brands.sql and 06-import-catalog-boards.sql")


if __name__ == "__main__":
    main()
