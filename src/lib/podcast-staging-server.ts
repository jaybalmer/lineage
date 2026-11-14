// Podcast archive staging: the database half.
//
// Takes the Supabase client as a PARAMETER instead of importing
// getServiceClient, so it runs both under bare Node (scripts/load-podcast-
// staging.mjs builds its own service-role client from .env.local) and inside a
// route (which passes getServiceClient()). It must not import @/lib/auth or
// anything else that reaches next/*.
//
// Writes ONLY to the four podcast_staging_* tables. Catalog tables (people,
// profiles, places, orgs, boards, events, mentions) are read, never written.

import type { SupabaseClient } from "@supabase/supabase-js"
import { readTimestamp } from "@/lib/mention-import"
import {
  STAGING_SUBJECT_TYPES,
  inferenceFlags,
  isBonusLabel,
  resolveNode,
  stagingKey,
  youTubeId,
} from "@/lib/podcast-staging"
import type {
  CatalogEntry,
  NodeCandidate,
  NodeFlag,
  NodeResolution,
  StagingGhost,
  StagingSubjectType,
  StoryDecision,
} from "@/lib/podcast-staging"

const PAGE = 1000
const WRITE_BATCH = 500

/**
 * Read every row of a table. PostgREST caps one select at 1000 rows, and the
 * boards table holds over 3,600, so a single select silently drops most of it.
 */
