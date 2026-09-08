#!/usr/bin/env node
// Export the live events tables to CSV so a research session can reconcile the
// events catalog against what is actually in production.
//
// Companion to export-catalog-tables.mjs, same reasoning: the Cowork sessions
// that build the events catalog have no network route to Supabase, so they read
// whatever CSV is sitting in data/events/. If that CSV is stale, every
// reconciliation number computed from it is wrong, silently.
//
// Usage (from repo root):
//   node scripts/export-events-tables.mjs
//       writes data/events/existing-event-series-export.csv
//              data/events/existing-events-export.csv
//              data/events/existing-export.EXPORTED-AT
//              data/events/schema-probe.json   (column names + counts, for brief drafting)
//
// READ ONLY. Issues SELECTs and nothing else.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
function env(k) {
  if (process.env[k]) return process.env[k]
  try {
    const line = readFileSync(resolve(root, ".env.local"), "utf8")
      .split("\n").find((l) => l.startsWith(k + "="))
    return line ? line.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") : null
  } catch { return null }
}
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL")
const KEY = env("SUPABASE_SERVICE_ROLE_KEY")
if (!URL_ || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1) }

async function sel(table, params = "select=*") {
  const r = await fetch(`${URL_}/rest/v1/${table}?${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
  })
  if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 200)}` }
  const total = (r.headers.get("content-range") || "").split("/")[1]
  return { rows: await r.json(), total }
}
function csv(rows) {
  if (!rows.length) return ""
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const cell = (v) => v === null || v === undefined ? ""
    : Array.isArray(v) ? `"${v.join(" | ").replace(/"/g, '""')}"`
    : typeof v === "object" ? `"${JSON.stringify(v).replace(/"/g, '""')}"`
    : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n")
}

const out = resolve(root, "data/events")
if (!existsSync(out)) mkdirSync(out, { recursive: true })
const probe = { exported_at: new Date().toISOString(), tables: {} }

for (const t of ["event_series", "events", "places", "event_results", "event_editions", "member_events"]) {
  const r = await sel(t, "select=*&limit=2000")
  if (r.error) { probe.tables[t] = { exists: false, error: r.error }; console.log(`${t}: ${r.error}`); continue }
  probe.tables[t] = { exists: true, total: r.total, columns: r.rows.length ? Object.keys(r.rows[0]) : [], sample: r.rows.slice(0, 2) }
  console.log(`${t}: ${r.total} rows, ${probe.tables[t].columns.length} columns`)
  if (t === "event_series") writeFileSync(resolve(out, "existing-event-series-export.csv"), csv(r.rows))
  if (t === "events") writeFileSync(resolve(out, "existing-events-export.csv"), csv(r.rows))
}
writeFileSync(resolve(out, "schema-probe.json"), JSON.stringify(probe, null, 1))
writeFileSync(resolve(out, "existing-export.EXPORTED-AT"), probe.exported_at + "\n")
console.log("wrote data/events/")
