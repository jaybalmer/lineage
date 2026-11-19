#!/usr/bin/env node
// Seed placeholder board images into board_sources (kind='image').
// Brief: ~/linestry-ops/briefs/board-image-seeding-brief-v1.md
//
// Each seeded image is a board_sources row with kind='image', status='active', a
// source_tier, the ORIGINAL remote image in image_url (attribution + takedown
// pointer) and our re-hosted 1,000px JPEG copy in hosted_url (board-images bucket,
// seeded/{board_id}/{tier}-{hash}.jpg). A member upload or link always wins over a
// seeded image at display time (/api/board-image, /api/board-image/list).
//
// Tiers (lowest number displays first):
//   1 retrosnow  photographed physical boards. Candidates = MATCH rows of
//                data/catalog/review/retrosnow-reconciliation.csv (brand + model already
//                reconciled to ours), image = that product's <image:loc> in
//                retrosnow.com/product-sitemap.xml. No product pages are crawled.
//   2 issuu      catalogue page as-is. Candidates = EXACT/QUALIFIED rows of
//                data/catalog/review/issuu-*-confirmations.csv. Page image is
//                https://image.isu.pub/{revisionId}/jpg/page_{page}.jpg; the revision id
//                is read once per doc from the public doc page (the docId slug alone 403s).
//   3 serper     one-time Google Images query per board that still has nothing, first
//                result only, kept only when the result's title/link names the model.
//                Costs Serper credits even with --dry-run (the query IS the dry run).
//
// No guessing (D3): a candidate attaches only to boards whose normalised brand AND
// model match. Year is a window, not a guess: a candidate for year Y attaches to that
// model's boards with |model_year - Y| <= 2; if none fall in the window and the model
// has exactly one board, it attaches to that one.
//
// Never re-adds an image that was removed (status='removed'): every existing image row,
// whatever its status, blocks the same (board, doc_id, page) key. Never touches
// existence rows. Writes only board_sources and the board-images bucket (service role).
//
// Usage:
//   node scripts/seed-board-images.mjs --tier retrosnow|issuu|serper [--dry-run]
//        [--limit N] [--board-id ID] [--batch 500]
// Dry run writes data/catalog/review/board-images-dryrun-{tier}.csv and touches nothing.

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const REVIEW = resolve(REPO_ROOT, "data", "catalog", "review")

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1] ?? null }
const TIER_NAME = arg("--tier")
const DRY = argv.includes("--dry-run") || argv.includes("--dry")
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity
const ONLY_BOARD = arg("--board-id")
const BATCH = arg("--batch") ? parseInt(arg("--batch"), 10) : 500
const TIERS = { retrosnow: 1, issuu: 2, serper: 3 }
if (!TIERS[TIER_NAME]) {
  console.error("Usage: node scripts/seed-board-images.mjs --tier retrosnow|issuu|serper [--dry-run] [--limit N] [--board-id ID]")
  process.exit(1)
}
const TIER = TIERS[TIER_NAME]
const YEAR_WINDOW = 2
const UA = "LinestryBot/1.0 (+https://linestry.com; snowboard history archive)"
const BUCKET = "board-images"

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
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA_URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local)."); process.exit(1) }
const db = createClient(SUPA_URL, KEY, { auth: { persistSession: false } })

// ── helpers ─────────────────────────────────────────────────────────────────
const norm = (s) => (s ?? "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const BRAND_ALIAS = { "ride": "ride snowboards" }
const brandKeys = (b) => { const n = norm(b); return BRAND_ALIAS[n] ? [n, BRAND_ALIAS[n]] : [n] }
const intOrNull = (v) => { const n = parseInt(String(v ?? "").trim(), 10); return Number.isFinite(n) ? n : null }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

// Polite fetch: one request per second per host, named UA.
const lastHit = new Map()
async function politeFetch(url, init = {}) {
  const host = new URL(url).host
  const wait = (lastHit.get(host) ?? 0) + 1000 - Date.now()
  if (wait > 0) await sleep(wait)
  lastHit.set(host, Date.now())
  return fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers ?? {}) } })
}

