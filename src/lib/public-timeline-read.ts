// PB-010 Phase 2: server-side read for the public timeline at /t/[slug].
//
// This is the ONE place that resolves a public_slug to a fully server-resolved
// timeline payload. The chromeless page, the public read API route, and the OG
// image route all read through here so they can never drift on what "enabled"
// means, which rows are visible, or how the header is shaped.
//
// Visibility discipline (PB-009): claims are read through claims_public and
// story riders through story_riders_public, so a declined/hidden tag or a
// non-public claim never reaches a public visitor. Stories are filtered to
// visibility='public'. The service client is used only to bypass RLS for the
// catalog joins; it never widens what the _public views already gate.

import { getServiceClient } from "@/lib/auth"
import { readPublishedMentions } from "@/lib/mentions-server"
import { eventSlug, placeSlug, boardSlug } from "@/lib/mock-data"
import type {
  Claim, Story, EntityType, Predicate, MentionSubjectType,
  PublicStackEntry, PublicStackEntryType, PublicStackCategoryKey,
} from "@/types"

// ── Resolved-entity shapes (only the fields the read-only cards render) ───────

export interface PublicPersonLite {
  id: string
  display_name: string
  avatar_url: string | null
  node_status: string | null
}
export interface PublicPlaceLite {
  id: string
  name: string
  region: string | null
  country: string | null
  place_type: string | null
  image_url: string | null
}
export interface PublicEventLite {
  id: string
  name: string
  event_type: string | null
  year: number | null
  start_date: string | null
  image_url: string | null
}
export interface PublicOrgLite {
  id: string
  name: string
  org_type: string | null
  brand_category: string | null
  founded_year: number | null
  logo_url: string | null
}
export interface PublicBoardLite {
  id: string
  brand: string
  model: string
  model_year: number | null
  shape: string | null
  image_url: string | null
}

export interface PublicTimelineEntities {
  people: Record<string, PublicPersonLite>
  places: Record<string, PublicPlaceLite>
  events: Record<string, PublicEventLite>
  orgs: Record<string, PublicOrgLite>
  boards: Record<string, PublicBoardLite>
}

/** Public header. Precise location (city) is intentionally omitted; only the
 *  coarse region/country is exposed, matching the non-owner person profile. */
export interface PublicTimelineOwner {
  id: string
  display_name: string
  slug: string
  avatar_url: string | null
  bio: string | null
  region: string | null
  country: string | null
  riding_since: number | null
  /** riding_since when set, else the earliest claim/story year. Drives the
   *  "Snowboarding since YYYY" header + OG line. Null when nothing is datable. */
  era_start: number | null
  /** Live membership tier for the member badge in the owner header. Null for
   *  event/org owners (episodes + shows carry no tier). */
  membership_tier: string | null
}

