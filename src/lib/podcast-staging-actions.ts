// Podcast archive staging, Phase 2: decisions (brief T7 to T12).
//
// Every write the staging surface makes goes through this module. Like
// podcast-staging-server.ts it takes the Supabase client as a parameter and
// never imports @/lib/auth, so it stays callable from routes and scripts alike.
// The routes call it AFTER requireModerator(), passing the editor's id as actor.
//
// Writes touch ONLY the podcast_staging_* tables. Catalog rows are read to
// validate a match, never written; creating catalog nodes is Phase 3.
//
// Audit (T12): every decision stamps decided_by and decided_at. On nodes,
// decided_by also means "a person has acted on this node", and the resolver
// pass leaves any such node alone, so a hand-picked match is never undone by a
// later "Re-check against catalog". "Reset" clears it and re-resolves.

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GHOST_FIELDS,
  approveBlocker,
  inferenceFlags,
  reasonsLine,
  resolveNode,
  stagingKey,
} from "@/lib/podcast-staging"
import type {
  NodeCandidate,
  NodeDecision,
  NodeFlag,
  NodeResolution,
  StagingGhost,
  StagingSubjectType,
  StoryDecision,
} from "@/lib/podcast-staging"
import { loadCatalogType, resolveStaging } from "@/lib/podcast-staging-server"

export type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string; [key: string]: unknown }

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ActionResult<never> => ({
  ok: false,
  status,
  error,
  ...extra,
})

const stamp = (actorId: string) => ({ decided_by: actorId, decided_at: new Date().toISOString() })
const touched = () => ({ updated_at: new Date().toISOString() })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v)

const text = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null
  const s = v.trim().slice(0, max)
  return s || null
}

// ── shapes ──────────────────────────────────────────────────────────────────

type NodeRow = {
  id: string
  subject_type: StagingSubjectType
  name: string
  normalized_name: string
  resolution: NodeResolution
  subject_id: string | null
  candidates: NodeCandidate[]
  ghost: StagingGhost
  heard_as: string[]
  flags: NodeFlag[]
  decision: NodeDecision
  merged_into: string | null
  also_known_as: string | null
  decided_by: string | null
}

const NODE_COLS = "id, subject_type, name, normalized_name, resolution, subject_id, candidates, ghost, heard_as, flags, decision, merged_into, also_known_as, decided_by"

async function getNodeRow(db: SupabaseClient, id: string): Promise<NodeRow | null> {
  const { data } = await db.from("podcast_staging_nodes").select(NODE_COLS).eq("id", id).maybeSingle()
  return (data as NodeRow | null) ?? null
}

/**
 * Recompute the inference flags (all_inferred / some_inferred) for nodes whose
 * mentions changed, keeping the resolver's flags as they are. Rejected
 * mentions still count: the flag is about how the name was heard.
 */
async function refreshInferenceFlags(db: SupabaseClient, nodeIds: string[]): Promise<void> {
  const ids = [...new Set(nodeIds)].filter(Boolean)
  if (!ids.length) return
  const { data } = await db
    .from("podcast_staging_node_stats")
    .select("id, flags, mention_count, inferred_count")
    .in("id", ids)
  for (const r of (data ?? []) as { id: string; flags: NodeFlag[]; mention_count: number; inferred_count: number }[]) {
    const kept = (r.flags ?? []).filter((f) => f !== "all_inferred" && f !== "some_inferred")
    const next = [...kept, ...inferenceFlags(Number(r.mention_count), Number(r.inferred_count))]
    if (JSON.stringify(next) !== JSON.stringify(r.flags ?? [])) {
      await db.from("podcast_staging_nodes").update({ flags: next, ...touched() }).eq("id", r.id)
    }
  }
}

const handPicked = (n: Pick<NodeRow, "flags">) => (n.flags ?? []).includes("manual_match")

/**
 * Run the resolver for one node and write the result (keeps the decision).
 * A hand-picked match is never re-resolved; Reset drops the flag first.
 */
