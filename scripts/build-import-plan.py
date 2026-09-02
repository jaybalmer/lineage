#!/usr/bin/env python3
"""
Turn a reviewed reconciliation CSV (with the reviewer_decision column filled in)
into an ordered, human-reviewable SQL migration package for the `boards` table.

THIS SCRIPT WRITES NO DATABASE. It only reads the decisions CSV + the boards
export and emits .sql files plus a plan.md for a human to review and run.

Decision vocabulary (per row):
  keep    -> leave the existing board untouched (no SQL).
  merge   -> enrich the existing board with the catalog match (backfill the new
             catalog_* columns; for FUZZY typo fixes also correct the model name).
             MATCH rows marked 'import' are treated as 'merge' (per Jay, 2026-09).
  import  -> insert the catalog board as a NEW row (used for FUZZY pairs that are
             actually distinct boards).

Outputs (under data/catalog/review/import-plan/):
  01-add-columns.sql     additive: ADD COLUMN ... to boards (SAFE)
  02-merge-backfill.sql  UPDATE existing boards (GATED: touches existing rows)
  03-import-new-boards.sql  INSERT new boards (additive)
  plan.md                what each step does, risk, ordering, open items

Usage:
  python3 scripts/build-import-plan.py \
    --decisions data/catalog/review/reconciliation-decisions.csv \
    --boards    data/catalog/existing-boards-export.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "catalog" / "review" / "import-plan"

# New columns added to `boards` to hold the catalog's provenance. All additive.
NEW_COLUMNS = [
    ("model_id", "text"),            # catalog slug, brand-slug--model-slug
    ("first_year", "smallint"),      # catalog's sourced first year (distinct from model_year)
    ("year_basis", "text"),          # introduced | earliest_sourced | unknown
    ("category", "text"),            # freestyle | freeride | ...
    ("confidence", "text"),          # verified | likely
    ("sources", "text[]"),           # source URLs
]


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def brand_key(name: str) -> str:
    """Loose brand key for matching existing spelling to catalog spelling."""
    s = strip_accents(name or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\b(snowboards|snowboarding|snowboard|sds|inc|industries)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def q(val: str | None) -> str:
    """SQL string literal or NULL."""
    if val is None or str(val).strip() == "":
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def q_int(val: str | None) -> str:
    if val is None or str(val).strip() == "":
        return "NULL"
    try:
        return str(int(float(val)))
    except ValueError:
        return "NULL"


def q_text_array(val: str | None) -> str:
    """Catalog sources are ' | '-separated; emit a Postgres text[] literal or NULL."""
    if not val or not val.strip():
        return "NULL"
    parts = [p.strip() for p in val.split("|") if p.strip()]
    if not parts:
        return "NULL"
    inner = ", ".join("'" + p.replace("'", "''") + "'" for p in parts)
    return f"ARRAY[{inner}]"


def status_from_confidence(conf: str) -> str:
    return "verified" if (conf or "").strip().lower() == "verified" else "unverified"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--decisions", default=str(ROOT / "data/catalog/review/reconciliation-decisions.csv"))
    ap.add_argument("--boards", default=str(ROOT / "data/catalog/existing-boards-export.csv"))
    args = ap.parse_args()

    with open(args.decisions, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    with open(args.boards, newline="", encoding="utf-8-sig") as f:
        boards = list(csv.DictReader(f))

    # Map (brand_key, model_lower) -> [board ids]; and brand_key -> existing display spelling
    ids_by_pair: dict[tuple[str, str], list[str]] = defaultdict(list)
    existing_brand_spelling: dict[str, str] = {}
    for b in boards:
        bk = brand_key(b.get("brand", ""))
        ids_by_pair[(bk, (b.get("model") or "").strip().lower())].append(b["id"])
        existing_brand_spelling.setdefault(bk, (b.get("brand") or "").strip())

    merges: list[dict] = []   # {ids, set_cols, fuzzy_name_fix}
    imports: list[dict] = []
    keeps: list[dict] = []
    unresolved: list[str] = []

    for r in rows:
        decision = (r.get("reviewer_decision") or "").strip().lower()
        if not decision:
            continue
        bucket = r["bucket"]
        # MATCH marked 'import' is treated as merge (per Jay).
        if bucket == "MATCH" and decision == "import":
            decision = "merge"

        if decision == "keep":
            keeps.append(r)
            continue

        if decision == "merge":
            bk = brand_key(r["brand_existing"])
            ids = ids_by_pair.get((bk, (r["model_existing"] or "").strip().lower()), [])
            if not ids:
                unresolved.append(f"MERGE could not find board id for {r['brand_existing']} / {r['model_existing']}")
                continue
            fuzzy_fix = r["bucket"] == "FUZZY"  # correct the model name to the catalog spelling
            merges.append({"ids": ids, "row": r, "fix_name": fuzzy_fix})
            continue

        if decision == "import":
            imports.append(r)
            continue

        unresolved.append(f"Unknown decision '{decision}' for {r['brand_existing'] or r['brand_catalog']} {r['model_existing'] or r['model_catalog']}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ---- 01 add columns (SAFE, additive) ----
    add_lines = ["-- STEP 1: additive columns on boards (SAFE per the risk gate).",
                 "-- Adds homes for the catalog's provenance. Reversible (drop the columns).", ""]
    for name, typ in NEW_COLUMNS:
        add_lines.append(f"alter table boards add column if not exists {name} {typ};")
    add_lines.append("")
    add_lines.append("create index if not exists boards_model_id_idx on boards(model_id);")
    (OUT_DIR / "01-add-columns.sql").write_text("\n".join(add_lines) + "\n", encoding="utf-8")

    # ---- 02 merge backfill (GATED: updates existing rows) ----
    m_lines = ["-- STEP 2: enrich existing boards from their catalog match (MERGE).",
               "-- GATED: this UPDATEs existing rows. Run STEP 1 first.",
               "-- Backfills catalog_* provenance; FUZZY typo fixes also correct model name.",
               "-- Wrapped in a transaction so it is all-or-nothing.", "", "begin;", ""]
    for m in merges:
        r = m["row"]
        sets = [
            f"model_id = {q(r['model_id_catalog'])}",
            f"first_year = {q_int(r['first_year_catalog'])}",
            f"year_basis = {q(r['year_basis'])}",
            f"confidence = {q(r['confidence'])}",
            f"sources = {q_text_array(r['sources_catalog'])}",
        ]
        if m["fix_name"] and (r["model_catalog"] or "").strip():
            sets.insert(0, f"model = {q(r['model_catalog'])}")
        set_clause = ",\n    ".join(sets)
        id_list = ", ".join(q(i) for i in m["ids"])
        note = f"  -- {r['brand_existing']} {r['model_existing']}"
        if m["fix_name"]:
            note += f"  (FUZZY: rename -> {r['model_catalog']})"
        m_lines.append(note)
        m_lines.append(f"update boards set\n    {set_clause}\n  where id in ({id_list});")
        m_lines.append("")
    m_lines.append("commit;")
    (OUT_DIR / "02-merge-backfill.sql").write_text("\n".join(m_lines) + "\n", encoding="utf-8")

    # ---- 03 import new boards (additive INSERT) ----
    i_lines = ["-- STEP 3: insert catalog boards that are genuinely new (IMPORT).",
               "-- Additive. Run STEP 1 first (needs the new columns).",
               "-- id = gen_random_uuid(); added_by = null (nullable); shape = null.",
               "-- brand uses the existing spelling when the brand already exists in boards.",
               "", "begin;", ""]
    cols = ("id, brand, model, model_year, shape, external_ref, community_status, "
            "added_by, model_id, first_year, year_basis, category, confidence, sources")
    for r in imports:
        bk = brand_key(r["brand_catalog"])
        brand = existing_brand_spelling.get(bk, r["brand_catalog"])
        vals = ", ".join([
            "gen_random_uuid()",
            q(brand),
            q(r["model_catalog"]),
            q_int(r["first_year_catalog"]),   # model_year seeded from catalog first_year
            "NULL",                            # shape unknown
            q("catalog:" + r["model_id_catalog"]),
            q(status_from_confidence(r["confidence"])),
            "NULL",                            # added_by
            q(r["model_id_catalog"]),
            q_int(r["first_year_catalog"]),
            q(r["year_basis"]),
            q(r["category"]) if r.get("category") else "NULL",
            q(r["confidence"]),
            q_text_array(r["sources_catalog"]),
        ])
        i_lines.append(f"  -- {brand} {r['model_catalog']}  (was fuzzy vs existing '{r['model_existing']}')")
        i_lines.append(f"insert into boards ({cols})\n  values ({vals});")
        i_lines.append("")
    i_lines.append("commit;")
    (OUT_DIR / "03-import-new-boards.sql").write_text("\n".join(i_lines) + "\n", encoding="utf-8")

    # ---- plan.md ----
    dec_counts = Counter(
        ("merge" if (r["bucket"] == "MATCH" and (r.get("reviewer_decision") or "").strip().lower() == "import")
         else (r.get("reviewer_decision") or "").strip().lower())
        for r in rows if (r.get("reviewer_decision") or "").strip()
    )
    p = []
    p.append("# Boards import plan")
    p.append("")
    p.append("Generated from `reconciliation-decisions.csv` by `scripts/build-import-plan.py`.")
    p.append("**No database was written by generating this.** Review, then run the steps in order.")
    p.append("")
    p.append("## What will run")
    p.append("")
    p.append(f"- **{dec_counts.get('merge', 0)} merges** -> `02-merge-backfill.sql` (UPDATE existing boards)")
    p.append(f"- **{dec_counts.get('import', 0)} imports** -> `03-import-new-boards.sql` (INSERT new boards)")
    p.append(f"- **{dec_counts.get('keep', 0)} keeps** -> no SQL, listed below")
    p.append("")
    p.append("## Order + risk gate")
    p.append("")
    p.append("1. `01-add-columns.sql` - additive ADD COLUMN. **SAFE.**")
    p.append("2. `02-merge-backfill.sql` - UPDATEs existing rows. **GATED** (touches existing data). "
             "Backfills the new columns; the 5 FUZZY merges also correct a misspelled model name.")
    p.append("3. `03-import-new-boards.sql` - INSERTs new rows. Additive.")
    p.append("")
    p.append("Run 1 before 2 and 3 (they need the new columns). 2 and 3 are each wrapped in a "
             "transaction. Take a boards backup first (Supabase does PITR, but a `create table "
             "boards_backup as select * from boards;` before step 2 is cheap insurance).")
    p.append("")
    p.append("## Keeps (no change)")
    p.append("")
    for r in keeps:
        p.append(f"- {r['brand_existing']} {r['model_existing']} ({r['bucket']})")
    p.append("")
    p.append("## Imports (new boards)")
    p.append("")
    for r in imports:
        p.append(f"- {r['brand_catalog']} {r['model_catalog']} (`{r['model_id_catalog']}`)")
    p.append("")
    p.append("## Open items to decide before/after running")
    p.append("")
    p.append("- **3 duplicate boards** (Barfoot Freestyle, Burton Performer Elite, Lib Tech Emma Peele) "
             "still exist; the merge UPDATEs both copies. De-dupe them separately (delete the extra row).")
    p.append("- **33 boards carry a placeholder `model_year` of 2010.** This plan does NOT overwrite "
             "`model_year`; it adds the catalog's `first_year` alongside. Decide whether to replace the "
             "2010 values with `first_year` in a follow-up.")
    p.append("- Imported boards use the catalog `first_year` as their `model_year` and `shape = null`.")
    if unresolved:
        p.append("")
        p.append("## UNRESOLVED (fix before running)")
        p.append("")
        for u in unresolved:
            p.append(f"- {u}")
    (OUT_DIR / "plan.md").write_text("\n".join(p) + "\n", encoding="utf-8")

    print(f"merges={len(merges)} imports={len(imports)} keeps={len(keeps)} unresolved={len(unresolved)}")
    print(f"Wrote {OUT_DIR}/ (01-add-columns.sql, 02-merge-backfill.sql, 03-import-new-boards.sql, plan.md)")
    if unresolved:
        print("UNRESOLVED:")
        for u in unresolved:
            print("  " + u)


if __name__ == "__main__":
    main()
