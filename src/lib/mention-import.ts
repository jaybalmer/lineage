// Podcast mention import: the pure half.
//
// Client-safe BY DESIGN: this module is imported by the admin import page as
// well as by the server executor, so it must never reach for the service client
// or anything else that drags next/headers into the browser bundle. The writes
// live in mention-import-server.ts, exactly the split mentions.ts /
// mentions-server.ts already uses.
//
// MIRROR NOTE. scripts/import-mentions.mjs holds the same rules in plain JS,
// because it runs under bare Node and cannot import TypeScript. The seed
// contract, the near-miss rule and the ghost planner must behave identically in
// both files: CHANGE BOTH. The route is now the primary implementation; the
// script stays for local use until it is retired.

import { parseTimestampInput } from "@/lib/mentions"
import type { MentionSubjectType } from "@/types"

export const SUBJECT_TYPES: MentionSubjectType[] = ["person", "place", "org", "board", "event"]

// ── the seed contract (podcast-seeds/README.md) ─────────────────────────────

export type SeedGhost = {
  place_type?: string
  region?: string
  country?: string
  org_type?: string
  brand_category?: string
  brand?: string
  model?: string
  model_year?: number
  shape?: string
  start_date?: string
  event_type?: string
  year?: number
  place_id?: string
}

export type SeedSubject = {
  subject_name?: string
  subject_type?: string
  resolution?: string
  subject_id?: string | null
  confirm_new?: boolean
  ghost?: SeedGhost
  timestamp?: string | number
  timestamp_seconds?: number
  excerpt?: string
  story_title?: string
  status?: string
  activity?: string
  skip_reason?: string
}

export type SeedStory = {
  timestamp?: string | number
  timestamp_seconds?: number
  title?: string
  excerpt?: string
  status?: string
  resolution?: string
  activity?: string
  skip_reason?: string
  subjects?: SeedSubject[]
}

export type SeedEpisode = {
  episode_event_id?: string
  show_name?: string
  episode_number?: number
  episode_name?: string
  media_url?: string
  public_slug?: string
}

export type MentionSeed = {
  episode: SeedEpisode
  stories?: SeedStory[]
  mentions?: SeedSubject[]
}

/**
 * Shape-check a pasted seed before anything touches the database.
 *
 * Deliberately shallow: it confirms the envelope so the resolver can assume an
 * episode block and a row source. Per-row problems (bad subject_type, garbage
 * timestamp, missing ghost column) are reported per row in the plan instead of
 * failing the whole paste, because one bad row out of fifty should be visible,
 * not fatal.
 */
export function validateSeed(raw: unknown): { seed: MentionSeed } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Seed must be a JSON object." }
  }
  const seed = raw as MentionSeed
  if (!seed.episode || typeof seed.episode !== "object") {
    return { error: "Seed needs an { episode } block identifying the episode." }
  }
  if (!Array.isArray(seed.stories) && !Array.isArray(seed.mentions)) {
    return { error: "Seed needs a stories array (preferred) or a flat mentions array." }
  }
  if (seed.stories && !Array.isArray(seed.stories)) return { error: "stories must be an array." }
  if (seed.mentions && !Array.isArray(seed.mentions)) return { error: "mentions must be an array." }
  return { seed }
}

// ── expansion ───────────────────────────────────────────────────────────────

export type ExpandedSubject = {
  /** Stable address back into the seed: `s:<story>:<subject>` or `m:<index>`. */
  key: string
  storyKey: string
  subject_name: string
  subject_type: string
  resolution: string
  subject_id: string | null
  confirm_new: boolean
  ghost: SeedGhost
  timestamp_raw: string | number | null
  excerpt: string | null
  story_title: string | null
  status: string
}

export type ExpandedStory = {
  key: string
  timestamp_raw: string | number | null
  timestamp_seconds: number | null
  title: string | null
  excerpt: string | null
  /** The story is marked skip in the seed, so its whole cast is trimmed. */
  trimmed: boolean
  activity: string | null
  skip_reason: string | null
  subjects: ExpandedSubject[]
}

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim()
  return s || null
}