async function reresolve(db: SupabaseClient, node: NodeRow): Promise<NodeRow> {
  if (handPicked(node)) return node
  const index = await loadCatalogType(db, node.subject_type)
  const r = resolveNode({ subject_type: node.subject_type, name: node.name, ghost: node.ghost ?? {} }, index)
  const inference = (node.flags ?? []).filter((f) => f === "all_inferred" || f === "some_inferred")
  const patch = {
    resolution: r.resolution,
    subject_id: r.subject_id,
    candidates: r.candidates,
    flags: [...r.flags, ...inference],
    resolved_at: new Date().toISOString(),
    ...touched(),
  }
  await db.from("podcast_staging_nodes").update(patch).eq("id", node.id)
  return { ...node, ...patch }
}

// ── stories (T7) ────────────────────────────────────────────────────────────

export type StoryAction = "approve" | "trim" | "hold_sensitive" | "restore" | "accept_revision" | "dismiss_revision"

export async function decideStory(
  db: SupabaseClient,
  actorId: string,
  storyId: string,
  body: { action?: unknown; activity?: unknown; reason?: unknown },
): Promise<ActionResult<{ decision: StoryDecision }>> {
  const { data } = await db
    .from("podcast_staging_stories")
    .select("id, episode_id, decision, revision_pending")
    .eq("id", storyId)
    .maybeSingle()
  const story = data as { id: string; episode_id: string; decision: StoryDecision; revision_pending: Record<string, unknown> | null } | null
  if (!story) return fail(404, "Story not found")

  const action = body.action as StoryAction
  let patch: Record<string, unknown>

  switch (action) {
    case "approve":
      patch = { decision: "approved", activity: null, skip_reason: null }
      break
    case "trim": {
      const reason = text(body.reason)
      if (!reason) return fail(400, "Say why the story is trimmed.")
      patch = { decision: "trimmed", activity: text(body.activity, 80), skip_reason: reason }
      break
    }
    case "hold_sensitive":
      patch = { decision: "hold_sensitive" }
      break
    case "restore":
      patch = { decision: "pending", activity: null, skip_reason: null }
      break
    case "accept_revision": {
      // D11: apply the newer seed content, keep the human decision.
      const rev = story.revision_pending
      if (!rev) return fail(400, "This story has no pending revision.")
      patch = { revision_pending: null }
      if (typeof rev.excerpt === "string" && rev.excerpt.trim()) patch.excerpt = rev.excerpt
      break
    }
    case "dismiss_revision":
      patch = { revision_pending: null }
      break
    default:
      return fail(400, "action must be approve, trim, hold_sensitive, restore, accept_revision or dismiss_revision")
  }

  const { data: updated, error } = await db
    .from("podcast_staging_stories")
    .update({ ...patch, ...stamp(actorId), ...touched() })
    .eq("id", storyId)
    .select("decision")
    .maybeSingle()
  if (error) return fail(500, error.message)

  // First decision in an episode moves it from loaded to in review.
  await db.from("podcast_staging_episodes").update({ status: "in_review", ...touched() }).eq("id", story.episode_id).eq("status", "loaded")

  return { ok: true, decision: (updated as { decision: StoryDecision }).decision }
}

// ── nodes (T8) ──────────────────────────────────────────────────────────────

export type NodeAction =
  | "approve" | "hold" | "reject" | "reset"
  | "rename" | "set_match" | "confirm_new" | "ghost"
  | "link_aka" | "unlink_aka"

