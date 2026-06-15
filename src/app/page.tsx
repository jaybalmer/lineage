"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { EQUITY_POOL_SHARES } from "@/lib/equity-offer"

const FEATURES = [
  {
    icon: "📍",
    title: "Map your timeline",
    desc: "Log the places, boards, events and people that shaped your journey.",
    accent: "border-blue-700",
  },
  {
    icon: "✕",
    title: "Find where lines cross",
    desc: "Discover where your timeline overlaps with other people who share the same stories.",
    accent: "border-violet-700",
  },
  {
    icon: "🌍",
    title: "Build the collective timeline",
    desc: "Individual timelines weave into a shared community history. The more people add, the more complete the linestry becomes.",
    accent: "border-emerald-700",
  },
]

export default function Home() {
  const { activePersonId } = useLineageStore()
  const communities = useLineageStore((s) => s.communities)
  const isAuth = isAuthUser(activePersonId)
  // Single-community launch: homepage banner reads snowboarding.
  const banner = communities.find((c) => c.slug === "snowboarding")?.landing_banner_url

  return (
    // Landing page is always dark, regardless of the theme toggle. The .dark
    // wrapper re-scopes the theme tokens for this whole subtree (incl. Nav).
    <div className="dark min-h-screen bg-background text-foreground">
      <Nav />

      {/* Full-width banner band. No text overlaid on the photo, so no scrim. */}
      {banner && (
        <div className="w-full h-44 sm:h-56 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Hero */}
      <div className={cn("max-w-3xl mx-auto px-6 pb-10 text-center", banner ? "pt-10" : "pt-20")}>
        <div className="mb-8 select-none">
          <div
            className="font-bold text-foreground leading-none tracking-tight"
            style={{ fontSize: "clamp(4rem, 14vw, 7.5rem)", letterSpacing: "-0.03em" }}
          >
            <Link href="/word" className="inline-block hover:opacity-90 transition-opacity" aria-label="Linestry, see the definition">
              <span style={{ fontFamily: "var(--font-wordmark)" }}>Linestry</span><span className="inline-block rounded-full bg-accent" style={{ width: "0.3em", height: "0.3em", verticalAlign: "baseline", marginLeft: "0.04em" }} />
            </Link>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-5 mt-8 max-w-2xl mx-auto">
          Our history is real, but scattered. Let&rsquo;s weave our stories together.
        </h1>

        <p className="text-muted text-base leading-relaxed max-w-xl mx-auto">
          Our stories, crews, and events are scattered across social feeds and fading
          memories. Linestry is where your story gets kept, and our individual timelines
          get woven together into our community story.
        </p>
      </div>

      {/* Snowboarding focus + primary CTAs */}
      <div className="max-w-3xl mx-auto px-6 pb-8">
        <div className="rounded-2xl border-2 border-foreground/20 bg-surface p-6 sm:p-8 text-center">
          <p className="text-foreground text-lg font-semibold leading-snug mb-3">
            Linestry is starting with the snowboarding community to bring our stories together.
          </p>
          <p className="text-muted text-base leading-relaxed max-w-xl mx-auto mb-6">
            Add your stories, your boards, the places you rode and the people you ride
            with. Build your timeline, and help build the linestry of snowboarding.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isAuth ? (
              <Link
                href="/snowboarding/profile"
                className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
              >
                My Timeline
              </Link>
            ) : (
              <Link
                href="/onboarding"
                className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
              >
                Start Your Timeline
              </Link>
            )}
            <Link
              href="/snowboarding"
              className="px-6 py-2.5 rounded-lg border border-border-default text-muted font-semibold text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Browse Snowboarding
            </Link>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="max-w-3xl mx-auto px-6 pb-6">
        <div className="flex flex-col gap-4">
          {FEATURES.map(({ icon, title, desc, accent }, i) => (
            <div
              key={title}
              className={cn("postcard bg-surface border-2 rounded-xl p-5", accent)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{icon}</span>
                <div>
                  <div className="text-[10px] text-muted mb-1 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="text-sm font-bold text-foreground leading-snug mb-2">{title}</div>
                  <div className="text-muted text-sm leading-relaxed">{desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Equity teaser: visible to everyone (auth + logged out). Surfaces the
          offer that otherwise only lives behind /membership. */}
      <div className="max-w-3xl mx-auto px-6 pb-10">
        <p className="text-center text-muted text-sm leading-relaxed">
          Free riders earn a share of a {EQUITY_POOL_SHARES.toLocaleString()} share pool, just by adding history.{" "}
          <Link href="/equity" className="text-accent-strong font-semibold hover:underline">
            See how it works
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div className="text-center py-10">
        <p className="text-muted text-xs">
          Lineage Community Technologies Inc.
        </p>
      </div>
    </div>
  )
}