export async function selectAll<T>(db: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(cols).order("id").range(from, from + PAGE - 1)
    if (error) throw new Error(`read ${table}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

// ── catalog index ───────────────────────────────────────────────────────────
// Same sources and label shapes as loadIndex in mention-import-server.ts
// (person = profiles UNION people, archived profiles skipped), read in full,
// with episodes excluded from event matching (T4a).

export type CatalogIndex = Record<StagingSubjectType, CatalogEntry[]>

export async function loadCatalogIndex(db: SupabaseClient): Promise<CatalogIndex> {
  const [person, place, org, event, board] = await Promise.all(
    (["person", "place", "org", "event", "board"] as const).map((t) => loadCatalogType(db, t)),
  )
  return { person, place, org, event, board }
}

/** One type's catalog entries, read in full. Per-node actions use this alone. */
export async function loadCatalogType(db: SupabaseClient, type: StagingSubjectType): Promise<CatalogEntry[]> {
  if (type === "person") {
    const [people, profiles] = await Promise.all([
      selectAll<{ id: string; display_name: string | null; node_status: string | null }>(db, "people", "id, display_name, node_status"),
      selectAll<{ id: string; display_name: string | null; is_archived: boolean | null }>(db, "profiles", "id, display_name, is_archived"),
    ])
    const person: CatalogEntry[] = []
    for (const p of profiles) {
      if (p.is_archived || !p.display_name) continue
      person.push({ id: p.id, name: p.display_name, label: `${p.display_name} (member)` })
    }
    const seen = new Set(person.map((r) => r.id))
    for (const p of people) {
      if (seen.has(p.id) || !p.display_name) continue
      person.push({ id: p.id, name: p.display_name, label: `${p.display_name} (${p.node_status})` })
    }
    return person
  }
  if (type === "place") {
    const places = await selectAll<{ id: string; name: string; place_type: string | null }>(db, "places", "id, name, place_type")
    return places.map((p) => ({ id: p.id, name: p.name, label: `${p.name} (${p.place_type})` }))
  }
  if (type === "org") {
    const orgs = await selectAll<{ id: string; name: string; org_type: string | null }>(db, "orgs", "id, name, org_type")
    return orgs.map((o) => ({ id: o.id, name: o.name, label: `${o.name} (${o.org_type})` }))
  }
  if (type === "event") {
    const events = await selectAll<{ id: string; name: string; year: number | null; event_type: string | null }>(db, "events", "id, name, year, event_type")
    return events
      .filter((e) => e.event_type !== "episode")
      .map((e) => ({ id: e.id, name: e.name, year: e.year, label: `${e.name}${e.year ? ` (${e.year})` : ""}` }))
  }
  const boards = await selectAll<{ id: string; brand: string | null; model: string | null; model_year: number | null }>(db, "boards", "id, brand, model, model_year")
  return boards.map((b) => ({
    id: b.id,
    name: `${b.brand ?? ""} ${b.model ?? ""}`.trim(),
    brand: b.brand,
    model: b.model,
    model_year: b.model_year,
    label: `${b.brand} ${b.model}${b.model_year ? ` ${b.model_year}` : ""}`,
  }))
}

// ── loader input ────────────────────────────────────────────────────────────

/** One row of podcast_archive/episode-manifest.csv. */
export type ManifestRow = Record<string, string>

export type StagingSeedSubject = {
  subject_name?: string
  subject_type?: string
  ghost?: StagingGhost
  heard_as?: string
  inferred?: boolean
}

export type StagingSeed = {
  /** File name, for the report. */
  file: string
  episode: {
    show_name?: string
    episode_number?: number | null
    episode_name?: string
    media_url?: string
    archive_label?: string
    guest?: string
    date?: string
    note?: string
  }
  stories?: {
    timestamp?: string | number
    timestamp_seconds?: number
    title?: string
    excerpt?: string
    resolution?: string
    status?: string
    activity?: string
    skip_reason?: string
    subjects?: StagingSeedSubject[]
  }[]
}

export type LoadReport = {
  apply: boolean
  episodes: { insert: number; update: number; unchanged: number }
  stories: { insert: number; update: number; revision: number; unchanged: number }
  nodes: { insert: number; update: number; unchanged: number }
  mentions: { insert: number; update: number; unchanged: number; notInSeed: number }
  attachedToLive: { label: string; episode_event_id: string }[]
  refusals: { where: string; why: string }[]
}

// ── episode numbering (D1, D2, D12) and spinoffs (D3) ───────────────────────

const FOUNDING_FROM = "2015-12-01"
const FOUNDING_TO = "2017-04-30"

/**
 * D2: the 34 unlabelled founding-era episodes (Dec 2015 to Apr 2017) get
 * synthetic numbers 101 to 134 in publication order, computed over the WHOLE
 * manifest so a number never depends on which seeds happen to be loaded.
 */
export function foundingNumbers(manifest: ManifestRow[]): Map<string, number> {
  const rows = manifest
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (r.label ?? "").toUpperCase() === "SPECIAL" && r.date >= FOUNDING_FROM && r.date <= FOUNDING_TO)
    .sort((a, b) => (a.r.date === b.r.date ? a.i - b.i : a.r.date < b.r.date ? -1 : 1))
  const out = new Map<string, number>()
  rows.forEach(({ r }, rank) => {
    const vid = r.canonical_video_id || r.youtube_id
    if (vid) out.set(vid, 101 + rank)
  })
  return out
}

function seriesNote(title: string | undefined): string | null {
  const t = String(title ?? "")
  if (/\bthe plug\b/i.test(t)) return "The Plug with Russell Winfield"
  if (/\bside hits?\b/i.test(t)) return "Side Hits"
  return null
}

function manifestByVideo(manifest: ManifestRow[]): Map<string, ManifestRow> {
  const out = new Map<string, ManifestRow>()
  for (const r of manifest) {
    for (const v of [r.canonical_video_id, r.youtube_id, ...(r.twin_video_ids ?? "").split(/[\s;|]+/)]) {
      const id = (v ?? "").trim()
      if (id && !out.has(id)) out.set(id, r)
    }
  }
  return out
}

// ── the load ────────────────────────────────────────────────────────────────

type EpisodeRow = {
  id: string
  video_id: string
  show_org_id: string | null
  archive_label: string | null
  guest: string | null
  episode_name: string
  proposed_episode_number: number | null
  air_date: string | null
  media_url: string | null
  series_note: string | null
  wave: string | null
  episode_event_id: string | null
  notes: string | null
}

type NodeRow = {
  id: string
  subject_type: StagingSubjectType
  name: string
  normalized_name: string
  ghost: StagingGhost
  heard_as: string[]
  merged_into: string | null
}

type StoryRow = {
  id: string
  episode_id: string
  timestamp_seconds: number
  position: number
  title: string
  excerpt: string
  decision: StoryDecision
  activity: string | null
  skip_reason: string | null
  revision_pending: unknown
  decided_by: string | null
}

type MentionRow = {
  id: string
  story_id: string
  node_id: string
  heard_as: string | null
  inferred: boolean
}

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim()
  return s || null
}

/**
 * Order-insensitive deep equality. jsonb hands objects back with its own key
 * order, so comparing JSON.stringify output would call every stored object
 * "changed" and make each re-run rewrite rows it did not change.
 */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canonical(x)]),
    )
  }
  return v ?? null
}
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

async function insertBatched(db: SupabaseClient, table: string, rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    const { error } = await db.from(table).insert(rows.slice(i, i + WRITE_BATCH))
    if (error) throw new Error(`insert ${table}: ${error.message}`)
  }
}

async function updateEach(db: SupabaseClient, table: string, rows: { id: string; patch: Record<string, unknown> }[]): Promise<void> {
  for (const r of rows) {
    const { error } = await db.from(table).update({ ...r.patch, ...(table === "podcast_staging_mentions" ? {} : { updated_at: new Date().toISOString() }) }).eq("id", r.id)
    if (error) throw new Error(`update ${table} ${r.id}: ${error.message}`)
  }
}

/**
 * Load seeds into staging. Dry run unless apply is true.
 *
 * Idempotent (D11): episodes key on video_id, nodes on (subject_type,
 * normalized name), stories on (episode, timestamp, title), mentions on (story,
 * node). A re-run inserts what is new, refreshes descriptive fields on rows
 * nobody has decided, and NEVER touches a decision: new seed content for a
 * decided story lands in revision_pending. Rows that left the seed are counted,
 * not deleted.
 *
 * Episodes attach to a live episode event only by YouTube id (F13), never by
 * guest name, so the S3E17 Ingemar Backman episode stays apart from the live
 * Season 12 one.
 */
export async function loadStaging(
  db: SupabaseClient,
  input: { manifest: ManifestRow[]; seeds: StagingSeed[] },
  { apply }: { apply: boolean },
): Promise<LoadReport> {
  const report: LoadReport = {
    apply,
    episodes: { insert: 0, update: 0, unchanged: 0 },
    stories: { insert: 0, update: 0, revision: 0, unchanged: 0 },
    nodes: { insert: 0, update: 0, unchanged: 0 },
    mentions: { insert: 0, update: 0, unchanged: 0, notInSeed: 0 },
    attachedToLive: [],
    refusals: [],
  }

  const byVideo = manifestByVideo(input.manifest)
  const founding = foundingNumbers(input.manifest)

  // Live episodes, keyed by YouTube id (media_url formats vary: watch and youtu.be).
  const { data: liveEps, error: liveErr } = await db
    .from("events")
    .select("id, name, media_url")
    .eq("event_type", "episode")
  if (liveErr) throw new Error(`read live episodes: ${liveErr.message}`)
  const liveByVideo = new Map<string, string>()
  for (const e of (liveEps ?? []) as { id: string; media_url: string | null }[]) {
    const v = youTubeId(e.media_url)
    if (v) liveByVideo.set(v, e.id)
  }

  // Show orgs by exact (case-insensitive) name.
  const showNames = [...new Set(input.seeds.map((s) => str(s.episode.show_name)).filter(Boolean) as string[])]
  const showIds = new Map<string, string | null>()
  for (const name of showNames) {
    const { data } = await db.from("orgs").select("id").ilike("name", name.replace(/([%_\\])/g, "\\$1"))
    const rows = (data ?? []) as { id: string }[]
    showIds.set(name.toLowerCase(), rows.length === 1 ? rows[0].id : null)
    if (rows.length !== 1) report.refusals.push({ where: `show "${name}"`, why: `${rows.length} orgs match; show_org_id left empty` })
  }

  // ── existing staging state ────────────────────────────────────────────
  const [existingEps, existingNodes, existingStories, existingMentions] = await Promise.all([
    selectAll<EpisodeRow>(db, "podcast_staging_episodes", "id, video_id, show_org_id, archive_label, guest, episode_name, proposed_episode_number, air_date, media_url, series_note, wave, episode_event_id, notes"),
    selectAll<NodeRow>(db, "podcast_staging_nodes", "id, subject_type, name, normalized_name, ghost, heard_as, merged_into"),
    selectAll<StoryRow>(db, "podcast_staging_stories", "id, episode_id, timestamp_seconds, position, title, excerpt, decision, activity, skip_reason, revision_pending, decided_by"),
    selectAll<MentionRow>(db, "podcast_staging_mentions", "id, story_id, node_id, heard_as, inferred"),
  ])

  const epByVideo = new Map(existingEps.map((e) => [e.video_id, e]))
  const nodeByKey = new Map(existingNodes.map((n) => [`${n.subject_type}|${n.normalized_name}`, n]))
  const nodeById = new Map(existingNodes.map((n) => [n.id, n]))
  const storyByKey = new Map(existingStories.map((s) => [`${s.episode_id}|${s.timestamp_seconds}|${s.title}`, s]))
  const mentionByKey = new Map(existingMentions.map((m) => [`${m.story_id}|${m.node_id}`, m]))

  /** Follow merged_into so a reloaded seed lands on the surviving node. */
  const survivor = (id: string): string => {
    let cur = id
    for (let hops = 0; hops < 20; hops++) {
      const next = nodeById.get(cur)?.merged_into
      if (!next) return cur
      cur = next
    }
    return cur
  }

  const epInserts: Record<string, unknown>[] = []
  const epUpdates: { id: string; patch: Record<string, unknown> }[] = []

  // Accumulate nodes and stories across ALL seeds first, so a node named in
  // five episodes is one row whose heard_as unions all five.
  type PendingNode = { id: string; subject_type: StagingSubjectType; name: string; key: string; ghost: StagingGhost; heard: Set<string>; isNew: boolean }
  const pendingNodes = new Map<string, PendingNode>()

  type PendingStory = {
    id: string
    episodeId: string
    ts: number
    position: number
    title: string
    excerpt: string
    decision: StoryDecision
    activity: string | null
    skip_reason: string | null
    casts: Map<string, { heard_as: string | null; inferred: boolean }>
  }
  const pendingStories: PendingStory[] = []

  for (const seed of input.seeds) {
    const ep = seed.episode ?? {}
    const videoId = youTubeId(ep.media_url)
    if (!videoId) {
      report.refusals.push({ where: seed.file, why: `no YouTube id in episode.media_url "${ep.media_url ?? ""}"` })
      continue
    }
    const m = byVideo.get(videoId)
    if (!m) report.refusals.push({ where: seed.file, why: `video ${videoId} not in the manifest; loaded from the seed alone` })

    const label = str(m?.label) ?? str(ep.archive_label)
    const isBonus = isBonusLabel(label)
    const foundingNo = founding.get(videoId) ?? null
    const manifestNo = m?.proposed_episode_number ? Number(m.proposed_episode_number) : null
    const proposed = isBonus ? null : foundingNo ?? manifestNo ?? (typeof ep.episode_number === "number" ? ep.episode_number : null)
    const notes = foundingNo !== null ? `D2: synthetic founding-era number ${foundingNo} (publication order), editorial.` : null

    const liveId = liveByVideo.get(videoId) ?? null
    const showOrgId = str(ep.show_name) ? showIds.get(String(ep.show_name).trim().toLowerCase()) ?? null : null

    const desired = {
      video_id: videoId,
      show_org_id: showOrgId,
      archive_label: label,
      guest: str(m?.guest) ?? str(ep.guest),
      episode_name: str(ep.episode_name) ?? str(m?.title) ?? `FNRad ${label ?? videoId}`,
      proposed_episode_number: proposed,
      air_date: str(m?.date) ?? str(ep.date),
      media_url: `https://www.youtube.com/watch?v=${videoId}`,
      series_note: seriesNote(m?.title ?? ep.episode_name),
      wave: str(m?.wave),
      episode_event_id: liveId,
    }
    if (liveId) report.attachedToLive.push({ label: label ?? videoId, episode_event_id: liveId })

    let episodeId: string
    const existing = epByVideo.get(videoId)
    if (!existing) {
      episodeId = crypto.randomUUID()
      epInserts.push({ id: episodeId, ...desired, notes })
      report.episodes.insert++
    } else {
      episodeId = existing.id
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(desired)) {
        // Never clear a live attachment someone (or Phase 3) wrote.
        if (k === "episode_event_id" && existing.episode_event_id && !v) continue
        if (!sameJson((existing as Record<string, unknown>)[k], v)) patch[k] = v
      }
      if (notes && !existing.notes) patch.notes = notes
      if (Object.keys(patch).length) {
        epUpdates.push({ id: existing.id, patch })
        report.episodes.update++
      } else report.episodes.unchanged++
    }

    ;(seed.stories ?? []).forEach((story, position) => {
      const where = `${seed.file} story ${position + 1}`
      const ts = readTimestamp(story.timestamp_seconds ?? story.timestamp ?? null)
      if (ts === null || ts === undefined) {
        report.refusals.push({ where, why: `unreadable or missing timestamp "${story.timestamp ?? ""}"` })
        return
      }
      const title = str(story.title)
      const excerpt = str(story.excerpt)
      if (!title || !excerpt) {
        report.refusals.push({ where, why: "story needs a title and an excerpt" })
        return
      }
      const trimmed = story.resolution === "skip"
      const sensitive = story.status === "hold_sensitive" || story.resolution === "hold_sensitive"
      const casts = new Map<string, { heard_as: string | null; inferred: boolean }>()

      for (const subject of story.subjects ?? []) {
        const type = str(subject.subject_type) as StagingSubjectType | null
        const name = str(subject.subject_name)
        if (!type || !STAGING_SUBJECT_TYPES.includes(type) || !name) {
          report.refusals.push({ where, why: `subject "${name ?? ""}" (${type ?? "no type"}) skipped: needs a name and a valid type` })
          continue
        }
        const key = stagingKey(name)
        if (!key) {
          report.refusals.push({ where, why: `subject "${name}" normalizes to nothing` })
          continue
        }
        const nodeKey = `${type}|${key}`
        let pn = pendingNodes.get(nodeKey)
        if (!pn) {
          const found = nodeByKey.get(nodeKey)
          pn = {
            id: found ? survivor(found.id) : crypto.randomUUID(),
            subject_type: type,
            name,
            key,
            ghost: { ...(found?.ghost ?? {}) },
            heard: new Set(found?.heard_as ?? []),
            isNew: !found,
          }
          pendingNodes.set(nodeKey, pn)
        }
        // Fill ghost fields the node does not have yet; never overwrite one.
        for (const [gk, gv] of Object.entries(subject.ghost ?? {})) {
          if (gv !== null && gv !== undefined && gv !== "" && pn.ghost[gk] === undefined) pn.ghost[gk] = gv
        }
        const heard = str(subject.heard_as)
        if (heard) pn.heard.add(heard)

        const prior = casts.get(pn.id)
        casts.set(pn.id, {
          heard_as: prior?.heard_as ?? heard,
          inferred: Boolean(prior?.inferred || subject.inferred === true),
        })
      }

      pendingStories.push({
        id: "",
        episodeId,
        ts,
        position,
        title,
        excerpt,
        decision: sensitive ? "hold_sensitive" : trimmed ? "trimmed" : "pending",
        activity: str(story.activity),
        skip_reason: str(story.skip_reason),
        casts,
      })
    })
  }

  // ── nodes ─────────────────────────────────────────────────────────────
  const nodeInserts: Record<string, unknown>[] = []
  const nodeUpdates: { id: string; patch: Record<string, unknown> }[] = []
  for (const pn of pendingNodes.values()) {
    const heardAs = [...pn.heard].sort()
    if (pn.isNew) {
      nodeInserts.push({
        id: pn.id,
        subject_type: pn.subject_type,
        name: pn.name,
        normalized_name: pn.key,
        ghost: pn.ghost,
        heard_as: heardAs,
      })
      report.nodes.insert++
    } else {
      const cur = nodeById.get(pn.id)
      const patch: Record<string, unknown> = {}
      if (cur && !sameJson(cur.ghost ?? {}, pn.ghost)) patch.ghost = pn.ghost
      if (cur && !sameJson([...(cur.heard_as ?? [])].sort(), heardAs)) patch.heard_as = heardAs
      if (Object.keys(patch).length) {
        nodeUpdates.push({ id: pn.id, patch })
        report.nodes.update++
      } else report.nodes.unchanged++
    }
  }

  // ── stories and mentions ──────────────────────────────────────────────
  const storyInserts: Record<string, unknown>[] = []
  const storyUpdates: { id: string; patch: Record<string, unknown> }[] = []
  const mentionInserts: Record<string, unknown>[] = []
  const mentionUpdates: { id: string; patch: Record<string, unknown> }[] = []
  const seenMentionKeys = new Set<string>()
  const seenStoryKeys = new Set<string>()

  for (const ps of pendingStories) {
    const sKey = `${ps.episodeId}|${ps.ts}|${ps.title}`
    if (seenStoryKeys.has(sKey)) {
      report.refusals.push({ where: `${ps.title} at ${ps.ts}s`, why: "duplicate story (same episode, timestamp and title) in the seed; second copy skipped" })
      continue
    }
    seenStoryKeys.add(sKey)
    const cur = storyByKey.get(sKey)

    if (!cur) {
      ps.id = crypto.randomUUID()
      storyInserts.push({
        id: ps.id,
        episode_id: ps.episodeId,
        timestamp_seconds: ps.ts,
        position: ps.position,
        title: ps.title,
        excerpt: ps.excerpt,
        decision: ps.decision,
        activity: ps.activity,
        skip_reason: ps.skip_reason,
      })
      report.stories.insert++
    } else {
      ps.id = cur.id
      const content = { excerpt: ps.excerpt, activity: ps.activity, skip_reason: ps.skip_reason, decision: ps.decision }
      const changed =
        cur.excerpt !== ps.excerpt ||
        (cur.activity ?? null) !== ps.activity ||
        (cur.skip_reason ?? null) !== ps.skip_reason ||
        cur.decision !== ps.decision
      if (cur.decided_by) {
        // D11: a person decided this story. New seed content waits beside it.
        if (changed && !sameJson(cur.revision_pending, content)) {
          storyUpdates.push({ id: cur.id, patch: { revision_pending: content } })
          report.stories.revision++
        } else report.stories.unchanged++
      } else {
        const patch: Record<string, unknown> = {}
        if (changed) Object.assign(patch, content)
        if (cur.position !== ps.position) patch.position = ps.position
        if (Object.keys(patch).length) {
          storyUpdates.push({ id: cur.id, patch })
          report.stories.update++
        } else report.stories.unchanged++
      }
    }

    for (const [nodeId, cast] of ps.casts) {
      const mKey = `${ps.id}|${nodeId}`
      seenMentionKeys.add(mKey)
      const mCur = mentionByKey.get(mKey)
      if (!mCur) {
        mentionInserts.push({ story_id: ps.id, node_id: nodeId, heard_as: cast.heard_as, inferred: cast.inferred })
        report.mentions.insert++
      } else if ((mCur.heard_as ?? null) !== cast.heard_as || mCur.inferred !== cast.inferred) {
        mentionUpdates.push({ id: mCur.id, patch: { heard_as: cast.heard_as, inferred: cast.inferred } })
        report.mentions.update++
      } else report.mentions.unchanged++
    }
  }

  // Mentions already staged for stories in this load that the seed no longer
  // names. Counted for the report, never deleted (a decision may hang off them).
  const loadedStoryIds = new Set(pendingStories.map((s) => s.id).filter(Boolean))
  for (const m of existingMentions) {
    if (loadedStoryIds.has(m.story_id) && !seenMentionKeys.has(`${m.story_id}|${m.node_id}`)) report.mentions.notInSeed++
  }

  if (!apply) return report

  // Order matters for the foreign keys: episodes, nodes, stories, mentions.
  await insertBatched(db, "podcast_staging_episodes", epInserts)
  await updateEach(db, "podcast_staging_episodes", epUpdates)
  await insertBatched(db, "podcast_staging_nodes", nodeInserts)
  await updateEach(db, "podcast_staging_nodes", nodeUpdates)
  await insertBatched(db, "podcast_staging_stories", storyInserts)
  await updateEach(db, "podcast_staging_stories", storyUpdates)
  await insertBatched(db, "podcast_staging_mentions", mentionInserts)
  await updateEach(db, "podcast_staging_mentions", mentionUpdates)

  return report
}