export async function patchNode(
  db: SupabaseClient,
  actorId: string,
  nodeId: string,
  body: Record<string, unknown>,
): Promise<ActionResult<{ node: Pick<NodeRow, "id" | "name" | "resolution" | "decision" | "subject_id"> }>> {
  const node = await getNodeRow(db, nodeId)
  if (!node) return fail(404, "Node not found")
  if (node.merged_into) return fail(409, "This node was merged into another one. Edit that node instead.", { merged_into: node.merged_into })

  const action = body.action as NodeAction
  const done = async (patch: Record<string, unknown>) => {
    const { error } = await db.from("podcast_staging_nodes").update({ ...patch, ...touched() }).eq("id", nodeId)
    if (error) return fail(500, error.message)
    const fresh = (await getNodeRow(db, nodeId))!
    return { ok: true as const, node: { id: fresh.id, name: fresh.name, resolution: fresh.resolution, decision: fresh.decision, subject_id: fresh.subject_id } }
  }

  switch (action) {
    case "approve": {
      const blocker = approveBlocker(node)
      if (blocker) return fail(409, blocker)
      return done({ decision: "approved", ...stamp(actorId) })
    }
    case "hold":
      return done({ decision: "hold", ...stamp(actorId) })
    case "reject":
      return done({ decision: "rejected", ...stamp(actorId) })

    case "reset": {
      // Back to untouched: pending, no actor, and a fresh resolver result.
      const flags = (node.flags ?? []).filter((f) => f !== "manual_match")
      await db.from("podcast_staging_nodes").update({ decision: "pending", decided_by: null, decided_at: null, flags, ...touched() }).eq("id", nodeId)
      await reresolve(db, { ...node, flags, decision: "pending", decided_by: null })
      return done({})
    }

    case "rename": {
      const name = text(body.name, 200)
      if (!name) return fail(400, "Give the node a name.")
      const key = stagingKey(name)
      if (!key) return fail(400, "That name has no letters or digits in it.")
      if (key !== node.normalized_name) {
        const { data: clash } = await db
          .from("podcast_staging_nodes")
          .select("id, name")
          .eq("subject_type", node.subject_type)
          .eq("normalized_name", key)
          .neq("id", nodeId)
          .maybeSingle()
        if (clash) {
          const c = clash as { id: string; name: string }
          return fail(409, `"${c.name}" is already a node. Merge into it instead.`, { conflict_node_id: c.id })
        }
      }
      const { error } = await db.from("podcast_staging_nodes").update({ name, normalized_name: key, ...stamp(actorId), ...touched() }).eq("id", nodeId)
      if (error) return fail(500, error.message)
      // A new name can change the catalog answer, unless a match was hand-picked.
      await reresolve(db, (await getNodeRow(db, nodeId))!)
      return done({})
    }

    case "set_match": {
      const subjectId = text(body.subject_id, 100)
      if (!subjectId) return fail(400, "subject_id is required")
      const index = await loadCatalogType(db, node.subject_type)
      const entry = index.find((e) => e.id === subjectId)
      if (!entry) return fail(400, `No ${node.subject_type} with that id in the catalog (episodes are not matchable).`)
      const candidates = [
        { id: entry.id, label: entry.label, kind: "exact" as const },
        ...(node.candidates ?? []).filter((c) => c.id !== entry.id),
      ]
      const flags = [...(node.flags ?? []).filter((f) => f !== "manual_match" && f !== "catalog_duplicate"), "manual_match"]
      return done({ resolution: "matched", subject_id: entry.id, candidates, flags, ...stamp(actorId) })
    }

    case "confirm_new": {
      if (!["review", "ambiguous", "new", "matched"].includes(node.resolution)) {
        return fail(409, approveBlocker(node) ?? "This node cannot be confirmed new.")
      }
      // A board or event still needs its NOT NULL column to be creatable.
      const asNew = { ...node, resolution: "new" as const, subject_id: null }
      const blocker = approveBlocker(asNew)
      return done({
        resolution: blocker ? "needs_detail" : "new",
        subject_id: null,
        flags: (node.flags ?? []).filter((f) => f !== "manual_match"),
        ...stamp(actorId),
      })
    }

    case "ghost": {
      const allowed = GHOST_FIELDS[node.subject_type]
      const input = (body.ghost ?? {}) as Record<string, unknown>
      const ghost: StagingGhost = { ...(node.ghost ?? {}) }
      for (const key of allowed) {
        if (!(key in input)) continue
        const raw = input[key]
        if (raw === null || raw === "") {
          delete ghost[key]
          continue
        }
        if (key === "model_year") {
          const y = Number(raw)
          if (!Number.isInteger(y) || y < 1960 || y > 2035) return fail(400, "model_year must be a year between 1960 and 2035.")
          ghost.model_year = y
        } else if (key === "start_date") {
          const s = String(raw).trim()
          if (!/^(19|20)\d{2}(-\d{2}-\d{2})?$/.test(s)) return fail(400, "start_date must be YYYY or YYYY-MM-DD.")
          ghost.start_date = s
        } else {
          const s = text(raw, 120)
          if (s) ghost[key] = s
        }
      }
      const { error } = await db.from("podcast_staging_nodes").update({ ghost, ...stamp(actorId), ...touched() }).eq("id", nodeId)
      if (error) return fail(500, error.message)
      // A year (or brand and model) can turn "Needs a year" into a match or a
      // creatable new node. reresolve() leaves a hand-picked match alone.
      await reresolve(db, (await getNodeRow(db, nodeId))!)
      return done({})
    }

    case "link_aka": {
      // D10: one real-world entity as two node types (Mack Dawg the person and
      // the company). Linked both ways; never merged across types.
      const otherId = body.other_id
      if (!isUuid(otherId) || otherId === nodeId) return fail(400, "other_id must be another node")
      const other = await getNodeRow(db, otherId)
      if (!other || other.merged_into) return fail(404, "Other node not found")
      if (other.subject_type === node.subject_type) {
        return fail(400, "Also-known-as links nodes of different types. For the same type, merge instead.")
      }
      await db.from("podcast_staging_nodes").update({ also_known_as: otherId, ...stamp(actorId), ...touched() }).eq("id", nodeId)
      await db.from("podcast_staging_nodes").update({ also_known_as: nodeId, ...touched() }).eq("id", otherId)
      return done({})
    }

    case "unlink_aka": {
      if (node.also_known_as) {
        await db.from("podcast_staging_nodes").update({ also_known_as: null, ...touched() }).eq("id", node.also_known_as).eq("also_known_as", nodeId)
      }
      return done({ also_known_as: null, ...stamp(actorId) })
    }

    default:
      return fail(400, "Unknown node action")
  }
}