/**
 * Flatten a seed into stories with casts.
 *
 * A story is one passage of the episode: a timestamp, an excerpt, and every
 * entity it establishes. It expands to one mention per subject, all sharing the
 * moment, so the whole story lands on each participant's timeline rather than
 * the fragment that happens to name them.
 *
 * The legacy flat mentions[] array renders as one-subject stories, so seeds
 * written before the story format still import and still review.
 */
export function expandSeed(seed: MentionSeed): ExpandedStory[] {
  const out: ExpandedStory[] = []

  ;(seed.mentions ?? []).forEach((row, index) => {
    const key = `m:${index}`
    const trimmed = row.resolution === "skip"
    out.push({
      key,
      timestamp_raw: row.timestamp_seconds ?? row.timestamp ?? null,
      timestamp_seconds: readTimestamp(row.timestamp_seconds ?? row.timestamp ?? null) ?? null,
      title: str(row.story_title) ?? str(row.subject_name),
      excerpt: str(row.excerpt),
      trimmed,
      activity: str(row.activity),
      skip_reason: str(row.skip_reason),
      subjects: [toSubject(row, key, key, row.timestamp_seconds ?? row.timestamp ?? null, row.excerpt, row.story_title, row.status)],
    })
  })

  ;(seed.stories ?? []).forEach((story, index) => {
    const storyKey = `s:${index}`
    const trimmed = story.resolution === "skip"
    const ts = story.timestamp_seconds ?? story.timestamp ?? null
    out.push({
      key: storyKey,
      timestamp_raw: ts,
      timestamp_seconds: readTimestamp(ts) ?? null,
      title: str(story.title),
      excerpt: str(story.excerpt),
      trimmed,
      activity: str(story.activity),
      skip_reason: str(story.skip_reason),
      subjects: (story.subjects ?? []).map((subject, j) =>
        toSubject(
          subject,
          `${storyKey}:${j}`,
          storyKey,
          subject.timestamp_seconds ?? subject.timestamp ?? ts,
          subject.excerpt ?? story.excerpt,
          subject.story_title ?? story.title,
          subject.status ?? story.status,
        ),
      ),
    })
  })

  return out
}

function toSubject(
  subject: SeedSubject,
  key: string,
  storyKey: string,
  timestamp: string | number | null | undefined,
  excerpt: string | undefined,
  storyTitle: string | undefined,
  status: string | undefined,
): ExpandedSubject {
  return {
    key,
    storyKey,
    subject_name: str(subject.subject_name) ?? "",
    subject_type: str(subject.subject_type) ?? "",
    resolution: str(subject.resolution) ?? "new_ghost",
    subject_id: str(subject.subject_id),
    confirm_new: subject.confirm_new === true,
    ghost: subject.ghost ?? {},
    timestamp_raw: timestamp ?? null,
    excerpt: str(excerpt),
    story_title: str(storyTitle),
    status: str(status) ?? "draft",
  }
}

/** Timestamp as whole seconds. null = none, undefined = unreadable. */
export function readTimestamp(raw: string | number | null | undefined): number | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null
  return parseTimestampInput(String(raw))
}

// ── name matching ───────────────────────────────────────────────────────────
// Exact matching alone is not safe. The first real import wrote "Mount Baker"
// while the catalog held "Mt. Baker Ski Area", matched nothing, and minted a
// second Baker. Same for Nakiska, Breckenridge, Whistler and Blackcomb.

/**
 * Words that carry no identity, so "Nakiska" and "Nakiska Ski Area" compare
 * equal. Deliberately short: anything dropped here is a word two genuinely
 * different entities are allowed to share.
 */
const GENERIC_TOKENS = new Set([
  "the", "a", "an", "and", "of", "at",
  "ski", "skiing", "area", "resort", "mountain", "mtn", "hill", "park",
  "snowboard", "snowboards", "snowboarding", "boards", "co", "inc", "ltd", "llc",
])

/** Lowercase, expand the abbreviations that actually collide, strip punctuation. */
export function normalizeName(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\bmt\.?\b/g, "mount")
    .replace(/\bst\.?\b/g, "saint")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Identity-bearing tokens only. */
