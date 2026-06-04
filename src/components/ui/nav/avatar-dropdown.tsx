"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CommunityLink } from "@/components/ui/community-link"
import { getInitials } from "@/components/ui/rider-avatar"
import { useLineageStore } from "@/store/lineage-store"
import { useTheme } from "@/lib/theme"
import { supabase } from "@/lib/supabase"

const TIER_BADGE: Record<string, { label: string; color: string; symbol: string }> = {
  annual:   { label: "MEMBER",      color: "#f59e0b", symbol: "◈" },
  lifetime: { label: "LIFETIME",    color: "#8b5cf6", symbol: "◆" },
  founding: { label: "FOUNDING ✦",  color: "#f59e0b", symbol: "✦" },
}

export interface AvatarDropdownProps {
  displayName:     string
  tier:            string
  totalTokens:     number
  pendingTagCount: number
  isEditor:        boolean
}

/**
 * Avatar button + dropdown. Absorbs the "me" lenses (Compare, Connections),
 * the theme toggle, and the editor link off the main nav rows (D6). Its own ref
 * and state keep each rendered instance isolated.
 */
export function AvatarDropdown({ displayName, tier, totalTokens, pendingTagCount, isEditor }: AvatarDropdownProps) {
  const path   = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const ref       = useRef<HTMLDivElement>(null)
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
        className="flex items-center gap-1.5 rounded-full focus:outline-none relative"
        aria-label="User menu"
      >
        <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center text-xs font-semibold text-background hover:bg-foreground/80 transition-colors">
          {getInitials(displayName || "?")}
        </div>
        {pendingTagCount > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-blue-600 text-white"
            style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}
            aria-label={`${pendingTagCount} pending tags`}
          >
            {pendingTagCount > 99 ? "99+" : pendingTagCount}
          </span>
        )}
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
          style={{ fontFamily: "var(--font-body)" }}
        >
          {/* Name + tier */}
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

          {/* My Timeline */}
          <CommunityLink href="/profile"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            My Timeline
          </CommunityLink>

          {/* Tags */}
          <Link href="/me/tags"
            className="flex items-center justify-between px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            <span>Tags</span>
            {pendingTagCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white"
                style={{ fontSize: 9, fontWeight: 700 }}
              >
                {pendingTagCount > 99 ? "99+" : pendingTagCount}
              </span>
            )}
          </Link>

          {/* Compare (global) */}
          <Link href="/compare"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Compare
          </Link>

          {/* Connections (global, cross-community) */}
          <Link href="/me/connections"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Connections
          </Link>

          <div className="border-t border-border-default" />

          {/* Membership management (always reachable) */}
          <Link href="/account/membership"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Membership
          </Link>

          {/* Tier-conditional upsell / token balance */}
          {tier === "free" ? (
            <Link href="/membership"
              className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors"
              style={{ fontSize: 10, color: "#f59e0b" }}>
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

          {/* Theme toggle (in-dropdown; replaces the old row-1 standalone toggle) */}
          <button
            type="button"
            onClick={toggle}
            className="w-full flex items-center justify-between px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}
          >
            <span>Theme</span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-sm leading-none">{theme === "dark" ? "☾" : "☀"}</span>
              {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>

          {/* Editor (catalog editors only) */}
          {isEditor && (
            <Link href="/admin"
              className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              style={{ fontSize: 11 }}>
              Editor
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
