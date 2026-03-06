"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/timeline", label: "My Timeline" },
  { href: "/compare", label: "Compare" },
  { href: "/connections", label: "Connections" },
  { href: "/places", label: "Places" },
  { href: "/explore", label: "Explore" },
]

export function Nav() {
  const path = usePathname()

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
                path.startsWith(href)
                  ? "bg-[#1e1e1e] text-white"
                  : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
            J
          </div>
        </div>
      </div>
    </nav>
  )
}
