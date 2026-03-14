"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getPersonById } from "@/lib/mock-data"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const PRIMARY_NAV = [
  { href: "/profile", label: "Profile" },
  { href: "/compare", label: "Compare" },
  { href: "/connections", label: "Connections" },
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
  const { activePersonId, profileOverride, loadDbEntities } = useLineageStore()
  const basePerson = getPersonById(activePersonId)
  const loadedForId = useRef<string | null>(null)

  // Load shared entity catalog + riding days once per auth session
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    if (loadedForId.current === activePersonId) return
    loadedForId.current = activePersonId
    loadDbEntities()
  }, [activePersonId, loadDbEntities])
  const displayName = profileOverride.display_name ?? basePerson?.display_name ?? ""
  const initial = displayName[0]?.toUpperCase() ?? "?"

  const avatarLink = (
    <Link href="/profile">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white hover:bg-blue-500 transition-colors flex-shrink-0">
        {initial}
      </div>
    </Link>
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
          {avatarLink}
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
          {avatarLink}
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
