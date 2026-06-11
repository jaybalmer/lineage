// BUG-014: connection overlap derived from story tags + story junctions.
//
// Locked design (June 10): tagging a person on a story NEVER writes a paired
// claim. Instead the scorer derives overlap on read, here, going through the
// same `_public` views the rest of the app uses. That keeps the data clean and
// makes moderation free: a declined/disabled tag, or a subject who opted into
// approval gating, drops out of `story_riders_public` and therefore out of
// these results with zero extra logic (PB-009 gotcha #9 + the permissive view).
//
// Two entry points:
//   - deriveStoryFactsForPair(a, b)  → OverlapFact[] for Compare (fed as
//     extraFacts into computeConnectionSummary, which dedups + scores).
//   - deriveStoryConnectionCandidates(me) → person ids co-tagged with me, for
//     the Connections list.
//
// Performance: client-side at launch scale. Every query is batched over an id
// list. There is no per-candidate query in a loop (brief §4 guardrail).

import { supabase } from "@/lib/supabase"
import type { OverlapFact } from "@/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A co-tagged story scores like a direct rode_with (+8), capped at two stories
// (+16 total). Shared event/place links on those stories score the same as
// their claim-derived equivalents and dedup against them downstream.
const STORY_COTAG_SCORE = 8
const STORY_COTAG_CAP_STORIES = 2
const STORY_EVENT_SCORE = 10
const STORY_PLACE_SCORE = 2

type ResolveName = (id: string, type: string) => string

interface StoryRow {
  id: string
  author_id: string
  story_date: string
  title: string | null
  linked_event_id: string | null
  linked_place_id: string | null
}

const STORY_COLS = "id, author_id, story_date, title, linked_event_id, linked_place_id"

function yearOf(date: string | null | undefined): string {
  return (date ?? "").slice(0, 4)
}

// ── Compare: derive overlap facts for a specific pair ───────────────────────
// The story author counts as present on their own story, so a co-tag is "both
// present" where present = authored OR tagged (through the public view).
export async function deriveStoryFactsForPair(
  aId: string,
  bId: string,
  resolveName: ResolveName,
): Promise<OverlapFact[]> {
  // Only real/ghost people (UUID ids) have stories. Mock riders ("u1") never do.
  if (!aId || !bId || aId === bId) return []
  if (!UUID_RE.test(aId) || !UUID_RE.test(bId)) return []

  const [{ data: tagRows }, { data: authoredRows }] = await Promise.all([
    supabase.from("story_riders_public").select("story_id, rider_id").in("rider_id", [aId, bId]),
    supabase.from("stories").select(STORY_COLS).in("author_id", [aId, bId]).eq("visibility", "public"),
  ])

  const taggedA = new Set<string>()
  const taggedB = new Set<string>()
  for (const r of (tagRows ?? []) as { story_id: string; rider_id: string }[]) {
    if (r.rider_id === aId) taggedA.add(r.story_id)
    if (r.rider_id === bId) taggedB.add(r.story_id)
  }
  const authoredA = new Set<string>()
  const authoredB = new Set<string>()
  const metaById = new Map<string, StoryRow>()
  for (const s of (authoredRows ?? []) as StoryRow[]) {
    metaById.set(s.id, s)
    if (s.author_id === aId) authoredA.add(s.id)
    if (s.author_id === bId) authoredB.add(s.id)
  }

  const candidateIds = new Set<string>([...taggedA, ...taggedB, ...authoredA, ...authoredB])
  const coTaggedIds = [...candidateIds].filter(
    (sid) => (taggedA.has(sid) || authoredA.has(sid)) && (taggedB.has(sid) || authoredB.has(sid)),
  )
  if (coTaggedIds.length === 0) return []

  // Metadata for co-tagged stories neither person authored (third-party author,
  // both tagged), plus the community-added place/event junctions. The stories
  // query re-applies the public-visibility filter, so a private co-tagged story
  // drops out of metaById and is not counted.
  const missingIds = coTaggedIds.filter((sid) => !metaById.has(sid))
  const [{ data: extraStories }, { data: placeRows }, { data: eventRows }] = await Promise.all([
    missingIds.length
      ? supabase.from("stories").select(STORY_COLS).in("id", missingIds).eq("visibility", "public")
      : Promise.resolve({ data: [] as StoryRow[] }),
    supabase.from("story_places").select("story_id, place_id").in("story_id", coTaggedIds),
    supabase.from("story_events").select("story_id, event_id").in("story_id", coTaggedIds),
  ])
  for (const s of (extraStories ?? []) as StoryRow[]) metaById.set(s.id, s)

  const placesByStory = new Map<string, Set<string>>()
  for (const r of (placeRows ?? []) as { story_id: string; place_id: string }[]) {
    if (!placesByStory.has(r.story_id)) placesByStory.set(r.story_id, new Set())
    placesByStory.get(r.story_id)!.add(r.place_id)
  }
  const eventsByStory = new Map<string, Set<string>>()
  for (const r of (eventRows ?? []) as { story_id: string; event_id: string }[]) {
    if (!eventsByStory.has(r.story_id)) eventsByStory.set(r.story_id, new Set())
    eventsByStory.get(r.story_id)!.add(r.event_id)
  }

  // Newest first, so the +8 cap keeps the most recent shared moments.
  const ordered = coTaggedIds
    .map((sid) => metaById.get(sid))
    .filter((s): s is StoryRow => s != null)
    .sort((a, b) => (b.story_date ?? "").localeCompare(a.story_date ?? ""))

  const facts: OverlapFact[] = []
  ordered.forEach((s, i) => {
    const year = yearOf(s.story_date)

    // Co-tagged on the story (+8, capped). OverlapFact.entityType has no
    // "story" member; "person" is a neutral placeholder and the story id can't
    // collide with any claim object_id, so timeline highlighting is unaffected.
    if (i < STORY_COTAG_CAP_STORIES) {
      const title = s.title?.trim()
      facts.push({
        type: "story",
        label: title ? `Tagged together on "${title}"` : "Tagged together in a story",
        detail: year,
        score: STORY_COTAG_SCORE,
        entityId: s.id,
        entityType: "person",
      })
    }

    // Shared event (+10): author's primary link + any community-added events.
    const eventIds = new Set<string>(s.linked_event_id ? [s.linked_event_id] : [])
    for (const eid of eventsByStory.get(s.id) ?? []) eventIds.add(eid)
    for (const eid of eventIds) {
      facts.push({
        type: "event",
        label: `Both attended ${resolveName(eid, "event")}`,
        detail: year,
        score: STORY_EVENT_SCORE,
        entityId: eid,
        entityType: "event",
      })
    }

    // Shared place (+2): author's primary link + any community-added places.
    const placeIds = new Set<string>(s.linked_place_id ? [s.linked_place_id] : [])
    for (const pid of placesByStory.get(s.id) ?? []) placeIds.add(pid)
    for (const pid of placeIds) {
      facts.push({
        type: "resort",
        label: `Both rode ${resolveName(pid, "place")}`,
        detail: year,
        score: STORY_PLACE_SCORE,
        entityId: pid,
        entityType: "place",
      })
    }
  })

  return facts
}

