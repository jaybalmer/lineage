#!/usr/bin/env node
// Podcast archive staging loader (brief: podcast-archive-staging-brief-v2.md, T3 + T4).
//
// Fills the podcast_staging_* tables from the episode manifest and a folder of
// mention seed files, then runs the resolver pass against the live catalog.
// Writes ONLY to staging. Nothing in people, places, orgs, boards, events or
// mentions is touched, and nothing here is public.
//
// Usage (from the repo root, LOCAL session, needs .env.local):
//   node scripts/load-podcast-staging.mjs <manifest.csv> <seeds-dir>
//       dry run: parse, plan, print counts, write NOTHING (default)
//   node scripts/load-podcast-staging.mjs <manifest.csv> <seeds-dir> --apply
//       load into staging, then resolve every undecided node
//   node scripts/load-podcast-staging.mjs --resolve-only [--apply]
//       re-check staged nodes against the catalog without loading seeds
//   node scripts/load-podcast-staging.mjs --dates <podcast_archive dir> [--apply]
//       Pass A story dates: reads every <folder>/dates/<slug>.json under the
//       dir and fills the date columns on matching staged stories. Prints
//       matched, unmatched and already-loaded counts; --dry-run is the default.
//   node scripts/load-podcast-staging.mjs --replays <replays.json> [--apply]
//       marks each replayed copy with replay_of = its original story
//
// The pilot fixture lives in the main checkout only (podcast_archive/ is
// ignored locally), so from a worktree pass absolute paths:
//   node scripts/load-podcast-staging.mjs \
//     /Users/jaybalmer/lineage/podcast_archive/episode-manifest.csv \
//     /Users/jaybalmer/lineage/podcast_archive/pilot/seeds --apply
//
// NO MIRROR. Unlike scripts/import-mentions.mjs, this script holds no logic of
// its own: it runs src/lib/podcast-staging*.ts directly, using Node's built-in
// TypeScript type stripping plus the resolve hook below for the @/ alias, so
// the staging admin routes and this loader share one implementation.
//
// Re-runs are safe (D11): decisions are never overwritten, and new seed content
// for a decided story lands in revision_pending.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { registerHooks } from "node:module"
import { createClient } from "@supabase/supabase-js"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")

// ── @/ alias + extensionless .ts imports, for src/lib under bare Node ───────
// src/ files are ES modules; say so, or Node warns and reparses each one.
const asTsModule = (r) => (r.url.startsWith(pathToFileURL(SRC).href) && r.url.endsWith(".ts") ? { ...r, format: "module-typescript" } : r)

registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromSrc = context.parentURL?.startsWith(pathToFileURL(SRC).href)
    let base = null
    if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2))
    else if (fromSrc && (specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      base = resolve(dirname(fileURLToPath(context.parentURL)), specifier)
    }
    if (base) {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
        if (existsSync(candidate)) return asTsModule(nextResolve(pathToFileURL(candidate).href, context))
      }
    }
    return asTsModule(nextResolve(specifier, context))
  },
})

// ── env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  const env = { ...process.env }
  const file = join(ROOT, ".env.local")
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || env[m[1]]) continue
      env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  }
  return env
}

// ── CSV (quoted fields, embedded commas and quotes) ─────────────────────────
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field); field = ""
      if (row.some((f) => f !== "")) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])))
}

// ── main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const apply = args.includes("--apply")
const resolveOnly = args.includes("--resolve-only")
// --dates and --replays take a path value.
const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined }
const datesDir = valueOf("--dates")
const replaysFile = valueOf("--replays")
const flagValues = new Set([datesDir, replaysFile].filter(Boolean))
const positional = args.filter((a) => !a.startsWith("--") && !flagValues.has(a))

if (args.includes("--dates") && !datesDir) { console.error("--dates needs the podcast_archive directory"); process.exit(1) }
if (args.includes("--replays") && !replaysFile) { console.error("--replays needs the path to replays.json"); process.exit(1) }

