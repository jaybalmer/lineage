"use client"

// PB-010A Phase 3: the Stack View identity block + the chromeless share control.
//
// StackHeader is the Campsite-style identity block that sits above the curated
// stack on the dark ground: avatar, name, tagline, an era chip ("Snowboarding
// since 1983" — the differentiator the supplement calls out) and a location
// chip. Store-free; fed the resolved owner header from the public read. The
// Stack/Timeline toggle + brand mark now live in the page's top bar
// (public-profile-view), not in this header.
//
// StackViewControls bundles that toggle with the Share button for the chromeless
// /t/ page. The toggle itself is the shared StackTimelineToggle so it stays
// consistent with the in-app profile page; "Timeline" navigates to the full
// profile rather than switching an in-page view.

import { useState } from "react"
import type { PublicTimelineOwner } from "@/lib/public-timeline-read"
import { StackTimelineToggle } from "@/components/public-timeline/stack-timeline-toggle"
import { cn } from "@/lib/utils"

export function StackViewControls({
  timelineHref,
  variant,
}: {
  /** Full-profile URL the "Timeline" segment navigates to. */
  timelineHref: string
  variant: "light" | "dark"
}) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    if (!url) return
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ url }); return } catch { /* cancelled → fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked; nothing to do */ }
  }

  const dark = variant === "dark"

  return (
    <div className="flex items-center gap-2">
      <StackTimelineToggle active="stack" timelineHref={timelineHref} variant={variant} />
      <button
        onClick={share}
        aria-label="Share this page"
        className={cn(
          "inline-flex items-center justify-center h-8 px-3 rounded-full text-[11px] font-semibold border transition-colors",
          dark
            ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
            : "border-border-default bg-surface text-muted hover:text-foreground",
        )}
      >
        {copied ? "Copied" : "Share ↗"}
      </button>
    </div>
  )
}

export function StackHeader({ owner }: { owner: PublicTimelineOwner }) {
  const tagline = owner.bio ? owner.bio.split("\n")[0] : null
  const location = [owner.region, owner.country].filter(Boolean).join(", ")

  return (
    <header className="mb-6">
      <div className="flex flex-col items-center text-center">
        {owner.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={owner.avatar_url}
            alt={owner.display_name}
            className="w-20 h-20 rounded-full object-cover border-2 border-white/15"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white border-2 border-white/15"
            style={{ background: "radial-gradient(circle at 30% 30%, #8B5CF6, #5B21B6 60%, #3730A3)" }}
          >
            {owner.display_name[0]?.toUpperCase() ?? "?"}
          </div>
        )}

        <h1
          className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {owner.display_name}
        </h1>
        {tagline && <p className="mt-1 text-sm text-white/55 max-w-md">{tagline}</p>}

        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          {owner.era_start && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/8 border border-white/12 text-[11px] font-medium uppercase tracking-wider text-white/80">
              <span className="w-1 h-1 rounded-full bg-white/70" />
              Snowboarding since {owner.era_start}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/8 border border-white/12 text-[11px] font-medium text-white/70">
              {location}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
