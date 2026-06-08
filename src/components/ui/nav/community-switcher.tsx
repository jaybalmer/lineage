"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { CommunityAvatarPill } from "@/components/ui/nav/community-avatar-pill"
import type { Community } from "@/types"

interface CommunitySwitcherProps {
  activeCommunitySlug: string
  communities: Community[]
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 12 12" fill="none"
      className={cn("transition-transform", open && "rotate-180")}
      aria-hidden="true"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Community switcher: the dot affordance in the title row plus its dropdown.
 * Lists active communities (sort_order asc) and coming-soon communities (muted,
 * not clickable). Own ref + state, closes on outside click and route change,
 * matching the AvatarDropdown pattern.
 */
export function CommunitySwitcher({ activeCommunitySlug, communities }: CommunitySwitcherProps) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)

  const inCommunity =
    path === `/${activeCommunitySlug}` || path.startsWith(`/${activeCommunitySlug}/`)

  useEffect(() => { setOpen(false) }, [path])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const sorted     = [...communities].sort((a, b) => a.sort_order - b.sort_order)
  const active     = sorted.filter((c) => c.status === "active")
  const comingSoon = sorted.filter((c) => c.status === "coming_soon")

  // Only disambiguate type when the visible list actually mixes types.
  const showTypePill = new Set(communities.map((c) => c.type)).size > 1

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Switch community"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors",
          open
            ? "bg-accent text-white"
            : "bg-surface-active text-muted hover:text-foreground",
        )}
      >
        <Chevron open={open} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-[260px] bg-surface border border-border-default rounded-xl shadow-lg overflow-hidden z-50"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <div className="max-h-[400px] overflow-y-auto py-1">
            {active.length > 1 && (
              <div className="px-4 pt-2 pb-1 text-[9px] uppercase tracking-wider text-muted">
                My communities
              </div>
            )}
            {active.map((c) => {
              const isCurrent = c.slug === activeCommunitySlug && inCommunity
              return (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-hover transition-colors"
                >
                  <CommunityAvatarPill community={c} size="md" />
                  <span className="flex-1 truncate text-foreground" style={{ fontSize: 12 }}>{c.name}</span>
                  {showTypePill && (
                    <span className="text-[9px] uppercase tracking-wider text-muted">{c.type}</span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] uppercase tracking-wider text-accent-strong">current</span>
                  )}
                </Link>
              )
            })}

            {comingSoon.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[9px] uppercase tracking-wider text-muted">
                  Coming soon
                </div>
                {/* TODO post-launch: coming-soon community rows should become clickable, opening a
                    waitlist signup flow (gated on a real second community nearing launch).
                    Currently render-only. */}
                {comingSoon.map((c) => (
                  <div
                    key={c.slug}
                    className="flex items-center gap-2.5 px-4 py-2 opacity-40 cursor-default"
                  >
                    <CommunityAvatarPill community={c} size="md" />
                    <span className="flex-1 truncate text-foreground" style={{ fontSize: 12 }}>{c.name}</span>
                    <span className="text-[9px] uppercase tracking-wider text-muted">soon</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {inCommunity && (
            <>
              <div className="border-t border-border-default" />
              <Link
                href="/"
                className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                style={{ fontSize: 11 }}
              >
                Back to Linestry (global)
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
