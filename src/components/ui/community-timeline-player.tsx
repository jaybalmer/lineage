"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { TimelinePlayerShell, buildCommunitySlides } from "@/components/ui/timeline-player"
import { BrandMark } from "@/components/ui/brand-mark"
import type { Community } from "@/types"

// Community Landing Redesign, Phase 2 (Workstream C)
// Community-level timeline player, launched from the landing page's Play button.
// Reuses the shared TimelinePlayerShell (identical chrome to personal play) with
// community stat/highlight slides. Public — available to everyone, since this is
// a brand/showcase feature rather than an owner-launched personal recap.
export function CommunityTimelinePlayer({ community, onClose }: { community: Community; onClose: () => void }) {
  const router = useRouter()
  const catalog = useLineageStore((s) => s.catalog)
  const activeCommunitySlug = useLineageStore((s) => s.activeCommunitySlug)
  const activePersonId = useLineageStore((s) => s.activePersonId)
  const isAuth = isAuthUser(activePersonId)

  const slides = useMemo(
    () =>
      buildCommunitySlides(community, catalog, () => {
        onClose()
        router.push(isAuth ? `/${activeCommunitySlug}/profile` : "/onboarding")
      }),
    [community, catalog, isAuth, activeCommunitySlug, onClose, router],
  )

  const avatar = community.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={community.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
  ) : (
    <BrandMark size={22} color="#3b82f6" />
  )

  return <TimelinePlayerShell slides={slides} header={{ label: community.name, avatar }} onClose={onClose} />
}
