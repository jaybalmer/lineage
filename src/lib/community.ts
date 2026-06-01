import type { Community, SchemaNoun } from "@/types"

/** Default community slug: snowboarding is the only active community at launch */
export const DEFAULT_COMMUNITY_SLUG = "snowboarding"

/** All known community slugs (used for route validation before DB is available) */
export const COMMUNITY_SLUGS = ["snowboarding", "surf", "skate", "ski", "mtb"] as const
export type CommunitySlug = (typeof COMMUNITY_SLUGS)[number]

/** Check whether a string is a known community slug */
export function isValidCommunitySlug(slug: string): slug is CommunitySlug {
  return (COMMUNITY_SLUGS as readonly string[]).includes(slug)
}

/** Look up a community by slug from a loaded communities array */
export function getCommunityBySlug(slug: string, communities: Community[]): Community | undefined {
  return communities.find((c) => c.slug === slug)
}

/**
 * Prefix a path with the active community slug.
 *
 * communityHref("/feed", "snowboarding")
 *   → "/snowboarding/feed"
 *
 * communityHref("/events", undefined)
 *   → "/snowboarding/events"  (falls back to default)
 *
 * Note: top-level routes like /people/[id] are not community-scoped and should
 * not be passed to this helper.
 */
export function communityHref(path: string, communitySlug?: string): string {
  const slug = communitySlug || DEFAULT_COMMUNITY_SLUG
  // Ensure path starts with /
  const normalised = path.startsWith("/") ? path : `/${path}`
  return `/${slug}${normalised}`
}

/** Global fallback labels per schema noun, used when a community has no override. */
export const FALLBACK_LABELS: Record<SchemaNoun, string> = {
  people: "People",
  places: "Places",
  events: "Events",
  boards: "Boards",
  brands: "Brands",
  stories: "Stories",
}

/**
 * Resolve the display label for a schema noun in the context of a community.
 * Falls back to the global label when the community has no override, no
 * noun_map, or no community is passed.
 */
export function communityLabel(schemaNoun: SchemaNoun, community: Community | undefined): string {
  return community?.noun_map?.[schemaNoun] ?? FALLBACK_LABELS[schemaNoun]
}
