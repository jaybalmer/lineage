"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const ITEMS: { href: string; label: string }[] = [
  { href: "/me/tags",           label: "Tags"     },
  { href: "/me/settings/trust", label: "Trusted"  },
  { href: "/me/settings/blocks",label: "Blocked"  },
]

export function MeSubNav({ pendingTagCount }: { pendingTagCount?: number }) {
  const path = usePathname()
  return (
    <div className="border-b border-border-default bg-surface">
      <div className="max-w-5xl mx-auto flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-none">
        {ITEMS.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/")
          const showBadge = item.href === "/me/tags" && (pendingTagCount ?? 0) > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap flex items-center gap-1.5",
                active
                  ? "bg-surface-active text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface-hover",
              )}
            >
              <span>{item.label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                  {pendingTagCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