/**
 * Merge node A (source) into node B (target), within one type.
 *
 * A's mentions repoint to B. Where B is already in the same story, A's mention
 * is a duplicate and is removed (staging rows only, never catalog rows). A keeps
 * a merged_into pointer, so a reload of the seed lands on B (the loader follows
 * it), and drops out of every list. Each step is safe to repeat, so a failure
 * halfway can be finished by running the merge again.
 */
export async function mergeNode(
  db: SupabaseClient,
  actorId: string,
  sourceId: string,
  targetId: unknown,
): Promise<ActionResult<{ target_id: string; repointed: number; duplicates_removed: number }>> {
  if (!isUuid(targetId)) return fail(400, "target_id must be a node id")
  if (targetId === sourceId) return fail(400, "A node cannot merge into itself.")
  const [a, b] = await Promise.all([getNodeRow(db, sourceId), getNodeRow(db, targetId)])
  if (!a) return fail(404, "Node not found")
  if (!b) return fail(404, "Target node not found")
  if (a.merged_into) return fail(409, "This node is already merged.")
  if (b.merged_into) return fail(409, "The target was itself merged. Pick the node it was merged into.")
  if (a.subject_type !== b.subject_type) {
    return fail(400, "Merge works within one type. Link them as also-known-as instead.")
  }

  const { data: aRows, error: aErr } = await db
    .from("podcast_staging_mentions")
    .select("id, story_id, published_mention_id")
    .eq("node_id", sourceId)
    .range(0, 9999)
  if (aErr) return fail(500, aErr.message)
  const fromA = (aRows ?? []) as { id: string; story_id: string; published_mention_id: string | null }[]
  if (fromA.some((m) => m.published_mention_id)) {
    return fail(409, "Some of this node's mentions are already published. Unpublish the episode first.")
  }

  const { data: bRows, error: bErr } = await db
    .from("podcast_staging_mentions")
    .select("story_id")
    .eq("node_id", targetId)
    .range(0, 9999)
  if (bErr) return fail(500, bErr.message)
  const bStories = new Set(((bRows ?? []) as { story_id: string }[]).map((m) => m.story_id))

  const duplicates = fromA.filter((m) => bStories.has(m.story_id)).map((m) => m.id)
  const movable = fromA.filter((m) => !bStories.has(m.story_id)).map((m) => m.id)

  for (let i = 0; i < movable.length; i += 200) {
    const { error } = await db
      .from("podcast_staging_mentions")
      .update({ node_id: targetId, ...stamp(actorId) })
      .in("id", movable.slice(i, i + 200))
    if (error) return fail(500, `repoint: ${error.message}`)
  }
  for (let i = 0; i < duplicates.length; i += 200) {
    const { error } = await db.from("podcast_staging_mentions").delete().in("id", duplicates.slice(i, i + 200))
    if (error) return fail(500, `dedupe: ${error.message}`)
  }

  // B inherits what A knew: how the name was heard, ghost fields B lacks, and
  // an also-known-as link if B has none.
  const ghost: StagingGhost = { ...(a.ghost ?? {}), ...(b.ghost ?? {}) }
  const heardAs = [...new Set([...(b.heard_as ?? []), ...(a.heard_as ?? []), a.name])].filter((h) => h && h !== b.name).sort()
  const bPatch: Record<string, unknown> = { ghost, heard_as: heardAs, ...touched() }
  if (!b.also_known_as && a.also_known_as) bPatch.also_known_as = a.also_known_as
  await db.from("podcast_staging_nodes").update(bPatch).eq("id", targetId)
  if (!b.also_known_as && a.also_known_as) {
    await db.from("podcast_staging_nodes").update({ also_known_as: targetId, ...touched() }).eq("id", a.also_known_as)
  }

  const { error: mErr } = await db
    .from("podcast_staging_nodes")
    .update({ merged_into: targetId, also_known_as: null, ...stamp(actorId), ...touched() })
    .eq("id", sourceId)
  if (mErr) return fail(500, mErr.message)

  await refreshInferenceFlags(db, [targetId])
  return { ok: true, target_id: targetId, repointed: movable.length, duplicates_removed: duplicates.length }
}