// ── the resolver pass (T4) ──────────────────────────────────────────────────

export type ResolveReport = {
  apply: boolean
  checked: number
  changed: number
  skippedDecided: number
  byResolution: Record<NodeResolution, number>
  byType: Record<StagingSubjectType, Partial<Record<NodeResolution, number>>>
}

/**
 * Resolve every undecided node against the live catalog. Re-runnable: the
 * catalog changes underneath staging, so this is a pass, not a one-time step.
 * Nodes a person has decided (decided_by set) are left exactly as they are.
 */
export async function resolveStaging(
  db: SupabaseClient,
  { apply, index }: { apply: boolean; index?: CatalogIndex },
): Promise<ResolveReport> {
  const catalog = index ?? (await loadCatalogIndex(db))
  const [nodes, stats] = await Promise.all([
    selectAll<{
      id: string
      subject_type: StagingSubjectType
      name: string
      normalized_name: string
      ghost: StagingGhost
      resolution: NodeResolution
      subject_id: string | null
      candidates: NodeCandidate[]
      flags: NodeFlag[]
      decided_by: string | null
      merged_into: string | null
    }>(db, "podcast_staging_nodes", "id, subject_type, name, normalized_name, ghost, resolution, subject_id, candidates, flags, decided_by, merged_into"),
    selectAll<{ id: string; mention_count: number; inferred_count: number }>(db, "podcast_staging_node_stats", "id, mention_count, inferred_count"),
  ])
  const statById = new Map(stats.map((s) => [s.id, s]))

  const report: ResolveReport = {
    apply,
    checked: 0,
    changed: 0,
    skippedDecided: 0,
    byResolution: { unresolved: 0, matched: 0, ambiguous: 0, review: 0, new: 0, needs_detail: 0 },
    byType: { person: {}, place: {}, org: {}, board: {}, event: {} },
  }

  const now = new Date().toISOString()
  const updates: { id: string; patch: Record<string, unknown> }[] = []

  for (const n of nodes) {
    if (n.merged_into) continue
    if (n.decided_by) {
      report.skippedDecided++
      report.byResolution[n.resolution]++
      const t = report.byType[n.subject_type]
      t[n.resolution] = (t[n.resolution] ?? 0) + 1
      continue
    }
    report.checked++
    const r = resolveNode({ subject_type: n.subject_type, name: n.name, ghost: n.ghost ?? {} }, catalog[n.subject_type])
    const s = statById.get(n.id)
    const flags = [...r.flags, ...inferenceFlags(Number(s?.mention_count ?? 0), Number(s?.inferred_count ?? 0))]

    report.byResolution[r.resolution]++
    const t = report.byType[n.subject_type]
    t[r.resolution] = (t[r.resolution] ?? 0) + 1

    if (
      n.resolution !== r.resolution ||
      (n.subject_id ?? null) !== r.subject_id ||
      !sameJson(n.candidates, r.candidates) ||
      !sameJson(n.flags, flags)
    ) {
      updates.push({
        id: n.id,
        patch: { resolution: r.resolution, subject_id: r.subject_id, candidates: r.candidates, flags, resolved_at: now },
      })
      report.changed++
    }
  }

  if (apply) await updateEach(db, "podcast_staging_nodes", updates)
  return report
}
