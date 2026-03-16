"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getPersonById } from "@/lib/mock-data"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const TIER_BADGE: Record<string, { label: string; color: string; symbol: string }> = {
  annual:   { label: "MEMBER",          color: "#3b82f6", symbol: "◈" },
  lifetime: { label: "LIFETIME",        color: "#8b5cf6", symbol: "◆" },
  founding: { label: "FOUNDING ✦",      color: "#f59e0b", symbol: "✦" },
}

const PRIMARY_NAV = [
  { href: "/profile", label: "Profile" },
  { href: "/compare", label: "Compare" },
  { href: "/connections", label: "Connections" },
  { href: "/collective", label: "Collective" },
]

const SECONDARY_NAV = [
  { href: "/riders", label: "Riders" },
  { href: "/events", label: "Events" },
  { href: "/boards", label: "Boards" },
  { href: "/brands", label: "Brands" },
  { href: "/places", label: "Places" },
  { href: "/admin", label: "Editor" },
]

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV]

function navLinkClass(href: string, path: string, active: boolean) {
  return cn(
    "px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap",
    active
      ? "bg-surface-active text-foreground"
      : "text-muted hover:text-foreground hover:bg-surface-hover"
  )
}

function isActive(href: string, path: string) {
  return href === "/profile"
    ? path === "/profile" || path.startsWith("/profile/")
    : path.startsWith(href)
}

export function Nav() {
  const path = usePathname()
  const { activePersonId, profileOverride, loadDbEntities, membership } = useLineageStore()
  const basePerson = getPersonById(activePersonId)
  const loadedForId = useRef<string | null>(null)
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Load shared entity catalog + riding days once per auth session
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    if (loadedForId.current === activePersonId) return
    loadedForId.current = activePersonId
    loadDbEntities()
  }, [activePersonId, loadDbEntities])

  // Close dropdown on navigation (path change) or outside click
  useEffect(() => { setDropOpen(false) }, [path])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const displayName = profileOverride.display_name ?? basePerson?.display_name ?? ""
  const initial = displayName[0]?.toUpperCase() ?? "?"
  const tier = membership.tier
  const tierBadge = TIER_BADGE[tier] ?? null
  const totalTokens = membership.token_balance.founder * 2 + membership.token_balance.member + membership.token_balance.contribution

  const avatarDropdown = (
    <div ref={dropRef} className="relative flex-shrink-0">
      <button
        onClick={() => setDropOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-full focus:outline-none"
        aria-label="User menu"
      >
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          {initial}
        </div>
        {tierBadge && (
          <span className="hidden sm:inline text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${tierBadge.color}20`, color: tierBadge.color, fontSize: 8, letterSpacing: 0.5 }}>
            {tierBadge.label}
          </span>
        )}
      </button>

      {dropOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border-default rounded-xl shadow-lg overflow-hidden z-50"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {/* Name row */}
          <div className="px-4 py-3 border-b border-border-default">
            <div className="text-foreground font-semibold" style={{ fontSize: 12 }}>{displayName || "Your Profile"}</div>
            {tierBadge ? (
              <div style={{ fontSize: 9, color: tierBadge.color, marginTop: 2 }}>{tierBadge.symbol} {tierBadge.label}</div>
            ) : (
              <div className="text-muted" style={{ fontSize: 9, marginTop: 2 }}>Free rider</div>
            )}
          </div>

          {/* Links */}
          <Link href="/profile"
            className="flex items-center gap-2 px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            My Timeline
          </Link>
          <Link href="/account/membership"
            className="flex items-center gap-2 px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Membership
          </Link>

          {/* Divider + membership CTA or token status */}
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
        </div>
      )}
    </div>
  )

  return (
    <nav className="border-b border-border-default bg-bg-nav sticky top-0 z-50">
      {/* Desktop: single row */}
      <div className="hidden md:flex max-w-5xl mx-auto px-4 items-center h-14 gap-6">
        <Link href="/" className="font-semibold text-foreground tracking-tight flex items-center gap-2 flex-shrink-0">
          <span className="text-blue-400">⬡</span>
          <span>Lineage</span>
        </Link>
        <div className="flex items-center gap-1">
          {ALL_NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={navLinkClass(href, path, isActive(href, path))}>
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <ThemeToggle />
          {avatarDropdown}
        </div>
      </div>

      {/* Mobile: two rows */}
      <div className="md:hidden">
        {/* Row 1: logo + primary nav + avatar */}
        <div className="flex items-center h-12 px-3 gap-2">
          <Link href="/" className="font-semibold text-foreground tracking-tight flex items-center gap-1.5 flex-shrink-0 mr-1">
            <span className="text-blue-400">⬡</span>
            <span>Lineage</span>
          </Link>
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            {PRIMARY_NAV.map(({ href, label }) => (
              <Link key={href} href={href} className={cn(
                "px-2 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                isActive(href, path)
                  ? "bg-surface-active text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              )}>
                {label}
              </Link>
            ))}
          </div>
          {avatarDropdown}
        </div>

        {/* Row 2: secondary nav + theme toggle */}
        <div className="flex items-center px-3 pb-1.5 border-t border-border-default/50 pt-1">
          <div className="flex items-center gap-0.5 flex-1">
            {SECONDARY_NAV.map(({ href, label }) => (
              <Link key={href} href={href} className={cn(
                "px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap",
                isActive(href, path)
                  ? "bg-surface-active text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              )}>
                {label}
              </Link>
            ))}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
