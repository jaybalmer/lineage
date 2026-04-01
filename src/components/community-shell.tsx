"use client"

import { useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"

/**
 * Client component rendered inside the [community] layout.
 * Syncs the URL community slug with the Zustand store so all
 * components (nav, CommunityLink, etc.) know the active community.
 */
export function CommunityShell({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const setActiveCommunitySlug = useLineageStore((s) => s.setActiveCommunitySlug)

  useEffect(() => {
    setActiveCommunitySlug(slug)
  }, [slug, setActiveCommunitySlug])

  return <>{children}</>
}
