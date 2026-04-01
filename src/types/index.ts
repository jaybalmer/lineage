// Core entity types for Lineage

export type PrivacyLevel = "private" | "shared" | "public"
export type ConfidenceLevel = "self-reported" | "corroborated" | "documented" | "partner-verified"
export type CommunityStatus = "verified" | "unverified"
export type CommunityLaunchStatus = "active" | "coming_soon"

// ─── Community ──────────────────────────────────────────────────────────────

export interface Community {
  id: string
  slug: string
  name: string
  emoji?: string
  status: CommunityLaunchStatus
  sort_order: number
  created_at?: string
}
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

export interface ProfileLink {
  label: string   // e.g. "Instagram", "YouTube", or custom label
  url: string     // full URL
}

export interface Person {
  id: string
  display_name: string
  birth_year?: number
  riding_since?: number
  privacy_level: PrivacyLevel
  wikidata_qid?: string
  bio?: string
  avatar_url?: string
  card_bg_url?: string
  home_resort_id?: string
  city?: string
  region?: string
  country?: string
  is_current_user?: boolean
  community_status?: CommunityStatus
  added_by?: string
  links?: ProfileLink[]
  /** Populated for registered users (profiles table); absent for catalog/mock people */
  membership_tier?: "free" | "annual" | "lifetime" | "founding"
  /** Community slugs this person belongs to (populated from junction table) */
  community_slugs?: string[]
  /** Primary community for this person (profiles table) */
  primary_community_id?: string
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
  /** Community slugs this place belongs to (populated from junction table) */
  community_slugs?: string[]
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
  /** Community slugs this org belongs to (populated from junction table) */
  community_slugs?: string[]
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
  /** Community slugs this board belongs to (populated from junction table) */
  community_slugs?: string[]
}

export interface EventSeries {
  id: string
  name: string
  place_id?: string
  frequency: "annual" | "tour" | "irregular"
  start_year?: number
  end_year?: number
  description?: string
  brand_ids?: string[]
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
  website_url?: string
  youtube_url?: string
  brand_ids?: string[]
  /** Community slugs this event belongs to (populated from junction table) */
  community_slugs?: string[]
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
  // Community scoping — every claim belongs to exactly one community
  community_id?: string
  // Competition-specific fields (competed_at claims only)
  division?: string   // e.g. "Open Men", "Masters", "Boardercross"
  result?: string     // e.g. "1st", "3rd", "DNF", "Top 10"
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

// ─── Membership ───────────────────────────────────────────────────────────────

export type MembershipTier   = "free" | "annual" | "lifetime" | "founding"
export type MembershipStatus = "active" | "expired" | "gifted"

export interface TokenBalance {
  founder:      number
  member:       number
  contribution: number
}

export interface GiftCode {
  code:        string
  status:      "unused" | "redeemed"
  redeemed_by?: string
}

export interface MembershipState {
  tier:                    MembershipTier
  status:                  MembershipStatus
  founding_badge:          boolean
  founding_member_number?: number  // sequential # assigned at purchase (founding tier only)
  token_balance:           TokenBalance
  gift_codes:              GiftCode[]
  stripe_customer_id?:     string
  stripe_subscription_id?: string
  membership_expires_at?:  string // ISO date
  pending_credit:          number // sub-threshold distribution rollover
  member_card_seen_at?:    string // ISO timestamp of first card view (analytics)
  is_editor:               boolean // can access /admin editor — granted to founding members + selected users
}

export interface TriggerPrefs {
  onboarding_banner_shown?:          boolean
  first_connection_cta_shown?:       boolean
  verification_gate_session_shown?:  boolean
  milestone_card_5_dismissed?:       boolean
  milestone_card_20_dismissed?:      boolean
  digest_membership_mentions?:       number
}

// ─── Stories ─────────────────────────────────────────────────────────────────

export interface StoryPhoto {
  id: string
  story_id: string
  url: string
  caption?: string
  sort_order: number
  created_at: string
}

export interface Story {
  id: string
  author_id: string
  title?: string
  body: string
  story_date: string   // YYYY-MM-DD — positions it on the timeline
  visibility: PrivacyLevel
  linked_event_id?: string
  linked_place_id?: string
  linked_org_id?: string
  created_at: string
  updated_at: string
  // Joined relations (populated by API)
  photos?: StoryPhoto[]
  board_ids?: string[]
  rider_ids?: string[]
  // Denormalised author info (joined from profiles)
  author?: { display_name: string; avatar_url?: string }
  youtube_url?: string | null
  url?: string | null
  // Community scoping — every story belongs to exactly one community
  community_id?: string
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
  /** Community IDs selected during onboarding */
  community_ids?: string[]
}