export function significantTokens(raw: unknown): string[] {
  return normalizeName(raw).split(" ").filter((t) => t && !GENERIC_TOKENS.has(t))
}

/**
 * True when two names are close enough that a human should decide.
 *
 * The rule is token containment after normalization: every significant token of
 * the shorter name appears in the longer. That catches abbreviation ("Mt." vs
 * "Mount"), generic suffixes ("Nakiska" vs "Nakiska Ski Area") and partial names
 * ("Whistler" vs "Whistler Blackcomb"), which is every duplicate the first real
 * import produced. Deliberately loose: a false flag costs one decision, a missed
 * one costs a permanent duplicate node other people start linking to.
 */
export function isNearMiss(a: unknown, b: unknown): boolean {
  const A = new Set(significantTokens(a))
  const B = new Set(significantTokens(b))
  if (A.size === 0 || B.size === 0) return false
  const [small, large] = A.size <= B.size ? [A, B] : [B, A]
  for (const token of small) if (!large.has(token)) return false
  return true
}

export const sameName = (a: unknown, b: unknown): boolean =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()

// ── ghost planning ──────────────────────────────────────────────────────────

export type GhostPlan = {
  table: "people" | "places" | "orgs" | "boards" | "events"
  id: string
  row: Record<string, unknown>
  /** Human line for the review surface: what this would create. */
  summary: string
}

/** Text catalog ids, matching the app convention (add-entity-modal generateId). */
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Plan the catalog row a new subject would create.
 *
 * Every ghost is explicitly unverified, and a person ghost sets node_status
 * 'unclaimed' EXPLICITLY: the people.node_status default is 'catalog', which
 * misfiles a ghost as a plain catalog row rather than a claimable node.
 *
 * Returns { error } when the seed does not carry a column the table requires.
 * boards.model_year and events.start_date are NOT NULL with no default, and a
 * year is not something an importer may invent.
 */
export function planGhost(
  subject: Pick<ExpandedSubject, "subject_name" | "subject_type" | "ghost">,
  actorId: string | null,
): GhostPlan | { error: string } {
  const name = subject.subject_name.trim()
  const ghost = subject.ghost ?? {}

  if (subject.subject_type === "person") {
    const id = crypto.randomUUID()
    return {
      table: "people",
      id,
      summary: `person "${name}" as an unclaimed node`,
      row: {
        id,
        display_name: name,
        community_status: "unverified",
        node_status: "unclaimed",
        added_by: actorId,
      },
    }
  }

  if (subject.subject_type === "place") {
    const id = genId("place")
    const placeType = ghost.place_type ?? "resort"
    return {
      table: "places",
      id,
      summary: `place "${name}" (${placeType})`,
      row: {
        id,
        name,
        place_type: placeType,
        region: ghost.region ?? null,
        country: ghost.country ?? null,
        community_status: "unverified",
        added_by: actorId,
      },
    }
  }

  if (subject.subject_type === "org") {
    const id = genId("org")
    const orgType = ghost.org_type ?? "brand"
    return {
      table: "orgs",
      id,
      summary: `brand "${name}" (${orgType})`,
      row: {
        id,
        name,
        org_type: orgType,
        brand_category: ghost.brand_category ?? null,
        country: ghost.country ?? null,
        community_status: "unverified",
        added_by: actorId,
      },
    }
  }

  if (subject.subject_type === "board") {
    const brand = ghost.brand ?? null
    const model = ghost.model ?? null
    const modelYear = ghost.model_year ?? null
    if (!brand || !model || !modelYear) {
      const missing = [
        !brand ? "ghost.brand" : null,
        !model ? "ghost.model" : null,
        !modelYear ? "ghost.model_year" : null,
      ].filter(Boolean).join(", ")
      return {
        error: `board ghost is missing ${missing} (boards.model_year is NOT NULL). Add it to the seed, or resolve this row to an existing board.`,
      }
    }
    const id = genId("board")
    return {
      table: "boards",
      id,
      summary: `board "${brand} ${model} ${modelYear}"`,
      row: {
        id,
        brand,
        model,
        model_year: modelYear,
        shape: ghost.shape ?? null,
        community_status: "unverified",
        added_by: actorId,
      },
    }
  }

  if (subject.subject_type === "event") {
    const rawStart = ghost.start_date ?? null
    if (!rawStart) {
      return {
        error: `event ghost is missing ghost.start_date (YYYY or YYYY-MM-DD; events.start_date is NOT NULL). Add it to the seed, or resolve this row to an existing event.`,
      }
    }
    const startDate = /^\d{4}$/.test(String(rawStart)) ? `${rawStart}-01-01` : String(rawStart)
    const id = genId("event")
    return {
      table: "events",
      id,
      summary: `event "${name}" starting ${startDate}`,
      row: {
        id,
        name,
        event_type: ghost.event_type ?? "gathering",
        start_date: startDate,
        year: ghost.year ?? Number(startDate.slice(0, 4)),
        place_id: ghost.place_id ?? null,
        community_status: "unverified",
        added_by: actorId,
      },
    }
  }

  return { error: `subject_type must be one of ${SUBJECT_TYPES.join(", ")}` }
}

