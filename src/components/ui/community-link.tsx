"use client"

import Link from "next/link"
import { useLineageStore } from "@/store/lineage-store"

/**
 * Segments that live under the [community] route group.
 * CommunityLink will auto-prefix these with the active community slug.
 */
const COMMUNITY_SEGMENTS = new Set([
  "riders", "places", "events", "boards", "brands", "orgs",
  "stories", "feed", "connections", "collective", "profile",
  "explore", "timeline",
])

/**
 * Drop-in replacement for next/link that auto-prefixes community-scoped routes.
 *
 * <CommunityLink href="/riders/brad-holmes">  →  /snowboarding/riders/brad-holmes
 * <CommunityLink href="/auth/signin">         →  /auth/signin  (unchanged — global route)
 * <CommunityLink href="/">                    →  /  (unchanged — root)
 */
export function CommunityLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const slug = useLineageStore((s) => s.activeCommunitySlug)

  if (typeof href === "string" && href.startsWith("/")) {
    const firstSeg = href.split("/")[1] // "" for "/", "riders" for "/riders/brad"
    if (firstSeg && COMMUNITY_SEGMENTS.has(firstSeg)) {
      return <Link {...props} href={`/${slug}${href}`} />
    }
  }

  return <Link {...props} href={href} />
}
