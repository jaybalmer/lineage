"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getPersonById } from "@/lib/mock-data"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { getInitials } from "@/components/ui/rider-avatar"
import { supabase } from "@/lib/supabase"

const TIER_BADGE: Record<string, { label: string; color: string; symbol: string }> = {
  annual:   { label: "MEMBER",      color: "#3b82f6", symbol: "◈" },
  lifetime: { label: "LIFETIME",    color: "#8b5cf6", symbol: "◆" },
  founding: { label: "FOUNDING ✦",  color: "#f59e0b", symbol: "✦" },
}

/** Base paths for community-scoped nav links (prefixed at render time) */
const PRIMARY_NAV_PATHS = [
  { path: "/profile",     label: "Timeline" },
  { path: "/feed",        label: "Feed" },
  { path: "/connections", label: "Connections" },
  { path: "/collective",  label: "Collective" },
]

const SECONDARY_NAV_PATHS = [
  { path: "/riders",  label: "Riders" },
  { path: "/events",  label: "Events" },
  { path: "/boards",  label: "Boards" },
  { path: "/brands",  label: "Brands" },
  { path: "/places",  label: "Places" },
  { path: "/stories", label: "Stories" },
]

/** Check if pathname matches a nav link (accounting for community prefix) */
function isActive(navHref: string, pathname: string) {
  if (navHref.endsWith("/profile")) {
    return pathname === navHref || pathname.startsWith(navHref + "/")
  }
  return pathname.startsWith(navHref)
}

// ─── Avatar dropdown — isolated component so each desktop/mobile instance
//     has its own ref and state (avoids the shared-ref-rendered-twice bug) ────

interface AvatarDropdownProps {
  initial:      string
  displayName:  string
  tier:         string
  totalTokens:  number
}

function AvatarDropdown({ initial, displayName, tier, totalTokens }: AvatarDropdownProps) {
  const path     = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)
  const ref      = useRef<HTMLDivElement>(null)
  const tierBadge = TIER_BADGE[tier] ?? null

  async function handleSignOut() {
    setOpen(false)
    const { setActivePersonId, setProfileOverride } = useLineageStore.getState()
    await supabase.auth.signOut()
    setActivePersonId("")
    setProfileOverride({})
    router.push("/")
  }

  // Close when the route changes (navigation completed)
  useEffect(() => { setOpen(false) }, [path])

  // Close on outside mousedown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-full focus:outline-none"
        aria-label="User menu"
      >
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          {getInitials(displayName || "?")}
        </div>
        {tierBadge && (
          <span className="hidden sm:inline px-1.5 py-0.5 rounded-full"
            style={{ background: `${tierBadge.color}20`, color: tierBadge.color, fontSize: 8, letterSpacing: 0.5, fontWeight: 700 }}>
            {tierBadge.label}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border-default rounded-xl shadow-lg overflow-hidden z-50"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {/* Name row */}
          <div className="px-4 py-3 border-b border-border-default">
            <div className="text-foreground font-semibold" style={{ fontSize: 12 }}>
              {displayName || "Your Profile"}
            </div>
            {tierBadge ? (
              <div style={{ fontSize: 9, color: tierBadge.color, marginTop: 2 }}>
                {tierBadge.symbol} {tierBadge.label}
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: 9, marginTop: 2 }}>Free rider</div>
            )}
          </div>

          {/* Links */}
          <Link href={`/${useLineageStore.getState().activeCommunitySlug}/profile`}
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            My Timeline
          </Link>
          <Link href="/account/membership"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Membership
          </Link>

          <div className="border-t border-border-default" />

          {tier === "free" ? (
            <Link href="/membership"
              className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors"
              style={{ fontSize: 10, color: "#3b82f6" }}>
              <span>Become a member</span>
              <span>→</span>
            </Link>
          ) : (
            <Link href="/account/membership"
              className="flex items-center justify-between px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              style={{ fontSize: 10 }}>
              <span>{totalTokens} tokens</span>
              <span className="text-green-500" style={{ fontSize: 9 }}>● Revenue share active</span>
            </Link>
          )}

          <div className="border-t border-border-default" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Primary nav paths for Row 2 (includes compare which is global) */
const ROW2_NAV_PATHS = [
  { path: "/profile",     label: "Timeline",    community: true },
  { path: "/compare",     label: "Compare",     community: false },
  { path: "/connections", label: "Connects",    community: true },
  { path: "/feed",        label: "Feed",        community: true },
  { path: "/collective",  label: "Collective",  community: true },
]

/** Community emoji lookup */
const COMMUNITY_EMOJI: Record<string, string> = {
  snowboarding: "🏂", surf: "🏄", skate: "🛹", ski: "⛷️", mtb: "🚵",
}