if (!resolveOnly && !datesDir && !replaysFile && positional.length < 2) {
  console.error("Usage: node scripts/load-podcast-staging.mjs <manifest.csv> <seeds-dir> [--apply]\n       node scripts/load-podcast-staging.mjs --resolve-only [--apply]")
  process.exit(1)
}

const env = loadEnv()
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (environment or .env.local).")
  process.exit(1)
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { loadStaging, resolveStaging } = await import(pathToFileURL(join(SRC, "lib", "podcast-staging-server.ts")).href)

console.log(apply ? "MODE: apply (writes to podcast_staging_* only)" : "MODE: dry run (no writes)")

function printDateReport(label, r, extra = "") {
  console.log(`\n${label}`)
  console.log(`  matched ${r.matched}, already loaded ${r.alreadyLoaded}, to write ${r.matched - r.alreadyLoaded}, written ${r.written}, unmatched ${r.unmatched.length}${extra}`)
  const shown = r.unmatched.slice(0, 40)
  for (const u of shown) console.log(`    - ${u.where}: ${u.why}`)
  if (r.unmatched.length > shown.length) console.log(`    ... and ${r.unmatched.length - shown.length} more`)
}

if (datesDir || replaysFile) {
  const { loadStoryDates, loadReplays } = await import(pathToFileURL(join(SRC, "lib", "podcast-staging-dates.ts")).href)
  if (datesDir) {
    // Every <folder>/dates/<slug>.json under the archive (pilot + batches); summary.json is the checker's, not a dates file.
    const files = readdirSync(datesDir, { recursive: true })
      .map(String)
      .filter((f) => /(^|\/)dates\/[^/]+\.json$/.test(f) && !f.endsWith("/summary.json"))
      .filter((f) => statSync(join(datesDir, f)).isFile())
      .sort()
      .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(datesDir, f), "utf8")) }))
    console.log(`dates files: ${files.length}`)
    const r = await loadStoryDates(db, files, { apply })
    printDateReport("DATES", r, `, staged stories with no dates row ${r.stagedWithoutDates}`)
  }
  if (replaysFile) {
    const replays = JSON.parse(readFileSync(replaysFile, "utf8"))
    console.log(`replay pairs: ${replays.length}`)
    printDateReport("REPLAYS", await loadReplays(db, replays, { apply }))
  }
  process.exit(0)
}

if (!resolveOnly) {
  const [manifestPath, seedsDir] = positional
  const manifest = parseCsv(readFileSync(manifestPath, "utf8"))
  const files = readdirSync(seedsDir).filter((f) => f.endsWith(".json")).sort()
  const seeds = files.map((f) => ({ file: f, ...JSON.parse(readFileSync(join(seedsDir, f), "utf8")) }))
  console.log(`manifest rows: ${manifest.length}, seed files: ${seeds.length}`)

  const load = await loadStaging(db, { manifest, seeds }, { apply })
  console.log("\nLOAD")
  console.log("  episodes:", load.episodes)
  console.log("  stories: ", load.stories)
  console.log("  nodes:   ", load.nodes)
  console.log("  mentions:", load.mentions)
  if (load.attachedToLive.length) console.log("  attached to live episodes (by YouTube id):", load.attachedToLive)
  if (load.refusals.length) {
    console.log(`  refusals (${load.refusals.length}):`)
    for (const r of load.refusals) console.log(`    - ${r.where}: ${r.why}`)
  }
}

if (apply || resolveOnly) {
  const res = await resolveStaging(db, { apply })
  console.log("\nRESOLVE")
  console.log(`  checked ${res.checked}, changed ${res.changed}, left alone (decided) ${res.skippedDecided}`)
  console.log("  by resolution:", res.byResolution)
  console.log("  by type:", res.byType)
} else {
  console.log("\n(dry run: the resolver pass runs after --apply, against staged rows)")
}