// ── data loads ──────────────────────────────────────────────────────────────
async function fetchAll(table, cols, filter) {
  const out = []; const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(cols).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table} select: ${error.message}`)
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

function indexBoards(boards) {
  // `${normBrand}|${normModel}` -> boards[]
  const byModel = new Map()
  for (const b of boards) {
    const k = `${norm(b.brand)}|${norm(b.model)}`
    if (!byModel.has(k)) byModel.set(k, [])
    byModel.get(k).push(b)
  }
  return byModel
}

/** Boards a candidate (brand, model, year) attaches to, under the D3 + year-window rule. */
function boardsFor(byModel, brand, model, year) {
  let list = null
  for (const bk of brandKeys(brand)) { list = byModel.get(`${bk}|${norm(model)}`); if (list) break }
  if (!list || !list.length) return { boards: [], note: "no board with this brand + model" }
  if (year == null) {
    return list.length === 1 ? { boards: list, note: "single board, no year on source" } : { boards: [], note: "no year on source and model has several boards" }
  }
  const inWindow = list.filter((b) => Math.abs((b.model_year ?? 0) - year) <= YEAR_WINDOW)
  if (inWindow.length) return { boards: inWindow, note: `year ${year} within +/-${YEAR_WINDOW}` }
  if (list.length === 1) return { boards: list, note: `single board (${list[0].model_year}), source year ${year}` }
  return { boards: [], note: `source year ${year} outside +/-${YEAR_WINDOW} of every board` }
}

// ── tier adapters: each returns candidates ──────────────────────────────────
// candidate: { brand, model, year, image_url, source_url, publisher, doc_title, doc_id, page, match_type, note }

async function retrosnowCandidates() {
  const res = await politeFetch("https://retrosnow.com/product-sitemap.xml")
  if (!res.ok) throw new Error(`retrosnow sitemap ${res.status}`)
  const xml = await res.text()
  const imgByUrl = new Map()
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim()
    const img = m[1].match(/<image:loc>([^<]+)<\/image:loc>/)?.[1]?.trim()
    if (loc && img) imgByUrl.set(loc.replace(/\/?$/, "/"), img)
  }
  console.log(`retrosnow sitemap: ${imgByUrl.size} products with an image`)
  const out = []
  for (const r of readCsvObjects(resolve(REVIEW, "retrosnow-reconciliation.csv"))) {
    if (r.bucket !== "MATCH") continue           // FUZZY / BRAND_NEW / RETROSNOW_ONLY never attach
    if ((r.reviewer_decision || "").toLowerCase().startsWith("reject")) continue
    const url = (r.url || "").replace(/\/?$/, "/")
    const image = imgByUrl.get(url)
    if (!image) continue
    out.push({
      brand: r.our_brand, model: r.our_model, year: intOrNull(r.year),
      image_url: image, source_url: url,
      publisher: "RetroSnow", doc_title: null,
      doc_id: `retrosnow:${new URL(url).pathname}`, page: null,
      match_type: "EXACT", note: `retrosnow "${r.model}" ${r.year}`,
    })
  }
  return out
}

async function issuuCandidates() {
  const meta = {}
  for (const r of readCsvObjects(resolve(REVIEW, "issuu-inventory.csv"))) {
    if (r.docId) meta[r.docId] = { publisher: r.publisher || "", season: r.model_year_or_season || "", url: r.url || "" }
  }
  const files = readdirSync(REVIEW).filter((f) => /^issuu-.*-confirmations\.csv$/.test(f)).sort()
  const rows = []
  for (const f of files) {
    for (const r of readCsvObjects(resolve(REVIEW, f))) {
      if ((r.reason || "").startsWith("BRAND_IDENTITY")) continue
      if (!["EXACT", "QUALIFIED"].includes((r.match_type || "").toUpperCase())) continue
      const page = intOrNull(r.page)
      if (!r.brand || !r.catalog_model_name || !r.source_docId || page == null) continue
      rows.push(r)
    }
  }
  // Resolve each doc's revision id once (the public doc page embeds it).
  const revision = new Map()
  for (const docId of new Set(rows.map((r) => r.source_docId))) {
    const docUrl = rows.find((r) => r.source_docId === docId).source_url || meta[docId]?.url
    try {
      const res = await politeFetch(docUrl)
      const html = await res.text()
      const rev = html.match(/image\.isu\.pub\/([0-9]+-[0-9a-f]+)\/jpg\/page_/)?.[1] ?? null
      revision.set(docId, rev)
      console.log(`issuu ${docId}: ${rev ?? "NO REVISION ID (skipped)"}`)
    } catch (e) {
      revision.set(docId, null)
      console.log(`issuu ${docId}: fetch failed (${e.message})`)
    }
  }
  const out = []
  for (const r of rows) {
    const rev = revision.get(r.source_docId)
    if (!rev) continue
    const page = intOrNull(r.page)
    const m = meta[r.source_docId] || {}
    const season = m.season || r.catalog_season || ""
    const base = r.source_url || m.url
    out.push({
      brand: r.brand, model: r.catalog_model_name, year: intOrNull(r.catalog_model_year),
      image_url: `https://image.isu.pub/${rev}/jpg/page_${page}.jpg`,
      source_url: `${base.replace(/\/$/, "")}/${page}`,
      publisher: m.publisher || "Issuu", doc_title: [m.publisher, season].filter(Boolean).join(" ") || null,
      doc_id: r.source_docId, page,
      match_type: (r.match_type || "").toUpperCase(), note: `${r.match_type} "${r.model_ocr}" p${page}`,
    })
  }
  return out
}

