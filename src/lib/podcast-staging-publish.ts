// Podcast archive staging, Phase 3: publish and unpublish (brief T13 to T17).
//
// HUMAN-RUN. This is the only staging module that writes to the catalog: it
// creates episode events, new catalog nodes and mentions. Everything goes
// through ONE function with writes switched on or off, so the dry run a person
// reviews is produced by the code that executes it (same rule as the importer).
//
// Go-live (Jay, 2026-11-14, brief F11): publish creates the episode HIDDEN
// (events.public_enabled defaults to false) and writes its mentions as
// published. GET /api/mentions only returns mentions on live episodes, so
// nothing appears on any timeline until the episode is flipped public from its
// episode page. The episode flag is the single switch.
//
// Like the other staging modules it takes the client as a parameter and never
// imports @/lib/auth. No contribution tokens (T16): rows are inserted directly,
// never through /api/catalog/entity.

import type { SupabaseClient } from "@supabase/supabase-js"
import { mentionDedupeKey, planGhost } from "@/lib/mention-import"
import { approveBlocker, resolveNode } from "@/lib/podcast-staging"
import type {
  NodeDecision,
  NodeFlag,
  NodeResolution,
  StagingGhost,
  StagingSubjectType,
  StoryDecision,
} from "@/lib/podcast-staging"
import { loadCatalogType } from "@/lib/podcast-staging-server"

const COMMUNITY_SLUG = "snowboarding"

