"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getPersonById } from "@/lib/mock-data"
import { getCommunityBySlug } from "@/lib/community"
import type { Community } from "@/types"
import { LensRow } from "@/components/ui/nav/lens-row"
import { CategoryRow } from "@/components/ui/nav/category-row"
import { CommunityAvatarPill } from "@/components/ui/nav/community-avatar-pill"
import { CommunitySwitcher } from "@/components/ui/nav/community-switcher"
import { AvatarDropdown, type AvatarDropdownProps } from "@/components/ui/nav/avatar-dropdown"

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

  // At global scope activeCommunity is undefined so category labels fall back to
  // the global defaults (People, not Riders).
  const activeCommunity = inCommunity ? getCommunityBySlug(communitySlug, communities) : undefined

  return (
    <div>
      {/* Row 1: title */}
      <div className="flex items-center h-12 px-4 gap-2">
        <Link href="/" className="font-black text-xl text-foreground tracking-tight flex-shrink-0">
          Linestry<span className="inline-block rounded-full bg-accent" style={{ width: "0.3em", height: "0.3em", verticalAlign: "baseline", marginLeft: "0.04em" }} />
        </Link>
        {inCommunity && (
          <>
            <span className="text-foreground/40 font-black text-xl flex-shrink-0" style={{ letterSpacing: "-0.03em" }}>/</span>
            <Link href={`/${communitySlug}`} className="flex items-center gap-1.5 min-w-0 flex-shrink">
              <CommunityAvatarPill community={activeCommunity} slug={communitySlug} size="sm" />
              <span className="font-black text-xl text-foreground tracking-tight truncate">
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
          <Link href="/auth/signin"
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-strong transition-colors flex-shrink-0">
            Sign in
          </Link>
        )}
      </div>

      {/* Community signal: 3px accent strip in-community, standard divider at global */}
      {inCommunity ? (
        <div className="h-[3px] bg-accent" />
      ) : (
        <div className="border-t border-border-default" />
      )}

      {/* Row 2: lens */}
      <LensRow communitySlug={communitySlug} pathname={path} isAuth={isAuth} />

      <div className="border-t border-border-default" />

      {/* Row 3: categories */}
      <CategoryRow communitySlug={communitySlug} pathname={path} activeCommunity={activeCommunity} />
    </div>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function Nav() {
  const path = usePathname()
  const { activePersonId, profileOverride, loadDbEntities, membership, activeCommunitySlug, communities, pendingTagCount } = useLineageStore()
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

  const dropdownProps: AvatarDropdownProps = {
    displayName,
    tier,
    totalTokens,
    pendingTagCount,
    isEditor: membership.is_editor,
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