// Serper: per board (not per candidate), only boards with no image row at all.
async function serperCandidates(boards, boardsWithImage) {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) throw new Error("SERPER_API_KEY missing from .env.local")
  const todo = boards.filter((b) => !boardsWithImage.has(b.id)).slice(0, LIMIT)
  console.log(`serper: ${todo.length} boards with no image row (credits: up to ${todo.length * 2})`)
  const out = []
  let n = 0
  for (const b of todo) {
    n++
    const queries = [b.model_year ? `${b.brand} ${b.model} ${b.model_year} snowboard` : null, `${b.brand} ${b.model} snowboard`].filter(Boolean)
    for (const q of queries) {
      const res = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 1 }),
      })
      if (!res.ok) { console.log(`serper ${res.status} on "${q}" (out of credits?) - stopping`); return out }
      const img = (await res.json()).images?.[0]
      if (!img?.imageUrl) continue
      // D3: the result must name the model (title or link slug) and the brand.
      const hay = norm(`${img.title ?? ""} ${img.link ?? ""}`)
      const brandHit = brandKeys(b.brand).some((k) => hay.includes(k.split(" ")[0]))
      const modelHit = norm(b.model).length >= 2 && ` ${hay} `.includes(` ${norm(b.model)} `)
      if (!brandHit || !modelHit) continue
      let domain = img.domain || img.source || ""
      try { domain = new URL(img.link).hostname.replace(/^www\./, "") } catch { /* keep */ }
      out.push({
        brand: b.brand, model: b.model, year: b.model_year, board_id: b.id,
        image_url: img.imageUrl, source_url: img.link || img.imageUrl,
        publisher: domain || "web", doc_title: img.title || null,
        doc_id: `serper:${img.link || img.imageUrl}`, page: null,
        match_type: "QUALIFIED", note: `serper "${q}" -> ${img.title ?? ""}`,
      })
      break
    }
    if (n % 100 === 0) console.log(`  serper ${n}/${todo.length}, ${out.length} kept`)
  }
  return out
}

