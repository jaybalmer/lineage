#!/usr/bin/env node
// One-time backfill: populate profiles.public_slug for existing member
// profiles (PB-010 Phase 1). Run AFTER the migration
// 20260615000003_pb010_phase1_public_timeline_foundation.sql is applied.
//
// Usage (from repo root):
//   node scripts/backfill-public-slug.mjs            # dry run: prints the plan, writes nothing
//   node scripts/backfill-public-slug.mjs --apply    # writes the slugs to prod
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
// environment, falling back to .env.local. Uses the service-role key, so it
// bypasses RLS. Idempotent: only rows where public_slug is null are touched,
// so re-running after a partial run is safe.
//
// SLUG RULE KEPT IN SYNC WITH src/lib/public-slug.ts (ensureUniquePublicSlug).
// This script runs under plain Node and cannot import the TypeScript helper, so
// the two-line nameToSlug rule and the collision-to-id-suffix rule are mirrored
// here. If you change the slug rule, change BOTH files.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const APPLY = process.argv.includes("--apply")

// ── env loading ─────────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // no .env.local; rely on process.env
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked env and .env.local).")
  process.exit(1)
}

// ── slug rule (mirror of src/lib/public-slug.ts) ────────────────────────────
function nameToSlug(name) {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}
function shortIdSuffix(id) {
  const cleaned = (id ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase()
  return cleaned.slice(0, 8) || "x"
}
// Pick a unique slug for one profile given the set of slugs already taken.
// First-come keeps the bare name slug; later collisions get the id suffix.
function pickSlug(displayName, id, taken) {
  const base = nameToSlug(displayName)
  const suffix = shortIdSuffix(id)
  const candidates = base ? [base, `${base}_${suffix}`] : [`rider_${suffix}`]
  for (const c of candidates) {
    if (!taken.has(c)) return c
  }
  const wideBase = base || "rider"
  const fullId = (id ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase() || "x"
  for (let len = 9; len <= fullId.length; len++) {
    const c = `${wideBase}_${fullId.slice(0, len)}`
    if (!taken.has(c)) return c
  }
  return `${wideBase}_${fullId}`
}

// ── run ─────────────────────────────────────────────────────────────────────
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data: profiles, error } = await db
  .from("profiles")
  .select("id, display_name, public_slug")
  .order("id", { ascending: true })

if (error) {
  console.error("Failed to read profiles:", error.message)
  process.exit(1)
}

const taken = new Set()
for (const p of profiles) {
  if (p.public_slug) taken.add(p.public_slug)
}

const toBackfill = profiles.filter((p) => !p.public_slug)
const plan = []
let suffixed = 0
for (const p of toBackfill) {
  const slug = pickSlug(p.display_name, p.id, taken)
  taken.add(slug)
  if (slug !== nameToSlug(p.display_name)) suffixed++
  plan.push({ id: p.id, display_name: p.display_name, slug })
}

console.log(`Profiles total:        ${profiles.length}`)
console.log(`Already have a slug:   ${profiles.length - toBackfill.length}`)
console.log(`To backfill:           ${toBackfill.length}`)
console.log(`Of those, suffixed:    ${suffixed} (name slug collided or was empty)`)
console.log("")

if (!APPLY) {
  console.log("DRY RUN (no writes). Sample of the plan:")
  for (const row of plan.slice(0, 20)) {
    console.log(`  ${row.slug.padEnd(28)} <- ${row.display_name ?? "(no name)"} [${row.id}]`)
  }
  if (plan.length > 20) console.log(`  ... and ${plan.length - 20} more`)
  console.log("\nRe-run with --apply to write these slugs.")
  process.exit(0)
}

console.log("APPLYING...")
let ok = 0
let failed = 0
for (const row of plan) {
  // Guard on public_slug is null so a concurrent / re-run never clobbers.
  const { error: upErr } = await db
    .from("profiles")
    .update({ public_slug: row.slug })
    .eq("id", row.id)
    .is("public_slug", null)
  if (upErr) {
    failed++
    console.error(`  FAIL ${row.id} -> ${row.slug}: ${upErr.message}`)
  } else {
    ok++
  }
}
console.log(`\nDone. Updated ${ok}, failed ${failed}.`)
process.exit(failed > 0 ? 1 : 0)
