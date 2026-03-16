"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

const FEATURES = [
  {
    title: "Your riding history, mapped",
    desc: "Every resort, backcountry zone, and season — logged and searchable. A personal record of where the sport took you.",
  },
  {
    title: "Who else was there",
    desc: "Rode Baldface in 2004? Baker every January for a decade? Surface connections with other riders you never knew you shared.",
  },
  {
    title: "Boards, sponsors, crews",
    desc: "The gear you rode, the brands you repped, the teams you were part of. All of it is part of the story.",
  },
  {
    title: "Yours until you say otherwise",
    desc: "Your lineage is private by default. Share it with connections, make it public, or keep it to yourself.",
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
          <div className="text-[0.7rem] font-semibold tracking-[0.35em] text-muted uppercase mt-1 mb-4">
            SNOWBOARDING
          </div>
          <TimelineNodes />
        </div>

        {/* Headline */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-5 mt-8">
          The collective timeline of snowboarding
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

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-6">
        <div className="border-t border-border-default" />
      </div>

      {/* Feature list */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="divide-y divide-[#1e1e1e]">
          {FEATURES.map(({ title, desc }, i) => (
            <div key={title} className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_11rem_1fr] gap-x-6 gap-y-1 py-6 items-baseline">
              <span className="text-[11px] text-muted font-mono pt-px">{String(i + 1).padStart(2, "0")}</span>
              <div className="text-sm font-semibold text-foreground leading-snug">{title}</div>
              <div className="col-start-2 sm:col-start-3 text-muted text-sm leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer line */}
      <div className="text-center pb-16">
        <p className="text-muted text-xs">
          Snowboarding has 40 years of history — let&apos;s map it.
        </p>
      </div>
    </div>
  )
}