// ── Connections list: people co-tagged with me through stories ──────────────
// Returns person ids (claimed members and unclaimed ghosts alike), excluding
// me. The caller merges these with claim-derived candidates and renders ghosts
// with the unclaimed treatment + Invite CTA.
export async function deriveStoryConnectionCandidates(meId: string): Promise<string[]> {
  if (!meId || !UUID_RE.test(meId)) return []

  // 1. My story set: stories I authored + stories I'm tagged in (public view).
  const [{ data: myTags }, { data: myAuthored }] = await Promise.all([
    supabase.from("story_riders_public").select("story_id").eq("rider_id", meId),
    supabase.from("stories").select("id").eq("author_id", meId).eq("visibility", "public"),
  ])
  const myStoryIds = new Set<string>([
    ...((myTags ?? []) as { story_id: string }[]).map((r) => r.story_id),
    ...((myAuthored ?? []) as { id: string }[]).map((r) => r.id),
  ])
  if (myStoryIds.size === 0) return []
  const ids = [...myStoryIds]

  // 2. Everyone present on the PUBLIC stories in that set. Restricting to public
  //    stories (via this query) keeps a private story I'm tagged in from leaking
  //    its other participants.
  const { data: publicStories } = await supabase
    .from("stories").select("id, author_id").in("id", ids).eq("visibility", "public")
  const publicRows = (publicStories ?? []) as { id: string; author_id: string }[]
  if (publicRows.length === 0) return []
  const publicIds = publicRows.map((s) => s.id)

  const { data: coTags } = await supabase
    .from("story_riders_public").select("rider_id").in("story_id", publicIds)

  const candidates = new Set<string>()
  for (const s of publicRows) if (s.author_id !== meId) candidates.add(s.author_id)
  for (const r of (coTags ?? []) as { rider_id: string }[]) if (r.rider_id !== meId) candidates.add(r.rider_id)
  return [...candidates]
}
