// Podcast mention import: the executor.
//
// Split out of mention-import.ts because that module is imported by the admin
// import page, and getServiceClient drags next/headers into the client bundle
// (mentions.ts had exactly this bug in Session B). Everything that touches the
// database lives here.
//
// One function, two modes. The dry run and the real import are the SAME code
// path with writes switched off, so the plan a person reviews is produced by
// the code that executes it. A separate preview implementation would be free to
// drift, and the whole value of the review surface is that it is honest.
//
// MIRROR NOTE: scripts/import-mentions.mjs is the plain-Node twin. CHANGE BOTH.

import { getServiceClient } from "@/lib/auth"
import {
  SUBJECT_TYPES,
  expandSeed,
  ghostIdentity,
  isNearMiss,
  mentionDedupeKey,
  planGhost,
  readTimestamp,
  sameName,
  validateSeed,
} from "@/lib/mention-import"
import { formatTimestamp } from "@/lib/mentions"
import type {
  ExpandedSubject,
  ImportPlan,
  MentionSeed,
  PlanCandidate,
  PlanStory,
  PlanSubject,
  SubjectOutcome,
} from "@/lib/mention-import"

type IndexEntry = {
  id: string
  name: string
  label: string
  brand?: string | null
  model?: string | null
  model_year?: number | null
}

type EpisodeRow = {
  id: string
  name: string
  event_type: string | null
  episode_number: number | null
  media_url: string | null
  show_org_id: string | null
}

/** Escape ilike wildcards so a name probe is an exact, case-insensitive match. */
function ilikeExact(value: string): string {
  return value.replace(/([%_\\])/g, "\\$1")
}

// ── episode resolution ──────────────────────────────────────────────────────
// By id when the seed carries one, else by episode_number (or name) within the
// show, mirroring the dedup probe in /api/admin/show-episode.
async function resolveEpisode(
  db: ReturnType<typeof getServiceClient>,
  ep: MentionSeed["episode"],
): Promise<{ episode: EpisodeRow } | { error: string }> {
  const cols = "id, name, event_type, episode_number, media_url, show_org_id"

  if (ep.episode_event_id) {
    const { data } = await db.from("events").select(cols).eq("id", ep.episode_event_id).maybeSingle()
    const row = data as EpisodeRow | null
    if (!row) return { error: `Episode id ${ep.episode_event_id} not found.` }
    if (row.event_type !== "episode") {
      return { error: `Event ${ep.episode_event_id} is not an episode (event_type=${row.event_type}).` }
    }
    return { episode: row }
  }

  const showName = (ep.show_name ?? "").trim()
  if (!showName) return { error: "Seed needs episode.episode_event_id or episode.show_name." }

  const { data: shows } = await db.from("orgs").select("id, name").ilike("name", ilikeExact(showName))
  const showRows = (shows ?? []) as { id: string; name: string }[]
  if (showRows.length === 0) return { error: `Show "${showName}" not found in orgs.` }
  if (showRows.length > 1) {
    return { error: `Show "${showName}" matches ${showRows.length} orgs. Set episode.episode_event_id instead.` }
  }

  let probe = db.from("events").select(cols).eq("show_org_id", showRows[0].id).eq("event_type", "episode")
  if (ep.episode_number !== undefined && ep.episode_number !== null) {
    probe = probe.eq("episode_number", ep.episode_number)
  } else if (ep.episode_name) {
    probe = probe.ilike("name", ilikeExact(ep.episode_name))
  } else {
    return { error: "Seed needs episode.episode_number or episode.episode_name to find the episode within the show." }
  }

  const { data: episodes } = await probe
  const rows = (episodes ?? []) as EpisodeRow[]
  if (rows.length === 0) {
    return {
      error: `No episode found in "${showName}" for ${ep.episode_number ?? ep.episode_name}. Author it first (Brands -> the show -> Add episode).`,
    }
  }
  if (rows.length > 1) {
    return { error: `Ambiguous episode in "${showName}": ${rows.length} matches. Set episode.episode_event_id instead.` }
  }
  return { episode: rows[0] }
}

// ── catalog index ───────────────────────────────────────────────────────────
// One read per table per run, held in memory. Matching in memory rather than
// per-row SQL is what makes the near-miss scan affordable at all, and it lets a
// ghost created mid-run be visible to later rows (rememberCreated).