// Same table map as linkCommunity in mention-import-server.ts (kept local so
// this module never imports the auth chain). New nodes land in the community
// beside the episode, exactly as import ghosts do.
const COMMUNITY_JUNCTION: Record<string, { table: string; key: string }> = {
  people: { table: "community_people", key: "person_id" },
  places: { table: "community_places", key: "place_id" },
  orgs: { table: "community_orgs", key: "org_id" },
  boards: { table: "community_boards", key: "board_id" },
  events: { table: "community_events", key: "event_id" },
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── shapes ──────────────────────────────────────────────────────────────────

type EpisodeRow = {
  id: string
  show_org_id: string | null
  archive_label: string | null
  guest: string | null
  episode_name: string
  proposed_episode_number: number | null
  air_date: string | null
  media_url: string | null
  video_id: string
  status: string
  episode_event_id: string | null
  published_created: boolean
}

type NodeRow = {
  id: string
  subject_type: StagingSubjectType
  name: string
  resolution: NodeResolution
  subject_id: string | null
  ghost: StagingGhost
  flags: NodeFlag[]
  decision: NodeDecision
  merged_into: string | null
  published_created: boolean
}

type MentionRow = {
  id: string
  decision: "inherit" | "rejected"
  published_mention_id: string | null
  node: NodeRow | null
  story: {
    id: string
    episode_id: string
    timestamp_seconds: number
    title: string
    excerpt: string
    decision: StoryDecision
    start_year: number | null
    end_year: number | null
  } | null
}

export type ExcludedRow = { episode: string; story: string; timestamp_seconds: number; node: string; reason: string }

export type PublishPlan = {
  applied: boolean
  episodes: { id: string; label: string; action: "create" | "attach" | "existing" | "nothing_to_publish"; episode_event_id: string | null; mentions: number }[]
  episodes_to_create: number
  nodes_to_create: Record<StagingSubjectType, number>
  nodes_to_create_total: number
  mentions_to_insert: number
  already_published: number
  excluded: ExcludedRow[]
  excluded_by_reason: Record<string, number>
  /** Filled after an apply. */
  result?: {
    episodes_created: number
    episodes_attached: number
    nodes_created: number
    nodes_matched_at_publish: number
    mentions_inserted: number
    mentions_skipped_existing: number
    refusals: string[]
  }
}

const label = (e: Pick<EpisodeRow, "archive_label" | "guest" | "episode_name">) =>
  [e.archive_label, e.guest ?? e.episode_name].filter(Boolean).join(" ")

/** Why a staged mention will not publish, or null when it will (T13). */
function exclusionReason(m: MentionRow): string | null {
  const s = m.story
  const n = m.node
  if (!s || !n) return "orphaned row"
  if (s.decision === "trimmed") return "story trimmed"
  if (s.decision === "hold_sensitive") return "story held as sensitive"
  if (s.decision !== "approved") return "story not approved yet"
  if (m.decision === "rejected") return "dropped from this story"
  if (n.merged_into) return "node was merged"
  if (n.decision === "pending") return "node not approved yet"
  if (n.decision === "hold") return "node on hold"
  if (n.decision === "rejected") return "node rejected"
  const blocker = approveBlocker(n)
  if (blocker) return `node not publishable: ${blocker}`
  return null
}

const NODE_COLS = "id, subject_type, name, resolution, subject_id, ghost, flags, decision, merged_into, published_created"

async function loadBatch(db: SupabaseClient, episodeIds: string[]) {
  const { data: eps, error } = await db
    .from("podcast_staging_episodes")
    .select("id, show_org_id, archive_label, guest, episode_name, proposed_episode_number, air_date, media_url, video_id, status, episode_event_id, published_created")
    .in("id", episodeIds)
  if (error) throw new Error(`episodes: ${error.message}`)
  const episodes = (eps ?? []) as EpisodeRow[]

  const { data: storyRows, error: sErr } = await db
    .from("podcast_staging_stories")
    .select("id")
    .in("episode_id", episodeIds)
    .range(0, 9999)
  if (sErr) throw new Error(`stories: ${sErr.message}`)
  const storyIds = ((storyRows ?? []) as { id: string }[]).map((s) => s.id)

  const mentions: MentionRow[] = []
  for (let i = 0; i < storyIds.length; i += 150) {
    const { data, error: mErr } = await db
      .from("podcast_staging_mentions")
      .select(
        `id, decision, published_mention_id, node:podcast_staging_nodes(${NODE_COLS}), ` +
          "story:podcast_staging_stories(id, episode_id, timestamp_seconds, title, excerpt, decision, start_year, end_year)",
      )
      .in("story_id", storyIds.slice(i, i + 150))
    if (mErr) throw new Error(`mentions: ${mErr.message}`)
    mentions.push(...((data ?? []) as unknown as MentionRow[]))
  }
  return { episodes, mentions }
}

// ── publish (T13, T14, T15) ─────────────────────────────────────────────────

/**
 * Plan, and when apply is true execute, a publish batch for the given staged
 * episodes. Re-running a batch is a no-op: published staged mentions are
 * skipped, created ids are written back to staging, and mention inserts skip
 * anything already on the episode (the mentions_dedupe key).
 */
export async function publishEpisodes(
  db: SupabaseClient,
  actorId: string,
  episodeIds: string[],
  { apply }: { apply: boolean },
): Promise<PublishPlan> {
  const { episodes, mentions } = await loadBatch(db, episodeIds)
  const epById = new Map(episodes.map((e) => [e.id, e]))

  const excluded: ExcludedRow[] = []
  const publishable: MentionRow[] = []
  let alreadyPublished = 0
  for (const m of mentions) {
    if (m.published_mention_id) {
      alreadyPublished++
      continue
    }
    const why = exclusionReason(m)
    if (why) {
      const ep = m.story ? epById.get(m.story.episode_id) : undefined
      excluded.push({
        episode: ep ? label(ep) : "?",
        story: m.story?.title ?? "?",
        timestamp_seconds: m.story?.timestamp_seconds ?? 0,
        node: m.node?.name ?? "?",
        reason: why,
      })
    } else publishable.push(m)
  }

  // New nodes this batch mints: approved, resolved as new, no catalog id yet.
  const toCreate = new Map<string, NodeRow>()
  for (const m of publishable) {
    const n = m.node!
    if (n.resolution === "new" && !n.subject_id) toCreate.set(n.id, n)
  }
  const nodesByType: Record<StagingSubjectType, number> = { person: 0, place: 0, org: 0, board: 0, event: 0 }
  for (const n of toCreate.values()) nodesByType[n.subject_type]++

  // Distinct catalog mentions per episode: two staged rows that land on the
  // same subject at the same moment are one catalog mention.
  const perEpisode = new Map<string, Set<string>>()
  for (const m of publishable) {
    const key = `${m.node!.subject_type}|${m.node!.subject_id ?? `new:${m.node!.id}`}|${m.story!.timestamp_seconds}`
    const set = perEpisode.get(m.story!.episode_id) ?? new Set<string>()
    set.add(key)
    perEpisode.set(m.story!.episode_id, set)
  }

  const plan: PublishPlan = {
    applied: apply,
    episodes: episodes.map((e) => {
      const n = perEpisode.get(e.id)?.size ?? 0
      return {
        id: e.id,
        label: label(e),
        action: n === 0 ? "nothing_to_publish" : e.episode_event_id ? "existing" : "create",
        episode_event_id: e.episode_event_id,
        mentions: n,
      }
    }),
    episodes_to_create: episodes.filter((e) => !e.episode_event_id && (perEpisode.get(e.id)?.size ?? 0) > 0).length,
    nodes_to_create: nodesByType,
    nodes_to_create_total: toCreate.size,
    mentions_to_insert: [...perEpisode.values()].reduce((a, s) => a + s.size, 0),
    already_published: alreadyPublished,
    excluded,
    excluded_by_reason: excluded.reduce<Record<string, number>>((acc, r) => {
      acc[r.reason] = (acc[r.reason] ?? 0) + 1
      return acc
    }, {}),
  }

  if (!apply) return plan

  // ── apply ─────────────────────────────────────────────────────────────
  const result = {
    episodes_created: 0,
    episodes_attached: 0,
    nodes_created: 0,
    nodes_matched_at_publish: 0,
    mentions_inserted: 0,
    mentions_skipped_existing: 0,
    refusals: [] as string[],
  }
  const now = new Date().toISOString()

  const { data: comm } = await db.from("communities").select("id").eq("slug", COMMUNITY_SLUG).maybeSingle()
  const communityId = (comm as { id: string } | null)?.id ?? null
  const link = async (table: string, id: string) => {
    const j = COMMUNITY_JUNCTION[table]
    if (!communityId || !j) return
    await db.from(j.table).upsert({ community_id: communityId, [j.key]: id }, { onConflict: `community_id,${j.key}` })
  }

  // 1. Episode events, same row shape POST /api/admin/show-episode writes.
  const eventIdByStaged = new Map<string, string>()
  for (const e of episodes) {
    if (e.episode_event_id) {
      eventIdByStaged.set(e.id, e.episode_event_id)
      continue
    }
    if ((perEpisode.get(e.id)?.size ?? 0) === 0) continue

    // Attach instead of creating a twin: an episode created since staging
    // loaded, matched by YouTube id (F13), then by name within the show.
    const { data: byVideo } = await db
      .from("events")
      .select("id")
      .eq("event_type", "episode")
      .ilike("media_url", `%${e.video_id}%`)
      .limit(1)
    let twin = ((byVideo ?? []) as { id: string }[])[0] ?? null
    if (!twin && e.show_org_id) {
      const { data: byName } = await db
        .from("events")
        .select("id")
        .eq("event_type", "episode")
        .eq("show_org_id", e.show_org_id)
        .ilike("name", e.episode_name.replace(/([%_\\])/g, "\\$1"))
        .limit(1)
      twin = ((byName ?? []) as { id: string }[])[0] ?? null
    }
    let eventId: string
    let created = false
    if (twin) {
      eventId = twin.id
      result.episodes_attached++
      // Part C2: fill the show's label on an attached event only when it has none.
      if (e.archive_label) {
        await db.from("events").update({ episode_label: e.archive_label }).eq("id", eventId).is("episode_label", null)
      }
    } else {
      eventId = genId("evt")
      const year = e.air_date ? Number(e.air_date.slice(0, 4)) : null
      const { error } = await db.from("events").insert({
        id: eventId,
        name: e.episode_name,
        event_type: "episode",
        show_org_id: e.show_org_id,
        start_date: e.air_date,
        year,
        episode_number: e.proposed_episode_number,
        episode_label: e.archive_label,
        media_url: e.media_url ?? `https://www.youtube.com/watch?v=${e.video_id}`,
        community_status: "verified",
        added_by: actorId,
      })
      if (error) {
        result.refusals.push(`${label(e)}: episode insert failed: ${error.message}`)
        continue
      }
      await link("events", eventId)
      created = true
      result.episodes_created++
    }
    eventIdByStaged.set(e.id, eventId)
    await db
      .from("podcast_staging_episodes")
      .update({ episode_event_id: eventId, published_created: created, updated_at: now })
      .eq("id", e.id)
  }

  // 2. New catalog nodes. A fresh exact check first: if someone added the row
  //    to the catalog since staging resolved, use it rather than mint a twin.
  const subjectIdByNode = new Map<string, string>()
  const failedNodes = new Set<string>()
  const indexCache = new Map<StagingSubjectType, Awaited<ReturnType<typeof loadCatalogType>>>()
  for (const n of toCreate.values()) {
    let index = indexCache.get(n.subject_type)
    if (!index) {
      index = await loadCatalogType(db, n.subject_type)
      indexCache.set(n.subject_type, index)
    }
    const fresh = resolveNode({ subject_type: n.subject_type, name: n.name, ghost: n.ghost ?? {} }, index)
    if (fresh.resolution === "matched" && fresh.subject_id) {
      subjectIdByNode.set(n.id, fresh.subject_id)
      result.nodes_matched_at_publish++
      await db
        .from("podcast_staging_nodes")
        .update({ resolution: "matched", subject_id: fresh.subject_id, candidates: fresh.candidates, updated_at: now })
        .eq("id", n.id)
      continue
    }
    const ghost = planGhost({ subject_name: n.name, subject_type: n.subject_type, ghost: n.ghost ?? {} }, actorId)
    if ("error" in ghost) {
      result.refusals.push(`${n.name}: ${ghost.error}`)
      failedNodes.add(n.id)
      continue
    }
    const { error } = await db.from(ghost.table).insert(ghost.row)
    if (error) {
      result.refusals.push(`${n.name}: insert into ${ghost.table} failed: ${error.message}`)
      failedNodes.add(n.id)
      continue
    }
    await link(ghost.table, ghost.id)
    subjectIdByNode.set(n.id, ghost.id)
    index.push({ id: ghost.id, name: n.name, label: `${n.name} (just created)` })
    result.nodes_created++
    await db
      .from("podcast_staging_nodes")
      .update({
        resolution: "matched",
        subject_id: ghost.id,
        candidates: [{ id: ghost.id, label: ghost.summary, kind: "exact" }],
        published_created: true,
        updated_at: now,
      })
      .eq("id", n.id)
  }

  // 3. Mentions, per episode, skip-existing on the mentions_dedupe key.
  for (const e of episodes) {
    const eventId = eventIdByStaged.get(e.id)
    if (!eventId) continue
    const mine = publishable.filter((m) => m.story!.episode_id === e.id && !failedNodes.has(m.node!.id))
    if (!mine.length) continue

    const { data: existingRows } = await db
      .from("mentions")
      .select("id, subject_type, subject_id, timestamp_seconds")
      .eq("episode_event_id", eventId)
    const byKey = new Map<string, string>()
    const preexisting = new Set<string>()
    for (const r of (existingRows ?? []) as { id: string; subject_type: string; subject_id: string; timestamp_seconds: number | null }[]) {
      const k = mentionDedupeKey(r.subject_type, r.subject_id, r.timestamp_seconds)
      byKey.set(k, r.id)
      preexisting.add(k)
    }

    const stagedByKey = new Map<string, string[]>()
    const inserts: Record<string, unknown>[] = []
    for (const m of mine) {
      const n = m.node!
      const subjectId = subjectIdByNode.get(n.id) ?? n.subject_id
      if (!subjectId) continue
      const key = mentionDedupeKey(n.subject_type, subjectId, m.story!.timestamp_seconds)
      stagedByKey.set(key, [...(stagedByKey.get(key) ?? []), m.id])
      if (byKey.has(key) || inserts.some((r) => r._key === key)) continue
      inserts.push({
        _key: key,
        episode_event_id: eventId,
        subject_type: n.subject_type,
        subject_id: subjectId,
        timestamp_seconds: m.story!.timestamp_seconds,
        excerpt: m.story!.excerpt,
        story_title: m.story!.title,
        // Story years for the archive's Path view (migration 20261118000002).
        story_start_year: m.story!.start_year,
        story_end_year: m.story!.start_year != null ? (m.story!.end_year ?? m.story!.start_year) : null,
        status: "published",
        created_by: actorId,
      })
    }

    for (const row of inserts) {
      const { _key, ...payload } = row
      const { data: ins, error } = await db.from("mentions").insert(payload).select("id").maybeSingle()
      if (error) {
        if (error.code === "23505") {
          result.mentions_skipped_existing++
          continue
        }
        result.refusals.push(`${label(e)}: mention insert failed: ${error.message}`)
        continue
      }
      byKey.set(_key as string, (ins as { id: string }).id)
      result.mentions_inserted++
    }

    // Write the catalog ids back so a re-run skips them and unpublish knows
    // exactly what this batch created.
    for (const [key, stagedIds] of stagedByKey) {
      const mentionId = byKey.get(key)
      if (!mentionId) continue
      await db.from("podcast_staging_mentions").update({ published_mention_id: mentionId }).in("id", stagedIds)
    }
    result.mentions_skipped_existing += [...stagedByKey.keys()].filter((k) => preexisting.has(k)).length

    await db
      .from("podcast_staging_episodes")
      .update({ status: "published", published_at: now, published_by: actorId, updated_at: now })
      .eq("id", e.id)
  }

  plan.result = result
  return plan
}

// ── unpublish (T17) ─────────────────────────────────────────────────────────

export type UnpublishPlan = {
  applied: boolean
  episode: string
  mentions_to_delete: number
  /** Created by publish and NOT deleted (other things may reference them). */
  created_nodes: { id: string; name: string; subject_type: StagingSubjectType; subject_id: string }[]
  created_episode_event_id: string | null
  deleted?: number
}

/**
 * Delete exactly the catalog mentions a publish inserted for this episode (by
 * published_mention_id) and clear those pointers. Created nodes and the
 * episode event stay, and are listed for a person to handle.
 */
export async function unpublishEpisode(
  db: SupabaseClient,
  actorId: string,
  episodeId: string,
  { apply }: { apply: boolean },
): Promise<UnpublishPlan | { error: string }> {
  const { episodes, mentions } = await loadBatch(db, [episodeId])
  const ep = episodes[0]
  if (!ep) return { error: "Episode not found" }

  const published = mentions.filter((m) => m.published_mention_id)
  const mentionIds = [...new Set(published.map((m) => m.published_mention_id!))]
  const createdNodes = new Map<string, UnpublishPlan["created_nodes"][number]>()
  for (const m of published) {
    const n = m.node
    if (n?.published_created && n.subject_id) createdNodes.set(n.id, { id: n.id, name: n.name, subject_type: n.subject_type, subject_id: n.subject_id })
  }

  const plan: UnpublishPlan = {
    applied: apply,
    episode: label(ep),
    mentions_to_delete: mentionIds.length,
    created_nodes: [...createdNodes.values()],
    created_episode_event_id: ep.published_created ? ep.episode_event_id : null,
  }
  if (!apply) return plan

  let deleted = 0
  for (let i = 0; i < mentionIds.length; i += 200) {
    const chunk = mentionIds.slice(i, i + 200)
    // Scoped to this episode's event as well as the ids, belt and braces.
    const { data, error } = await db
      .from("mentions")
      .delete()
      .in("id", chunk)
      .eq("episode_event_id", ep.episode_event_id ?? "")
      .select("id")
    if (error) return { error: `delete mentions: ${error.message}` }
    deleted += (data ?? []).length
  }
  const stagedIds = published.map((m) => m.id)
  for (let i = 0; i < stagedIds.length; i += 200) {
    await db.from("podcast_staging_mentions").update({ published_mention_id: null }).in("id", stagedIds.slice(i, i + 200))
  }
  await db
    .from("podcast_staging_episodes")
    .update({ status: "ready", published_at: null, published_by: null, updated_at: new Date().toISOString() })
    .eq("id", episodeId)
  void actorId
  return { ...plan, deleted }
}
