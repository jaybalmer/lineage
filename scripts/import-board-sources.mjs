#!/usr/bin/env node
// Import "Documented in" catalog provenance into board_sources (Phase 1).
//
// Reads the Issuu extraction confirmations (data/catalog/review/issuu-*-confirmations.csv),
// resolves each confirmed sighting to a live boards.id by normalised brand+model, and
// writes one board_sources row (kind='existence') per sighting. Sightings that don't match
// a live board (e.g. the held new/zero-model brands not yet in the catalog) are written to
// data/catalog/review/issuu-provenance-unresolved.csv for the normal catalog-merge review.
//
// Idempotent: it first deletes every system-imported existence row (added_by IS NULL) and
// re-inserts from the CSVs, so re-running just refreshes. It never touches image rows or
// human-added rows.
//
// READ+WRITE to board_sources ONLY (a table added this session). Never writes any other
// table. Reads boards. Uses the service-role key from .env.local, like
// scripts/export-catalog-tables.mjs.
//
// Usage:  node scripts/import-board-sources.mjs [--dry]

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const REVIEW = resolve(REPO_ROOT, "data", "catalog", "review")
const DRY = process.argv.includes("--dry")

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8")
    for (const line of raw.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  } catch { /* rely on process.env */ }
}
loadEnvLocal()
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local)."); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

// ── helpers ─────────────────────────────────────────────────────────────────
const norm = (s) => (s ?? "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")   // strip diacritics (Völkl -> Volkl)
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// Brand-name aliases where the extraction label and the live catalog differ.
// Ride was consolidated to "Ride Snowboards" in the live catalog (PR #222).
const BRAND_ALIAS = { "ride": "ride snowboards" }
const brandKeys = (b) => { const n = norm(b); return BRAND_ALIAS[n] ? [n, BRAND_ALIAS[n]] : [n] }

// Minimal CSV parser (quoted fields, doubled quotes, commas/newlines in quotes).
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c === "\r") { /* skip */ }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}
function readCsvObjects(path) {
  const rows = parseCsv(readFileSync(path, "utf8"))
  if (!rows.length) return []
  const head = rows[0]
  return rows.slice(1).filter((r) => r.length && r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])))
}
function csvOut(rows, cols) {
  const cell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n"
}
const intOrNull = (v) => { const n = parseInt(String(v ?? "").trim(), 10); return Number.isFinite(n) ? n : null }

// ── doc metadata (publisher + human title) from the inventory ────────────────
function docMeta() {
  const meta = {}
  for (const r of readCsvObjects(resolve(REVIEW, "issuu-inventory.csv"))) {
    const id = r.docId; if (!id) continue
    meta[id] = { publisher: r.publisher || "", season: r.model_year_or_season || "", url: r.url || "" }
  }
  return meta
}

async function fetchAllBoards() {
  const out = []; const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("boards").select("id, brand, model").range(from, from + PAGE - 1)
    if (error) throw new Error(`boards select: ${error.message}`)
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  const meta = docMeta()
  const boards = await fetchAllBoards()
  // lookup: `${normBrand}|${normModel}` -> board.id  (first wins; ~1 row per model)
  const byKey = new Map()
  for (const b of boards) {
    const k = `${norm(b.brand)}|${norm(b.model)}`
    if (!byKey.has(k)) byKey.set(k, b.id)
  }
  console.log(`boards loaded: ${boards.length} (${byKey.size} distinct brand|model keys)`)

  // Cite from confirmations AND review-candidates: a review-candidate model that has
  // since been merged into the live catalog (e.g. the new-brand tranche) now resolves
  // to a board and should carry its provenance too. Rows that still have no live board
  // fall through to the unresolved log, unchanged.
  const files = readdirSync(REVIEW)
    .filter((f) => /^issuu-.*-(confirmations|review-candidates)\.csv$/.test(f))
    .sort()
  const resolved = new Map()   // dedup key -> row
  const unresolved = []
  let sightings = 0

  for (const f of files) {
    for (const r of readCsvObjects(resolve(REVIEW, f))) {
      // Never cite a brand-identity-flagged sighting (e.g. US "Artec" vs the catalog's
      // Slovenian Artec) - it must not attach to the wrong brand's board.
      if ((r.reason || "").startsWith("BRAND_IDENTITY")) continue
      const brand = r.brand
      const model = r.catalog_model_name || r.model_ocr   // reconciled name, else the printed name
      if (!brand || !model) continue
      sightings++
      const docId = r.source_docId || ""
      const m = meta[docId] || {}
      const publisher = m.publisher || ""
      const season = m.season || r.catalog_season || ""
      const doc_title = [publisher, season].filter(Boolean).join(" ")
      const page = intOrNull(r.page)
      const model_year = intOrNull(r.catalog_model_year)
      const source_url = r.source_url || m.url || ""

      // resolve to a board id via normalised brand+model (brand aliases considered)
      let boardId = null
      for (const bk of brandKeys(brand)) { const id = byKey.get(`${bk}|${norm(model)}`); if (id) { boardId = id; break } }

      if (!boardId) {
        unresolved.push({ brand, model, publisher, season, docId, page: page ?? "", model_year: model_year ?? "", source_file: f })
        continue
      }
      const dedup = `${boardId}|${docId}|${page ?? 0}|existence`
      if (!resolved.has(dedup)) {
        resolved.set(dedup, {
          board_id: boardId, kind: "existence", publisher, doc_title,
          doc_id: docId || null, source_url, page, model_year,
          match_type: r.match_type || null, image_url: null, added_by: null,
        })
      }
    }
  }

  const rows = [...resolved.values()]
  console.log(`sightings read: ${sightings}`)
  console.log(`resolved to a board: ${rows.length} distinct citations`)
  console.log(`unresolved: ${unresolved.length} (no live board yet)`)

  // write the unresolved log for the catalog-merge review
  const unresolvedPath = resolve(REVIEW, "issuu-provenance-unresolved.csv")
  const byBrand = {}
  for (const u of unresolved) byBrand[u.brand] = (byBrand[u.brand] || 0) + 1
  console.log("unresolved by brand:", Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b}:${n}`).join(", "))
  if (!DRY) writeFileSync(unresolvedPath, csvOut(unresolved, ["brand", "model", "publisher", "season", "docId", "page", "model_year", "source_file"]))

  if (DRY) { console.log("\n[--dry] no writes performed."); return }

  // idempotent: clear prior system-imported existence rows, then insert fresh
  const del = await db.from("board_sources").delete().eq("kind", "existence").is("added_by", null)
  if (del.error) throw new Error(`delete existing: ${del.error.message}`)

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from("board_sources").insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(`insert chunk @${i}: ${error.message}`)
    inserted += Math.min(CHUNK, rows.length - i)
  }
  console.log(`\ninserted ${inserted} board_sources rows.`)
  console.log(`unresolved log -> ${unresolvedPath}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
