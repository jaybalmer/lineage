"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

interface LensRowProps {
  communitySlug: string
  pathname: string
  isAuth: boolean
  /** The viewer's unified profile URL (/people/{slug}); /onboarding when signed out. */
  myTimelineHref: string
}

/**
 * Lens row: Community / Feed / My Timeline. Same three slots in every scope.
 * Destinations resolve through the active community slug, which falls back to
 * the default community at global scope (D1 in the Phase 2 brief), so the row
 * is functionally identical in both scopes at launch.
 *
 * Signed-out: the timeline slot reads "Start My Timeline" and points at the
 * /onboarding aha-before-auth flow rather than dumping the visitor at the bare
 * sign-in screen, since the most prominent lens should invite, not gate.
 */
export function LensRow({ communitySlug, pathname, isAuth, myTimelineHref }: LensRowProps) {
  // Timeline lens points at the viewer's unified /people/{slug} page in every
  // scope (the old /{community}/profile and /me/timeline URLs now redirect
  // there). Signed out, myTimelineHref is /onboarding and the lens reads "Start
  // My Timeline" so the most prominent lens invites rather than gates.
  const timelineHref = myTimelineHref
  const timelineLabel = isAuth ? "My Timeline" : "Start My Timeline"
  const timelineActive = isAuth && pathname === myTimelineHref

  // TODO PB-013 (Member Landing & Default Scope): when a weighted global Feed surface exists
  // (the "From your communities / Across Lineage" split), route Feed at global scope to /feed
  // (with the surface rendering global) instead of relying on the proxy to redirect into the
  // default community.
  const feedHref = `/${communitySlug}/feed`
  const feedActive =
    pathname === `/${communitySlug}/feed` ||
    pathname.startsWith(`/${communitySlug}/feed/`)

  // TODO PB-012 (Community Home Page): when a global Lineage summary surface exists (curated
  // directory of all communities), route Community at global scope there instead of the
  // community home.
  // The Community lens always points at the community home and is active only there. The root
  // marketing page ("/") is reached via the wordmark, not a lens, so no lens lights up on it
  // (BUG-003: Community used to stay highlighted on the landing page, and tapping it reloaded
  // "/" instead of returning to the community).
  const communityHref = `/${communitySlug}`
  const communityActive = pathname === `/${communitySlug}`

  const lenses = [
    { id: "community", label: "Community",   href: communityHref, active: communityActive },
    { id: "feed",      label: "Feed",        href: feedHref,      active: feedActive },
    { id: "timeline",  label: timelineLabel, href: timelineHref,  active: timelineActive },
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
