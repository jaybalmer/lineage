"use client"

// PB-010 cleanup: the chromeless /t/[slug] surface.
//
// /t/[slug] is the curated **Stack** — the shareable public card. Its sibling
// view, the full timeline, now lives at the in-app profile page /people/[id],
// so the "Timeline" toggle navigates there instead of switching an in-page
// renderer (the two views are two URLs). A top bar carries the Linestry mark
// (a path back into the platform) on the left and the Stack/Timeline toggle +
// Share on the right.
//
// Owners with no curated stack fall back to the read-only chromeless timeline
// (the Phase 2 screen, story-first, light .postcard ground) so the page is
// never empty; that fallback shows the mark but no toggle (there is no stack to
// toggle to). Store-free: both renderers take server-resolved payloads.

import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { PublicTimeline } from "@/components/public-timeline/public-timeline"
import { StackView } from "@/components/public-timeline/stack-view"
import { StackHeader, StackViewControls } from "@/components/public-timeline/stack-header"
import type { PublicTimelinePayload, PublicStackPayload } from "@/lib/public-timeline-read"

function locationLine(region: string | null, country: string | null): string {
  return [region, country].filter(Boolean).join(", ")
}

// Brand mark + wordmark, linking home — the path back into the platform from
// the chromeless page (top-left of the top bar).
function BrandHome({ variant }: { variant: "light" | "dark" }) {
  const dark = variant === "dark"
  return (
    <Link
      href="/"
      aria-label="Linestry home"
      className={dark
        ? "inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        : "inline-flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"}
    >
      <BrandMark size={22} color={dark ? "#ffffff" : "#3b82f6"} />
      <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Linestry
      </span>
    </Link>
  )
}

export function PublicProfileView({
  timeline, stack,
}: {
  timeline: PublicTimelinePayload
  stack: PublicStackPayload
}) {
  const { owner } = timeline
  const canStack = stack.entries.length > 0
  // Resolve to the canonical UUID; /people/[id] rewrites the address bar to the
  // name slug client-side (collision-safe), so we never risk landing a visitor
  // on the wrong profile by guessing a slug here.
  const profileHref = `/people/${owner.id}`

  if (canStack) {
    return (
      <div className="min-h-screen w-full" style={{ background: "#1C1917" }}>
        <main className="mx-auto max-w-xl px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <BrandHome variant="dark" />
            <StackViewControls timelineHref={profileHref} variant="dark" />
          </div>

          <StackHeader owner={owner} />
          <StackView
            entries={stack.entries}
            owner={owner}
            stories={timeline.stories}
            entities={timeline.entities}
          />

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

  // ── Timeline fallback (stackless owner): Phase 2 screen on the light ground ──
  const loc = locationLine(owner.region, owner.country)
  const eraLine = owner.era_start ? `Snowboarding since ${owner.era_start}` : null
  const subline = [eraLine, loc].filter(Boolean).join(" · ")

  return (
    <div className="postcard min-h-screen w-full">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-8">
          <BrandHome variant="light" />
        </div>

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
