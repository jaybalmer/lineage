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
import type { Claim, Story } from "@/types"

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
  "id, display_name, avatar_url, bio, region, country, riding_since, public_slug, public_timeline_enabled, public_timeline_default_view"

type ProfileHeaderRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  region: string | null
  country: string | null
  riding_since: number | null
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
  const rows = Array.from(byId.values())
  if (rows.length === 0) return []

  const storyIds = rows.map((s) => s.id as string)

  // rider_ids through the approved-only view; community place/event links from
  // their base junctions (no tag_events on those, so no view needed).
  const [riderRes, cPlaceRes, cEventRes] = await Promise.all([
    db.from("story_riders_public").select("story_id, rider_id").in("story_id", storyIds),
    db.from("story_places").select("story_id, place_id, added_by").in("story_id", storyIds),
    db.from("story_events").select("story_id, event_id, added_by").in("story_id", storyIds),
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

  const stories: Story[] = rows.map((s) => ({
    ...(s as unknown as Story),
    board_ids: ((s.boards as { board_id: string }[]) ?? []).map((b) => b.board_id),
    rider_ids: ridersByStory.get(s.id as string) ?? [],
    community_places: cPlacesByStory.get(s.id as string) ?? [],
    community_events: cEventsByStory.get(s.id as string) ?? [],
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
): Promise<PublicTimelineEntities> {
  const personIds = new Set<string>()
  const placeIds = new Set<string>()
  const eventIds = new Set<string>()
  const orgIds = new Set<string>()
  const boardIds = new Set<string>()

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
    ? db.from("events").select("id, name, event_type, year, start_date, image_url").in("id", ids.event)
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

/** Full payload for the chromeless page + public API. Null = 404 (D4). */
export async function readPublicTimeline(slug: string): Promise<PublicTimelinePayload | null> {
  if (!slug) return null
  const db = getServiceClient()
  const profile = await resolveEnabledProfile(db, slug)
  if (!profile) return null

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
    },
    claims,
    stories,
    entities,
    default_view: profile.public_timeline_default_view ?? null,
  }
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
  }
}
