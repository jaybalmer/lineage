#!/usr/bin/env node
// Loads the Pass B retellings into the FNRad Archive's Retold tables
// (migration 20261118000003_fnrad_retellings.sql).
//
// Usage (repo root, LOCAL session, needs .env.local):
//   node scripts/import-fnrad-retellings.mjs <entries.json>           dry run, writes nothing
//   node scripts/import-fnrad-retellings.mjs <entries.json> --apply   upsert
//
// Groupings only (Jay, 2026-11-18): an entry's id, title, years and kind, and
// each telling's episode, timestamp and role. The written differences and
// notes are never loaded. A telling is kept only when it matches a published
// story: video id -> podcast_staging_episodes.episode_event_id, then a
// published mention at that exact timestamp. Re-runs upsert on the same keys.

import { readFileSync, existsSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

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

const [file, flag] = process.argv.slice(2)
if (!file) {
  console.error("Usage: node scripts/import-fnrad-retellings.mjs <entries.json> [--apply]")
  process.exit(1)
}
const apply = flag === "--apply"
const env = loadEnv()
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (environment or .env.local).")
  process.exit(1)
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const toSeconds = (ts) => {
  const p = String(ts).split(":").map((x) => parseInt(x, 10))
  if (p.some((x) => !Number.isFinite(x))) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null
}
const toYears = (y) => {
  const m = String(y ?? "").match(/^(\d{4})(?:\s*to\s*(\d{4}))?$/)
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : [null, null]
}
const chunks = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

const entries = JSON.parse(readFileSync(resolve(file), "utf8")).entries
const videoIds = [...new Set(entries.flatMap((e) => e.tellings.map((t) => t.key.split("|")[0])))]

// video id -> published episode event
const eventByVideo = new Map()
for (const part of chunks(videoIds, 100)) {
  const { data, error } = await db.from("podcast_staging_episodes").select("video_id, episode_event_id").in("video_id", part)
  if (error) throw new Error(`staging episodes: ${error.message}`)
  for (const r of data ?? []) if (r.episode_event_id) eventByVideo.set(r.video_id, r.episode_event_id)
}

// published story timestamps per episode event
const storyTs = new Map()
for (const part of chunks([...new Set(eventByVideo.values())], 40)) {
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("mentions")
      .select("episode_event_id, timestamp_seconds")
      .in("episode_event_id", part)
      .eq("status", "published")
      .order("id")
      .range(from, from + 999)
    if (error) throw new Error(`mentions: ${error.message}`)
    for (const r of data ?? []) {
      if (r.timestamp_seconds == null) continue
      if (!storyTs.has(r.episode_event_id)) storyTs.set(r.episode_event_id, new Set())
      storyTs.get(r.episode_event_id).add(r.timestamp_seconds)
    }
    if ((data ?? []).length < 1000) break
  }
}

const retellings = []
const tellings = []
const miss = { noEpisode: 0, noStory: 0 }
for (const e of entries) {
  const [start, end] = toYears(e.year)
  const kept = []
  e.tellings.forEach((t, position) => {
    const [video, ts] = t.key.split("|")
    const ev = eventByVideo.get(video)
    const sec = toSeconds(ts)
    if (!ev) return void miss.noEpisode++
    if (sec == null || !storyTs.get(ev)?.has(sec)) return void miss.noStory++
    if (kept.some((k) => k.episode_event_id === ev && k.timestamp_seconds === sec)) return
    kept.push({ retelling_id: e.id, episode_event_id: ev, timestamp_seconds: sec, role: t.role ?? null, position })
  })
  retellings.push({ id: e.id, title: e.title, years: e.year ?? null, start_year: start, end_year: end, kind: e.kind, _kept: kept.length })
  tellings.push(...kept)
}

const showable = retellings.filter((r) => r._kept >= 2).length
console.log(`entries: ${entries.length} (${showable} with 2+ matched tellings)`)
console.log(`tellings: ${entries.reduce((n, e) => n + e.tellings.length, 0)} in file, ${tellings.length} matched to a published story`)
console.log(`unmatched: ${miss.noEpisode} episode not published, ${miss.noStory} no published story at that timestamp`)

if (!apply) {
  console.log("Dry run. Re-run with --apply to write.")
  process.exit(0)
}
for (const part of chunks(retellings.map(({ _kept, ...r }) => r), 200)) {
  const { error } = await db.from("fnrad_retellings").upsert(part, { onConflict: "id" })
  if (error) throw new Error(`fnrad_retellings: ${error.message}`)
}
for (const part of chunks(tellings, 500)) {
  const { error } = await db.from("fnrad_retelling_tellings").upsert(part, { onConflict: "retelling_id,episode_event_id,timestamp_seconds" })
  if (error) throw new Error(`fnrad_retelling_tellings: ${error.message}`)
}
console.log(`Wrote ${retellings.length} entries and ${tellings.length} tellings.`)
