"use client"

import Link from "next/link"
import { useLineageStore } from "@/store/lineage-store"

/**
 * Segments that live under the [community] route group.
 * CommunityLink will auto-prefix these with the active community slug.
 *
 * Note: "people" is intentionally absent. Person nodes live at top-level /people/[id]
 * because a person can be a member of more than one community.
 */
const COMMUNITY_SEGMENTS = new Set([
  "places", "events", "boards", "brands", "orgs",
  "stories", "feed", "connections", "collective", "profile",
  "explore", "timeline",
])

/**
 * Resolve a community-scoped path to its active-community-prefixed form.
 *
 *   communityHref("/feed", "snowboarding")               → "/snowboarding/feed"
 *   communityHref("/people/brad-holmes", "snowboarding") → "/people/brad-holmes" (top-level)
 *   communityHref("/auth/signin", "snowboarding")        → "/auth/signin"        (global)
 *   communityHref("/", "snowboarding")                   → "/"                   (root)
 *
 * Exported so non-Link consumers that render a raw <a> (e.g. ImageLightbox,
 * which opens in a new tab) can build the same URL CommunityLink would, instead
 * of pointing at a bare community-scoped path that 404s (BUG-001).
 */
export function communityHref(href: string, slug: string): string {
  if (href.startsWith("/")) {
    // Strip any ?query / #hash before reading the segment so community-scoped
    // links with params (e.g. "/boards?brand=Burton") still get prefixed.
    const firstSeg = href.split(/[?#]/)[0].split("/")[1] // "" for "/", "feed" for "/feed"
    if (firstSeg && COMMUNITY_SEGMENTS.has(firstSeg)) {
      return `/${slug}${href}`
    }
  }
  return href
}

/**
 * Drop-in replacement for next/link that auto-prefixes community-scoped routes.
 */
export function CommunityLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const slug = useLineageStore((s) => s.activeCommunitySlug)

  if (typeof href === "string") {
    return <Link {...props} href={communityHref(href, slug)} />
  }

  return <Link {...props} href={href} />
}