// ── re-host ─────────────────────────────────────────────────────────────────
const processed = new Map() // image_url -> { buf, hash } | null
async function sizedCopy(imageUrl) {
  if (processed.has(imageUrl)) return processed.get(imageUrl)
  let result = null
  try {
    const res = await politeFetch(imageUrl)
    if (res.ok) {
      const input = Buffer.from(await res.arrayBuffer())
      const buf = await sharp(input).rotate()
        .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true }).toBuffer()
      result = { buf, hash: createHash("sha1").update(imageUrl).digest("hex").slice(0, 12) }
    } else {
      console.log(`  fetch ${res.status}: ${imageUrl}`)
    }
  } catch (e) {
    console.log(`  fetch/resize failed: ${imageUrl} (${e.message})`)
  }
  processed.set(imageUrl, result)
  return result
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const boards = (await fetchAll("boards", "id, brand, model, model_year"))
    .filter((b) => !ONLY_BOARD || b.id === ONLY_BOARD)
  const byModel = indexBoards(boards)
  const existing = await fetchAll("board_sources", "board_id, doc_id, page, status", (q) => q.eq("kind", "image"))
  const takenKeys = new Set(existing.map((e) => `${e.board_id}|${e.doc_id ?? ""}|${e.page ?? 0}`))
  const boardsWithImage = new Set(existing.filter((e) => e.status === "active").map((e) => e.board_id))
  console.log(`boards: ${boards.length}; existing image rows: ${existing.length} (${boardsWithImage.size} boards with an active one)`)

  let candidates
  if (TIER_NAME === "retrosnow") candidates = await retrosnowCandidates()
  else if (TIER_NAME === "issuu") candidates = await issuuCandidates()
  else candidates = await serperCandidates(boards, boardsWithImage)
  console.log(`candidates: ${candidates.length}`)

  // Expand candidates to (board, candidate) rows.
  const planned = []
  const unattached = []
  const seen = new Set()
  for (const c of candidates) {
    const { boards: targets, note } = c.board_id
      ? { boards: boards.filter((b) => b.id === c.board_id), note: "serper per-board" }
      : boardsFor(byModel, c.brand, c.model, c.year)
    if (!targets.length) { unattached.push({ ...c, why: note }); continue }
    for (const b of targets) {
      const key = `${b.id}|${c.doc_id}|${c.page ?? 0}`
      if (takenKeys.has(key) || seen.has(key)) continue
      seen.add(key)
      planned.push({ board: b, c, note: `${c.note}; ${note}` })
    }
  }
  const limited = TIER_NAME === "serper" ? planned : planned.slice(0, LIMIT)
  const distinctBoards = new Set(limited.map((p) => p.board.id))
  console.log(`planned rows: ${limited.length} across ${distinctBoards.size} boards (${unattached.length} candidates attached to nothing)`)

  const dryPath = resolve(REVIEW, `board-images-dryrun-${TIER_NAME}.csv`)
  const dryRows = limited.map((p) => ({
    board_id: p.board.id, brand: p.board.brand, model: p.board.model, board_year: p.board.model_year,
    tier: TIER, source_year: p.c.year ?? "", publisher: p.c.publisher, source_url: p.c.source_url,
    image_url: p.c.image_url, match_note: p.note,
  }))
  const cols = ["board_id", "brand", "model", "board_year", "tier", "source_year", "publisher", "source_url", "image_url", "match_note"]
  if (DRY) {
    writeFileSync(dryPath, csvOut(dryRows, cols))
    const unPath = resolve(REVIEW, `board-images-unattached-${TIER_NAME}.csv`)
    writeFileSync(unPath, csvOut(unattached, ["brand", "model", "year", "source_url", "image_url", "why"]))
    console.log(`\n[--dry-run] no writes. Review -> ${dryPath}\nUnattached -> ${unPath}`)
    return
  }

  // Real run: re-host + insert in batches.
  let inserted = 0, failed = 0
  for (let i = 0; i < limited.length; i += BATCH) {
    const chunk = limited.slice(i, i + BATCH)
    const rows = []
    for (const p of chunk) {
      const copy = await sizedCopy(p.c.image_url)
      if (!copy) { failed++; continue }
      const path = `seeded/${p.board.id}/${TIER}-${copy.hash}.jpg`
      const up = await db.storage.from(BUCKET).upload(path, copy.buf, { contentType: "image/jpeg", upsert: true })
      if (up.error) { console.log(`  upload failed ${path}: ${up.error.message}`); failed++; continue }
      const hosted_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      rows.push({
        board_id: p.board.id, kind: "image", status: "active", source_tier: TIER,
        publisher: p.c.publisher, doc_title: p.c.doc_title, doc_id: p.c.doc_id,
        source_url: p.c.source_url, page: p.c.page, model_year: p.c.year,
        match_type: p.c.match_type, image_url: p.c.image_url, hosted_url, added_by: null,
      })
    }
    if (rows.length) {
      const { error } = await db.from("board_sources").insert(rows)
      if (error) throw new Error(`insert batch @${i}: ${error.message}`)
      inserted += rows.length
    }
    console.log(`batch ${i / BATCH + 1}: +${rows.length} (total ${inserted}, failed ${failed})`)
  }

  // Coverage summary across all tiers.
  const active = await fetchAll("board_sources", "board_id, source_tier", (q) => q.eq("kind", "image").eq("status", "active"))
  const perTier = {}
  for (const r of active) perTier[r.source_tier] = (perTier[r.source_tier] || 0) + 1
  console.log(`\ninserted ${inserted}, failed ${failed}.`)
  console.log(`active image rows by tier: ${JSON.stringify(perTier)}; distinct boards: ${new Set(active.map((r) => r.board_id)).size}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
