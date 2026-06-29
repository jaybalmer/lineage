// Core entity types for Linestry

export type PrivacyLevel = "private" | "shared" | "public"
export type ConfidenceLevel = "self-reported" | "corroborated" | "documented" | "partner-verified"
export type CommunityStatus = "verified" | "unverified"
export type CommunityLaunchStatus = "active" | "coming_soon"
export type NodeStatus = "catalog" | "unclaimed" | "claimed" | "verified"
export type TagPreference = "notify_approve" | "auto_approve" | "disabled"
export type VerificationTier = "standard" | "elevated" | "protected"
export type ClaimRequestStatus = "pending" | "vouched" | "approved" | "denied" | "expired"
export type PersonRedirectReason = "merged" | "reslugged" | "manual"

// ─── PB-009 Tag Events (Phase 1 foundation) ─────────────────────────────────

export type TagEventSource = "member" | "public_timeline_embed" | "editor" | "system"
export type TagEventStatus = "pending" | "approved" | "declined" | "disabled"
export type TagEventSubjectTier = "standard" | "elevated" | "protected" | "unclaimed" | "catalog"
export type TagEventDeclineCategory =
  | "this_wasnt_me"
  | "wrong_moment"
  | "preference"
  | "spam"
  | "other"
  | "lifecycle_destroyed"  // PB-009 Phase 3: paired tag_event disabled when the underlying story/claim was deleted

// ─── PB-009 Phase 3 — reports, action log, decision notifications ───────────

export type TagReportStatus = "open" | "reviewed" | "dismissed" | "resolved_moment_destroyed"

export type TagActionActorRole = "owner" | "editor" | "asserter" | "reporter" | "system"

export type TagActionKind =
  | "approve"
  | "decline"
  | "override_approve"
  | "override_decline"
  | "block_cascade"
  | "trust_cascade"
  | "lifecycle_disable"
  | "restrict_asserter"
  | "unrestrict_asserter"
  | "report_open"
  | "report_close_action"
  | "report_close_dismiss"
  | "report_resolved_moment_destroyed"

