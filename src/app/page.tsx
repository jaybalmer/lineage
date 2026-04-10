"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { cn, nameToSlug } from "@/lib/utils"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { COMMUNITY_SLUGS } from "@/lib/community"

/** Community dot colors — gold for active, muted for coming soon */
const COMMUNITY_DOT_COLOR: Record<string, string> = {
  snowboarding: "#B8862A",
  surf: "#78716C",
  skate: "#78716C",
  ski: "#78716C",
  mtb: "#78716C",
}

/** Fallback community list used before catalog loads */
const FALLBACK_COMMUNITIES = [
  { slug: "snowboarding",  name: "Snowboarding",     emoji: "🏂", status: "active" },
  { slug: "surf",          name: "Surf",             emoji: "🏄", status: "coming_soon" },
  { slug: "skate",         name: "Skateboarding",    emoji: "🛹", status: "coming_soon" },
  { slug: "ski",           name: "Skiing",           emoji: "⛷️", status: "coming_soon" },
  { slug: "mtb",           name: "Mountain Biking",  emoji: "🚵", status: "coming_soon" },
] as const

const FEATURES = [
  {
    icon: "📍",
    title: "Map your personal timeline",
    desc: "Log every place, event, person, and piece of gear that shaped your journey. A meaningful record of your history inside the community.",
    accent: "border-blue-700",
  },
  {
    icon: "✕",
    title: "Find where your lines cross",
    desc: "Same mountain in '04? Same event the year everything changed? Lineage surfaces the unexpected overlaps you didn't know you had.",
    accent: "border-violet-700",
  },
  {
    icon: "🌍",
    title: "Build collective timelines",
    desc: "Individual timelines weave together into a shared community history. The more people contribute, the richer the collective record becomes.",
    accent: "border-emerald-700",
  },
  {
    icon: "💛",
    title: "Community economies",
    desc: "Revenue shared with contributors, creators, and members. The people who build the history share in the value it creates.",
    accent: "border-amber-700",
  },
]

export default function Home() {
  const { activePersonId, communities: storeCommunities } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const [browseHref, setBrowseHref] = useState<string>("/riders")

  // Use store communities if loaded, otherwise fallback
  const communities = storeCommunities.length > 0
    ? storeCommunities
    : FALLBACK_COMMUNITIES

  // Find the rider with the most claims for the browse link
  useEffect(() => {
    supabase
      .from("claims")
      .select("subject_id")
      .then(async ({ data }) => {
        if (!data || data.length === 0) return
        const counts: Record<string, number> = {}
        for (const row of data) {
          if (row.subject_id) counts[row.subject_id] = (counts[row.subject_id] ?? 0) + 1
        }
        const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (!topId) return
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", topId)
          .single()
        if (profile?.display_name) {
          setBrowseHref(`/riders/${nameToSlug(profile.display_name)}`)
        } else {
          setBrowseHref(`/riders/${topId}`)
        }
      })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="mb-8 select-none">
          <div
            className="font-bold text-foreground leading-none tracking-tight"
            style={{ fontSize: "clamp(4rem, 14vw, 7.5rem)", letterSpacing: "-0.03em" }}
          >
            Lineage<span className="inline-block rounded-full bg-[#B8862A]" style={{ width: "0.3em", height: "0.3em", verticalAlign: "baseline", marginLeft: "0.04em" }} />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-5 mt-8">
          Collective timelines for communities
        </h1>

        <p className="text-muted text-base leading-relaxed max-w-xl mx-auto mb-6">
          Lineage is a new kind of social platform where people build personal timelines
          of their experiences, and together those timelines form a collective record
          that connects us.
        </p>
      </div>

      {/* Community cards */}
      <div className="max-w-3xl mx-auto px-6 pb-6">
        <div className="flex flex-col gap-3">
          {communities.map((comm) => {
            const isActive = comm.status === "active"
            return (
              <div
                key={comm.slug}
                className={cn(
                  "relative rounded-xl border-2 p-5 transition-all",
                  isActive
                    ? "bg-surface border-foreground/20 hover:border-foreground/40"
                    : "bg-surface/50 border-border-default/50 opacity-60"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Marker dot */}
                  {isActive ? (
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: COMMUNITY_DOT_COLOR[comm.slug] ?? "#B8862A" }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex-shrink-0 mt-0.5 bg-muted/20 border border-border-default" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground text-lg leading-snug">
                        {comm.name}
                      </span>
                      {!isActive && (
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted px-2 py-0.5 rounded-full bg-surface-hover border border-border-default">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <div className="text-muted text-sm font-mono">
                      lineage.wtf/<span className="text-foreground">{comm.slug}</span>
                    </div>

                    {/* CTAs — only for active communities */}
                    {isActive && (
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        {isAuth ? (
                          <Link
                            href={`/${comm.slug}/profile`}
                            className="px-5 py-2 rounded-lg bg-[#1C1917] text-[#F5F2EE] font-semibold text-xs hover:bg-[#292524] transition-colors"
                          >
                            My Timeline
                          </Link>
                        ) : (
                          <Link
                            href="/onboarding"
                            className="px-5 py-2 rounded-lg bg-[#1C1917] text-[#F5F2EE] font-semibold text-xs hover:bg-[#292524] transition-colors"
                          >
                            Start Your Timeline
                          </Link>
                        )}
                        <Link
                          href={`/${comm.slug}`}
                          className="px-5 py-2 rounded-lg border border-border-default text-muted font-semibold text-xs hover:text-foreground hover:border-foreground/30 transition-colors"
                        >
                          Browse
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tagline */}
      <div className="max-w-3xl mx-auto px-6 py-6 text-center">
        <p className="text-foreground text-xl font-semibold italic leading-snug">
          Every community has a history.<br />
          Lineage helps map it.
        </p>
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
