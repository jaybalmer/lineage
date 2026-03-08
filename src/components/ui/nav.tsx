"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getPersonById } from "@/lib/mock-data"

const NAV_ITEMS = [
  { href: "/profile", label: "Profile" },
  { href: "/events", label: "Events" },
  { href: "/boards", label: "Boards" },
  { href: "/places", label: "Places" },
  { href: "/connections", label: "Connections" },
]

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

  return (
    <nav className="border-b border-[#2a2a2a] bg-[#0d0d0d] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14 gap-8">
        <Link href="/" className="font-semibold text-white tracking-tight flex items-center gap-2">
          <span className="text-blue-400">⬡</span>
          <span>Lineage</span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                (href === "/profile" ? path === "/profile" || path.startsWith("/profile/") : path.startsWith(href))
                  ? "bg-[#1e1e1e] text-white"
                  : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/profile">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
              {initial}
            </div>
          </Link>
        </div>
      </div>
    </nav>
  )
}