export interface PublicTimelinePayload {
  owner: PublicTimelineOwner
  claims: Claim[]
  stories: Story[]
  entities: PublicTimelineEntities
  /** Phase 3 reads this to fork timeline vs stack; Phase 2 always renders timeline. */
  default_view: "timeline" | "stack" | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function yearOf(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const y = parseInt(String(dateStr).slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : null
}

const PROFILE_HEADER_COLS =
  "id, display_name, avatar_url, bio, region, country, riding_since, membership_tier, public_slug, public_timeline_enabled, public_timeline_default_view"

type ProfileHeaderRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  region: string | null
  country: string | null
  riding_since: number | null
  membership_tier: string | null
  public_slug: string | null
  public_timeline_enabled: boolean | null
  public_timeline_default_view: "timeline" | "stack" | null
}

/** Resolve the slug to an enabled profile, or null when missing/disabled.
 *  Disabled and unknown both resolve to null so a turned-off URL leaks nothing
 *  (brief decision D4: caller returns 404 either way). */
async function resolveEnabledProfile(
  db: ReturnType<typeof getServiceClient>,
  slug: string,
): Promise<ProfileHeaderRow | null> {
  const { data } = await db
    .from("profiles")
    .select(PROFILE_HEADER_COLS)
    .eq("public_slug", slug)
    .maybeSingle()
  const row = data as ProfileHeaderRow | null
  if (!row || row.public_timeline_enabled !== true || !row.display_name) return null
  return row
}

// ── Story read (mirrors the public author + rider reads in /api/stories) ──────

const STORY_JOIN = `
  *,
  photos:story_photos(id, url, caption, sort_order),
  boards:story_boards(board_id),
  author:profiles!author_id(display_name, avatar_url)
`

async function readOwnerStories(
  db: ReturnType<typeof getServiceClient>,
  ownerId: string,
): Promise<Story[]> {
  // Tagged-in story ids come through the approved-only view, so a pending or
  // declined tag against this owner never surfaces their tagged stories.
  const { data: taggedRows } = await db
    .from("story_riders_public")
    .select("story_id")
    .eq("rider_id", ownerId)
  const taggedIds = Array.from(
    new Set(((taggedRows ?? []) as { story_id: string }[]).map((r) => r.story_id)),
  )

  const authoredP = db
    .from("stories")
    .select(STORY_JOIN)
    .eq("visibility", "public")
    .eq("author_id", ownerId)
    .order("story_date", { ascending: false })

  const taggedP = taggedIds.length
    ? db
        .from("stories")
        .select(STORY_JOIN)
        .eq("visibility", "public")
        .in("id", taggedIds)
        .order("story_date", { ascending: false })
    : Promise.resolve({ data: [] as Record<string, unknown>[] })

  const [authoredRes, taggedRes] = await Promise.all([authoredP, taggedP])

  const byId = new Map<string, Record<string, unknown>>()
  for (const s of (authoredRes.data ?? []) as Record<string, unknown>[]) byId.set(s.id as string, s)
  for (const s of (taggedRes.data ?? []) as Record<string, unknown>[]) byId.set(s.id as string, s)
  return enrichStories(db, Array.from(byId.values()))
}

/** Load specific public stories by id, enriched the same way readOwnerStories
 *  enriches. Used by the event-owner stack read, whose curated story entries
 *  point at arbitrary stories rather than an owner's authored/tagged set. */
async function readStoriesByIds(
  db: ReturnType<typeof getServiceClient>,
  ids: string[],
): Promise<Story[]> {
  if (ids.length === 0) return []
  const { data } = await db
    .from("stories")
    .select(STORY_JOIN)
    .eq("visibility", "public")
    .in("id", ids)
  return enrichStories(db, (data ?? []) as Record<string, unknown>[])
}

/** Shared enrichment: resolve board ids, approved rider tags, and the community
 *  place/event/org junctions onto raw story rows, returning newest-first. */
async function enrichStories(
  db: ReturnType<typeof getServiceClient>,
  rows: Record<string, unknown>[],
): Promise<Story[]> {
  if (rows.length === 0) return []

  const storyIds = rows.map((s) => s.id as string)

  // rider_ids through the approved-only view; community place/event links from
  // their base junctions (no tag_events on those, so no view needed).
  const [riderRes, cPlaceRes, cEventRes, cOrgRes] = await Promise.all([
    db.from("story_riders_public").select("story_id, rider_id").in("story_id", storyIds),
    db.from("story_places").select("story_id, place_id, added_by").in("story_id", storyIds),
    db.from("story_events").select("story_id, event_id, added_by").in("story_id", storyIds),
    db.from("story_orgs").select("story_id, org_id, added_by").in("story_id", storyIds),
  ])

  const ridersByStory = new Map<string, string[]>()
  for (const r of (riderRes.data ?? []) as { story_id: string; rider_id: string }[]) {
    const arr = ridersByStory.get(r.story_id) ?? []
    arr.push(r.rider_id)
    ridersByStory.set(r.story_id, arr)
  }
  const cPlacesByStory = new Map<string, { place_id: string; added_by: string | null }[]>()
  for (const r of (cPlaceRes.data ?? []) as { story_id: string; place_id: string; added_by: string | null }[]) {
    const arr = cPlacesByStory.get(r.story_id) ?? []
    arr.push({ place_id: r.place_id, added_by: r.added_by })
    cPlacesByStory.set(r.story_id, arr)
  }
  const cEventsByStory = new Map<string, { event_id: string; added_by: string | null }[]>()
  for (const r of (cEventRes.data ?? []) as { story_id: string; event_id: string; added_by: string | null }[]) {
    const arr = cEventsByStory.get(r.story_id) ?? []
    arr.push({ event_id: r.event_id, added_by: r.added_by })
    cEventsByStory.set(r.story_id, arr)
  }
  const cOrgsByStory = new Map<string, { org_id: string; added_by: string | null }[]>()
  for (const r of (cOrgRes.data ?? []) as { story_id: string; org_id: string; added_by: string | null }[]) {
    const arr = cOrgsByStory.get(r.story_id) ?? []
    arr.push({ org_id: r.org_id, added_by: r.added_by })
    cOrgsByStory.set(r.story_id, arr)
  }

  const stories: Story[] = rows.map((s) => ({
    ...(s as unknown as Story),
    board_ids: ((s.boards as { board_id: string }[]) ?? []).map((b) => b.board_id),
    rider_ids: ridersByStory.get(s.id as string) ?? [],
    community_places: cPlacesByStory.get(s.id as string) ?? [],
    community_events: cEventsByStory.get(s.id as string) ?? [],
    community_orgs: cOrgsByStory.get(s.id as string) ?? [],
    boards: undefined,
  }))

  // Stable newest-first order across the merged authored + tagged set.
  stories.sort((a, b) => (b.story_date ?? "").localeCompare(a.story_date ?? ""))
  return stories
}

// ── Entity resolution (everything the cards name, resolved by id) ────────────

async function resolveEntities(
  db: ReturnType<typeof getServiceClient>,
  claims: Claim[],
  stories: Story[],
  seed?: { person?: string[]; place?: string[]; event?: string[]; org?: string[]; board?: string[] },
): Promise<PublicTimelineEntities> {
  const personIds = new Set<string>()
  const placeIds = new Set<string>()
  const eventIds = new Set<string>()
  const orgIds = new Set<string>()
  const boardIds = new Set<string>()

  // Seed ids (e.g. curated event-stack refs that are not derived from claims).
  for (const id of seed?.person ?? []) personIds.add(id)
  for (const id of seed?.place ?? []) placeIds.add(id)
  for (const id of seed?.event ?? []) eventIds.add(id)
  for (const id of seed?.org ?? []) orgIds.add(id)
  for (const id of seed?.board ?? []) boardIds.add(id)

  for (const c of claims) {
    if (!c.object_id) continue
    if (c.object_type === "person") personIds.add(c.object_id)
    else if (c.object_type === "place") placeIds.add(c.object_id)
    else if (c.object_type === "event") eventIds.add(c.object_id)
    else if (c.object_type === "org") orgIds.add(c.object_id)
    else if (c.object_type === "board") boardIds.add(c.object_id)
  }
  for (const s of stories) {
    if (s.linked_place_id) placeIds.add(s.linked_place_id)
    if (s.linked_event_id) eventIds.add(s.linked_event_id)
    if (s.linked_org_id) orgIds.add(s.linked_org_id)
    for (const b of s.board_ids ?? []) boardIds.add(b)
    for (const r of s.rider_ids ?? []) personIds.add(r)
    for (const cp of s.community_places ?? []) placeIds.add(cp.place_id)
    for (const ce of s.community_events ?? []) eventIds.add(ce.event_id)
    for (const co of s.community_orgs ?? []) orgIds.add(co.org_id)
  }

  const ids = {
    person: Array.from(personIds),
    place: Array.from(placeIds),
    event: Array.from(eventIds),
    org: Array.from(orgIds),
    board: Array.from(boardIds),
  }

  const entities: PublicTimelineEntities = {
    people: {},
    places: {},
    events: {},
    orgs: {},
    boards: {},
  }

  // People live in two tables (catalog `people` + auth `profiles`), merged
  // catalog-wins exactly like the client store. `people` has no avatar_url
  // column, so avatars come only from profiles.
  const peopleP = ids.person.length
    ? Promise.all([
        db.from("people").select("id, display_name, node_status").in("id", ids.person),
        db.from("profiles").select("id, display_name, avatar_url, node_status").in("id", ids.person),
      ])
    : Promise.resolve([{ data: [] }, { data: [] }] as const)

  const placesP = ids.place.length
    ? db.from("places").select("id, name, region, country, place_type, image_url").in("id", ids.place)
    : Promise.resolve({ data: [] })
  const eventsP = ids.event.length
    // events has no image_url column (photos live in event_image_votes); selecting
    // it silently failed this query, so event entities never resolved in stacks.
    ? db.from("events").select("id, name, event_type, year, start_date").in("id", ids.event)
    : Promise.resolve({ data: [] })
  const orgsP = ids.org.length
    ? db.from("orgs").select("id, name, org_type, brand_category, founded_year, logo_url").in("id", ids.org)
    : Promise.resolve({ data: [] })
  const boardsP = ids.board.length
    ? db.from("boards").select("id, brand, model, model_year, shape, image_url").in("id", ids.board)
    : Promise.resolve({ data: [] })

  const [[catalogPpl, profilePpl], placesRes, eventsRes, orgsRes, boardsRes] = await Promise.all([
    peopleP, placesP, eventsP, orgsP, boardsP,
  ])

  // profiles first, then catalog people overwrite on id collision (catalog wins).
  for (const r of (profilePpl.data ?? []) as { id: string; display_name: string | null; avatar_url: string | null; node_status: string | null }[]) {
    entities.people[r.id] = {
      id: r.id,
      display_name: r.display_name ?? "Rider",
      avatar_url: r.avatar_url ?? null,
      node_status: r.node_status ?? null,
    }
  }
  for (const r of (catalogPpl.data ?? []) as { id: string; display_name: string | null; node_status: string | null }[]) {
    entities.people[r.id] = {
      id: r.id,
      display_name: r.display_name ?? "Rider",
      avatar_url: entities.people[r.id]?.avatar_url ?? null,
      node_status: r.node_status ?? null,
    }
  }
  for (const r of (placesRes.data ?? []) as PublicPlaceLite[]) {
    entities.places[r.id] = {
      id: r.id, name: r.name, region: r.region ?? null, country: r.country ?? null,
      place_type: r.place_type ?? null, image_url: r.image_url ?? null,
    }
  }
  for (const r of (eventsRes.data ?? []) as PublicEventLite[]) {
    entities.events[r.id] = {
      id: r.id, name: r.name, event_type: r.event_type ?? null, year: r.year ?? null,
      start_date: r.start_date ?? null, image_url: r.image_url ?? null,
    }
  }
  for (const r of (orgsRes.data ?? []) as PublicOrgLite[]) {
    entities.orgs[r.id] = {
      id: r.id, name: r.name, org_type: r.org_type ?? null, brand_category: r.brand_category ?? null,
      founded_year: r.founded_year ?? null, logo_url: r.logo_url ?? null,
    }
  }
  for (const r of (boardsRes.data ?? []) as PublicBoardLite[]) {
    entities.boards[r.id] = {
      id: r.id, brand: r.brand, model: r.model, model_year: r.model_year ?? null,
      shape: r.shape ?? null, image_url: r.image_url ?? null,
    }
  }

  return entities
}

// ── Public entry points ──────────────────────────────────────────────────────

/** Build the full timeline payload from an already-resolved profile row. Shared
 *  by the slug-gated public read and the by-id profile read (the Featured rail),
 *  so both apply the identical visibility discipline and header shape. `slug` is
 *  the fallback for owner.slug when the profile has no stored public_slug. */
async function buildProfilePayload(
  db: ReturnType<typeof getServiceClient>,
  profile: ProfileHeaderRow,
  slug: string,
): Promise<PublicTimelinePayload> {
  const ownerId = profile.id

  const claimsP = db
    .from("claims_public")
    .select("*")
    .eq("subject_id", ownerId)
    .eq("visibility", "public")
  const [claimsRes, stories] = await Promise.all([claimsP, readOwnerStories(db, ownerId)])
  const claims = (claimsRes.data ?? []) as Claim[]

  const entities = await resolveEntities(db, claims, stories)

  // Era = riding_since when set, else earliest datable claim/story year.
  let earliest: number | null = null
  for (const c of claims) {
    const y = yearOf(c.start_date)
    if (y !== null && (earliest === null || y < earliest)) earliest = y
  }
  for (const s of stories) {
    const y = yearOf(s.story_date)
    if (y !== null && (earliest === null || y < earliest)) earliest = y
  }
  const era_start = profile.riding_since ?? earliest

  return {
    owner: {
      id: ownerId,
      display_name: profile.display_name!,
      slug: profile.public_slug ?? slug,
      avatar_url: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
      region: profile.region ?? null,
      country: profile.country ?? null,
      riding_since: profile.riding_since ?? null,
      era_start,
      membership_tier: profile.membership_tier ?? null,
    },
    claims,
    stories,
    entities,
    default_view: profile.public_timeline_default_view ?? null,
  }
}

/** Full payload for the chromeless page + public API. Null = 404 (D4). */
export async function readPublicTimeline(slug: string): Promise<PublicTimelinePayload | null> {
  if (!slug) return null
  const db = getServiceClient()
  const profile = await resolveEnabledProfile(db, slug)
  if (!profile) return null
  return buildProfilePayload(db, profile, slug)
}

/** By-id profile timeline, WITHOUT the public_timeline_enabled gate. Powers the
 *  Featured rail on /people/[id], which surfaces a member's curated stack on
 *  their own (already public) profile page even when they have not opted into
 *  the standalone /t/[slug] page. Visibility is still enforced through
 *  claims_public + the public story reads, so nothing private leaks. Null when
 *  the profile is missing or archived. */
export async function readProfileTimelineById(id: string): Promise<PublicTimelinePayload | null> {
  if (!id) return null
  const db = getServiceClient()
  const { data } = await db
    .from("profiles")
    .select(PROFILE_HEADER_COLS + ", is_archived")
    .eq("id", id)
    .maybeSingle()
  const profile = data as (ProfileHeaderRow & { is_archived: boolean | null }) | null
  if (!profile || !profile.display_name || profile.is_archived === true) return null
  return buildProfilePayload(db, profile, profile.public_slug ?? id)
}

/** Resolve a member's curated stack for the profile Featured rail. Reuses the
 *  by-id timeline (no enabled gate) and the shared stack resolver. Null when the
 *  profile is missing/archived; an empty entries array when nothing is curated. */
export async function readProfileStackById(id: string): Promise<PublicStackPayload | null> {
  const timeline = await readProfileTimelineById(id)
  if (!timeline) return null
  return readPublicStack(timeline.owner.slug, timeline)
}

/** Lightweight owner-only resolve for the OG image route, which only needs the
 *  name + era and should not pay for the full entity resolution. */
export async function readPublicTimelineOwner(slug: string): Promise<PublicTimelineOwner | null> {
  if (!slug) return null
  const db = getServiceClient()
  const profile = await resolveEnabledProfile(db, slug)
  if (!profile) return null

  let era_start = profile.riding_since ?? null
  if (era_start === null) {
    const [claimRes, storyRes] = await Promise.all([
      db.from("claims_public").select("start_date").eq("subject_id", profile.id)
        .eq("visibility", "public").order("start_date", { ascending: true }).limit(1),
      db.from("stories").select("story_date").eq("author_id", profile.id)
        .eq("visibility", "public").order("story_date", { ascending: true }).limit(1),
    ])
    const cy = yearOf((claimRes.data?.[0] as { start_date?: string } | undefined)?.start_date)
    const sy = yearOf((storyRes.data?.[0] as { story_date?: string } | undefined)?.story_date)
    era_start = [cy, sy].filter((y): y is number => y !== null).sort((a, b) => a - b)[0] ?? null
  }

  return {
    id: profile.id,
    display_name: profile.display_name!,
    slug: profile.public_slug ?? slug,
    avatar_url: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    region: profile.region ?? null,
    country: profile.country ?? null,
    riding_since: profile.riding_since ?? null,
    era_start,
    membership_tier: profile.membership_tier ?? null,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PB-010A Phase 3: Stack View read
//
// The Stack is an owner-curated highlight reel (NOT a filter of the timeline).
// readPublicStack loads the owner's public_stack_entries, resolves each one
// against the SAME visibility-safe claims/stories/entities the Phase 2 timeline
// read already produced, drops any entry whose underlying record is no longer
// visible (a curated selection is additive to visibility, never a bypass), and
// derives the category_summary counts + era spans from the owner's claim set.
// It reuses readPublicTimeline rather than re-reading; callers that already hold
// the timeline payload pass it as `pre` to avoid a second round-trip.
// ════════════════════════════════════════════════════════════════════════════

/** Left-edge + kicker accent, keyed to Linestry's entity color conventions
 *  (places = teal per CLAUDE.md, not the legacy blue in the supplement). */
export type StackAccent = "violet" | "teal" | "amber" | "emerald" | "cyan"

/** One row inside a category_summary card's inline expansion (top 5-7 items). */
export interface ResolvedStackSummaryItem {
  id: string
  name: string
  meta: string | null   // "1983 – present", "1994", "7 shared moments", …
}

/** A fully server-resolved stack card, ready for the store-free renderer.
 *  custom_title / custom_summary overrides are already applied. The five ref
 *  types carry a thumbnail descriptor; category_summary carries count + items. */
export interface ResolvedStackEntry {
  id: string
  entry_type: PublicStackEntryType
  /** The underlying entity id (place/event/story/board/rider). Null for
   *  category_summary. PB-010 Phase 4 reads this to build the tag moment. */
  refId: string | null
  position: number
  accent: StackAccent
  kicker: string                 // "Story" | "Place" | … | "Places"
  kickerMeta: string | null      // muted context line ("1994 · Blackcomb")
  title: string
  /** In-app path to the entity this card points at, so the featured set is
   *  browsable and not just expandable. Null for stories and summaries, which
   *  have no entity page and expand instead. Community-scoped paths are emitted
   *  BARE (/places/…): the proxy 301s them to the active community, which is
   *  what lets the chromeless /t/ page link into the app. */
  href: string | null
  summary: string | null         // full text; the client truncates per breakpoint
  // Thumbnail: a server-resolvable photo, else an entity-graphic fallback.
  thumbPhotoUrl: string | null
  thumbEntity: EntityType | null // entity-graphic fallback (null for story / summary)
  thumbName: string              // seeds the lettered person / org tile
  thumbYear: number | null       // seeds the event tile
  board: { brand: string; model: string; year: number | null } | null  // useBoardImage hint
  // category_summary only:
  categoryKey: PublicStackCategoryKey | null
  count: number | null
  items: ResolvedStackSummaryItem[]
}

export interface PublicStackPayload {
  owner: PublicTimelineOwner
  entries: ResolvedStackEntry[]
}

const ACCENT_BY_TYPE: Record<Exclude<PublicStackEntryType, "category_summary">, StackAccent> = {
  story: "violet", place: "teal", event: "amber", board: "emerald", rider: "violet",
}
const CATEGORY_ACCENT: Record<PublicStackCategoryKey, StackAccent> = {
  places: "teal", boards: "emerald", events: "amber", riders: "violet", stories: "violet",
}
const CATEGORY_KICKER: Record<PublicStackCategoryKey, string> = {
  places: "Places", boards: "Boards", events: "Events", riders: "Riders", stories: "Stories",
}

const EVENT_PREDICATES = new Set<Predicate>(["competed_at", "spectated_at", "organized_at", "organized"])

/** A range label that keeps "present" for open-ended spans (unlike the shared
 *  formatDateRange, which drops it per BUG-033). */
function eraLabel(years: number[], ongoing: boolean): string | null {
  if (years.length === 0) return null
  const min = Math.min(...years)
  const max = Math.max(...years)
  if (ongoing) return `${min} – present`
  return min === max ? String(min) : `${min} – ${max}`
}

function firstPhotoUrl(story: Story): string | null {
  const photos = (story.photos ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return photos[0]?.url ?? null
}

function joinMeta(parts: (string | null | undefined)[]): string | null {
  const cleaned = parts.filter((p): p is string => !!p && p.trim().length > 0)
  return cleaned.length ? cleaned.join(" · ") : null
}

interface YearAgg { years: number[]; ongoing: boolean }
function pushSpan(agg: YearAgg, start?: string, end?: string) {
  const sy = yearOf(start); if (sy !== null) agg.years.push(sy)
  const ey = yearOf(end); if (ey !== null) agg.years.push(ey)
  if (start && !end) agg.ongoing = true
}

/** Resolve the owner's public_stack_entries against the already-read timeline.
 *  Returns null when the slug is disabled/unknown (the caller 404s, matching the
 *  timeline route). */
export async function readPublicStack(
  slug: string,
  pre?: PublicTimelinePayload | null,
): Promise<PublicStackPayload | null> {
  const timeline = pre ?? (await readPublicTimeline(slug))
  if (!timeline) return null

  const { owner, claims, stories, entities } = timeline
  const db = getServiceClient()

  const { data: rowData } = await db
    .from("public_stack_entries")
    .select("*")
    .eq("owner_profile_id", owner.id)
    .order("position", { ascending: true })
  const rows = (rowData ?? []) as PublicStackEntry[]
  if (rows.length === 0) return { owner, entries: [] }

  // ── Pre-aggregate the owner's claim set, once, for summaries + per-entity meta.
  const storiesById = new Map(stories.map((s) => [s.id, s]))

  const placeAgg = new Map<string, YearAgg>()
  const boardAgg = new Map<string, YearAgg>()
  const eventClaimByEvent = new Map<string, Claim>()
  const eventYear = new Map<string, number>()
  const riderAgg = new Map<string, YearAgg & { moments: number }>()

  for (const c of claims) {
    if (!c.object_id) continue
    if (c.object_type === "place" && (c.predicate === "rode_at" || c.predicate === "worked_at")) {
      const a = placeAgg.get(c.object_id) ?? { years: [], ongoing: false }
      pushSpan(a, c.start_date, c.end_date)
      placeAgg.set(c.object_id, a)
    } else if (c.object_type === "board" && c.predicate === "owned_board") {
      const a = boardAgg.get(c.object_id) ?? { years: [], ongoing: false }
      pushSpan(a, c.start_date, c.end_date)
      boardAgg.set(c.object_id, a)
    } else if (c.object_type === "event" && EVENT_PREDICATES.has(c.predicate)) {
      if (!eventClaimByEvent.has(c.object_id)) eventClaimByEvent.set(c.object_id, c)
      const y = yearOf(c.start_date); if (y !== null) eventYear.set(c.object_id, y)
    } else if (c.object_type === "person" && c.predicate === "rode_with") {
      const a = riderAgg.get(c.object_id) ?? { years: [], ongoing: false, moments: 0 }
      pushSpan(a, c.start_date, c.end_date)
      a.moments += 1
      riderAgg.set(c.object_id, a)
    }
  }
  // Tagged-in stories count as shared moments with each co-tagged rider.
  for (const s of stories) {
    for (const rid of s.rider_ids ?? []) {
      const a = riderAgg.get(rid) ?? { years: [], ongoing: false, moments: 0 }
      a.moments += 1
      riderAgg.set(rid, a)
    }
  }

  // First story photo per linked place / event (thumbnail priority tier 2).
  const placePhoto = new Map<string, string>()
  const eventPhoto = new Map<string, string>()
  for (const s of stories) {
    const url = firstPhotoUrl(s)
    if (!url) continue
    const pIds = [s.linked_place_id, ...(s.community_places ?? []).map((cp) => cp.place_id)]
    for (const pid of pIds) if (pid && !placePhoto.has(pid)) placePhoto.set(pid, url)
    const eIds = [s.linked_event_id, ...(s.community_events ?? []).map((ce) => ce.event_id)]
    for (const eid of eIds) if (eid && !eventPhoto.has(eid)) eventPhoto.set(eid, url)
  }

  // ── Category summary builders (count + era + top items). Counts come straight
  // from the visibility-safe claim/story set, so they match the public surface.
  function eventLabel(c: Claim | undefined): string | null {
    if (!c) return null
    const role = PREDICATE_RESULT_LABEL[c.predicate] ?? null
    return joinMeta([role, c.division, c.result])
  }

  function buildSummary(key: PublicStackCategoryKey): { count: number; era: string | null; items: ResolvedStackSummaryItem[] } {
    if (key === "places") {
      const ids = [...placeAgg.keys()].filter((id) => entities.places[id])
      const allYears: number[] = []; let ongoing = false
      for (const id of ids) { const a = placeAgg.get(id)!; allYears.push(...a.years); ongoing = ongoing || a.ongoing }
      const items = ids
        .map((id) => ({ id, name: entities.places[id].name, agg: placeAgg.get(id)! }))
        .sort((x, y) => (Math.min(...x.agg.years, Infinity)) - (Math.min(...y.agg.years, Infinity)))
        .slice(0, 7)
        .map((x) => ({ id: x.id, name: x.name, meta: eraLabel(x.agg.years, x.agg.ongoing) }))
      return { count: ids.length, era: eraLabel(allYears, ongoing), items }
    }
    if (key === "boards") {
      const ids = [...boardAgg.keys()].filter((id) => entities.boards[id])
      const allYears: number[] = []; let ongoing = false
      for (const id of ids) { const a = boardAgg.get(id)!; allYears.push(...a.years); ongoing = ongoing || a.ongoing }
      const items = ids
        .map((id) => { const b = entities.boards[id]; return { id, name: `${b.brand} ${b.model}`, year: b.model_year } })
        .sort((x, y) => (y.year ?? 0) - (x.year ?? 0))
        .slice(0, 7)
        .map((x) => ({ id: x.id, name: x.name, meta: x.year ? String(x.year) : null }))
      return { count: ids.length, era: eraLabel(allYears, ongoing), items }
    }
    if (key === "events") {
      const ids = [...eventClaimByEvent.keys()].filter((id) => entities.events[id])
      const years = ids.map((id) => eventYear.get(id)).filter((y): y is number => y != null)
      const items = ids
        .map((id) => ({ id, name: entities.events[id].name, year: eventYear.get(id) ?? entities.events[id].year ?? null }))
        .sort((x, y) => (x.year ?? 0) - (y.year ?? 0))
        .slice(0, 7)
        .map((x) => ({ id: x.id, name: x.name, meta: x.year ? String(x.year) : null }))
      return { count: ids.length, era: eraLabel(years, false), items }
    }
    if (key === "riders") {
      const ids = [...riderAgg.keys()].filter((id) => entities.people[id])
      const allYears: number[] = []; let ongoing = false
      for (const id of ids) { const a = riderAgg.get(id)!; allYears.push(...a.years); ongoing = ongoing || a.ongoing }
      const items = ids
        .map((id) => ({ id, name: entities.people[id].display_name, agg: riderAgg.get(id)! }))
        .sort((x, y) => y.agg.moments - x.agg.moments)
        .slice(0, 7)
        .map((x) => ({
          id: x.id, name: x.name,
          meta: eraLabel(x.agg.years, x.agg.ongoing) ?? `${x.agg.moments} shared moment${x.agg.moments === 1 ? "" : "s"}`,
        }))
      return { count: ids.length, era: eraLabel(allYears, ongoing), items }
    }
    // stories
    const yrs = stories.map((s) => yearOf(s.story_date)).filter((y): y is number => y != null)
    const items = stories.slice(0, 7).map((s) => ({
      id: s.id, name: s.title || (s.body ?? "").slice(0, 48) || "Untitled story",
      meta: yearOf(s.story_date) ? String(yearOf(s.story_date)) : null,
    }))
    return { count: stories.length, era: eraLabel(yrs, false), items }
  }

  // ── Resolve each curated row. A null result drops the row (gone-private etc.).
  function resolveRow(row: PublicStackEntry): ResolvedStackEntry | null {
    const base = { id: row.id, position: row.position, refId: row.entry_ref_id ?? null }

    if (row.entry_type === "category_summary") {
      if (!row.category_key) return null
      const { count, era, items } = buildSummary(row.category_key)
      if (count === 0) return null  // nothing to summarise → drop
      const noun = row.category_key
      const title = row.custom_title ?? defaultSummaryTitle(noun, count)
      return {
        ...base, entry_type: "category_summary", href: null, accent: CATEGORY_ACCENT[noun],
        kicker: CATEGORY_KICKER[noun], kickerMeta: era,
        title, summary: row.custom_summary ?? null,
        thumbPhotoUrl: null, thumbEntity: null, thumbName: "", thumbYear: null, board: null,
        categoryKey: noun, count, items,
      }
    }

    const ref = row.entry_ref_id
    if (!ref) return null
    const accent = ACCENT_BY_TYPE[row.entry_type]

    if (row.entry_type === "story") {
      const story = storiesById.get(ref)
      if (!story) return null
      const linkedPlace = story.linked_place_id ? entities.places[story.linked_place_id] : undefined
      const linkedImg =
        (story.linked_place_id && entities.places[story.linked_place_id]?.image_url) ||
        (story.linked_event_id && entities.events[story.linked_event_id]?.image_url) ||
        (story.board_ids ?? []).map((b) => entities.boards[b]?.image_url).find(Boolean) || null
      return {
        ...base, entry_type: "story", href: null, accent: "violet", kicker: "Story",
        kickerMeta: joinMeta([yearOf(story.story_date)?.toString(), linkedPlace?.name]),
        title: row.custom_title ?? story.title ?? (story.body ?? "").split("\n")[0].slice(0, 80) ?? "Story",
        summary: row.custom_summary ?? story.body ?? null,
        thumbPhotoUrl: firstPhotoUrl(story) ?? linkedImg, thumbEntity: null, thumbName: "", thumbYear: null, board: null,
        categoryKey: null, count: null, items: [],
      }
    }

    if (row.entry_type === "place") {
      const place = entities.places[ref]
      if (!place) return null
      const agg = placeAgg.get(ref)
      return {
        ...base, entry_type: "place", accent, kicker: "Place",
        href: stackHref("place", ref, place),
        kickerMeta: joinMeta([agg ? eraLabel(agg.years, agg.ongoing) : null, joinMeta([place.region, place.country])]),
        title: row.custom_title ?? place.name,
        summary: row.custom_summary ?? null,
        thumbPhotoUrl: place.image_url ?? placePhoto.get(ref) ?? null,
        thumbEntity: "place", thumbName: place.name, thumbYear: null, board: null,
        categoryKey: null, count: null, items: [],
      }
    }

    if (row.entry_type === "event") {
      const event = entities.events[ref]
      if (!event) return null
      const yr = eventYear.get(ref) ?? event.year ?? yearOf(event.start_date)
      return {
        ...base, entry_type: "event", accent, kicker: "Event",
        href: stackHref("event", ref, event),
        kickerMeta: joinMeta([yr?.toString(), event.event_type?.replace(/-/g, " ")]),
        title: row.custom_title ?? event.name,
        summary: row.custom_summary ?? eventLabel(eventClaimByEvent.get(ref)),
        thumbPhotoUrl: event.image_url ?? eventPhoto.get(ref) ?? null,
        thumbEntity: "event", thumbName: event.name, thumbYear: yr ?? null, board: null,
        categoryKey: null, count: null, items: [],
      }
    }

    if (row.entry_type === "board") {
      const board = entities.boards[ref]
      if (!board) return null
      const agg = boardAgg.get(ref)
      const yearLbl = board.model_year ? `'${String(board.model_year).slice(2)}` : null
      return {
        ...base, entry_type: "board", accent, kicker: "Board",
        href: stackHref("board", ref, board),
        kickerMeta: joinMeta([board.model_year?.toString(), board.shape?.replace(/-/g, " ")]),
        title: row.custom_title ?? `${board.brand} ${board.model}`,
        summary: row.custom_summary ?? joinMeta([yearLbl, agg ? eraLabel(agg.years, agg.ongoing) : null]),
        thumbPhotoUrl: board.image_url ?? null,
        thumbEntity: "board", thumbName: `${board.brand} ${board.model}`, thumbYear: null,
        board: { brand: board.brand, model: board.model, year: board.model_year ?? null },
        categoryKey: null, count: null, items: [],
      }
    }

    // rider
    const person = entities.people[ref]
    if (!person) return null
    const agg = riderAgg.get(ref)
    return {
      ...base, entry_type: "rider", accent: "violet", kicker: "Rider",
      href: stackHref("rider", ref, null),
      kickerMeta: joinMeta([
        agg ? eraLabel(agg.years, agg.ongoing) : null,
        agg && agg.moments > 0 ? `${agg.moments} shared moment${agg.moments === 1 ? "" : "s"}` : null,
      ]),
      title: row.custom_title ?? `Rode with ${person.display_name}`,
      summary: row.custom_summary ?? null,
      thumbPhotoUrl: person.avatar_url ?? null,
      thumbEntity: "person", thumbName: person.display_name, thumbYear: null, board: null,
      categoryKey: null, count: null, items: [],
    }
  }

  const entries = rows.map(resolveRow).filter((e): e is ResolvedStackEntry => e !== null)
  return { owner, entries }
}

/** Human label for a category_summary card title, e.g. "Rode at 12 places". */
function defaultSummaryTitle(key: PublicStackCategoryKey, count: number): string {
  switch (key) {
    case "places": return `Rode at ${count} place${count === 1 ? "" : "s"}`
    case "boards": return `${count} board${count === 1 ? "" : "s"}`
    case "events": return `${count} event${count === 1 ? "" : "s"}`
    case "riders": return `Rode with ${count} rider${count === 1 ? "" : "s"}`
    case "stories": return `${count} stor${count === 1 ? "y" : "ies"} told`
  }
}

/** Short role label for an event claim's summary line. */
const PREDICATE_RESULT_LABEL: Partial<Record<Predicate, string>> = {
  competed_at: "Competed",
  spectated_at: "Spectated",
  organized_at: "Organized",
  organized: "Organized",
}

// ════════════════════════════════════════════════════════════════════════════
// FNRad Featured Timelines Phase 2: event-owner (episode) curated stack read
//
// An episode (Event) owns a curated stack the same way a profile does, but it
// has NO owner claim set, so this path is isolated from the profile resolver
// above (zero regression risk): it resolves the curated entries directly against
// the catalog and the referenced public stories. The same store-free StackView /
// StackEntryCard render the result. Category-summary entries have no meaning for
// an episode (no claim set to summarize) and are dropped.
// ════════════════════════════════════════════════════════════════════════════

// NOTE: the events table has no `image_url` column (event photos live in
// event_image_votes), so it is intentionally absent here — selecting it 404s the
// whole read.
const EVENT_STACK_COLS =
  "id, name, description, event_type, year, start_date, episode_number, media_url, show_org_id, public_slug, public_enabled, publish_at"

type EventStackRow = {
  id: string
  name: string | null
  description: string | null
  event_type: string | null
  year: number | null
  start_date: string | null
  episode_number: number | null
  media_url: string | null
  show_org_id: string | null
  public_slug: string | null
  public_enabled: boolean | null
  publish_at: string | null
}

/**
 * Session C scheduled release: an episode is LIVE to the public when it is
 * enabled AND its scheduled time has passed (null = publish immediately, the
 * pre-Session-C behavior). Evaluated on every read, so a scheduled page goes
 * live on its own with no cron, no queue, and no deploy. Editors bypass this
 * entirely via the /t/[slug] preview branch.
 *
 * An unparseable publish_at is treated as "not yet", which fails closed.
 */
export function isEpisodeLive(
  row: { public_enabled?: boolean | null; publish_at?: string | null },
  now: number = Date.now(),
): boolean {
  if (row.public_enabled !== true) return false
  if (!row.publish_at) return true
  const at = Date.parse(row.publish_at)
  return Number.isFinite(at) && at <= now
}

export interface PublicEpisodeShow {
  id: string
  name: string
  /** Public slug when the show has published its own chromeless page (Phase 3). */
  slug: string | null
}

export interface PublicEpisodeMeta {
  episode_number: number | null
  media_url: string | null
  date: string | null
  show: PublicEpisodeShow | null
  guests: PublicPersonLite[]
  /** Session C: the raw publish gate, so the editor preview can tell a
   *  never-published page from a scheduled one. */
  public_enabled: boolean
  publish_at: string | null
  /** Session C: the in-app episode page, resolved here so the chromeless view
   *  does not have to pull the slug helpers (and the mock catalog behind them)
   *  into the public bundle. Bare /events/... 301s to the active community. */
  in_app_path: string
}

/** Session C: one published mention, fully resolved server-side so the
 *  chromeless (store-free) public page can render it without the catalog. */
export interface PublicMention {
  id: string
  subject_type: MentionSubjectType
  subject_id: string
  /** Resolved display name, falling back to the raw id when unresolvable. */
  subject_name: string
  timestamp_seconds: number | null
  excerpt: string | null
  story_title: string | null
}

export interface PublicEpisodePayload {
  owner: PublicTimelineOwner
  meta: PublicEpisodeMeta
  entries: ResolvedStackEntry[]
  /** Carried so the story stack cards can expand to the rich story in StackView. */
  stories: Story[]
  entities: PublicTimelineEntities
  /** Session C: published mentions on this episode, timestamp order. */
  mentions: PublicMention[]
  /** Session C: public stories that link or tag this episode, newest first,
   *  capped, resolved as story cards. Curated-stack stories are excluded (they
   *  already render above). */
  linkedEntries: ResolvedStackEntry[]
  linkedStories: Story[]
  /** Total matching linked stories before the cap, so the view can offer
   *  "See all on the episode". */
  linkedTotal: number
}

/** Map an episode event row to the shared owner header shape (display_name =
 *  episode title, era = its year, avatar = its image). */
function eventOwnerHeader(row: EventStackRow): PublicTimelineOwner {
  return {
    id: row.id,
    display_name: row.name ?? "Episode",
    slug: row.public_slug ?? row.id,
    avatar_url: null,
    bio: row.description ?? null,
    region: null,
    country: null,
    riding_since: null,
    era_start: row.year ?? yearOf(row.start_date),
    membership_tier: null,
  }
}

/** Resolve one story into a stack story card. Shared by the curated resolver
 *  and the Session C auto-surfaced linked-stories list, so a curated story and
 *  a linked story can never render as two different-looking cards. */
function storyStackEntry(
  story: Story,
  entities: PublicTimelineEntities,
  opts: { id: string; position: number; customTitle?: string | null; customSummary?: string | null },
): ResolvedStackEntry {
  const linkedPlace = story.linked_place_id ? entities.places[story.linked_place_id] : undefined
  const linkedImg =
    (story.linked_place_id && entities.places[story.linked_place_id]?.image_url) ||
    (story.linked_event_id && entities.events[story.linked_event_id]?.image_url) ||
    (story.board_ids ?? []).map((b) => entities.boards[b]?.image_url).find(Boolean) || null
  return {
    id: opts.id, position: opts.position, refId: story.id,
    entry_type: "story", href: null, accent: "violet", kicker: "Story",
    kickerMeta: joinMeta([yearOf(story.story_date)?.toString(), linkedPlace?.name]),
    title: opts.customTitle ?? story.title ?? (story.body ?? "").split("\n")[0].slice(0, 80) ?? "Story",
    summary: opts.customSummary ?? story.body ?? null,
    thumbPhotoUrl: firstPhotoUrl(story) ?? linkedImg, thumbEntity: null, thumbName: "", thumbYear: null, board: null,
    categoryKey: null, count: null, items: [],
  }
}

// Resolve one curated row for a non-profile owner (episode or show). Generic:
// the row resolves against the catalog/story entities the same way regardless of
// owner. Category summaries summarize an owner CLAIM set, which neither an
// episode nor a show has, so they are dropped.
/**
 * In-app path for a featured card, resolved server-side because StackView is
 * store-free and cannot reach the catalog to build one.
 *
 * Person links use the raw id rather than a name slug: the collision rule needs
 * the whole people catalog to know whether a name is unique, which this context
 * does not hold, and /people/[id] accepts both and canonicalizes the URL to the
 * slug on load anyway.
 */
function stackHref(
  type: PublicStackEntryType,
  ref: string,
  entity: { name?: string; brand?: string; model?: string } | null,
): string | null {
  if (type === "place") return `/places/${(entity && entity.name ? placeSlug({ name: entity.name } as never) : "") || ref}`
  if (type === "event") return `/events/${(entity && entity.name ? eventSlug({ name: entity.name }) : "") || ref}`
  if (type === "board") {
    const slug = entity && entity.brand && entity.model
      ? boardSlug({ brand: entity.brand, model: entity.model } as never)
      : ""
    return `/boards/${slug || ref}`
  }
  if (type === "rider") return `/people/${ref}`
  return null
}

function resolveCuratedRow(
  row: PublicStackEntry,
  entities: PublicTimelineEntities,
  storiesById: Map<string, Story>,
): ResolvedStackEntry | null {
  const base = { id: row.id, position: row.position, refId: row.entry_ref_id ?? null }

  if (row.entry_type === "category_summary") return null

  const ref = row.entry_ref_id
  if (!ref) return null
  const accent = ACCENT_BY_TYPE[row.entry_type]

  if (row.entry_type === "story") {
    const story = storiesById.get(ref)
    if (!story) return null
    return storyStackEntry(story, entities, {
      id: row.id, position: row.position,
      customTitle: row.custom_title, customSummary: row.custom_summary,
    })
  }

  if (row.entry_type === "place") {
    const place = entities.places[ref]
    if (!place) return null
    return {
      ...base, entry_type: "place", accent, kicker: "Place",
      href: stackHref("place", ref, place),
      kickerMeta: joinMeta([place.region, place.country]),
      title: row.custom_title ?? place.name, summary: row.custom_summary ?? null,
      thumbPhotoUrl: place.image_url ?? null, thumbEntity: "place", thumbName: place.name, thumbYear: null, board: null,
      categoryKey: null, count: null, items: [],
    }
  }

  if (row.entry_type === "event") {
    const event = entities.events[ref]
    if (!event) return null
    const yr = event.year ?? yearOf(event.start_date)
    return {
      ...base, entry_type: "event", accent, kicker: "Event",
      href: stackHref("event", ref, event),
      kickerMeta: joinMeta([yr?.toString(), event.event_type?.replace(/-/g, " ")]),
      title: row.custom_title ?? event.name, summary: row.custom_summary ?? null,
      thumbPhotoUrl: event.image_url ?? null, thumbEntity: "event", thumbName: event.name, thumbYear: yr ?? null, board: null,
      categoryKey: null, count: null, items: [],
    }
  }

  if (row.entry_type === "board") {
    const board = entities.boards[ref]
    if (!board) return null
    return {
      ...base, entry_type: "board", accent, kicker: "Board",
      href: stackHref("board", ref, board),
      kickerMeta: joinMeta([board.model_year?.toString(), board.shape?.replace(/-/g, " ")]),
      title: row.custom_title ?? `${board.brand} ${board.model}`, summary: row.custom_summary ?? null,
      thumbPhotoUrl: board.image_url ?? null, thumbEntity: "board",
      thumbName: `${board.brand} ${board.model}`, thumbYear: null,
      board: { brand: board.brand, model: board.model, year: board.model_year ?? null },
      categoryKey: null, count: null, items: [],
    }
  }

  // rider — on an episode/show a featured rider is a guest/mention, so the card
  // leads with the name (not the profile's "Rode with X").
  const person = entities.people[ref]
  if (!person) return null
  return {
    ...base, entry_type: "rider", accent: "violet", kicker: "Rider", kickerMeta: null,
    href: stackHref("rider", ref, null),
    title: row.custom_title ?? person.display_name, summary: row.custom_summary ?? null,
    thumbPhotoUrl: person.avatar_url ?? null, thumbEntity: "person",
    thumbName: person.display_name, thumbYear: null, board: null,
    categoryKey: null, count: null, items: [],
  }
}

/** Load + resolve a non-profile owner's curated stack: the rows, their resolved
 *  cards, and the referenced stories + entities (so StackView can expand story
 *  cards). `extra.seed` folds in ids the surrounding page needs resolved (an
 *  episode's guests, its published mention subjects) and `extra.stories` folds
 *  in stories read elsewhere (the Session C linked-stories list) so the whole
 *  page still costs ONE entity resolution. Shared by the event (episode) and
 *  org (show) reads. */
async function loadOwnerStack(
  db: ReturnType<typeof getServiceClient>,
  ownerType: "event" | "org",
  ownerId: string,
  extra: {
    seed?: { person?: string[]; place?: string[]; event?: string[]; org?: string[]; board?: string[] }
    stories?: Story[]
  } = {},
): Promise<{ entries: ResolvedStackEntry[]; stories: Story[]; entities: PublicTimelineEntities }> {
  const { data: rowData } = await db
    .from("public_stack_entries")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("position", { ascending: true })
  const rows = (rowData ?? []) as PublicStackEntry[]

  const seed = {
    person: [...(extra.seed?.person ?? [])],
    place: [...(extra.seed?.place ?? [])],
    event: [...(extra.seed?.event ?? [])],
    org: [...(extra.seed?.org ?? [])],
    board: [...(extra.seed?.board ?? [])],
  }
  const storyIds: string[] = []
  for (const r of rows) {
    if (!r.entry_ref_id) continue
    if (r.entry_type === "rider") seed.person.push(r.entry_ref_id)
    else if (r.entry_type === "place") seed.place.push(r.entry_ref_id)
    else if (r.entry_type === "event") seed.event.push(r.entry_ref_id)
    else if (r.entry_type === "board") seed.board.push(r.entry_ref_id)
    else if (r.entry_type === "story") storyIds.push(r.entry_ref_id)
  }

  const stories = await readStoriesByIds(db, storyIds)
  const entities = await resolveEntities(db, [], [...stories, ...(extra.stories ?? [])], seed)
  const storiesById = new Map(stories.map((s) => [s.id, s]))
  const entries = rows
    .map((r) => resolveCuratedRow(r, entities, storiesById))
    .filter((e): e is ResolvedStackEntry => e !== null)

  return { entries, stories, entities }
}

/** Session C default cap on the auto-surfaced linked-stories list. */
const EPISODE_LINKED_STORY_CAP = 12

/**
 * Every PUBLIC story that links or tags an episode, newest first.
 *
 * Mirrors the `event_id` union in GET /api/stories (singular `linked_event_id`
 * plus the `story_events` junction the Story Connections flow writes) rather
 * than calling that route: the /t/ read path is a server component on the
 * service client and never goes back out over HTTP. Two queries merged by id,
 * exactly like readOwnerStories, so a story that is both linked and tagged
 * appears once.
 */
async function readEventLinkedStories(
  db: ReturnType<typeof getServiceClient>,
  eventId: string,
): Promise<Story[]> {
  const { data: junctionRows } = await db
    .from("story_events")
    .select("story_id")
    .eq("event_id", eventId)
  const taggedIds = Array.from(
    new Set(((junctionRows ?? []) as { story_id: string }[]).map((r) => r.story_id)),
  )

  const linkedP = db
    .from("stories")
    .select(STORY_JOIN)
    .eq("visibility", "public")
    .eq("linked_event_id", eventId)

  const taggedP = taggedIds.length
    ? db.from("stories").select(STORY_JOIN).eq("visibility", "public").in("id", taggedIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] })

  const [linkedRes, taggedRes] = await Promise.all([linkedP, taggedP])

  const byId = new Map<string, Record<string, unknown>>()
  for (const s of (linkedRes.data ?? []) as Record<string, unknown>[]) byId.set(s.id as string, s)
  for (const s of (taggedRes.data ?? []) as Record<string, unknown>[]) byId.set(s.id as string, s)
  // enrichStories returns newest-first.
  return enrichStories(db, Array.from(byId.values()))
}

/** Resolve an episode's curated stack. Pass `slug` for the public chromeless
 *  page (requires public_enabled), or `eventId` for the in-app episode page
 *  (no enabled gate, since the in-app page is already community-visible).
 *  Returns null when the event is missing, or disabled in slug+requireEnabled
 *  mode (caller 404s). */
export async function readEventStack(
  opts: { slug?: string; eventId?: string; requireEnabled?: boolean },
): Promise<PublicEpisodePayload | null> {
  const db = getServiceClient()

  let query = db.from("events").select(EVENT_STACK_COLS)
  if (opts.slug) query = query.eq("public_slug", opts.slug)
  else if (opts.eventId) query = query.eq("id", opts.eventId)
  else return null
  const { data } = await query.maybeSingle()
  const event = data as EventStackRow | null
  if (!event) return null
  // Session C: "enabled" now also means "scheduled time has passed". A page
  // waiting on its publish_at is invisible to the public read; the /t/[slug]
  // editor-preview branch re-reads without requireEnabled, so editors still see
  // it (banner-marked).
  if (opts.requireEnabled && !isEpisodeLive(event)) return null

  // Guests seed the header (and the shared entity resolution) before the stack.
  const { data: guestRows } = await db
    .from("event_guests")
    .select("person_id, position")
    .eq("event_id", event.id)
    .order("position", { ascending: true })
  const guestIds = ((guestRows ?? []) as { person_id: string }[]).map((g) => g.person_id)

  // Session C: published mentions + auto-surfaced linked stories, read before
  // the stack so their subjects and entities fold into the one resolution pass.
  const [mentionRows, allLinked] = await Promise.all([
    readPublishedMentions(event.id),
    readEventLinkedStories(db, event.id),
  ])

  const mentionSeed = { person: [] as string[], place: [] as string[], event: [] as string[], org: [] as string[], board: [] as string[] }
  for (const m of mentionRows) {
    const bucket = mentionSeed[m.subject_type as keyof typeof mentionSeed]
    if (bucket) bucket.push(m.subject_id)
  }

  const { entries, stories, entities } = await loadOwnerStack(db, "event", event.id, {
    seed: {
      person: [...guestIds, ...mentionSeed.person],
      place: mentionSeed.place,
      event: mentionSeed.event,
      org: mentionSeed.org,
      board: mentionSeed.board,
    },
    stories: allLinked,
  })

  // A story already featured in the curated stack does not repeat below it.
  const curatedStoryIds = new Set(
    entries.filter((e) => e.entry_type === "story" && e.refId).map((e) => e.refId as string),
  )
  const linkedAll = allLinked.filter((s) => !curatedStoryIds.has(s.id))
  const linkedStories = linkedAll.slice(0, EPISODE_LINKED_STORY_CAP)
  const linkedEntries = linkedStories.map((s, i) =>
    storyStackEntry(s, entities, { id: `linked-${s.id}`, position: i }),
  )

  const mentions: PublicMention[] = mentionRows.map((m) => ({
    id: m.id,
    subject_type: m.subject_type,
    subject_id: m.subject_id,
    subject_name: mentionSubjectName(m.subject_type, m.subject_id, entities),
    timestamp_seconds: m.timestamp_seconds ?? null,
    excerpt: m.excerpt ?? null,
    story_title: m.story_title ?? null,
  }))

  // Show header (Phase 3 gives the show its own public page; until then slug is
  // whatever the org has, possibly null).
  let show: PublicEpisodeShow | null = null
  if (event.show_org_id) {
    const { data: orgRow } = await db
      .from("orgs")
      .select("id, name, public_slug")
      .eq("id", event.show_org_id)
      .maybeSingle()
    const o = orgRow as { id: string; name: string | null; public_slug: string | null } | null
    if (o) show = { id: o.id, name: o.name ?? "Show", slug: o.public_slug ?? null }
  }

  const guests = guestIds
    .map((id) => entities.people[id])
    .filter((p): p is PublicPersonLite => !!p)

  return {
    owner: eventOwnerHeader(event),
    meta: {
      episode_number: event.episode_number ?? null,
      media_url: event.media_url ?? null,
      date: event.start_date ?? null,
      show,
      guests,
      public_enabled: event.public_enabled === true,
      publish_at: event.publish_at ?? null,
      in_app_path: `/events/${eventSlug({ name: event.name ?? "" }) || event.id}`,
    },
    entries,
    stories,
    entities,
    mentions,
    linkedEntries,
    linkedStories,
    linkedTotal: linkedAll.length,
  }
}

/** Display name for a mention subject, resolved from the already-loaded public
 *  entities so the chromeless page needs no client catalog. Falls back to the
 *  raw id, which is what the in-app row does too. */
function mentionSubjectName(
  type: MentionSubjectType,
  id: string,
  entities: PublicTimelineEntities,
): string {
  if (type === "person") return entities.people[id]?.display_name ?? id
  if (type === "place") return entities.places[id]?.name ?? id
  if (type === "event") return entities.events[id]?.name ?? id
  if (type === "org") return entities.orgs[id]?.name ?? id
  const board = entities.boards[id]
  return board ? [board.brand, board.model].filter(Boolean).join(" ") || id : id
}

/** Owner-only header for the episode OG image (no stack resolution). */
export async function readEventOwner(slug: string): Promise<PublicTimelineOwner | null> {
  if (!slug) return null
  const db = getServiceClient()
  const { data } = await db
    .from("events")
    .select(EVENT_STACK_COLS)
    .eq("public_slug", slug)
    .maybeSingle()
  const event = data as EventStackRow | null
  if (!event || !isEpisodeLive(event)) return null
  return eventOwnerHeader(event)
}

// ════════════════════════════════════════════════════════════════════════════
// FNRad Featured Timelines Phase 3: org-owner (media show) curated canon read
//
// A media show (org with org_type='media') owns a curated "canon" stack the same
// way an episode does, plus an episode list (every event with show_org_id = the
// org). Reuses loadOwnerStack; the org header + episode list are the only extras.
// ════════════════════════════════════════════════════════════════════════════

// NOTE: the orgs table has no `region` column (region lives on profiles/places
// only), so it is intentionally absent here — selecting it 404s the whole read.
const ORG_STACK_COLS =
  "id, name, org_type, description, logo_url, founded_year, country, public_slug, public_enabled"

type OrgStackRow = {
  id: string
  name: string | null
  org_type: string | null
  description: string | null
  logo_url: string | null
  founded_year: number | null
  country: string | null
  public_slug: string | null
  public_enabled: boolean | null
}

/** One episode in a show's episode list. `slug` is non-null only when the
 *  episode has published its own public page (so the public show page links only
 *  to published episodes). */
export interface PublicShowEpisode {
  id: string
  title: string
  episode_number: number | null
  year: number | null
  slug: string | null
  public_enabled: boolean
  /** Session C: enabled AND past its publish_at. The public show page lists only
   *  live episodes, so a scheduled one stays hidden until its time. */
  live: boolean
}

export interface PublicShowPayload {
  owner: PublicTimelineOwner
  entries: ResolvedStackEntry[]
  episodes: PublicShowEpisode[]
  stories: Story[]
  entities: PublicTimelineEntities
}

function orgOwnerHeader(row: OrgStackRow): PublicTimelineOwner {
  return {
    id: row.id,
    display_name: row.name ?? "Show",
    slug: row.public_slug ?? row.id,
    avatar_url: row.logo_url ?? null,
    bio: row.description ?? null,
    region: null,
    country: row.country ?? null,
    riding_since: null,
    era_start: row.founded_year ?? null,
    membership_tier: null,
  }
}

/** Resolve a show's curated canon + episode list. Pass `slug` for the public
 *  chromeless page (requires public_enabled), or `orgId` for the in-app hub
 *  (no enabled gate). Returns null when the org is missing, or disabled in
 *  slug+requireEnabled mode (caller 404s). */
export async function readOrgStack(
  opts: { slug?: string; orgId?: string; requireEnabled?: boolean },
): Promise<PublicShowPayload | null> {
  const db = getServiceClient()

  let query = db.from("orgs").select(ORG_STACK_COLS)
  if (opts.slug) query = query.eq("public_slug", opts.slug)
  else if (opts.orgId) query = query.eq("id", opts.orgId)
  else return null
  const { data } = await query.maybeSingle()
  const org = data as OrgStackRow | null
  if (!org) return null
  if (opts.requireEnabled && org.public_enabled !== true) return null

  const { entries, stories, entities } = await loadOwnerStack(db, "org", org.id)

  // Episode list: every event linked to this show, newest first.
  const { data: epRows } = await db
    .from("events")
    .select("id, name, episode_number, year, start_date, public_slug, public_enabled, publish_at")
    .eq("show_org_id", org.id)
  const episodes: PublicShowEpisode[] = ((epRows ?? []) as {
    id: string; name: string | null; episode_number: number | null
    year: number | null; start_date: string | null; public_slug: string | null
    public_enabled: boolean | null; publish_at: string | null
  }[])
    .map((e) => ({
      id: e.id,
      title: e.name ?? "Episode",
      episode_number: e.episode_number ?? null,
      year: e.year ?? yearOf(e.start_date),
      slug: e.public_slug ?? null,
      public_enabled: e.public_enabled === true,
      live: isEpisodeLive(e),
    }))
    .sort((a, b) => {
      // Newest first: episode_number desc when both present, else year desc.
      if (a.episode_number != null && b.episode_number != null) return b.episode_number - a.episode_number
      return (b.year ?? 0) - (a.year ?? 0)
    })

  // Session C: on the PUBLIC read, drop everything that is not live. The view
  // already filters what it renders, but the payload is serialized into the
  // page, so an unfiltered list would leak the titles of unpublished and
  // scheduled episodes to anyone reading the source. A scheduled episode has to
  // be genuinely absent before its time, not just unlinked. The in-app read
  // (orgId, no requireEnabled) keeps the full list for editors.
  const visibleEpisodes = opts.requireEnabled ? episodes.filter((e) => e.live) : episodes

  return { owner: orgOwnerHeader(org), entries, episodes: visibleEpisodes, stories, entities }
}

/** Owner-only header for the show OG image (no stack resolution). */
export async function readOrgOwner(slug: string): Promise<PublicTimelineOwner | null> {
  if (!slug) return null
  const db = getServiceClient()
  const { data } = await db
    .from("orgs")
    .select(ORG_STACK_COLS)
    .eq("public_slug", slug)
    .maybeSingle()
  const org = data as OrgStackRow | null
  if (!org || org.public_enabled !== true) return null
  return orgOwnerHeader(org)
}