export interface TagReport {
  id: string
  tag_event_id: string
  reported_by: string
  reason_category: TagEventDeclineCategory
  reason_note: string | null
  status: TagReportStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface TagActionLogEntry {
  id: string
  tag_event_id: string | null
  asserter_id: string | null
  actor_id: string | null
  actor_role: TagActionActorRole
  action: TagActionKind
  prior_status: TagEventStatus | null
  new_status: TagEventStatus | null
  reason_category: TagEventDeclineCategory | null
  reason_note: string | null
  related_report: string | null
  created_at: string
}
export type TagEventDisplayState = "hidden" | "attributed" | "anonymous_aggregate"
export type VisitorDisplaySetting = "hidden" | "attributed" | "anonymous_aggregate"

/** Visitor record captured for source='public_timeline_embed' (PB-010 Phase 6 populates). */
export interface TagEventVisitorRecord {
  name?: string
  email_hash?: string
  ip_hash?: string
  visitor_role?: string
}

/** moment_ref shape: which row in story_riders or claims this tag_event pairs with. */
export interface TagEventMomentRef {
  story_id?: string
  claim_id?: string
  rider_id?: string
  event_id?: string
  place_id?: string
  day_id?: string
}

export interface TagEvent {
  id: string
  source: TagEventSource
  asserter_id: string | null
  asserter_visitor_record: TagEventVisitorRecord | null
  subject_id: string
  subject_tier_at_assert: TagEventSubjectTier
  predicate: string
  moment_ref: TagEventMomentRef
  community_id: string | null
  status: TagEventStatus
  decision_by: string | null
  decision_at: string | null
  decision_reason_category: TagEventDeclineCategory | null
  decision_reason_note: string | null
  co_sign_by: string | null
  co_sign_at: string | null
  display_state: TagEventDisplayState
  expires_at: string | null
  created_at: string
  updated_at: string
}

// ─── PB-010 Public Timeline + Stack View (Phase 1 foundation) ───────────────

export type PublicStackEntryType =
  | "story"
  | "place"
  | "event"
  | "board"
  | "rider"
  | "category_summary"

export type PublicStackCategoryKey = "places" | "boards" | "events" | "riders" | "stories"

/** One owner-curated entry in a public Stack View, ordered by `position`.
 *  A `category_summary` row carries `category_key` and no `entry_ref_id`; every
 *  other type carries an `entry_ref_id` (text, because catalog ids are mixed-type)
 *  and no `category_key`. Enforced by the public_stack_entry_shape DB constraint. */
export interface PublicStackEntry {
  id: string
  owner_profile_id: string
  entry_type: PublicStackEntryType
  entry_ref_id: string | null
  category_key: PublicStackCategoryKey | null
  position: number
  custom_title: string | null
  custom_summary: string | null
  created_at: string
  updated_at: string
}

// ─── Person redirects (PB-008 Phase 2 Session 1) ────────────────────────────

export interface PersonSlugAlias {
  alias: string
  person_id: string
  reason: PersonRedirectReason
  created_at: string
}

export interface PersonRedirectEntry {
  to_id: string
  to_slug: string
  reason: PersonRedirectReason
}

export type PersonRedirectMap = Record<string, PersonRedirectEntry>

// ─── Community ──────────────────────────────────────────────────────────────

export type CommunityType = "interest" | "place"
export type SchemaNoun = "people" | "places" | "events" | "boards" | "brands" | "stories"
export type NounMap = Partial<Record<SchemaNoun, string>>

export interface Community {
  id: string
  slug: string
  name: string
  emoji?: string
  status: CommunityLaunchStatus
  sort_order: number
  created_at?: string
  noun_map: NounMap
  type: CommunityType
  // Phase 2: admin-set visual identity (see migration 20260613000001).
  // Both nullable; landing page falls back to the color-dot header when unset.
  hero_image_url?: string  // full-width background photo
  avatar_url?: string      // community profile image
  // Landing Page Banner (see migration 20260615000002). Separate from hero_image_url:
  // this is the band across the top of the root homepage (/), not the community page.
  landing_banner_url?: string
  // Boards Catalog Banner (see migration 20260618000001). Full-width band across
  // the top of the community /boards catalog page; admin-set, same plumbing as
  // the other community images.
  boards_banner_url?: string
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
  /** @deprecated Use node_status instead for UI classification */
  community_status?: CommunityStatus
  node_status?: NodeStatus
  claimed_by?: string
  claimed_at?: string
  merged_from_id?: string
  merged_at?: string | null
  is_notable?: boolean
  is_deceased?: boolean
  invite_email?: string
  invited_by?: string
  tag_preference?: TagPreference
  added_by?: string
  links?: ProfileLink[]
  /** Populated for registered users (profiles table); absent for catalog/mock people */
  membership_tier?: "free" | "annual" | "lifetime" | "founding"
  /** Community slugs this person belongs to (populated from junction table) */
  community_slugs?: string[]
  /** Primary community for this person (profiles table) */
  primary_community_id?: string
  // PB-009 Phase 1
  /** Cached subject tier for fast read at tag-insert time. Populated by Phase 4. */
  node_tier_cache?: TagEventSubjectTier
  /** Timestamp of the last tier transition. */
  tier_changed_at?: string | null
  /** Default render mode for visitor-asserted tags. Per-moment overrides take precedence (Phase 6). */
  public_default_visitor_display?: VisitorDisplaySetting
  // PB-010 Phase 1 (public timeline foundation). Profile-only fields.
  /** Stored URL slug for the public timeline at /t/[slug]. The first stored slug column for a profile; derived from display_name via the public-slug helper. */
  public_slug?: string | null
  /** Opt-in gate for the public timeline route (Phase 2). Default false. */
  public_timeline_enabled?: boolean
  /** Nullable override for the default public view. The app resolves the effective default per owner type when this is null. */
  public_timeline_default_view?: "timeline" | "stack" | null
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
  /** PB-009 Phase 1: per-moment override for visitor-tag display (Phase 6 renders). */
  visitor_display_override?: VisitorDisplaySetting | null
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
  /** Per-brand accent hex (e.g. '#D72638'). Null falls back to --accent
   * (#3B82F6) on the brand page. Brand Page Redesign Phase 1. */
  brand_color?: string
  /** Curated hero image. Standard pages use a brand-color accent bar instead;
   * the curated (Phase 2) hero reads this. Brand Page Redesign Phase 1. */
  banner_url?: string
  // ── Brand Page Redesign Phase 2 (curated / partner layer) ──
  /** 'standard' (default) renders the Phase 1 header only; 'curated' and
   * 'founding' render the curated sections. 'founding' adds the partner ribbon. */
  curation_tier?: "standard" | "curated" | "founding"
  /** Brand-authored editorial statement; its first line derives the hero tagline. */
  heritage_statement?: string
  /** Ordered, brand-authored timeline milestones. */
  brand_milestones?: { year: number; label: string }[]
  /** Owner-ordered person ids for the featured-team rail. */
  featured_rider_ids?: string[]
  /** Brand media + artifacts grid. */
  brand_media?: { kind?: string; title?: string; subtitle?: string; image_url?: string; link_url?: string }[]
  /** Outbound brand links for the curated sidebar card. */
  brand_links?: { label: string; url: string }[]
  /** Founding-tier ribbon text, e.g. 'Founding Brand Partner'. */
  partner_label?: string
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
  /** Set by the DB default; used to surface a "Recently added" rail on the
   * boards catalog. Optimistic adds stamp it client-side so a just-added board
   * sorts to the top before the server round-trip lands. */
  created_at?: string
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
  /** PB-009 Phase 1: per-moment override for visitor-tag display (Phase 6 renders). */
  visitor_display_override?: VisitorDisplaySetting | null
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
  // Board claims (owned_board only): whether the rider rode the board, owns it
  // (in their collection), or both. NULL for non-board claims; grandfathered /
  // backfilled board claims are 'rode'.
  board_relationship?: BoardRelationship
  // PB-009 Phase 1: paired tag_event for person-implicating claims (NULL for self-claims and grandfathered rows)
  tag_event_id?: string | null
  // BUG-066: a companion `rode_with` points at its parent `rode_at` claim so the
  // timeline folds it into that place card (instead of guessing by year-only
  // date). NULL => a standalone / crew relationship row (one per pair, deduped
  // on write with a widening year range). NULL for every non-rode_with predicate.
  parent_claim_id?: string | null
}

/** A board claim records whether the rider rode the board, owns it (collection), or both. */
export type BoardRelationship = "rode" | "own" | "both"

// ─── Connection Summary ───────────────────────────────────────────────────────

export type OverlapType = "rode_with" | "resort" | "event" | "sponsor" | "board" | "team" | "story"

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
  // FTUE celebration system
  welcome_pending?:                  boolean  // set by auth/complete, consumed by profile
  welcome_celebration_shown?:        boolean
  timeline_animated?:                boolean  // first-visit timeline entrance animation has played (gated on welcome_celebration_shown)
  // First-session step tracking.
  // Retained for the post-launch floating FTUE bar (P0 plan Task 6); the inline
  // FtueGuide that set these was removed at launch. Do not delete as dead.
  ftue_added_board?:                 boolean
  ftue_added_event?:                 boolean
  ftue_connected_person?:            boolean
  ftue_shared_story?:                boolean
  ftue_complete?:                    boolean
  // Milestone claim counts shown (replaces old cards at 5/20)
  milestone_first_shown?:            boolean
  milestone_5_shown?:                boolean
  milestone_10_shown?:               boolean
}