function AppNav({ path, isAuth, isEditor, dropdownProps, communitySlug, communities }: {
  path: string
  isAuth: boolean
  isEditor: boolean
  dropdownProps: AvatarDropdownProps
  communitySlug: string
  communities: { slug: string; name: string; emoji?: string; status: string }[]
}) {
  /** Prefix a path with the community slug */
  const c = (basePath: string) => `/${communitySlug}${basePath}`

  /** Are we inside a community route? (e.g. /snowboarding/riders) */
  const inCommunity = path.startsWith(`/${communitySlug}/`)
  /** Are we on the root landing page? */
  const isLanding = path === "/"

  return (
    <div>
      {/* Row 1: logo + avatar */}
      <div className="flex items-center h-12 px-4 gap-3">
        <Link href="/" className="font-black text-xl text-foreground tracking-tight flex items-center gap-2 flex-shrink-0">
          <span className="text-blue-400 text-2xl">⬡</span>
          <span>Lineage</span>
        </Link>
        {inCommunity && (
          <Link href={`/${communitySlug}`} className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-muted font-black text-xl" style={{ letterSpacing: "-0.03em" }}>/</span>
            <span className="font-black text-xl text-foreground tracking-tight">{communitySlug}</span>
          </Link>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-4 flex-shrink-0">
          <ThemeToggle />
          {isAuth ? (
            <AvatarDropdown {...dropdownProps} />
          ) : (
            <Link href="/auth/signin"
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Row 2: primary nav — scrollable */}
      <div className="flex items-center px-4 gap-1 overflow-x-auto border-t border-border-default/50 py-1.5 scrollbar-none">
        {ROW2_NAV_PATHS.map(({ path: navPath, label, community }) => {
          const href = community ? c(navPath) : navPath
          return (
            <Link key={navPath} href={href} className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap",
              isActive(href, path)
                ? "bg-blue-600 text-white"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            )}>
              {label}
            </Link>
          )
        })}
        {isEditor && (
          <Link href="/admin" className={cn(
            "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap",
            isActive("/admin", path)
              ? "bg-blue-600 text-white"
              : "text-muted hover:text-foreground hover:bg-surface-hover"
          )}>
            Editor
          </Link>
        )}
      </div>

      {/* Row 3: context-dependent — community nodes OR community list */}
      <div className="flex items-center px-4 gap-1 overflow-x-auto border-t border-border-default/50 py-1.5 scrollbar-none">
        {(inCommunity || path === `/${communitySlug}`) ? (
          /* Inside a community: show entity nav (Riders, Events, ...) */
          SECONDARY_NAV_PATHS.map(({ path: navPath, label }) => {
            const href = c(navPath)
            return (
              <Link key={navPath} href={href} className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap",
                isActive(href, path)
                  ? "bg-surface-active text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              )}>
                {label}
              </Link>
            )
          })
        ) : (
          /* Landing page or global route: show communities list */
          communities.map((comm) => {
            const emoji = comm.emoji ?? COMMUNITY_EMOJI[comm.slug] ?? ""
            const href = `/${comm.slug}`
            const isComingSoon = comm.status === "coming_soon"
            return (
              <Link
                key={comm.slug}
                href={isComingSoon ? "#" : href}
                onClick={isComingSoon ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap flex items-center gap-1.5",
                  isComingSoon
                    ? "text-muted/50 cursor-default"
                    : isActive(href, path)
                      ? "bg-surface-active text-foreground"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                )}
              >
                <span>{emoji}</span>
                <span>{comm.name}</span>
                {isComingSoon && (
                  <span className="text-[9px] uppercase tracking-wider text-muted/40 ml-0.5">soon</span>
                )}
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function Nav() {
  const path = usePathname()
  const { activePersonId, profileOverride, loadDbEntities, membership, activeCommunitySlug, communities } = useLineageStore()
  const basePerson    = getPersonById(activePersonId)
  const loadedForId   = useRef<string | null>(null)

  // Load shared entity catalog + riding days once per auth session
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    if (loadedForId.current === activePersonId) return
    loadedForId.current = activePersonId
    loadDbEntities()
  }, [activePersonId, loadDbEntities])

  const isAuth      = isAuthUser(activePersonId)
  const isEditor    = membership.is_editor
  const displayName = profileOverride.display_name ?? basePerson?.display_name ?? ""
  const initial     = displayName[0]?.toUpperCase() ?? "?"
  const tier        = membership.tier
  const totalTokens = membership.token_balance.founder * 2 + membership.token_balance.member + membership.token_balance.contribution

  const dropdownProps = { initial, displayName, tier, totalTokens }

  return (
    <nav className="border-b border-border-default bg-bg-nav sticky top-0 z-50">
      <AppNav
        path={path}
        isAuth={isAuth}
        isEditor={isEditor}
        dropdownProps={dropdownProps}
        communitySlug={activeCommunitySlug}
        communities={communities}
      />
    </nav>
  )
}
