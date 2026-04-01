import type { Community } from "@/types"

/** Default community slug — snowboarding is the only active community at launch */
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
 * communityHref("/riders/brad-holmes", "snowboarding")
 *   → "/snowboarding/riders/brad-holmes"
 *
 * communityHref("/riders", undefined)
 *   → "/snowboarding/riders"  (falls back to default)
 */
export function communityHref(path: string, communitySlug?: string): string {
  const slug = communitySlug || DEFAULT_COMMUNITY_SLUG
  // Ensure path starts with /
  const normalised = path.startsWith("/") ? path : `/${path}`
  return `/${slug}${normalised}`
}