// ─── Celebrations ─────────────────────────────────────────────────────────────

export type CelebrationTier = 1 | 2 | 3 | 4 | 5

export interface CelebrationStat {
  label: string
  value: string
}

export interface CelebrationCta {
  label: string
  action: () => void
}

export interface CelebrationPayload {
  tier: CelebrationTier
  icon?: string
  title: string
  body?: string         // "meaning" — why it matters
  nextThread?: string   // suggested next action (plain text)
  stat?: string         // e.g. "Board #3 in your quiver" (single line)
  stats?: CelebrationStat[]  // structured stat list (label/value pairs)
  cta?: CelebrationCta       // actionable button (fires callback + dismisses)
  accentColor?: string  // defaults to blue #3b82f6
  autoDismissMs?: number // for Tier 1-2; if omitted, uses tier default
  contentType?: "board" | "event" | "person" | "story" | "welcome" | "milestone"
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
  /** false = authored but kept off the author's own timeline. Still public on
   * linked entity pages and in the community feed. Default true. */
  on_timeline?: boolean
  linked_event_id?: string
  linked_place_id?: string
  linked_org_id?: string
  created_at: string
  updated_at: string
  // Joined relations (populated by API)
  photos?: StoryPhoto[]
  board_ids?: string[]
  rider_ids?: string[]
  // Community-added connections (populated by GET /api/stories).
  // The author's own linked_place_id / linked_event_id stay separate;
  // chips render the union.
  community_places?: { place_id: string; added_by: string | null }[]
  community_events?: { event_id: string; added_by: string | null }[]
  community_orgs?: { org_id: string; added_by: string | null }[]
  // Denormalised author info (joined from profiles)
  author?: { display_name: string; avatar_url?: string }
  youtube_url?: string | null
  url?: string | null
  // Community scoping — every story belongs to exactly one community
  community_id?: string
  /** PB-009 Phase 1: per-moment override for visitor-tag display (Phase 6 renders). */
  visitor_display_override?: VisitorDisplaySetting | null
  // Reactions + comments (populated by GET /api/stories only; a story object
  // without comment_count did not come from the API and renders no
  // interaction row)
  reaction_summary?: Partial<Record<StoryReactionType, number>>
  viewer_reaction?: StoryReactionType | null
  comment_count?: number
}