/**
 * Identity of a would-be ghost, so two rows naming the same new entity plan ONE
 * node rather than two. The apply path gets this for free from rememberCreated
 * (a created ghost becomes an exact match for later rows); the dry run needs it
 * explicitly or the review surface over-reports what it is about to create.
 */
export function ghostIdentity(subject: Pick<ExpandedSubject, "subject_name" | "subject_type" | "ghost">): string {
  if (subject.subject_type === "board") {
    const g = subject.ghost ?? {}
    return `board|${normalizeName(g.brand)}|${normalizeName(g.model)}|${g.model_year ?? ""}`
  }
  return `${subject.subject_type}|${normalizeName(subject.subject_name)}`
}

/** Same key the mentions_dedupe unique index enforces. */
export const mentionDedupeKey = (
  subjectType: string,
  subjectId: string,
  ts: number | null,
): string => `${subjectType}|${subjectId}|${ts ?? -1}`

// ── the plan the review surface renders ─────────────────────────────────────

/** What the resolver decided about one subject. */
export type SubjectOutcome =
  /** Resolved to an existing catalog entity. */
  | "matched_existing"
  /** No match and nothing close: import would create the node. */
  | "new_ghost"
  /** Close to something already in the catalog. Blocks import until decided. */
  | "review"
  /** More than one exact match. Blocks import until decided. */
  | "ambiguous"
  /** The seed cannot produce a valid row. Reported, skipped, does not block. */
  | "refused"
  /** Already on this episode at this moment. */
  | "already_mapped"
  /** Trimmed, in the seed or on the page. */
  | "skipped"

export type PlanCandidate = { id: string; label: string }

export type PlanSubject = {
  key: string
  subject_name: string
  subject_type: string
  outcome: SubjectOutcome
  subject_id: string | null
  matched_label: string | null
  candidates: PlanCandidate[]
  ghost_summary: string | null
  /**
   * This row is the one that mints the node. A second row naming the same new
   * entity rides along on it, so summing this field counts nodes, not rows.
   */
  creates_node: boolean
  refusal: string | null
  timestamp_seconds: number | null
}

export type PlanStory = {
  key: string
  timestamp_seconds: number | null
  timestamp: string | null
  title: string | null
  excerpt: string | null
  trimmed: boolean
  activity: string | null
  skip_reason: string | null
  subjects: PlanSubject[]
}

export type PlanCounts = {
  stories: number
  mentions: number
  ghosts: number
  matched: number
  review: number
  refused: number
  skipped: number
  trimmed: number
}

export type ImportPlan = {
  applied: boolean
  episode: {
    id: string
    name: string
    episode_number: number | null
    media_url: string | null
  }
  stories: PlanStory[]
  counts: PlanCounts
  refusals: { where: string; why: string }[]
}

/** Rows a human still has to decide before import may run (D7). */
export function decisionsNeeded(plan: ImportPlan): PlanSubject[] {
  return plan.stories
    .filter((s) => !s.trimmed)
    .flatMap((s) => s.subjects)
    .filter((s) => s.outcome === "review" || s.outcome === "ambiguous")
}