// ── mentions (T9) ───────────────────────────────────────────────────────────

export async function patchMention(
  db: SupabaseClient,
  actorId: string,
  mentionId: string,
  body: { action?: unknown; node_id?: unknown },
): Promise<ActionResult<{ node_id: string; decision: string }>> {
  const { data } = await db
    .from("podcast_staging_mentions")
    .select("id, story_id, node_id, decision, published_mention_id")
    .eq("id", mentionId)
    .maybeSingle()
  const m = data as { id: string; story_id: string; node_id: string; decision: string; published_mention_id: string | null } | null
  if (!m) return fail(404, "Mention not found")
  if (m.published_mention_id) return fail(409, "This mention is already published. Unpublish the episode first.")

  if (body.action === "reject" || body.action === "restore") {
    const decision = body.action === "reject" ? "rejected" : "inherit"
    const { error } = await db.from("podcast_staging_mentions").update({ decision, ...stamp(actorId) }).eq("id", mentionId)
    if (error) return fail(500, error.message)
    return { ok: true, node_id: m.node_id, decision }
  }

  if (body.action === "repoint") {
    // The fix for a wrong inference in one episode: this mention moves, the
    // node and its other mentions stay. Cross-type is allowed (D9: an undated
    // event can be repointed to the place or org).
    const target = body.node_id
    if (!isUuid(target)) return fail(400, "node_id must be a node id")
    if (target === m.node_id) return fail(400, "That is already this mention's node.")
    const node = await getNodeRow(db, target)
    if (!node) return fail(404, "Target node not found")
    if (node.merged_into) return fail(409, "That node was merged. Pick the node it was merged into.")
    const { data: clash } = await db
      .from("podcast_staging_mentions")
      .select("id")
      .eq("story_id", m.story_id)
      .eq("node_id", target)
      .maybeSingle()
    if (clash) return fail(409, `"${node.name}" is already in this story. Drop this mention instead.`)
    const { error } = await db.from("podcast_staging_mentions").update({ node_id: target, ...stamp(actorId) }).eq("id", mentionId)
    if (error) return fail(500, error.message)
    await refreshInferenceFlags(db, [m.node_id, target])
    return { ok: true, node_id: target, decision: m.decision }
  }

  return fail(400, "action must be reject, restore or repoint")
}

// ── bulk (T10, T11) ─────────────────────────────────────────────────────────

export type BulkPreview = {
  count: number
  left_out: number
  reasons: string
  applied: boolean
}

/**
 * Approve every pending story in an episode. Trimmed and sensitive stories are
 * never swept up (D6): sensitive ones publish only by an individual approve.
 */
