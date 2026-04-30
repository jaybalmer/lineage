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
 * Drop-in replacement for next/link that auto-prefixes community-scoped routes.
 *
 * <CommunityLink href="/feed">                →  /snowboarding/feed
 * <CommunityLink href="/people/brad-holmes">  →  /people/brad-holmes  (unchanged, top-level)
 * <CommunityLink href="/auth/signin">         →  /auth/signin         (unchanged, global)
 * <CommunityLink href="/">                    →  /                    (unchanged, root)
 */
export function CommunityLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const slug = useLineageStore((s) => s.activeCommunitySlug)

  if (typeof href === "string" && href.startsWith("/")) {
    const firstSeg = href.split("/")[1] // "" for "/", "feed" for "/feed"
    if (firstSeg && COMMUNITY_SEGMENTS.has(firstSeg)) {
      return <Link {...props} href={`/${slug}${href}`} />
    }
  }

  return <Link {...props} href={href} />
}
