#!/usr/bin/env node
// Upsert the events catalog into prod through PostgREST, using the service-role key
// from .env.local. Reads the merge-applied JSON written by scripts/build-events-sql.py.
//
// Order matters for the FKs: event_series, then events, then event_results.
// Idempotent: every table upserts on its key, so a re-run updates instead of duplicating.
// Run the migration (20260907000001_events_catalog.sql) FIRST; event_results does not
// exist until then.
//
// Usage (from repo root):
//   python3 scripts/build-events-sql.py
//   node scripts/upload-events.mjs            # upload all three
//   node scripts/upload-events.mjs series     # or a single table: series | events | results

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
function env(k) {
  if (process.env[k]) return process.env[k]
  const line = readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n").find((l) => l.startsWith(k + "="))
  return line ? line.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") : null
}
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL")
const KEY = env("SUPABASE_SERVICE_ROLE_KEY")
if (!URL_ || !KEY) { console.error("Missing Supabase URL or service role key"); process.exit(1) }

const SQLDIR = resolve(root, "data/events/v0.3/import/sql")
const BATCH = 500

async function upsert(table, onConflict, rows) {
  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const url = `${URL_}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    })
    if (!r.ok) {
      console.error(`\n${table} batch ${i}-${i + chunk.length} FAILED: ${r.status}`)
      console.error((await r.text()).slice(0, 800))
      process.exit(1)
    }
    done += chunk.length
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}`)
  }
  process.stdout.write("\n")
}

const load = (f) => JSON.parse(readFileSync(resolve(SQLDIR, f), "utf8"))
const which = process.argv[2] || "all"

if (which === "all" || which === "series")
  await upsert("event_series", "id", load("series.json"))
if (which === "all" || which === "events")
  await upsert("events", "id", load("events.json"))
if (which === "all" || which === "results")
  await upsert("event_results",
    "event_id,discipline,division_label,event_name,place,rider_name",
    load("results.json"))

console.log("done")
