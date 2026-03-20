"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

const FEATURES = [
  {
    icon: "📍",
    title: "Map your personal timeline",
    desc: "Log every place, event, person, and piece of gear that shaped your journey. A meaningful record of your history inside the community — from your first day to where you are now.",
    accent: "border-blue-700",
  },
  {
    icon: "✕",
    title: "Find where your lines cross",
    desc: "Same mountain in '04? Same event the year everything changed? Lineage surfaces the unexpected overlaps — events, places, and moments you shared with people you didn't know you had history with.",
    accent: "border-violet-700",
  },
  {
    icon: "🌍",
    title: "Build collective timelines",
    desc: "Individual timelines weave together into a shared community history. The more people contribute, the richer and more trusted the collective record becomes.",
    accent: "border-emerald-700",
  },
  {
    icon: "💛",
    title: "Community economies",
    desc: "Revenue shared with contributors, creators, and members. The people who build the history share in the value it creates.",
    accent: "border-amber-700",
  },
]

// Inline SVG timeline — mirrors the logo's ○──○──○──○──○──○──○ motif
function TimelineNodes() {
  return (
    <svg
      viewBox="0 0 520 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[520px] mx-auto"
      aria-hidden="true"
    >
      <line x1="0" y1="18" x2="520" y2="18" stroke="currentColor" strokeWidth="2.5" className="text-foreground opacity-20" />
      {[26, 112, 198, 260, 322, 408, 494].map((cx) => (
        <circle key={cx} cx={cx} cy={18} r={9} stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-foreground opacity-30" />
      ))}
    </svg>
  )
}

export default function Home() {
  const { activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const [browseHref, setBrowseHref] = useState<string>("/riders")

  // Find the rider with the most claims to use as the Browse destination
  useEffect(() => {
    supabase
      .from("claims")
      .select("subject_id")
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const counts: Record<string, number> = {}
        for (const row of data) {
          if (row.subject_id) counts[row.subject_id] = (counts[row.subject_id] ?? 0) + 1
        }
        const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (topId) setBrowseHref(`/riders/${topId}`)
      })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">

        {/* Wordmark */}
        <div className="mb-8">
          <div
            className="font-black text-foreground leading-none tracking-tight select-none"
            style={{ fontSize: "clamp(4rem, 14vw, 8rem)", letterSpacing: "-0.02em" }}
          >
            LINEAGE
          </div>
          <TimelineNodes />
        </div>

        {/* Headline */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-5 mt-8">
          Collective timelines for communities
        </h1>

        {/* Body */}
        <p className="text-muted text-base leading-relaxed max-w-xl mx-auto mb-10">
          Lineage is a new kind of social platform where people build personal timelines
          of their experiences, and together those timelines form a collective timeline
          that connects us.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAuth ? (
            <Link
              href="/profile"
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
            >
              My Profile →
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
            >
              Start Your Timeline →
            </Link>
          )}
          <Link
            href={browseHref}
            className="w-full sm:w-auto px-8 py-3 rounded-xl border border-border-default text-muted font-semibold text-sm hover:border-border-default hover:text-foreground transition-colors"
          >
            Browse
          </Link>
        </div>

      </div>

      <div className="max-w-3xl mx-auto px-6 pb-4 text-center">
        <p className="text-foreground text-sm font-semibold">
          Every community has a history. Lineage helps you map it.
        </p>
      </div>

      {/* Feature cards — postcard style */}
      <div className="max-w-3xl mx-auto px-6 pb-6">
        <div className="flex flex-col gap-4">

          {/* Snowboarding community card — always first */}
          <div className="postcard bg-surface border-2 rounded-xl p-5 border-zinc-600">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">🏂</span>
              <div>
                <div className="text-[10px] font-mono text-muted mb-1 tabular-nums">00</div>
                <div className="text-sm font-bold text-foreground leading-snug mb-2">Starting with snowboarding</div>
                <div className="text-muted text-sm leading-relaxed">The first community on Lineage. More communities coming soon.</div>
              </div>
            </div>
          </div>

          {FEATURES.map(({ icon, title, desc, accent }, i) => (
            <div
              key={title}
              className={cn("postcard bg-surface border-2 rounded-xl p-5", accent)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{icon}</span>
                <div>
                  <div className="text-[10px] font-mono text-muted mb-1 tabular-nums">
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

      {/* Footer */}
      <div className="text-center py-10">
        <p className="text-muted text-xs">
          Lineage Community Technologies Ltd.
        </p>
      </div>
    </div>
  )
}
