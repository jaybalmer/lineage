"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { communityLabel } from "@/lib/community"
import type { Community, SchemaNoun } from "@/types"

interface CategoryRowProps {
  communitySlug: string
  pathname: string
  activeCommunity: Community | undefined
}

const CATEGORIES: SchemaNoun[] = ["stories", "people", "places", "events", "boards", "brands"]

/**
 * Category row: Stories / People (or community noun_map override) / Places /
 * Events / Boards / Brands. Labels resolve per-community via communityLabel();
 * at global scope activeCommunity is undefined so the global fallback labels show.
 * Person nodes live at the top-level /people route (PB-008); the rest are
 * community-scoped.
 */
export function CategoryRow({ communitySlug, pathname, activeCommunity }: CategoryRowProps) {
  return (
    <div className="flex items-center px-4 gap-1 overflow-x-auto py-1.5 scrollbar-none">
      {CATEGORIES.map((noun) => {
        const href = noun === "people" ? "/people" : `/${communitySlug}/${noun}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={noun}
            href={href}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap",
              active
                ? "bg-surface-active text-foreground"
                : "text-muted hover:text-foreground hover:bg-surface-hover",
            )}
          >
            {communityLabel(noun, activeCommunity)}
          </Link>
        )
      })}
    </div>
  )
}
