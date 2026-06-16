"use client"

// PB-010A Phase 3: the chromeless /t/[slug] view switch.
//
// Holds both server-resolved payloads (timeline + stack) so the visitor can
// toggle between views with zero reload / refetch (acceptance §3). Resolution
// order for the initial view is decided server-side in page.tsx (?view= →
// public_timeline_default_view → owner-type default), and clamped to timeline
// whenever the owner has not curated any stack entries — that protects every
// Phase 2 link and never shows an empty stack. On phones (<480px) the stack is
// auto-preferred regardless of the owner setting (the supplement's IG-bio rule),
// but only when there is a stack to show and the visitor did not explicitly ask
// for the timeline.
//
// The timeline branch reproduces the Phase 2 screen verbatim (light .postcard
// ground); the stack branch is the dark-ground curated list. Store-free: both
// renderers take server-resolved payloads.

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { PublicTimeline } from "@/components/public-timeline/public-timeline"
import { StackView } from "@/components/public-timeline/stack-view"
import { StackHeader, StackViewControls } from "@/components/public-timeline/stack-header"
import type { PublicTimelinePayload, PublicStackPayload } from "@/lib/public-timeline-read"

type StackView = "stack" | "timeline"

function locationLine(region: string | null, country: string | null): string {
  return [region, country].filter(Boolean).join(", ")
}

// Subscribe to the <480px breakpoint as an external store. getServerSnapshot
// returns false so SSR + hydration render the server-decided view; the real
// match applies right after hydration (no mismatch, no setState-in-effect).
function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(max-width: 479px)")
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(max-width: 479px)").matches,
    () => false,
  )
}

export function PublicProfileView({
  timeline, stack, initialView, lockTimeline,
}: {
  timeline: PublicTimelinePayload
  stack: PublicStackPayload
  initialView: StackView
  /** true when the visitor arrived with ?view=timeline — suppresses the mobile auto-stack. */
  lockTimeline: boolean
}) {
  const canStack = stack.entries.length > 0
  const isNarrow = useIsNarrow()
  // A manual toggle wins (in-memory only, per D5); otherwise follow the
  // server-decided view, but prefer the stack on phones (the IG-bio rule) when
  // there is one to show and the visitor did not ask for the timeline.
  const [manualView, setManualView] = useState<StackView | null>(null)
  const autoView: StackView = isNarrow && canStack && !lockTimeline ? "stack" : initialView
  let view = manualView ?? autoView
  if (view === "stack" && !canStack) view = "timeline" // never show an empty stack
  const setView = (v: StackView) => setManualView(v)

  const { owner } = timeline

  if (view === "stack" && canStack) {
    return (
      <div className="min-h-screen w-full" style={{ background: "#1C1917" }}>
        <main className="mx-auto max-w-xl px-4 py-8 sm:py-10">
          <StackHeader owner={owner} view={view} onView={setView} showToggle />
          <StackView entries={stack.entries} />

          <footer className="mt-12 pt-6 border-t border-white/10 flex flex-col items-center gap-3 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-white/55 hover:text-white transition-colors" aria-label="Linestry home">
              <BrandMark size={18} color="#ffffff" />
              <span className="text-xs font-medium">Powered by Linestry</span>
            </Link>
            <Link href="/" className="text-xs font-semibold text-white/80 hover:text-white">
              Claim your spot in the graph →
            </Link>
          </footer>
        </main>
      </div>
    )
  }

  // ── Timeline view (Phase 2 screen, unchanged) ──
  const loc = locationLine(owner.region, owner.country)
  const eraLine = owner.era_start ? `Snowboarding since ${owner.era_start}` : null
  const subline = [eraLine, loc].filter(Boolean).join(" · ")

  return (
    <div className="postcard min-h-screen w-full">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        {(canStack) && (
          <div className="flex justify-end mb-6">
            <StackViewControls view={view} onView={setView} showToggle variant="light" />
          </div>
        )}

        {/* Owner hero */}
        <header className="mb-10 flex items-start gap-4">
          {owner.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.avatar_url}
              alt={owner.display_name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0 border border-default"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white">
              {owner.display_name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {owner.display_name}
            </h1>
            {subline && <p className="mt-1.5 text-sm text-muted">{subline}</p>}
            {owner.bio && (
              <p className="mt-3 text-sm font-light leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {owner.bio}
              </p>
            )}
          </div>
        </header>

        {/* Read-only timeline */}
        <PublicTimeline payload={timeline} />

        {/* Attribution footer */}
        <footer className="mt-16 border-t border-default pt-6 flex flex-col items-center gap-3 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors" aria-label="Linestry home">
            <BrandMark size={18} color="#3b82f6" />
            <span className="text-xs font-medium">Powered by Linestry</span>
          </Link>
          <Link href="/" className="text-xs text-accent-strong hover:underline">
            Start your own timeline →
          </Link>
        </footer>
      </main>
    </div>
  )
}