async function loadIndex(
  db: ReturnType<typeof getServiceClient>,
  cache: Map<string, IndexEntry[]>,
  type: string,
): Promise<IndexEntry[]> {
  const cached = cache.get(type)
  if (cached) return cached

  let rows: IndexEntry[] = []

  if (type === "person") {
    // person spans BOTH people and profiles: the app's people catalog is the
    // union of the two, and a mention against a member must carry the profile
    // id or it never lands on their real timeline.
    const [{ data: people }, { data: profiles }] = await Promise.all([
      db.from("people").select("id, display_name, node_status"),
      db.from("profiles").select("id, display_name, is_archived"),
    ])
    for (const p of (profiles ?? []) as { id: string; display_name: string | null; is_archived: boolean | null }[]) {
      if (p.is_archived || !p.display_name) continue
      rows.push({ id: p.id, name: p.display_name, label: `${p.display_name} (member)` })
    }
    const seen = new Set(rows.map((r) => r.id))
    for (const p of (people ?? []) as { id: string; display_name: string | null; node_status: string | null }[]) {
      if (seen.has(p.id) || !p.display_name) continue
      rows.push({ id: p.id, name: p.display_name, label: `${p.display_name} (${p.node_status})` })
    }
  } else if (type === "place") {
    const { data } = await db.from("places").select("id, name, place_type")
    rows = ((data ?? []) as { id: string; name: string; place_type: string | null }[]).map((p) => ({
      id: p.id, name: p.name, label: `${p.name} (${p.place_type})`,
    }))
  } else if (type === "org") {
    const { data } = await db.from("orgs").select("id, name, org_type")
    rows = ((data ?? []) as { id: string; name: string; org_type: string | null }[]).map((o) => ({
      id: o.id, name: o.name, label: `${o.name} (${o.org_type})`,
    }))
  } else if (type === "event") {
    const { data } = await db.from("events").select("id, name, year")
    rows = ((data ?? []) as { id: string; name: string; year: number | null }[]).map((e) => ({
      id: e.id, name: e.name, label: `${e.name}${e.year ? ` (${e.year})` : ""}`,
    }))
  } else if (type === "board") {
    const { data } = await db.from("boards").select("id, brand, model, model_year")
    rows = ((data ?? []) as { id: string; brand: string | null; model: string | null; model_year: number | null }[]).map((b) => ({
      id: b.id,
      name: `${b.brand ?? ""} ${b.model ?? ""}`.trim(),
      brand: b.brand,
      model: b.model,
      model_year: b.model_year,
      label: `${b.brand} ${b.model}${b.model_year ? ` ${b.model_year}` : ""}`,
    }))
  }

  cache.set(type, rows)
  return rows
}

/**
 * Resolve one subject against the catalog.
 *
 * Pass 1 is a case-insensitive EXACT name match: exactly one hit resolves, more
 * than one is ambiguous and is never auto-picked. Pass 2 is the near-miss
 * probe, which exists because pass 1 alone quietly minted duplicates on the
 * first real import.
 */
async function findCandidates(
  db: ReturnType<typeof getServiceClient>,
  cache: Map<string, IndexEntry[]>,
  subject: ExpandedSubject,
): Promise<{ exact: IndexEntry[]; near: IndexEntry[] }> {
  const name = subject.subject_name.trim()
  const ghost = subject.ghost ?? {}
  const index = await loadIndex(db, cache, subject.subject_type)

  if (subject.subject_type === "board") {
    // brand + model is the real identity. Match on both when the seed carries
    // them (it must, to create the ghost at all), else fall back to the model.
    const exact = ghost.brand && ghost.model
      ? index.filter((b) =>
          sameName(b.brand, ghost.brand) && sameName(b.model, ghost.model) &&
          (!ghost.model_year || b.model_year === ghost.model_year))
      : index.filter((b) => sameName(b.model, name))
    if (exact.length > 0) return { exact, near: [] }
    const probe = ghost.brand && ghost.model ? `${ghost.brand} ${ghost.model}` : name
    return { exact: [], near: index.filter((b) => isNearMiss(probe, b.name)) }
  }

  const exact = index.filter((e) => sameName(e.name, name))
  if (exact.length > 0) return { exact, near: [] }
  return { exact: [], near: index.filter((e) => isNearMiss(name, e.name)) }
}

