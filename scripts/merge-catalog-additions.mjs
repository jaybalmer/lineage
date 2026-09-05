#!/usr/bin/env node
// Merge Issuu-mined catalog additions into the live catalog (orgs + boards).
//
// Reads data/catalog/review/issuu-merge-plan.csv (built by the provenance reconcile)
// and, for the chosen bucket, creates a brand org per genuinely-new brand and one
// board row per model, mirroring the shape the Send It merge used (added_by null,
// community_status 'unverified', year_basis 'earliest_sourced', confidence 'likely',
// model_id 'brand-slug--model-slug', sources = the Issuu source url). Brand metadata
// (founded_year, country) comes from data/catalog/v0.3/brands.csv where available.
//
// Idempotent: skips any org whose name already exists and any board whose brand+model
// already exists (case-insensitive). Never updates or deletes. Boards need no
// community_boards row (the catalog is global; only 68 of 3,223 boards are scoped).
//
// Usage:
//   node scripts/merge-catalog-additions.mjs --bucket new-brand --dry
//   node scripts/merge-catalog-additions.mjs --bucket new-brand
//   node scripts/merge-catalog-additions.mjs --bucket existing        (models for brands that already exist)
//
// WRITES to orgs + boards (additive only). Service-role key from .env.local.

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const BUCKET = (process.argv[process.argv.indexOf("--bucket") + 1] || "new-brand")
const DRY = process.argv.includes("--dry")

function loadEnvLocal() {
  try {
    for (const line of readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8").split("\n")) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("="); if (eq === -1) continue
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  } catch {}
}
loadEnvLocal()
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const norm = (s) => (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const slug = (s) => (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c }
    else if (c === '"') q = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c !== "\r") field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}
function readCsv(path) {
  const rows = parseCsv(readFileSync(path, "utf8")); if (!rows.length) return []
  const head = rows[0]
  return rows.slice(1).filter((r) => r.some((c) => c !== "")).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])))
}

async function fetchAll(table, cols) {
  const out = []; const P = 1000
  for (let f = 0; ; f += P) { const { data, error } = await db.from(table).select(cols).range(f, f + P - 1); if (error) throw new Error(`${table}: ${error.message}`); out.push(...data); if (data.length < P) break }
  return out
}

async function main() {
  const plan = readCsv(resolve(REPO_ROOT, "data/catalog/review/issuu-merge-plan.csv"))
  const want = BUCKET === "existing" ? "existing-brand" : "NEW-BRAND"
  const rows = plan.filter((p) => p.brand_status === want)

  // v0.3 brand metadata
  const meta = {}
  for (const r of readCsv(resolve(REPO_ROOT, "data/catalog/v0.3/brands.csv")))
    meta[norm(r.brand_name)] = { founded_year: r.founded_year || null, country: r.country || null }

  // live state
  const liveBoards = new Set((await fetchAll("boards", "brand, model")).map((b) => norm(b.brand) + "|" + norm(b.model)))
  const liveOrgs = new Set((await fetchAll("orgs", "name, org_type")).filter((o) => o.org_type === "brand").map((o) => norm(o.name)))

  // dedup plan rows by normalised brand+model, keep earliest first_year
  const byKey = new Map()
  for (const r of rows) {
    const k = norm(r.brand) + "|" + norm(r.model)
    const fy = parseInt(r.first_year, 10)
    const ex = byKey.get(k)
    if (!ex) byKey.set(k, { ...r, _fy: Number.isFinite(fy) ? fy : null })
    else if (Number.isFinite(fy) && (ex._fy == null || fy < ex._fy)) { ex._fy = fy; ex.first_year = r.first_year }
  }
  const deduped = [...byKey.values()]

  // orgs to create: ONLY in the new-brand bucket. Existing-brand rows already have
  // boards, so the brand is established - and its org, where one exists, may be named
  // differently ("Burton" boards vs a "Burton Snowboards" org), so creating one here
  // would duplicate it. Never create orgs for the existing bucket.
  const brandsInBucket = [...new Set(deduped.map((r) => r.brand))]
  const orgsToCreate = want === "NEW-BRAND"
    ? brandsInBucket.filter((b) => !liveOrgs.has(norm(b)))
    : []

  // boards to create: not already a board
  const boardsToCreate = deduped.filter((r) => !liveBoards.has(norm(r.brand) + "|" + norm(r.model)))

  console.log(`bucket=${BUCKET}  plan rows=${rows.length}  deduped=${deduped.length}`)
  console.log(`brands in bucket: ${brandsInBucket.length}  orgs to create: ${orgsToCreate.length}`)
  console.log(`boards to create: ${boardsToCreate.length}  (already live, skipped: ${deduped.length - boardsToCreate.length})`)
  if (orgsToCreate.length) console.log("new brand orgs:", orgsToCreate.join(", "))

  if (DRY) { console.log("\n[--dry] no writes."); return }

  // 1) brand orgs
  if (orgsToCreate.length) {
    const orgRows = orgsToCreate.map((b) => {
      const m = meta[norm(b)] || {}
      return {
        id: randomUUID(), name: b, org_type: "brand", brand_category: "board_brand",
        founded_year: m.founded_year ? parseInt(m.founded_year, 10) : null,
        country: m.country || null, community_status: "unverified", added_by: null,
      }
    })
    const { error } = await db.from("orgs").insert(orgRows)
    if (error) throw new Error(`orgs insert: ${error.message}`)
    console.log(`inserted ${orgRows.length} brand orgs.`)
  }

  // 2) boards
  const boardRows = boardsToCreate.map((r) => {
    const fy = Number.isFinite(r._fy) ? r._fy : (parseInt(r.first_year, 10) || null)
    return {
      id: randomUUID(), brand: r.brand, model: r.model, model_year: fy ?? 0,
      first_year: fy, year_basis: "earliest_sourced", category: "unknown",
      confidence: r.confidence || "likely", community_status: "unverified", added_by: null,
      model_id: `${slug(r.brand)}--${slug(r.model)}`,
      sources: r.source_url ? [r.source_url] : [],
    }
  })
  const CH = 500
  for (let i = 0; i < boardRows.length; i += CH) {
    const { error } = await db.from("boards").insert(boardRows.slice(i, i + CH))
    if (error) throw new Error(`boards insert @${i}: ${error.message}`)
  }
  console.log(`inserted ${boardRows.length} boards.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