export async function bulkApproveEpisodeStories(
  db: SupabaseClient,
  actorId: string,
  episodeId: unknown,
  apply: boolean,
): Promise<ActionResult<BulkPreview & { already_approved: number }>> {
  if (!isUuid(episodeId)) return fail(400, "episode_id must be an episode id")
  const { data, error } = await db
    .from("podcast_staging_stories")
    .select("id, decision")
    .eq("episode_id", episodeId)
    .range(0, 9999)
  if (error) return fail(500, error.message)
  const rows = (data ?? []) as { id: string; decision: StoryDecision }[]
  if (!rows.length) return fail(404, "No stories staged for that episode.")

  const eligible = rows.filter((r) => r.decision === "pending").map((r) => r.id)
  const trimmed = rows.filter((r) => r.decision === "trimmed").length
  const sensitive = rows.filter((r) => r.decision === "hold_sensitive").length
  const already = rows.filter((r) => r.decision === "approved").length

  if (apply && eligible.length) {
    for (let i = 0; i < eligible.length; i += 200) {
      const { error: uErr } = await db
        .from("podcast_staging_stories")
        .update({ decision: "approved", activity: null, skip_reason: null, ...stamp(actorId), ...touched() })
        .in("id", eligible.slice(i, i + 200))
        .eq("decision", "pending")
      if (uErr) return fail(500, uErr.message)
    }
    await db.from("podcast_staging_episodes").update({ status: "in_review", ...touched() }).eq("id", episodeId).eq("status", "loaded")
  }

  return {
    ok: true,
    count: eligible.length,
    left_out: trimmed + sensitive,
    reasons: reasonsLine([
      [sensitive, "held as sensitive", "held as sensitive"],
      [trimmed, "trimmed", "trimmed"],
    ]),
    already_approved: already,
    applied: apply,
  }
}

/**
 * Approve every pending node that is an exact catalog match. Nodes whose name
 * was inferred in every mention are left for an individual look (D7): a wrong
 * inference would attach stories to the wrong real person.
 */
export async function bulkApproveExactNodes(
  db: SupabaseClient,
  actorId: string,
  type: unknown,
  apply: boolean,
): Promise<ActionResult<BulkPreview>> {
  const t = typeof type === "string" && ["person", "place", "org", "board", "event"].includes(type) ? (type as StagingSubjectType) : null
  // A fresh builder per page: supabase-js builders accumulate modifiers.
  const pageQuery = (from: number) => {
    let q = db
      .from("podcast_staging_nodes")
      .select("id, resolution, subject_id, flags, decision")
      .is("merged_into", null)
      .eq("decision", "pending")
    if (t) q = q.eq("subject_type", t)
    return q.order("id").range(from, from + 999)
  }

  const rows: { id: string; resolution: NodeResolution; subject_id: string | null; flags: NodeFlag[] }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await pageQuery(from)
    if (error) return fail(500, error.message)
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < 1000) break
  }

  const eligible: string[] = []
  const tally = { inferred: 0, review: 0, ambiguous: 0, needs_detail: 0, new: 0, unresolved: 0 }
  for (const r of rows) {
    if (r.resolution === "matched" && r.subject_id) {
      if ((r.flags ?? []).includes("all_inferred")) tally.inferred++
      else eligible.push(r.id)
    } else if (r.resolution in tally) {
      tally[r.resolution as keyof typeof tally]++
    }
  }

  if (apply && eligible.length) {
    for (let i = 0; i < eligible.length; i += 200) {
      const { error } = await db
        .from("podcast_staging_nodes")
        .update({ decision: "approved", ...stamp(actorId), ...touched() })
        .in("id", eligible.slice(i, i + 200))
        .eq("decision", "pending")
      if (error) return fail(500, error.message)
    }
  }

  const leftOut = rows.length - eligible.length
  return {
    ok: true,
    count: eligible.length,
    left_out: leftOut,
    reasons: reasonsLine([
      [tally.inferred, "name inferred every time", "names inferred every time"],
      [tally.ambiguous, "needs a match picked", "need a match picked"],
      [tally.review, "close match to check", "close matches to check"],
      [tally.needs_detail, "needs a year", "need a year"],
      [tally.new, "new node", "new nodes"],
      [tally.unresolved, "not checked yet", "not checked yet"],
    ]),
    applied: apply,
  }
}

/** "Re-check against catalog": the resolver pass over every undecided node. */
export async function recheckCatalog(db: SupabaseClient): Promise<ActionResult<{ checked: number; changed: number; skipped_decided: number }>> {
  const r = await resolveStaging(db, { apply: true })
  return { ok: true, checked: r.checked, changed: r.changed, skipped_decided: r.skippedDecided }
}
