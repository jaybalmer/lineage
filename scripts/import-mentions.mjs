#!/usr/bin/env node
// Podcast pass Session D: import a scrubbed mention seed file into prod as
// DRAFT mentions, idempotently.
//
// The companion of .claude/skills/podcast-mentions. The skill turns a transcript
// into a seed file; a human scrubs it; this script resolves each subject to an
// existing catalog entity (or creates an unclaimed ghost) and inserts the
// mentions as drafts. Publishing stays a manual editor action on the episode
// page, so nothing this script writes is publicly visible.
//
// Usage (from repo root):
//   node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json
//       dry run: resolve everything, print the plan, write NOTHING (default)
//   node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json --resolve-only
//       resolve and write the resolutions BACK INTO THE SEED FILE. Still no DB
//       writes. This is the review surface: matched ids get filled in, unknown
//       names get flagged new_ghost, collisions get flagged ambiguous with the
//       candidate list so a human can pick.
//   node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json --apply
//       create the ghosts, insert the draft mentions, skip anything already
//       there. Safe to re-run: a second --apply on the same seed is a no-op.
//
// Flags:
//   --apply          write to the database (default is dry run)
//   --resolve-only   write resolutions back into the seed file, never the DB
//   --actor <uuid>   profiles.id stamped as created_by / added_by. Defaults to
//                    MENTIONS_IMPORT_ACTOR_ID from the environment / .env.local.
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
// environment, falling back to .env.local, exactly like
// scripts/backfill-public-slug.mjs. Uses the service-role key, so it bypasses
// RLS.
//
// MIRROR NOTE. The same logic now also lives in TypeScript, as
// src/lib/mention-import.ts (pure rules) + src/lib/mention-import-server.ts
// (the executor), behind POST /api/admin/mentions/import and the
// /admin/podcast/import page. That path is the portable one: it runs in the
// browser under an editor login, so the service-role key never has to leave the
// server. This script stays for local use and is now a MIRROR of it.
//
// CHANGE BOTH FILES when you change any of: the seed contract, the near-miss
// rule, ghost planning, the dedupe key, or the timestamp rule (which is itself
// a mirror of parseTimestampInput in src/lib/mentions.ts, because this script
// runs under plain Node and cannot import the TypeScript helper).

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve as resolvePath } from "node:path"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(__dirname, "..")

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const APPLY = argv.includes("--apply")
const RESOLVE_ONLY = argv.includes("--resolve-only")
const actorFlagIndex = argv.indexOf("--actor")
const ACTOR_FLAG = actorFlagIndex !== -1 ? argv[actorFlagIndex + 1] : null
const seedArg = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--actor")

if (!seedArg) {
  console.error("Usage: node scripts/import-mentions.mjs <seed.json> [--resolve-only|--apply] [--actor <uuid>]")
  process.exit(1)
}
if (APPLY && RESOLVE_ONLY) {
  console.error("--apply and --resolve-only are mutually exclusive.")
  process.exit(1)
}

// ── env loading (mirror of backfill-public-slug.mjs) ────────────────────────
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolvePath(REPO_ROOT, ".env.local"), "utf8")
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
const ACTOR_ID = ACTOR_FLAG ?? process.env.MENTIONS_IMPORT_ACTOR_ID ?? null

// ── shared rules ────────────────────────────────────────────────────────────
const SUBJECT_TYPES = ["person", "place", "org", "board", "event"]

/**
 * Mirror of parseTimestampInput in src/lib/mentions.ts. Accepts mm:ss, h:mm:ss,
 * or a raw seconds count. null = no timestamp, undefined = garbage.
 * CHANGE BOTH FILES if the rule changes.
 */
function parseTimestampInput(raw) {
  const value = String(raw ?? "").trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  const parts = value.split(":")
  if (parts.length < 2 || parts.length > 3) return undefined
  if (!parts.every((p) => /^\d+$/.test(p.trim()))) return undefined
  const nums = parts.map((p) => parseInt(p.trim(), 10))
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]]
  if (m > 59 || s > 59) return undefined
  return h * 3600 + m * 60 + s
}