const COMMUNITY_JUNCTION: Record<string, { table: string; key: string }> = {
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
async function linkCommunity(
  db: ReturnType<typeof getServiceClient>,
  table: string,
  id: string,
  communityId: string | null,
): Promise<void> {
  if (!communityId) return
  const j = COMMUNITY_JUNCTION[table]
  if (!j) return
  await db
    .from(j.table)
    .upsert({ community_id: communityId, [j.key]: id }, { onConflict: `community_id,${j.key}` })
}

// ── the run ─────────────────────────────────────────────────────────────────

export type RunOptions = {
  /** profiles.id stamped as created_by (mentions) and added_by (ghosts). */
  actorId: string
  /** false plans and writes nothing; true creates ghosts and inserts drafts. */
  apply: boolean
}

/**
 * Resolve a seed against the live catalog and, when applying, import it.
 *
 * Import lands every mention as a DRAFT regardless of what the seed says.
 * Publishing stays a separate editorial act on the episode page, so nothing
 * this function writes is publicly visible.
 */
export async function runMentionImport(
  rawSeed: unknown,
  { actorId, apply }: RunOptions,
): Promise<{ plan: ImportPlan } | { error: string }> {
  const parsed = validateSeed(rawSeed)
  if ("error" in parsed) return { error: parsed.error }
  const seed = parsed.seed

  const db = getServiceClient()

  const resolved = await resolveEpisode(db, seed.episode)
  if ("error" in resolved) return { error: resolved.error }
  const episode = resolved.episode

  // The community the episode belongs to, so new ghosts land beside it.
  const { data: episodeCommunity } = await db
    .from("community_events")
    .select("community_id")
    .eq("event_id", episode.id)
    .limit(1)
    .maybeSingle()
  const communityId = (episodeCommunity as { community_id: string } | null)?.community_id ?? null

  // Existing mentions on this episode, for the skip-existing check that makes
  // a re-import a no-op.
  const { data: existing } = await db
    .from("mentions")
    .select("id, subject_type, subject_id, timestamp_seconds")
    .eq("episode_event_id", episode.id)
  const mapped = new Map<string, string>()
  for (const m of (existing ?? []) as {
    id: string; subject_type: string; subject_id: string; timestamp_seconds: number | null
  }[]) {
    mapped.set(mentionDedupeKey(m.subject_type, m.subject_id, m.timestamp_seconds), m.id)
  }

  const cache = new Map<string, IndexEntry[]>()
  const refusals: { where: string; why: string }[] = []
  const plannedGhosts = new Map<string, string>()
  const counts = {
    stories: 0, mentions: 0, ghosts: 0, matched: 0, review: 0, refused: 0, skipped: 0, trimmed: 0,
  }

  const stories = expandSeed(seed)
  const planStories: PlanStory[] = []

  for (const story of stories) {
    const planSubjects: PlanSubject[] = []

    for (const subject of story.subjects) {
      const where = `${story.timestamp_raw ?? "--"} ${story.title ?? subject.subject_name}: ${subject.subject_name || "(no name)"}`
      const base = {
        key: subject.key,
        subject_name: subject.subject_name,
        subject_type: subject.subject_type,
        subject_id: subject.subject_id,
        matched_label: null as string | null,
        candidates: [] as PlanCandidate[],
        ghost_summary: null as string | null,
        creates_node: false,
        refusal: null as string | null,
        timestamp_seconds: null as number | null,
      }

      const push = (outcome: SubjectOutcome, extra: Partial<PlanSubject> = {}) => {
        planSubjects.push({ ...base, outcome, ...extra })
      }

      if (story.trimmed || subject.resolution === "skip") {
        counts.trimmed++
        push("skipped")
        continue
      }

      if (!SUBJECT_TYPES.includes(subject.subject_type as (typeof SUBJECT_TYPES)[number])) {
        const why = `subject_type must be one of ${SUBJECT_TYPES.join(", ")}`
        counts.refused++
        refusals.push({ where, why })
        push("refused", { refusal: why })
        continue
      }
      if (!subject.subject_name && !subject.subject_id) {
        const why = "needs subject_name or subject_id"
        counts.refused++
        refusals.push({ where, why })
        push("refused", { refusal: why })
        continue
      }

      const ts = readTimestamp(subject.timestamp_raw)
      if (ts === undefined) {
        const why = `unreadable timestamp "${subject.timestamp_raw}" (use mm:ss, h:mm:ss, or seconds)`
        counts.refused++
        refusals.push({ where, why })
        push("refused", { refusal: why })
        continue
      }
      base.timestamp_seconds = ts

      // A subject_id already in the seed is trusted: it is either a match a
      // previous resolve wrote or a disambiguation a human made, and
      // re-resolving it would undo that choice.
      let subjectId = subject.subject_id
      let matchedLabel: string | null = null

      if (!subjectId) {
        const { exact, near } = await findCandidates(db, cache, subject)
        if (exact.length === 1) {
          subjectId = exact[0].id
          matchedLabel = exact[0].label
        } else if (exact.length > 1) {
          counts.review++
          push("ambiguous", {
            candidates: exact.map((c) => ({ id: c.id, label: c.label })),
          })
          continue
        } else if (near.length > 0 && !subject.confirm_new) {
          // Nothing matched outright, but something is close enough that
          // creating a node here would probably mint a twin. Refuse and let a
          // human decide: a wrong new node is worse than a stopped import.
          counts.review++
          push("review", {
            candidates: near.map((c) => ({ id: c.id, label: c.label })),
          })
          continue
        }
      }

      // ── ghost ────────────────────────────────────────────────────────────
      if (!subjectId) {
        const identity = ghostIdentity(subject)
        const alreadyPlanned = plannedGhosts.get(identity)
        if (alreadyPlanned) {
          // A second row naming the same new entity plans ONE node, not two.
          subjectId = alreadyPlanned
          base.subject_id = subjectId
          base.ghost_summary = "same new node as above"
        } else {
          const ghost = planGhost(subject, actorId)
          if ("error" in ghost) {
            counts.refused++
            refusals.push({ where, why: ghost.error })
            push("refused", { refusal: ghost.error })
            continue
          }

          if (apply) {
            const { error } = await db.from(ghost.table).insert(ghost.row)
            if (error) {
              const why = `ghost insert into ${ghost.table} failed: ${error.message}`
              counts.refused++
              refusals.push({ where, why })
              push("refused", { refusal: why })
              continue
            }
            await linkCommunity(db, ghost.table, ghost.id, communityId)
            // Make the new node visible to the rest of this run, so a later row
            // naming it matches instead of creating a twin.
            const index = cache.get(subject.subject_type)
            if (index) {
              index.push({
                id: ghost.id,
                name: subject.subject_type === "board"
                  ? `${(ghost.row.brand as string | null) ?? ""} ${(ghost.row.model as string | null) ?? ""}`.trim()
                  : subject.subject_name,
                brand: (ghost.row.brand as string | null) ?? null,
                model: (ghost.row.model as string | null) ?? null,
                model_year: (ghost.row.model_year as number | null) ?? null,
                label: `${subject.subject_name} (just created)`,
              })
            }
          }

          subjectId = ghost.id
          base.ghost_summary = ghost.summary
          base.creates_node = true
          plannedGhosts.set(identity, ghost.id)
          counts.ghosts++
        }
        base.subject_id = subjectId
      } else {
        counts.matched++
        base.matched_label = matchedLabel
        base.subject_id = subjectId
      }

      // ── mention ──────────────────────────────────────────────────────────
      const key = mentionDedupeKey(subject.subject_type, subjectId, ts)
      if (mapped.has(key)) {
        counts.skipped++
        push("already_mapped")
        continue
      }

      const row = {
        episode_event_id: episode.id,
        subject_type: subject.subject_type,
        subject_id: subjectId,
        timestamp_seconds: ts,
        excerpt: subject.excerpt,
        story_title: subject.story_title,
        // A seed saying published is downgraded: publishing is a separate act.
        status: "draft" as const,
        created_by: actorId,
      }

      if (apply) {
        const { data: ins, error } = await db.from("mentions").insert(row).select("id").maybeSingle()
        if (error) {
          // 23505 means the row landed between the read above and this insert.
          // Same outcome as a skip, not a failure.
          if (error.code === "23505") {
            counts.skipped++
            push("already_mapped")
            continue
          }
          const why = `mention insert failed: ${error.message}`
          counts.refused++
          refusals.push({ where, why })
          push("refused", { refusal: why })
          continue
        }
        mapped.set(key, (ins as { id: string } | null)?.id ?? "")
      } else {
        mapped.set(key, "planned")
      }

      counts.mentions++
      push(base.ghost_summary ? "new_ghost" : "matched_existing")
    }

    if (!story.trimmed) counts.stories++

    planStories.push({
      key: story.key,
      timestamp_seconds: story.timestamp_seconds,
      timestamp: story.timestamp_seconds === null ? null : formatTimestamp(story.timestamp_seconds),
      title: story.title,
      excerpt: story.excerpt,
      trimmed: story.trimmed,
      activity: story.activity,
      skip_reason: story.skip_reason,
      subjects: planSubjects,
    })
  }

  // Episode order for the review surface. Undated stories sort last, and the
  // sort is stable so seed order breaks ties.
  planStories.sort((a, b) => (a.timestamp_seconds ?? Number.MAX_SAFE_INTEGER) - (b.timestamp_seconds ?? Number.MAX_SAFE_INTEGER))

  return {
    plan: {
      applied: apply,
      episode: {
        id: episode.id,
        name: episode.name,
        episode_number: episode.episode_number,
        media_url: episode.media_url,
      },
      stories: planStories,
      counts,
      refusals,
    },
  }
}
