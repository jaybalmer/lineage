"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getPersonById } from "@/lib/mock-data"
import { personHrefById } from "@/lib/entity-links"
import { getCommunityBySlug } from "@/lib/community"
import type { Community } from "@/types"
import { BrandMark } from "@/components/ui/brand-mark"
import { LensRow } from "@/components/ui/nav/lens-row"
import { CategoryRow } from "@/components/ui/nav/category-row"
import { CommunityAvatarPill } from "@/components/ui/nav/community-avatar-pill"
import { CommunitySwitcher } from "@/components/ui/nav/community-switcher"
import { AvatarDropdown, type AvatarDropdownProps } from "@/components/ui/nav/avatar-dropdown"
import { GuestMenu } from "@/components/ui/nav/guest-menu"

function AppNav({ path, isAuth, dropdownProps, communitySlug, communities }: {
  path: string
  isAuth: boolean
  dropdownProps: AvatarDropdownProps
  communitySlug: string
  communities: Community[]
}) {
  /** Inside a community route (e.g. /snowboarding or /snowboarding/feed). The
   *  proxy redirects bare top-level routes to the community form before render,
   *  so by here the URL is already community-prefixed when in scope. */
  const inCommunity = path.startsWith(`/${communitySlug}/`) || path === `/${communitySlug}`

  // Person nodes live top-level (cross-community) but are reached from the
  // community category row, so they carry the same brand-blue rule rather than
  // the global grey divider (BUG-007).
  const onPeopleRoute = path === "/people" || path.startsWith("/people/")
  const showCommunityRule = inCommunity || onPeopleRoute

  // The /me/* routes (settings, tags) carry the active community in
  // communitySlug but are neither in-community nor /people, so without this they
  // fall back to the global "People" label on the category row (BUG-091). Resolve
  // the active community here too so the riders tab reads "Riders" there as well.
  const onMeRoute = path === "/me" || path.startsWith("/me/")

  // Resolve the active community for the category row on the top-level /people
  // route too, so the People tab keeps its community label ("Riders") instead of
  // flipping to the global "People" fallback when selected (BUG-016). At true
  // global scope (neither in-community nor /people nor /me) it stays undefined and
  // the category labels fall back to the global defaults.
  const activeCommunity = (inCommunity || onPeopleRoute || onMeRoute) ? getCommunityBySlug(communitySlug, communities) : undefined

  return (
    <div>
      {/* Row 1: title */}
      <div className="flex items-center h-12 px-4 gap-2">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <BrandMark size={28} />
          <span className="font-black text-xl text-foreground tracking-tight" style={{ fontFamily: "var(--font-wordmark)" }}>Linestry</span>
        </Link>
        {inCommunity && (
          <>
            <span className="text-foreground/40 font-black text-xl flex-shrink-0" style={{ letterSpacing: "-0.03em" }}>/</span>
            <Link href={`/${communitySlug}`} className="flex items-center gap-1.5 min-w-0 flex-shrink">
              <CommunityAvatarPill community={activeCommunity} slug={communitySlug} size="sm" />
              <span className="font-black text-xl text-foreground tracking-tight truncate" style={{ fontFamily: "var(--font-wordmark)" }}>
                {activeCommunity?.name ?? communitySlug}
              </span>
            </Link>
          </>
        )}
        <CommunitySwitcher activeCommunitySlug={communitySlug} communities={communities} />
        <div className="flex-1" />
        {isAuth ? (
          <AvatarDropdown {...dropdownProps} />
        ) : (
          <GuestMenu />
        )}
      </div>

      {/* Community signal: 3px accent strip in-community (and on top-level people
          pages), standard divider at true global scope */}
      {showCommunityRule ? (
        <div className="h-[3px] bg-accent" />
      ) : (
        <div className="border-t border-border-default" />
      )}

      {/* Row 2: lens */}
      <LensRow communitySlug={communitySlug} pathname={path} isAuth={isAuth} myTimelineHref={dropdownProps.myTimelineHref} />

      <div className="border-t border-border-default" />

      {/* Row 3: categories */}
      <CategoryRow communitySlug={communitySlug} pathname={path} activeCommunity={activeCommunity} />
    </div>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function Nav() {
  const path = usePathname()
  const { activePersonId, profileOverride, loadDbEntities, membership, activeCommunitySlug, communities, pendingTagCount, catalog, userEntities } = useLineageStore()
  const basePerson  = getPersonById(activePersonId)
  const loadedForId = useRef<string | null>(null)

  // Load shared entity catalog + riding days once per auth session
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    if (loadedForId.current === activePersonId) return
    loadedForId.current = activePersonId
    loadDbEntities()
  }, [activePersonId, loadDbEntities])

  const isAuth      = isAuthUser(activePersonId)
  const displayName = profileOverride.display_name ?? basePerson?.display_name ?? ""
  const tier        = membership.tier
  const totalTokens = membership.token_balance.founder * 2 + membership.token_balance.member + membership.token_balance.contribution

  // The viewer's own unified profile (/people/{slug}). Both the "My Timeline"
  // lens and the avatar dropdown item point here now that the old /profile and
  // /me/timeline URLs redirect to it. Resolve through the merged catalog so the
  // slug (and its collision fallback to id) matches the destination's
  // canonicalization; signed-out visitors get the onboarding invite instead.
  const allPeople = [...catalog.people, ...(userEntities.people ?? [])]
  const myTimelineHref = isAuth ? personHrefById(activePersonId, allPeople) : "/onboarding"

  const dropdownProps: AvatarDropdownProps = {
    displayName,
    tier,
    totalTokens,
    pendingTagCount,
    isEditor: membership.is_editor,
    myTimelineHref,
  }

  return (
    <nav className="border-b border-border-default bg-bg-nav sticky top-0 z-50">
      <AppNav
        path={path}
        isAuth={isAuth}
        dropdownProps={dropdownProps}
        communitySlug={activeCommunitySlug}
        communities={communities}
      />
    </nav>
  )
}