/** Seconds to mm:ss (h:mm:ss past the hour), mirroring formatTimestamp. */
function formatTimestamp(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** Escape ilike wildcards so a name probe is an exact, case-insensitive match. */
function ilikeExact(value) {
  return String(value).replace(/([%_\\])/g, "\\$1")
}

/** Text catalog ids, matching the app convention (add-entity-modal generateId). */
function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ── seed loading ────────────────────────────────────────────────────────────
const SEED_PATH = resolvePath(process.cwd(), seedArg)
let seed
try {
  seed = JSON.parse(readFileSync(SEED_PATH, "utf8"))
} catch (err) {
  console.error(`Could not read seed file ${SEED_PATH}: ${err.message}`)
  process.exit(1)
}
if (!seed || typeof seed !== "object" || !seed.episode) {
  console.error("Seed file must be an object with an { episode } block.")
  process.exit(1)
}
if (!Array.isArray(seed.stories) && !Array.isArray(seed.mentions)) {
  console.error("Seed file needs a stories array (preferred) or a flat mentions array.")
  process.exit(1)
}

// A story is a passage of the episode with a cast: one timestamp, one excerpt,
// and every entity the story establishes. It expands to one mention per subject,
// all sharing the moment, so each subject's timeline carries the whole story
// rather than the fragment that happens to name them.
//
// The flat mentions array is still read, so seeds written before the story
// format keep working.
function expandStories(s) {
  const out = []
  for (const [storyIndex, story] of (s.stories ?? []).entries()) {
    for (const subject of story.subjects ?? []) {
      out.push({
        ...subject,
        timestamp: subject.timestamp ?? story.timestamp,
        timestamp_seconds: subject.timestamp_seconds ?? story.timestamp_seconds,
        excerpt: subject.excerpt ?? story.excerpt,
        story_title: subject.story_title ?? story.title ?? null,
        status: subject.status ?? story.status ?? "draft",
        resolution: subject.resolution ?? "new_ghost",
        activity: subject.activity ?? story.activity,
        skip_reason: subject.skip_reason ?? story.skip_reason,
        _story: storyIndex,
        _title: story.title,
        // The expanded row is a copy, so --resolve-only writes through this
        // reference to reach the subject inside the seed's story block.
        _ref: subject,
      })
    }
  }
  return out
}
// Story rows are appended after any flat rows so indexes stay stable in output.
const mentionRows = [...(seed.mentions ?? []), ...expandStories(seed)]
// A story marked skip trims its whole cast in one edit.
for (const [storyIndex, story] of (seed.stories ?? []).entries()) {
  if (story.resolution !== "skip") continue
  for (const row of mentionRows) if (row._story === storyIndex) row.resolution = "skip"
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── episode resolution ──────────────────────────────────────────────────────
// By id when the seed carries one, else by episode_number (or name) within the
// show, mirroring the dedup probe in /api/admin/show-episode.
async function resolveEpisode(ep) {
  if (ep.episode_event_id) {
    const { data } = await db
      .from("events")
      .select("id, name, event_type, episode_number, media_url, show_org_id")
      .eq("id", ep.episode_event_id)
      .maybeSingle()
    if (!data) return { error: `Episode id ${ep.episode_event_id} not found.` }
    if (data.event_type !== "episode") {
      return { error: `Event ${ep.episode_event_id} is not an episode (event_type=${data.event_type}).` }
    }
    return { episode: data }
  }

  const showName = (ep.show_name ?? "").trim()
  if (!showName) return { error: "Seed needs episode.episode_event_id or episode.show_name." }
  const { data: shows } = await db.from("orgs").select("id, name").ilike("name", ilikeExact(showName))
  if (!shows || shows.length === 0) return { error: `Show "${showName}" not found in orgs.` }
  if (shows.length > 1) return { error: `Show "${showName}" matches ${shows.length} orgs. Set episode.episode_event_id instead.` }

  let probe = db
    .from("events")
    .select("id, name, event_type, episode_number, media_url, show_org_id")
    .eq("show_org_id", shows[0].id)
    .eq("event_type", "episode")
  if (ep.episode_number !== undefined && ep.episode_number !== null) {
    probe = probe.eq("episode_number", ep.episode_number)
  } else if (ep.episode_name) {
    probe = probe.ilike("name", ilikeExact(ep.episode_name))
  } else {
    return { error: "Seed needs episode.episode_number or episode.episode_name to find the episode within the show." }
  }
  const { data: episodes } = await probe
  if (!episodes || episodes.length === 0) {
    return { error: `No episode found in "${showName}" for ${ep.episode_number ?? ep.episode_name}. Author it first (Brands -> the show -> Add episode).` }
  }
  if (episodes.length > 1) {
    return { error: `Ambiguous episode in "${showName}": ${episodes.length} matches. Set episode.episode_event_id instead.` }
  }
  return { episode: episodes[0] }
}

// ── subject resolution ──────────────────────────────────────────────────────
// Two passes, and the second one exists because the first one is not enough.
//
// Pass 1 is a case-insensitive EXACT name match. Exactly one hit resolves, more
// than one is ambiguous and is never auto-picked (D6).
//
// Pass 2 is the near-miss probe. Exact matching alone quietly minted duplicates
// on the first real import: the transcript says "Mount Baker" and the catalog
// holds "Mt. Baker Ski Area", so nothing matched and a second Baker was created.
// Same for Nakiska, Breckenridge, Whistler and Blackcomb. A near miss now
// REFUSES the row and hands back the candidates, because a wrong new node is
// worse than a stopped import: the mention still gets written, just against a
// twin nobody else links to.
//
// Escape hatch: set "confirm_new": true on the subject to say "I looked, it is
// genuinely different", and the probe is skipped for that row.
//
// person spans BOTH people and profiles: the app's people catalog is the union
// of the two (lineage-store catalog load), and a mention against a member must
// carry the profile id so it lands on their real timeline.

// Words that carry no identity, so "Nakiska" and "Nakiska Ski Area" compare
// equal. Deliberately short: anything dropped here is a word two different
// entities are allowed to share.
const GENERIC_TOKENS = new Set([
  "the", "a", "an", "and", "of", "at",
  "ski", "skiing", "area", "resort", "mountain", "mtn", "hill", "park",
  "snowboard", "snowboards", "snowboarding", "boards", "co", "inc", "ltd", "llc",
])

/** Lowercase, expand the abbreviations that actually collide, strip punctuation. */
function normalizeName(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\bmt\.?\b/g, "mount")
    .replace(/\bst\.?\b/g, "saint")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Identity-bearing tokens only. */
function significantTokens(raw) {
  return normalizeName(raw).split(" ").filter((t) => t && !GENERIC_TOKENS.has(t))
}

/**
 * True when two names are close enough that a human should decide.
 *
 * The rule is token containment after normalization: every significant token of
 * the shorter name appears in the longer. That catches abbreviation ("Mt." vs
 * "Mount"), generic suffixes ("Nakiska" vs "Nakiska Ski Area") and partial names
 * ("Whistler" vs "Whistler Blackcomb"), which is every duplicate the first
 * import produced. It is deliberately loose: a false flag costs one review, a
 * missed one costs a permanent duplicate node.
 */
function isNearMiss(a, b) {
  const A = new Set(significantTokens(a))
  const B = new Set(significantTokens(b))
  if (A.size === 0 || B.size === 0) return false
  const [small, large] = A.size <= B.size ? [A, B] : [B, A]
  for (const token of small) if (!large.has(token)) return false
  return true
}

const sameName = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()

// One read per table per run, held in memory. Matching in memory rather than
// per-row SQL is what makes the near-miss scan affordable at all, and it lets a
// ghost created mid-run be visible to later rows (see rememberCreated).
const indexCache = new Map()

async function loadIndex(type) {
  if (indexCache.has(type)) return indexCache.get(type)
  let rows = []
  if (type === "person") {
    const [{ data: people }, { data: profiles }] = await Promise.all([
      db.from("people").select("id, display_name, node_status"),
      db.from("profiles").select("id, display_name, is_archived"),
    ])
    for (const p of profiles ?? []) {
      if (p.is_archived || !p.display_name) continue
      rows.push({ id: p.id, name: p.display_name, label: `${p.display_name} (member)` })
    }
    const seen = new Set(rows.map((r) => r.id))
    for (const p of people ?? []) {
      if (seen.has(p.id) || !p.display_name) continue
      rows.push({ id: p.id, name: p.display_name, label: `${p.display_name} (${p.node_status})` })
    }
  } else if (type === "place") {
    const { data } = await db.from("places").select("id, name, place_type")
    rows = (data ?? []).map((p) => ({ id: p.id, name: p.name, label: `${p.name} (${p.place_type})` }))
  } else if (type === "org") {
    const { data } = await db.from("orgs").select("id, name, org_type")
    rows = (data ?? []).map((o) => ({ id: o.id, name: o.name, label: `${o.name} (${o.org_type})` }))
  } else if (type === "event") {
    const { data } = await db.from("events").select("id, name, year")
    rows = (data ?? []).map((e) => ({ id: e.id, name: e.name, label: `${e.name}${e.year ? ` (${e.year})` : ""}` }))
  } else {
    const { data } = await db.from("boards").select("id, brand, model, model_year")
    rows = (data ?? []).map((b) => ({
      id: b.id,
      name: `${b.brand ?? ""} ${b.model ?? ""}`.trim(),
      brand: b.brand, model: b.model, model_year: b.model_year,
      label: `${b.brand} ${b.model}${b.model_year ? ` ${b.model_year}` : ""}`,
    }))
  }
  indexCache.set(type, rows)
  return rows
}

/** Make a just-created ghost visible to the rest of this run. */
function rememberCreated(type, entity) {
  const rows = indexCache.get(type)
  if (rows) rows.push(entity)
}

/**
 * Resolve one subject.
 *
 * Returns { exact } when the name matched outright (0, 1 or many), and
 * { near } when nothing matched exactly but something looks like it should have.
 */
async function findCandidates(row) {
  const name = (row.subject_name ?? "").trim()
  const ghost = row.ghost ?? {}
  const type = row.subject_type
  const index = await loadIndex(type)

  if (type === "board") {
    // brand + model is the real identity. Match on both when the seed carries
    // them (it must, to create the ghost at all), else fall back to the model.
    const exact = ghost.brand && ghost.model
      ? index.filter((b) =>
          sameName(b.brand, ghost.brand) && sameName(b.model, ghost.model) &&
          (!ghost.model_year || b.model_year === ghost.model_year))
      : index.filter((b) => sameName(b.model, name))
    if (exact.length > 0) return { exact }
    const probe = ghost.brand && ghost.model ? `${ghost.brand} ${ghost.model}` : name
    return { exact: [], near: index.filter((b) => isNearMiss(probe, b.name)) }
  }

  const exact = index.filter((e) => sameName(e.name, name))
  if (exact.length > 0) return { exact }
  return { exact: [], near: index.filter((e) => isNearMiss(name, e.name)) }
}

// ── ghost creation (D5) ─────────────────────────────────────────────────────
// Every ghost is explicitly unverified. A person ghost sets node_status
// 'unclaimed' EXPLICITLY: the DB default is 'catalog', which misfiles it
// (see addUserPerson in src/store/lineage-store.ts).
//
// Returns { row, table, id } to insert, or { error } when the seed does not
// carry a column the table requires and no value may be invented.
function planGhost(row) {
  const name = (row.subject_name ?? "").trim()
  const ghost = row.ghost ?? {}

  if (row.subject_type === "person") {
    const id = crypto.randomUUID()
    return {
      table: "people",
      id,
      row: {
        id,
        display_name: name,
        community_status: "unverified",
        node_status: "unclaimed",
        added_by: ACTOR_ID,
      },
    }
  }

  if (row.subject_type === "place") {
    const id = genId("place")
    return {
      table: "places",
      id,
      row: {
        id,
        name,
        place_type: ghost.place_type ?? "resort",
        region: ghost.region ?? null,
        country: ghost.country ?? null,
        community_status: "unverified",
        added_by: ACTOR_ID,
      },
    }
  }

  if (row.subject_type === "org") {
    const id = genId("org")
    return {
      table: "orgs",
      id,
      row: {
        id,
        name,
        org_type: ghost.org_type ?? "brand",
        brand_category: ghost.brand_category ?? null,
        country: ghost.country ?? null,
        community_status: "unverified",
        added_by: ACTOR_ID,
      },
    }
  }

  if (row.subject_type === "board") {
    // boards.model_year is NOT NULL with no default, so the seed has to carry
    // brand + model + model_year. Refuse rather than invent a year.
    const brand = ghost.brand ?? null
    const model = ghost.model ?? null
    const modelYear = ghost.model_year ?? null
    if (!brand || !model || !modelYear) {
      return {
        error: `board ghost needs ghost.brand, ghost.model and ghost.model_year (boards.model_year is NOT NULL). Add them to the seed or resolve this row to an existing board.`,
      }
    }
    const id = genId("board")
    return {
      table: "boards",
      id,
      row: {
        id, brand, model, model_year: modelYear,
        shape: ghost.shape ?? null,
        community_status: "unverified",
        added_by: ACTOR_ID,
      },
    }
  }

  // event: events.start_date is NOT NULL with no default.
  const rawStart = ghost.start_date ?? null
  if (!rawStart) {
    return {
      error: `event ghost needs ghost.start_date (YYYY or YYYY-MM-DD; events.start_date is NOT NULL). Add it to the seed or resolve this row to an existing event.`,
    }
  }
  const startDate = /^\d{4}$/.test(rawStart) ? `${rawStart}-01-01` : rawStart
  const id = genId("event")
  return {
    table: "events",
    id,
    row: {
      id,
      name,
      event_type: ghost.event_type ?? "gathering",
      start_date: startDate,
      year: ghost.year ?? Number(String(startDate).slice(0, 4)),
      place_id: ghost.place_id ?? null,
      community_status: "unverified",
      added_by: ACTOR_ID,
    },
  }
}

const COMMUNITY_JUNCTION = {
  people: { table: "community_people", key: "person_id" },
  places: { table: "community_places", key: "place_id" },
  orgs: { table: "community_orgs", key: "org_id" },
  boards: { table: "community_boards", key: "board_id" },
  events: { table: "community_events", key: "event_id" },
}

/**
 * Put a freshly created ghost in the same community as the episode, matching
 * what /api/admin/show-episode does for a new show or episode. Best effort: a
 * missing junction row degrades to the entity simply not being community-scoped,
 * which the directories already tolerate.
 */
async function linkCommunity(table, id, communityId) {
  if (!communityId) return
  const j = COMMUNITY_JUNCTION[table]
  if (!j) return
  const { error } = await db
    .from(j.table)
    .upsert({ community_id: communityId, [j.key]: id }, { onConflict: `community_id,${j.key}` })
  if (error) console.warn(`  ! community junction for ${id} failed: ${error.message}`)
}

// ── run ─────────────────────────────────────────────────────────────────────
const { episode, error: episodeError } = await resolveEpisode(seed.episode)
if (episodeError) {
  console.error(episodeError)
  process.exit(1)
}

// The community the episode belongs to, so new ghosts land beside it.
const { data: episodeCommunity } = await db
  .from("community_events")
  .select("community_id")
  .eq("event_id", episode.id)
  .limit(1)
  .maybeSingle()
const communityId = episodeCommunity?.community_id ?? null

const mode = APPLY ? "APPLY" : RESOLVE_ONLY ? "RESOLVE-ONLY (writes the seed file, not the database)" : "DRY RUN (no writes)"
console.log(`Seed:     ${seedArg}`)
console.log(`Episode:  ${episode.name} [${episode.id}]${episode.episode_number ? ` (#${episode.episode_number})` : ""}`)
console.log(`Mode:     ${mode}`)
console.log(`Actor:    ${ACTOR_ID ?? "(none: added_by / created_by will be null)"}`)
console.log("")

if (APPLY && !ACTOR_ID) {
  console.error("--apply needs an actor: pass --actor <profiles.id> or set MENTIONS_IMPORT_ACTOR_ID.")
  process.exit(1)
}

// Existing mentions on this episode, for the skip-existing check (D8).
const { data: existingMentions } = await db
  .from("mentions")
  .select("id, subject_type, subject_id, timestamp_seconds")
  .eq("episode_event_id", episode.id)
const dedupeKey = (subjectType, subjectId, ts) => `${subjectType}|${subjectId}|${ts ?? -1}`
const existingKeys = new Map()
for (const m of existingMentions ?? []) {
  existingKeys.set(dedupeKey(m.subject_type, m.subject_id, m.timestamp_seconds), m.id)
}

let created = 0
let inserted = 0
let skipped = 0
let refused = 0
let excluded = 0
// Trimmed rows, grouped by the activity they were parked under. The seed keeps
// them so an episode never has to be re-transcribed when another activity or
// community goes live.
const parked = new Map()
const seedChanged = []

for (const [index, row] of mentionRows.entries()) {
  const label = `${index + 1}. ${row.subject_name ?? "(no name)"}`

  if (row.resolution === "skip") {
    excluded++
    const activity = row.activity ?? "unfiled"
    parked.set(activity, (parked.get(activity) ?? 0) + 1)
    console.log(`${label}: trimmed, parked under ${activity}${row.skip_reason ? ` (${row.skip_reason})` : ""}`)
    continue
  }
  if (!SUBJECT_TYPES.includes(row.subject_type)) {
    refused++
    console.log(`${label}: REFUSED, subject_type must be one of ${SUBJECT_TYPES.join(", ")}`)
    continue
  }
  if (!(row.subject_name ?? "").trim() && !row.subject_id) {
    refused++
    console.log(`${label}: REFUSED, needs subject_name or subject_id`)
    continue
  }

  // Timestamp: accept a raw seconds number or an mm:ss string, same rule as the
  // in-app editor modal.
  const rawTs = row.timestamp_seconds ?? row.timestamp ?? null
  const ts = rawTs === null || rawTs === undefined || rawTs === "" ? null : parseTimestampInput(rawTs)
  if (ts === undefined) {
    refused++
    console.log(`${label}: REFUSED, unreadable timestamp "${rawTs}" (use mm:ss, h:mm:ss, or seconds)`)
    continue
  }

  // ── resolve the subject ───────────────────────────────────────────────────
  // A subject_id already in the seed is trusted: it is either a match this
  // script wrote earlier or a disambiguation a human made, and re-resolving it
  // would undo that choice.
  let subjectId = row.subject_id ?? null
  let resolution = row.resolution ?? null

  if (!subjectId) {
    const { exact, near } = await findCandidates(row)
    if (exact.length === 1) {
      subjectId = exact[0].id
      resolution = "matched_existing"
      seedChanged.push({ index, subject_id: subjectId, resolution, candidates: null })
      console.log(`${label}: matched ${exact[0].label} [${subjectId}]`)
    } else if (exact.length > 1) {
      resolution = "ambiguous"
      seedChanged.push({ index, subject_id: null, resolution, candidates: exact })
      refused++
      console.log(`${label}: AMBIGUOUS, ${exact.length} exact matches. Pick one and set subject_id in the seed:`)
      for (const c of exact) console.log(`     ${c.id}  ${c.label}`)
      continue
    } else if ((near?.length ?? 0) > 0 && row.confirm_new !== true) {
      // Nothing matched outright, but something is close enough that creating a
      // node here would probably mint a twin. Refuse and let a human decide.
      resolution = "review"
      seedChanged.push({ index, subject_id: null, resolution, candidates: near })
      refused++
      console.log(`${label}: NEAR MISS, no exact match but ${near.length} similar. Set subject_id to one of these, or add "confirm_new": true if it really is new:`)
      for (const c of near) console.log(`     ${c.id}  ${c.label}`)
      continue
    } else {
      resolution = "new_ghost"
      seedChanged.push({ index, subject_id: null, resolution, candidates: null })
    }
  }

  // ── ghost ─────────────────────────────────────────────────────────────────
  if (!subjectId) {
    const plan = planGhost(row)
    if (plan.error) {
      refused++
      console.log(`${label}: REFUSED, ${plan.error}`)
      continue
    }
    if (APPLY) {
      const { error } = await db.from(plan.table).insert(plan.row)
      if (error) {
        refused++
        console.log(`${label}: REFUSED, ghost insert into ${plan.table} failed: ${error.message}`)
        continue
      }
      await linkCommunity(plan.table, plan.id, communityId)
      rememberCreated(row.subject_type, {
        id: plan.id,
        name: row.subject_type === "board"
          ? `${plan.row.brand ?? ""} ${plan.row.model ?? ""}`.trim()
          : (plan.row.display_name ?? plan.row.name),
        brand: plan.row.brand, model: plan.row.model, model_year: plan.row.model_year,
        label: `${plan.row.display_name ?? plan.row.name ?? plan.id} (just created)`,
      })
      subjectId = plan.id
      created++
      console.log(`${label}: created ${row.subject_type} ghost [${plan.id}]`)
    } else {
      created++
      // The ghost does not exist yet, so there is no id to dedupe the mention
      // against. It cannot already be present either: a mention needs a subject.
      inserted++
      console.log(`${label}: would create ${row.subject_type} ghost in ${plan.table}`)
      console.log(`     -> would then add a draft mention${ts === null ? "" : ` at ${formatTimestamp(ts)}`}`)
      continue
    }
  }

  // ── mention ───────────────────────────────────────────────────────────────
  const key = dedupeKey(row.subject_type, subjectId, ts)
  if (existingKeys.has(key)) {
    skipped++
    console.log(`${label}: already mapped at ${ts === null ? "no timestamp" : formatTimestamp(ts)}, skipping [${existingKeys.get(key)}]`)
    continue
  }

  if (row.status === "published") {
    console.log(`${label}: note, seed says published. Importing as draft (D2); publish from the episode page.`)
  }

  const mentionRow = {
    episode_event_id: episode.id,
    subject_type: row.subject_type,
    subject_id: subjectId,
    timestamp_seconds: ts,
    excerpt: (row.excerpt ?? "").trim() || null,
    story_title: (row.story_title ?? "").trim() || null,
    status: "draft",
    created_by: ACTOR_ID,
  }

  if (!APPLY) {
    inserted++
    console.log(`${label}: would add a draft mention${ts === null ? "" : ` at ${formatTimestamp(ts)}`} -> ${subjectId}`)
    continue
  }

  const { data: ins, error } = await db.from("mentions").insert(mentionRow).select("id").maybeSingle()
  if (error) {
    // 23505 means the row landed between the read above and this insert. That is
    // the same outcome as a skip, not a failure.
    if (error.code === "23505") {
      skipped++
      console.log(`${label}: already mapped (raced the dedupe index), skipping`)
    } else {
      refused++
      console.log(`${label}: REFUSED, mention insert failed: ${error.message}`)
    }
    continue
  }
  existingKeys.set(key, ins?.id ?? "")
  inserted++
  console.log(`${label}: draft mention${ts === null ? "" : ` at ${formatTimestamp(ts)}`} -> ${subjectId}`)
}

// ── write resolutions back into the seed (review surface) ───────────────────
if (RESOLVE_ONLY && seedChanged.length > 0) {
  for (const change of seedChanged) {
    // Write back into the row's real home: a story subject, or the flat array.
    const row = mentionRows[change.index]._ref ?? mentionRows[change.index]
    if (change.subject_id) row.subject_id = change.subject_id
    row.resolution = change.resolution
    if (change.candidates) row.candidates = change.candidates
    else delete row.candidates
  }
  writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8")
  console.log(`\nWrote resolutions back into ${seedArg}.`)
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log("")
console.log(`Episode:            ${episode.name} [${episode.id}]`)
console.log(`Ghosts ${APPLY ? "created:   " : "to create: "} ${created}`)
console.log(`Drafts ${APPLY ? "inserted:  " : "to insert: "} ${inserted}`)
console.log(`Skipped (existing): ${skipped}`)
console.log(`Trimmed (kept):     ${excluded}`)
for (const [activity, count] of [...parked.entries()].sort()) {
  console.log(`  parked: ${activity.padEnd(16)} ${count}`)
}
console.log(`Refused:            ${refused}`)

if (!APPLY && !RESOLVE_ONLY) {
  console.log("\nNothing was written. Re-run with --apply to import, or --resolve-only to record the resolutions in the seed.")
}
if (APPLY && inserted > 0) {
  console.log("\nImported mentions are DRAFTS: editor-only until you publish them from the episode page.")
}
process.exit(refused > 0 ? 1 : 0)