export type StoryReactionType = "stoke" | "fire" | "laugh" | "respect" | "classic"

export interface StoryComment {
  id: string
  story_id: string
  author_id: string
  body: string
  created_at: string
  author?: { display_name: string; avatar_url?: string }
}

// ─── Claim Requests ─────────────────────────────────────────────────────────

export interface Vouch {
  voucher_id: string
  relationship: "rode_with" | "worked_with" | "family" | "other"
  note: string | null
  created_at: string
}

// "member" = the existing auth flow (claimant has an account, merged via
// merge_person). "public_invite" = the email-first admin-invite flow (anonymous
// claimant, no account at submit; folded in at signup via promoteGhostToAccount).
export type ClaimKind = "member" | "public_invite"

export interface ClaimRequest {
  id: string
  // Null for email-first (public_invite) claims, which have no account yet.
  claimant_id: string | null
  // Set only on public_invite claims (the anonymous claimant's email).
  claimant_email?: string | null
  email_verified_at?: string | null
  claim_kind?: ClaimKind
  node_id: string
  verification_tier: VerificationTier
  status: ClaimRequestStatus
  vouches_required: number
  vouches_received: Vouch[]
  evidence_notes?: string
  editor_notes?: string
  expires_at: string
  created_at: string
  resolved_at?: string
  resolved_by: string | null
  status_reason: string | null
  updated_at: string
}

// ─── Merge execution (PB-008 Phase 2 Session 3) ──────────────────────────────

export type MergePath = "claim_in_place" | "merge"

/** Return shape of the public.merge_person() RPC. */
export interface MergePersonResult {
  path: MergePath
  noop: boolean
  ghost_id: string
  canonical_id: string
  /** Per-table arrays of repointed row ids: { "claims_subject_id": [id, ...], ... } */
  references_repointed: Record<string, string[]>
  /** Per-table arrays of deduplicated row ids (ghost-side rows removed because canonical already had a row at the same composite PK). */
  references_deduplicated: Record<string, string[]>
  /** Count of person_slug_aliases rows that had their person_id retargeted from ghost to canonical. */
  alias_rewrites: number
  /** Count of competing pending/vouched claim_requests on this node that were auto-denied. */
  claim_requests_auto_denied: number
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
  first_board_text?: string
  board_ids: string[]
  event_ids: string[]
  early_orgs: string[]
  crew_ids: string[]
  privacy?: "private" | "shared" | "public"
  email?: string
  /** Community IDs selected during onboarding */
  community_ids?: string[]
  /** How intensely they rode at their peak */
  riding_intensity?: "casual" | "a_lot" | "my_life"
  was_sponsored?: boolean
  did_compete?: boolean
}

// ── Diagnostics Phase 1: analytics_events ───────────────────────────────────
// Row shape for the durable in-app event log. The canonical category list is
// shared with the capture layer (src/lib/analytics.ts).

export type AnalyticsCategory =
  | "auth"
  | "ftue"
  | "content"
  | "invite"
  | "redirect"
  | "moderation"
  | "error"

export type AnalyticsSeverity = "warning" | "error"

export interface AnalyticsEvent {
  id: string
  created_at: string
  category: AnalyticsCategory
  event: string
  actor_id: string | null
  severity: AnalyticsSeverity | null
  props: Record<string, unknown>
}

// ── In-app bug report widget ────────────────────────────────────────────────
// Row shape for the bug_reports table. Written server-side by /api/bug-report
// after requireAuth(); reporter identity comes from the session, never the
// client payload. status drives a lightweight triage lifecycle (no DB CHECK, so
// the values below are advisory).

export type BugReportStatus = "new" | "triaged" | "resolved" | "wontfix"

export interface BugReport {
  id: string
  created_at: string
  reporter_id: string | null
  reporter_email: string | null
  note: string
  expected: string | null
  url: string | null
  viewport: string | null
  user_agent: string | null
  posthog_session_url: string | null
  /** Widget-open time (reporter-supplied, see migration-011); created_at minus this is roughly the time spent typing. */
  report_started_at: string | null
  status: BugReportStatus
}
