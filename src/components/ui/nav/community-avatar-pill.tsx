"use client"

import { getInitials } from "@/components/ui/rider-avatar"
import { COMMUNITY_INITIALS } from "@/lib/community"
import type { Community } from "@/types"

interface CommunityAvatarPillProps {
  community?: Community
  /** Fallback when the community object is not loaded yet (catalog pre-load). */
  slug?: string
  size?: "sm" | "md"
}

/**
 * Circular community avatar with initials, in the brand blue. Interest-community
 * style only at launch.
 */
// TODO Phase 3 or post-launch: when a place-type community exists, render the geotag-marker
// avatar treatment for type === "place" communities. Currently renders interest-style only
// (circle with initials) because no place community exists to test against.
export function CommunityAvatarPill({ community, slug, size = "sm" }: CommunityAvatarPillProps) {
  const override = COMMUNITY_INITIALS[community?.slug ?? slug ?? ""]
  const initials = override ?? getInitials(community?.name ?? slug ?? "?")
  const dims = size === "md" ? "w-6 h-6 text-[10px]" : "w-5 h-5 text-[9px]"

  return (
    <span
      className={`${dims} inline-flex items-center justify-center rounded-full bg-accent text-white font-semibold flex-shrink-0`}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
