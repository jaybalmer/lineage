// Core entity types for Lineage

export type PrivacyLevel = "private" | "shared" | "public"
export type ConfidenceLevel = "self-reported" | "corroborated" | "documented" | "partner-verified"
export type CommunityStatus = "verified" | "unverified"
export type PlaceType = "resort" | "shop" | "zone" | "city" | "venue"
export type OrgType = "brand" | "shop" | "team" | "magazine" | "event-series"
export type EventType = "contest" | "film-shoot" | "trip" | "camp" | "gathering"
export type Predicate =
  | "rode_at"
  | "worked_at"
  | "sponsored_by"
  | "part_of_team"
  | "fan_of"
  | "rode_with"
  | "shot_by"
  | "competed_at"
  | "spectated_at"
  | "organized_at"
  | "owned_board"
  | "coached_by"
  | "organized"
  | "located_at"

export interface Person {
  id: string
  display_name: string
  birth_year?: number
  riding_since?: number
  privacy_level: PrivacyLevel
  wikidata_qid?: string
  bio?: string
  avatar_url?: string
  home_resort_id?: string
  is_current_user?: boolean
  community_status?: CommunityStatus
  added_by?: string
}

export interface Place {
  id: string
  name: string
  place_type: PlaceType
  osm_id?: string
  wikidata_qid?: string
  region?: string
  country?: string
  lat?: number
  lon?: number
  website?: string
  image_url?: string
  description?: string
  first_snowboard_year?: number
  community_status?: CommunityStatus
  added_by?: string
}

export type BrandCategory = "board_brand" | "outerwear" | "bindings" | "boots" | "retailer" | "media" | "other"

export interface Org {
  id: string
  name: string
  org_type: OrgType
  brand_category?: BrandCategory
  description?: string
  wikidata_qid?: string
  founded_year?: number
  country?: string
  region?: string
  website?: string
  logo_url?: string
  community_status?: CommunityStatus
  added_by?: string
}

export interface Board {
  id: string
  brand: string
  model: string
  model_year: number
  external_ref?: string
  shape?: string
  image_url?: string
  community_status?: CommunityStatus
  added_by?: string
}

export interface EventSeries {
  id: string
  name: string
  place_id?: string
  frequency: "annual" | "tour" | "irregular"
  start_year?: number
  end_year?: number
  description?: string
}

export interface Event {
  id: string
  name: string
  start_date: string
  end_date?: string
  event_type: EventType
  place_id?: string
  series_id?: string   // FK → EventSeries
  year?: number        // numeric year for quick lookups
  external_ref?: string
  description?: string
  image_url?: string
  community_status?: CommunityStatus
  added_by?: string
}

export type EntityType = "person" | "place" | "org" | "board" | "event"

export interface RidingDay {
  id: string
  date: string           // YYYY-MM-DD
  place_id: string
  rider_ids: string[]    // other people on this day
  note?: string
  visibility: PrivacyLevel
  created_by: string
  created_at: string
}

export interface Source {
  id: string
  source_type: "magazine" | "website" | "photo" | "video" | "user-upload" | "fis-record"
  citation: string
  url?: string
  accessed_at?: string
}

export interface Claim {
  id: string
  subject_id: string
  subject_type: EntityType
  predicate: Predicate
  object_id: string
  object_type: EntityType
  start_date?: string
  end_date?: string
  confidence: ConfidenceLevel
  visibility: PrivacyLevel
  asserted_by: string // user id
  created_at: string
  sources?: Source[]
  note?: string
  approximate?: boolean
}

// ─── Connection Summary ───────────────────────────────────────────────────────

export type OverlapType = "rode_with" | "resort" | "event" | "sponsor" | "board" | "team"

export interface OverlapFact {
  type: OverlapType
  label: string        // "Both rode Whistler"
  detail: string       // "2003–2010"
  score: number
  entityId: string
  entityType: EntityType
}

export interface ConnectionSummary {
  score: number
  strength: "strong" | "medium" | "light" | "none"
  headline: string
  facts: OverlapFact[]   // all facts, sorted by score desc
  bullets: string[]      // human-readable bullet strings (top 7)
  shortCardText: string  // ≤240 chars for social
  longSummaryText: string // ≤600 chars for DMs/email
}

// ─── UI-focused composite types ──────────────────────────────────────────────

export interface TimelineEntry {
  claim: Claim
  object_entity: Person | Place | Org | Board | Event
  object_type: EntityType
}

export interface OnboardingState {
  step: number
  display_name?: string
  birth_year?: number
  home_country?: string
  home_region?: string
  home_city?: string
  start_year?: number
  first_place_id?: string
  first_board_id?: string
  board_ids: string[]
  event_ids: string[]
  early_orgs: string[]
  crew_ids: string[]
  privacy?: "private" | "shared" | "public"
  email?: string
}
