"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

interface LensRowProps {
  communitySlug: string
  pathname: string
  isAuth: boolean
}

/**
 * Lens row: Timeline / Feed / Community. Same three slots in every scope.
 * Destinations resolve through the active community slug, which falls back to
 * the default community at global scope (D1 in the Phase 2 brief), so the row
 * is functionally identical in both scopes at launch.
 */
export function LensRow({ communitySlug, pathname, isAuth }: LensRowProps) {
  const inCommunity =
    pathname === `/${communitySlug}` || pathname.startsWith(`/${communitySlug}/`)

  // Timeline lens: in-community it points at the community-scoped profile; at global scope it
  // points at the cross-community /me/timeline. (The avatar "My Timeline" item stays
  // community-scoped per PB-011 Phase 3A decision Q2.)
  const timelineHref = !isAuth
    ? "/auth/signin"
    : inCommunity
      ? `/${communitySlug}/profile`
      : "/me/timeline"
  const timelineActive = inCommunity
    ? (pathname === `/${communitySlug}/profile` ||
       pathname.startsWith(`/${communitySlug}/profile/`))
    : pathname === "/me/timeline"

  // TODO PB-013 (Member Landing & Default Scope): when a weighted global Feed surface exists
  // (the "From your communities / Across Lineage" split), route Feed at global scope to /feed
  // (with the surface rendering global) instead of relying on the proxy to redirect into the
  // default community.
  const feedHref = `/${communitySlug}/feed`
  const feedActive =
    pathname === `/${communitySlug}/feed` ||
    pathname.startsWith(`/${communitySlug}/feed/`)

  // TODO PB-012 (Community Home Page): when a global Lineage summary surface exists (curated
  // directory of all communities), route Community at global scope there instead of the root
  // marketing page.
  const communityHref = inCommunity ? `/${communitySlug}` : "/"
  const communityActive = inCommunity ? pathname === `/${communitySlug}` : pathname === "/"

  const lenses = [
    { id: "timeline",  label: "Timeline",  href: timelineHref,  active: timelineActive },
    { id: "feed",      label: "Feed",      href: feedHref,      active: feedActive },
    { id: "community", label: "Community", href: communityHref, active: communityActive },
  ]

  return (
    <div className="flex items-center px-4 gap-1 overflow-x-auto py-1.5 scrollbar-none">
      {lenses.map((lens) => (
        <Link
          key={lens.id}
          href={lens.href}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap",
            lens.active
              ? "bg-accent-strong text-white"
              : "text-muted hover:text-foreground hover:bg-surface-hover",
          )}
        >
          {lens.label}
        </Link>
      ))}
    </div>
  )
}
